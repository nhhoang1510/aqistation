

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>
#include <HardwareSerial.h>
#include <ArduinoJson.h>
#include <FS.h>
#include <SD.h>
#include <SPI.h>
#include <esp_task_wdt.h>

// Cấu hình WiFi (hardcode)
const char* WIFI_SSID     = "TP-Link_4DDC";
const char* WIFI_PASSWORD = "00000000";

// Cấu hình AP (fallback khi không kết nối được WiFi)
const char* AP_SSID = "AQI_Station";
const char* AP_PASS = "12345678";  // Để trống "" nếu muốn AP không có mật khẩu

const char* MQTT_SERVER   = "broker.emqx.io"; 
const int   MQTT_PORT     = 1883;
const char* MQTT_USER     = "";
const char* MQTT_PASS     = "";
const char* MQTT_TOPIC    = "aqistation/data";

// Chân GPIO
#define SD_CS_PIN   5 
#define SDA_PIN    21
#define SCL_PIN    22
#define RXD1       16
#define TXD1       17
#define MQ135_PIN  34

// Cấu hình bộ lọc
#define MA_SIZE    5
#define MED_SIZE   11
#define EMA_ALPHA  0.1f

// Cấu hình FreeRTOS
#define SENSOR_READ_INTERVAL_MS  10000
#define WDT_TIMEOUT_S            30
#define WIFI_CONNECT_TIMEOUT_MS  15000

// Event Group bits: thông báo data mới cho từng consumer
#define BIT_SD_READY    (1 << 0)
#define BIT_MQTT_READY  (1 << 1)
#define BITS_ALL_READY  (BIT_SD_READY | BIT_MQTT_READY)

// Đối tượng toàn cục
WiFiClient espClient;
PubSubClient mqttClient(espClient);
Adafruit_BME680 bme(&Wire);
HardwareSerial  pmsSerial(1);

volatile bool wifi_connected = false;  // Trạng thái WiFi

volatile bool sd_ok  = false;
volatile bool bme_ok = false;

SemaphoreHandle_t dataMutex;       // Bảo vệ SharedData
SemaphoreHandle_t spiMutex;        // Bảo vệ SPI bus (SD Card)
EventGroupHandle_t dataReadyEvent; // Thông báo data mới cho SD và MQTT

// Dữ liệu dùng chung giữa các task
struct SharedData {
  float pm2_5 = 0;
  float pm10 = 0;
  float temperature = 0;
  float humidity = 0;
  float pressure = 0;
  float gas_resistance = 0;
  int   mq135_value = 0;
  int   aqi = 0;
};
SharedData systemData;



// Trung bình trượt (Moving Average) - dùng cho PM2.5, PM10
struct MovingAvg {
  uint16_t buf[MA_SIZE] = {0};
  int idx = 0;
  int count = 0;
  void push(uint16_t val) {
    buf[idx] = val;
    idx = (idx + 1) % MA_SIZE;
    if (count < MA_SIZE) count++;
  }
  float get() const {
    if (count == 0) return 0;
    float sum = 0;
    for (int i = 0; i < count; i++) sum += buf[i];
    return sum / count;
  }
};
MovingAvg ma_pm25, ma_pm10;

// Làm mượt hàm mũ (EMA) - dùng cho BME680
struct EMA {
  float value = 0;
  bool initialized = false;
  float update(float raw) {
    if (!initialized) { value = raw; initialized = true; }
    else               value = EMA_ALPHA * raw + (1.0f - EMA_ALPHA) * value;
    return value;
  }
};
EMA ema_temp, ema_hum, ema_pres, ema_gas;

// Trung vị (Median Filter) - dùng cho MQ135
struct MedianFilter {
  int buf[MED_SIZE] = {0};
  int idx = 0;
  int count = 0;
  void push(int val) {
    buf[idx] = val;
    idx = (idx + 1) % MED_SIZE;
    if (count < MED_SIZE) count++;
  }
  int get() const {
    if (count == 0) return 0;
    int tmp[MED_SIZE];
    memcpy(tmp, buf, sizeof(int) * count);
    for (int i = 1; i < count; i++) {
      int key = tmp[i], j = i - 1;
      while (j >= 0 && tmp[j] > key) { tmp[j+1] = tmp[j]; j--; }
      tmp[j+1] = key;
    }
    return tmp[count / 2];
  }
};
MedianFilter med_mq135;



int aqiFromPM25(float c) {
  const float bp[][4] = {
    {  0.0f,  12.0f,   0,  50}, { 12.1f,  35.4f,  51, 100}, { 35.5f,  55.4f, 101, 150},
    { 55.5f, 150.4f, 151, 200}, {150.5f, 250.4f, 201, 300}, {250.5f, 350.4f, 301, 400},
    {350.5f, 500.4f, 401, 500},
  };
  for (auto& b : bp) {
    if (c <= b[1]) return (int)((b[3] - b[2]) / (b[1] - b[0]) * (c - b[0]) + b[2]);
  }
  return 500;
}

int aqiFromPM10(float c) {
  const float bp[][4] = {
    {  0,  54,   0,  50}, { 55, 154,  51, 100}, {155, 254, 101, 150},
    {255, 354, 151, 200}, {355, 424, 201, 300}, {425, 504, 301, 400},
    {505, 604, 401, 500},
  };
  for (auto& b : bp) {
    if (c <= b[1]) return (int)((b[3] - b[2]) / (b[1] - b[0]) * (c - b[0]) + b[2]);
  }
  return 500;
}

int aqiFromMQ135(int analog_val) {
  if (analog_val < 800)  return map(analog_val, 0, 800, 0, 50);
  if (analog_val < 1500) return map(analog_val, 801, 1500, 51, 100);
  if (analog_val < 2500) return map(analog_val, 1501, 2500, 101, 150);
  return map(analog_val, 2501, 4095, 151, 300);
}

// Tính AQI tổng hợp: lấy giá trị cao nhất từ PM2.5, PM10 và MQ135
int calculateComprehensiveAQI(float pm25_avg, float pm10_avg, int mq135_val) {
  int a25  = aqiFromPM25(pm25_avg);
  int a10  = aqiFromPM10(pm10_avg);
  int aGas = aqiFromMQ135(mq135_val);
  return max(max(a25, a10), aGas);
}



// Khởi tạo SD Card, tạo file CSV header nếu chưa có
void initSDCard() {
  Serial.println("[SD Card] Đang khởi tạo...");
  if (xSemaphoreTake(spiMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
    if (!SD.begin(SD_CS_PIN)) {
      Serial.println("[SD Card] Khoi tao that bai!");
      sd_ok = false;
      xSemaphoreGive(spiMutex);
      return;
    }
    sd_ok = true;
    Serial.println("[SD Card] Khoi tao thanh cong!");
    
    File file = SD.open("/database.csv", FILE_READ);
    if (!file) {
      file = SD.open("/database.csv", FILE_WRITE);
      if (file) {
        file.println("timestamp_ms,pm2_5,pm10,temperature,humidity,pressure,gas_resistance,mq135,aqi");
        file.close();
      }
    } else {
      file.close();
    }
    xSemaphoreGive(spiMutex);
  }
}

// Khởi tạo BME680, quét địa chỉ I2C 0x76 và 0x77
void initBME680() {
  Wire.begin(SDA_PIN, SCL_PIN);
  delay(100);
  
  uint8_t addrs[] = {0x76, 0x77};
  for (int a = 0; a < 2 && !bme_ok; a++) {
    if (bme.begin(addrs[a])) {
      bme_ok = true;
      Serial.printf("[BME680] Tim thay tai 0x%02X\n", addrs[a]);
      bme.setTemperatureOversampling(BME680_OS_8X);
      bme.setHumidityOversampling(BME680_OS_2X);
      bme.setPressureOversampling(BME680_OS_4X);
      bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
      bme.setGasHeater(320, 150);
    }
  }
  if (!bme_ok) Serial.println("[BME680] KHONG TIM THAY CAM BIEN!");
}

// Kết nối WiFi - BLOCK cho đến khi thành công
// 1. Thử hardcode WiFi (15s)
// 2. Nếu thất bại → bật AP + thử lại WiFi liên tục cho đến khi được
void initWiFi() {
  Serial.printf("[WiFi] Đang kết nối: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  // Lần thử đầu tiên
  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - startAttempt >= WIFI_CONNECT_TIMEOUT_MS) break;
    delay(500);
    Serial.print(".");
  }
  
  // Nếu kết nối được ngay → xong
  if (WiFi.status() == WL_CONNECTED) {
    wifi_connected = true;
    Serial.printf("\n[WiFi] Kết nối thành công! IP: %s\n", WiFi.localIP().toString().c_str());
    return;
  }
  
  // Không kết nối được → bật AP + tiếp tục thử WiFi
  Serial.println("\n[WiFi] Không kết nối được! Bật AP và thử lại...");
  WiFi.disconnect(true);
  delay(200);  // Đợi status WiFi reset hoàn toàn
  WiFi.mode(WIFI_AP_STA);  // Vừa làm AP vừa thử kết nối STA
  WiFi.softAP(AP_SSID, strlen(AP_PASS) > 0 ? AP_PASS : NULL);
  
  Serial.println("============================================");
  Serial.println("[AP] CHẾ ĐỘ ACCESS POINT");
  Serial.printf( "[AP] Tên WiFi: %s\n", AP_SSID);
  if (strlen(AP_PASS) > 0) Serial.printf("[AP] Mật khẩu: %s\n", AP_PASS);
  Serial.printf( "[AP] IP: %s\n", WiFi.softAPIP().toString().c_str());
  Serial.println("[WiFi] Đang thử kết nối lại liên tục...");
  Serial.println("============================================");
  
  // Block ở đây - thử lại WiFi cho đến khi STA thực sự kết nối
  // KHÔNG dùng WiFi.status() cho vòng ngoài vì ở chế độ AP_STA,
  // nó có thể trả về WL_CONNECTED sai do AP đang hoạt động.
  while (true) {
    WiFi.disconnect(true);  // Ngắt STA cũ trước khi thử lại
    delay(200);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED) {
      if (millis() - startAttempt >= WIFI_CONNECT_TIMEOUT_MS) break;
      delay(500);
    }
    // Kiểm tra kỹ: STA phải có IP hợp lệ (không phải 0.0.0.0)
    if (WiFi.status() == WL_CONNECTED && WiFi.localIP() != IPAddress(0, 0, 0, 0)) {
      Serial.printf("\n[WiFi] STA đã có IP: %s\n", WiFi.localIP().toString().c_str());
      break;
    }
    Serial.println("[WiFi] Vẫn chưa kết nối được, thử lại sau 10 giây...");
    delay(10000);
  }
  
  // Kết nối thành công! Tắt AP
  wifi_connected = true;
  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_STA);
  Serial.printf("[WiFi] Kết nối thành công! IP: %s\n", WiFi.localIP().toString().c_str());
}



// Đọc PMS5003 qua UART: đồng bộ frame từng byte, verify checksum, cập nhật PM2.5/PM10
void taskPMS(void *pvParameters) {
  esp_task_wdt_add(NULL);
  Serial.println("[PMS5003] Task khởi động - Core " + String(xPortGetCoreID()));
  
  for (;;) {
    esp_task_wdt_reset();
    
    if (pmsSerial.available() < 1) {
      vTaskDelay(pdMS_TO_TICKS(10));
      continue;
    }
    
    // Tìm header byte 1: 0x42
    uint8_t startByte = pmsSerial.read();
    if (startByte != 0x42) continue;
    
    // Chờ header byte 2: 0x4D
    unsigned long waitStart = millis();
    while (!pmsSerial.available()) {
      if (millis() - waitStart > 100) break;
      vTaskDelay(pdMS_TO_TICKS(1));
    }
    if (!pmsSerial.available()) continue;
    
    uint8_t secondByte = pmsSerial.read();
    if (secondByte != 0x4D) continue;
    
    // Đọc 30 bytes còn lại
    uint8_t buf[30];
    waitStart = millis();
    int bytesRead = 0;
    while (bytesRead < 30) {
      if (pmsSerial.available()) {
        buf[bytesRead++] = pmsSerial.read();
      } else if (millis() - waitStart > 200) {
        break;
      } else {
        vTaskDelay(pdMS_TO_TICKS(1));
      }
    }
    if (bytesRead < 30) continue;
    
    // Verify checksum
    uint16_t checksum_received = ((uint16_t)buf[28] << 8) | buf[29];
    uint16_t checksum_calc = 0x42 + 0x4D;
    for (int i = 0; i < 28; i++) checksum_calc += buf[i];
    if (checksum_calc != checksum_received) continue;
    
    // Trích xuất PM2.5 và PM10 (atmospheric environment)
    uint16_t raw_pm25 = ((uint16_t)buf[10] << 8) | buf[11];
    uint16_t raw_pm10 = ((uint16_t)buf[12] << 8) | buf[13];
    
    // Cập nhật bộ lọc và SharedData
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
      ma_pm25.push(raw_pm25);
      ma_pm10.push(raw_pm10);
      systemData.pm2_5 = ma_pm25.get();
      systemData.pm10  = ma_pm10.get();
      xSemaphoreGive(dataMutex);
    }
    
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

// Đọc BME680 + MQ135 mỗi 10s, tính AQI, thông báo EventGroup cho SD và MQTT
void taskSensors(void *pvParameters) {
  esp_task_wdt_add(NULL);
  Serial.println("[Sensors] Task khởi động - Core " + String(xPortGetCoreID()));
  
  TickType_t lastWakeTime = xTaskGetTickCount();
  
  for (;;) {
    esp_task_wdt_reset();
    
    int raw_mq135 = analogRead(MQ135_PIN);
    med_mq135.push(raw_mq135);
    int filtered_mq135 = med_mq135.get();

    float t = 0, h = 0, p = 0, g = 0;
    if (bme_ok && bme.performReading()) {
      t = bme.temperature;
      h = bme.humidity;
      p = bme.pressure / 100.0f;
      g = bme.gas_resistance / 1000.0f;
    }

    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      systemData.temperature    = ema_temp.update(t);
      systemData.humidity       = ema_hum.update(h);
      systemData.pressure       = ema_pres.update(p);
      systemData.gas_resistance = ema_gas.update(g);
      systemData.mq135_value    = filtered_mq135;
      
      systemData.aqi = calculateComprehensiveAQI(
        systemData.pm2_5, systemData.pm10, systemData.mq135_value
      );
      
      Serial.printf("[Sensors] Đã cập nhật phép đo mới. AQI hiện tại: %d\n", systemData.aqi);
      xSemaphoreGive(dataMutex);
      
      xEventGroupSetBits(dataReadyEvent, BITS_ALL_READY);
    }

    vTaskDelayUntil(&lastWakeTime, pdMS_TO_TICKS(SENSOR_READ_INTERVAL_MS));
  }
}

// Chờ EventGroup BIT_SD_READY, copy data, ghi CSV lên SD Card (bảo vệ SPI bằng mutex)
void taskSDCard(void *pvParameters) {
  esp_task_wdt_add(NULL);
  Serial.println("[SD Card] Task khởi động - Core " + String(xPortGetCoreID()));
  
  for (;;) {
    EventBits_t bits = xEventGroupWaitBits(
      dataReadyEvent, BIT_SD_READY, pdTRUE, pdFALSE, pdMS_TO_TICKS(10000)
    );
    
    esp_task_wdt_reset();
    
    if (!(bits & BIT_SD_READY)) continue;
    if (!sd_ok) continue;
    
    SharedData localCopy;
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      localCopy = systemData;
      xSemaphoreGive(dataMutex);
    } else {
      continue;
    }
    
    if (xSemaphoreTake(spiMutex, pdMS_TO_TICKS(500)) == pdTRUE) {
      File file = SD.open("/database.csv", FILE_APPEND);
      if (file) {
        file.printf("%lu,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%d,%d\n", 
                    millis(), localCopy.pm2_5, localCopy.pm10, 
                    localCopy.temperature, localCopy.humidity, 
                    localCopy.pressure, localCopy.gas_resistance, 
                    localCopy.mq135_value, localCopy.aqi);
        file.close();
        Serial.println("[SD Card] Đã lưu database.csv.");
      } else {
        Serial.println("[SD Card] Khong mo duoc file!");
      }
      xSemaphoreGive(spiMutex);
    }
  }
}

// Quản lý WiFi + MQTT. Chờ EventGroup BIT_MQTT_READY, publish JSON lên broker
void taskNetwork(void *pvParameters) {
  esp_task_wdt_add(NULL);
  Serial.println("[Network] Task khởi động - Core " + String(xPortGetCoreID()));
  
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setBufferSize(512);

  for (;;) {
    esp_task_wdt_reset();
    
    // Kiểm tra WiFi
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[Network] Mất WiFi, đang thử kết nối lại...");
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      vTaskDelay(pdMS_TO_TICKS(15000));
      continue;
    }

    // Duy trì MQTT
    if (!mqttClient.connected()) {
      String clientId = "ESP32_AQI_" + String(random(0xffff), HEX);
      if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
        Serial.println("[MQTT] Ket noi OK!");
      } else {
        Serial.printf("[MQTT] Loi (rc=%d), thu lai sau 5s\n", mqttClient.state());
        vTaskDelay(pdMS_TO_TICKS(5000));
        continue;
      }
    }
    mqttClient.loop();

    // Chờ data mới (timeout 1s để duy trì mqttClient.loop)
    EventBits_t bits = xEventGroupWaitBits(
      dataReadyEvent, BIT_MQTT_READY, pdTRUE, pdFALSE, pdMS_TO_TICKS(1000)
    );
    if (!(bits & BIT_MQTT_READY)) continue;
    
    // Publish data lên MQTT
    SharedData localCopy;
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      localCopy = systemData;
      xSemaphoreGive(dataMutex);
    } else {
      continue;
    }

    StaticJsonDocument<256> doc;
    doc["pm2_5"]          = round(localCopy.pm2_5 * 10) / 10.0;
    doc["pm10"]           = round(localCopy.pm10 * 10) / 10.0;
    doc["temperature"]    = round(localCopy.temperature * 10) / 10.0;
    doc["humidity"]       = round(localCopy.humidity * 10) / 10.0;
    doc["pressure"]       = round(localCopy.pressure * 10) / 10.0;
    doc["gas_resistance"] = round(localCopy.gas_resistance * 10) / 10.0;
    doc["mq135"]          = localCopy.mq135_value;
    doc["aqi"]            = localCopy.aqi;

    String payload;
    serializeJson(doc, payload);
    
    if (mqttClient.publish(MQTT_TOPIC, payload.c_str())) {
      Serial.println("[MQTT] Đã publish dữ liệu thành công!");
    } else {
      Serial.println("[MQTT] Publish that bai!");
    }
  }
}



void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== HỆ THỐNG GIÁM SÁT CHẤT LƯỢNG KHÔNG KHÍ - FreeRTOS v2 ===");

  // Tạo đối tượng đồng bộ
  dataMutex      = xSemaphoreCreateMutex();
  spiMutex       = xSemaphoreCreateMutex();
  dataReadyEvent = xEventGroupCreate();
  
  if (dataMutex == NULL || spiMutex == NULL || dataReadyEvent == NULL) {
    Serial.println("FATAL: Khong tao duoc Mutex/EventGroup!");
    while (1) { delay(1000); }
  }

  // Khởi tạo phần cứng
  initSDCard();
  initBME680();
  pmsSerial.begin(9600, SERIAL_8N1, RXD1, TXD1);

  // Kết nối WiFi (hardcode) hoặc chuyển sang AP mode
  initWiFi();

  // Watchdog Timer - cấu hình lại (Arduino Core v3.x đã tự init rồi)
  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = WDT_TIMEOUT_S * 1000,
    .idle_core_mask = 0,
    .trigger_panic = true
  };
  esp_task_wdt_reconfigure(&wdt_config);

  // Tạo Tasks - Core 1: Sensors, Core 0: Network
  xTaskCreatePinnedToCore(taskPMS,     "PMS_UART",  3072, NULL, 3, NULL, 1);
  xTaskCreatePinnedToCore(taskSensors, "Sensors",   4096, NULL, 2, NULL, 1);
  xTaskCreatePinnedToCore(taskSDCard,  "SD_Logger", 4096, NULL, 1, NULL, 1);
  xTaskCreatePinnedToCore(taskNetwork, "Network",   6144, NULL, 1, NULL, 0);
  
  Serial.println("=== Khởi tạo FreeRTOS thành công! ===");
}

// loop() trống - FreeRTOS scheduler quản lý toàn bộ
void loop() {
  vTaskDelay(pdMS_TO_TICKS(10000));
}