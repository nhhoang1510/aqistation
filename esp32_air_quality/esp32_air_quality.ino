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

const char* WIFI_SSID     = "TP-Link_4DDC";
const char* WIFI_PASSWORD = "00000000";
const char* MQTT_SERVER   = "broker.emqx.io"; 
const int   MQTT_PORT     = 1883;
const char* MQTT_USER     = "";
const char* MQTT_PASS     = "";
const char* MQTT_TOPIC    = "aqistation/data";

#define SD_CS_PIN   5 
#define SDA_PIN    21
#define SCL_PIN    22
#define RXD1       16
#define TXD1       17
#define MQ135_PIN  34

#define MA_SIZE    5      
#define MED_SIZE   11      
#define EMA_ALPHA  0.1f   

// Cấu hình tần suất cho các Task FreeRTOS
#define SENSOR_READ_INTERVAL_TICK  (10000 / portTICK_PERIOD_MS) // 10 giây đọc 1 lần
#define REPORT_INTERVAL_TICK       (10000 / portTICK_PERIOD_MS) // 10 giây báo cáo 1 lần

WiFiClient espClient;
PubSubClient mqttClient(espClient);
Adafruit_BME680 bme(&Wire);
HardwareSerial  pmsSerial(1);

bool sd_ok = false;
bool bme_ok = false;

// ─── SEMAPHORE MUTEX & ĐỐI TƯỢNG CHỨA DỮ LIỆU DÙNG CHUNG ──────────────────────
SemaphoreHandle_t dataMutex;

struct SharedData {
  float pm2_5 = 0;
  float pm10 = 0;
  float temperature = 0;
  float humidity = 0;
  float pressure = 0;
  float gas_resistance = 0;
  int mq135_value = 0;
  int aqi = 0;
  bool freshData = false; // Cờ báo hiệu có dữ liệu mới để lưu SD và gửi MQTT
};
SharedData systemData;

// ─── BỘ LỌC TOÁN HỌC (Giữ nguyên cấu trúc của bạn) ───────────────────────────
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

struct EMA {
  float value = 0;
  bool init = false;
  float update(float raw) {
    if (!init) { value = raw; init = true; }
    else         value = EMA_ALPHA * raw + (1.0f - EMA_ALPHA) * value;
    return value;
  }
};
EMA ema_temp, ema_hum, ema_pres, ema_gas;

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

// ─── THUẬT TOÁN TÍNH AQI (Giữ nguyên) ────────────────────────────────────────
int aqiFromPM25(float c) {
  const float bp[][4] = {
    {  0.0f,  12.0f,   0,  50}, { 12.1f,  35.4f,  51, 100}, { 35.5f,  55.4f, 101, 150},
    { 55.5f, 150.4f, 151, 200}, {150.5f, 250.4f, 201, 300}, {250.5f, 350.4f, 301, 400}, {350.5f, 500.4f, 401, 500},
  };
  for (auto& b : bp) { if (c <= b[1]) return (int)((b[3] - b[2]) / (b[1] - b[0]) * (c - b[0]) + b[2]); }
  return 500;
}

int aqiFromPM10(float c) {
  const float bp[][4] = {
    {  0,  54,   0,  50}, { 55, 154,  51, 100}, {155, 254, 101, 150},
    {255, 354, 151, 200}, {355, 424, 201, 300}, {425, 504, 301, 400}, {505, 604, 401, 500},
  };
  for (auto& b : bp) { if (c <= b[1]) return (int)((b[3] - b[2]) / (b[1] - b[0]) * (c - b[0]) + b[2]); }
  return 500;
}

int aqiFromMQ135(int analog_val) {
  if (analog_val < 800) return map(analog_val, 0, 800, 0, 50);
  if (analog_val < 1500) return map(analog_val, 801, 1500, 51, 100);
  if (analog_val < 2500) return map(analog_val, 1501, 2500, 101, 150);
  return map(analog_val, 2501, 4095, 151, 300);
}

int calculateComprehensiveAQI(float pm25_avg, float pm10_avg, int mq135_val) {
  int a25   = aqiFromPM25(pm25_avg);
  int a10   = aqiFromPM10(pm10_avg);
  int aGas  = aqiFromMQ135(mq135_val);
  return max(max(a25, a10), aGas);
}

// ─── KHỞI TẠO NGOẠI VI (Chạy trong setup) ─────────────────────────────────────
void initSDCard() {
  Serial.println("[SD Card] Đang khởi tạo...");
  if (!SD.begin(SD_CS_PIN)) {
    Serial.println("[SD Card] Khởi tạo thất bại!");
    sd_ok = false;
    return;
  }
  Serial.println("[SD Card] Khởi tạo thành công!");
  sd_ok = true;
  
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
}

void initBME680() {
  Wire.begin(SDA_PIN, SCL_PIN);
  delay(100);
  uint8_t addrs[] = {0x76, 0x77};
  for (int a = 0; a < 2 && !bme_ok; a++) {
    if (bme.begin(addrs[a])) {
      bme_ok = true;
      Serial.printf("[BME] Tìm thấy tại địa chỉ 0x%02X!\n", addrs[a]);
      bme.setTemperatureOversampling(BME680_OS_8X);
      bme.setHumidityOversampling(BME680_OS_2X);
      bme.setPressureOversampling(BME680_OS_4X);
      bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
      bme.setGasHeater(320, 150);
    }
  }
  if (!bme_ok) Serial.println("[BME] KHÔNG TÌM THẤY CẢM BIẾN BME680!");
}

// ─── PHẦN THỰC THI KHÔNG GIAN FREERTOS TASKS ──────────────────────────────────

// TASK 1: Đọc liên tục cổng Serial từ cảm biến bụi PMS5003 (Độ ưu tiên cao)
void taskPMS(void *pvParameters) {
  uint8_t buf[32];
  for (;;) {
    if (pmsSerial.available() >= 32) {
      pmsSerial.readBytes(buf, 32);
      if (buf[0] == 0x42 && buf[1] == 0x4D) {
        uint16_t raw_pm25 = (buf[12] << 8) | buf[13];
        uint16_t raw_pm10 = (buf[14] << 8) | buf[15];

        // Khóa Mutex để cập nhật dữ liệu vào bộ lọc an toàn
        if (xSemaphoreTake(dataMutex, portMAX_DELAY) == pdTRUE) {
          ma_pm25.push(raw_pm25);
          ma_pm10.push(raw_pm10);
          systemData.pm2_5 = ma_pm25.get();
          systemData.pm10  = ma_pm10.get();
          xSemaphoreGive(dataMutex);
        }
      }
    }
    vTaskDelay(50 / portTICK_PERIOD_MS); // Nghỉ 50ms để không nghẽn CPU Core
  }
}

// TASK 2: Thu thập dữ liệu định kỳ từ BME680 và MQ135 (Mỗi 10 giây)
void taskSensors(void *pvParameters) {
  TickType_t lastWakeTime = xTaskGetTickCount();
  for (;;) {
    // Đọc MQ135
    int raw_mq135 = analogRead(MQ135_PIN);
    med_mq135.push(raw_mq135);
    int filtered_mq135 = med_mq135.get();

    // Đọc BME680
    float t = 0, h = 0, p = 0, g = 0;
    if (bme_ok && bme.performReading()) {
      t = bme.temperature;
      h = bme.humidity;
      p = bme.pressure / 100.0f;
      g = bme.gas_resistance / 1000.0f;
    }

    // Khóa dữ liệu để cập nhật và tính toán AQI tổng hợp
    if (xSemaphoreTake(dataMutex, portMAX_DELAY) == pdTRUE) {
      systemData.temperature    = ema_temp.update(t);
      systemData.humidity       = ema_hum.update(h);
      systemData.pressure       = ema_pres.update(p);
      systemData.gas_resistance = ema_gas.update(g);
      systemData.mq135_value    = filtered_mq135;
      
      systemData.aqi = calculateComprehensiveAQI(systemData.pm2_5, systemData.pm10, systemData.mq135_value);
      systemData.freshData = true; // Kích hoạt cờ báo cho Task mạng và Task SD hoạt động
      
      Serial.printf("[Sensors] Đã cập nhật phép đo mới. AQI hiện tại: %d\n", systemData.aqi);
      xSemaphoreGive(dataMutex);
    }

    // Đảm bảo Task thức dậy chuẩn xác mỗi 10 giây nhờ vTaskDelayUntil
    vTaskDelayUntil(&lastWakeTime, SENSOR_READ_INTERVAL_TICK);
  }
}

// TASK 3: Đồng bộ lưu file cục bộ lên thẻ SD
void taskSDCard(void *pvParameters) {
  for (;;) {
    bool processData = false;
    SharedData localCopy;

    // Kiểm tra nhanh xem có dữ liệu mới không
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      if (systemData.freshData) {
        localCopy = systemData;
        processData = true;
        // Lưu ý: Không hạ cờ freshData ở đây vì cần để lại cho task MQTT nhận biết nữa
      }
      xSemaphoreGive(dataMutex);
    }

    if (processData && sd_ok) {
      File file = SD.open("/database.csv", FILE_APPEND);
      if (file) {
        file.printf("%lu,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%d,%d\n", 
                    millis(), localCopy.pm2_5, localCopy.pm10, localCopy.temperature, 
                    localCopy.humidity, localCopy.pressure, localCopy.gas_resistance, localCopy.mq135_value, localCopy.aqi);
        file.close();
        Serial.println("[SD Task] Đã lưu database.csv thành công.");
      }
    }

    vTaskDelay(500 / portTICK_PERIOD_MS); // Quét cờ kiểm tra mỗi 500ms
  }
}

// TASK 4: Quản lý WiFi, MQTT và đẩy dữ liệu lên Cloud
void taskNetwork(void *pvParameters) {
  // Kết nối WiFi lần đầu trong Task mạng
  Serial.printf("[Network] Kết nối WiFi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  while (WiFi.status() != WL_CONNECTED) {
    vTaskDelay(500 / portTICK_PERIOD_MS);
    Serial.print(".");
  }
  Serial.printf("\n[Network] WiFi OK! IP: %s\n", WiFi.localIP().toString().c_str());
  
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);

  for (;;) {
    // Duy trì WiFi
    if (WiFi.status() != WL_CONNECTED) {
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      while (WiFi.status() != WL_CONNECTED) {
        vTaskDelay(1000 / portTICK_PERIOD_MS);
      }
    }

    // Duy trì MQTT
    if (!mqttClient.connected()) {
      Serial.print("[MQTT] Đang kết nối Broker... ");
      String clientId = "ESP32_AQI_" + String(random(0xffff), HEX);
      if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
        Serial.println("Kết nối MQTT OK!");
      } else {
        Serial.printf("Lỗi MQTT (%d), thử lại sau 5s\n", mqttClient.state());
        vTaskDelay(5000 / portTICK_PERIOD_MS);
        continue;
      }
    }
    mqttClient.loop();

    // Kiểm tra và gửi dữ liệu khi có cờ báo freshData
    bool sendCloud = false;
    SharedData localCopy;

    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      if (systemData.freshData) {
        localCopy = systemData;
        sendCloud = true;
        systemData.freshData = false; // Đã xử lý xong dữ liệu vòng này, hạ cờ
      }
      xSemaphoreGive(dataMutex);
    }

    if (sendCloud) {
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
        Serial.println("[MQTT] Publish thất bại!");
      }
    }

    vTaskDelay(200 / portTICK_PERIOD_MS);
  }
}

// ─── KHỞI TẠO HỆ THỐNG ────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== HỆ THỐNG GIÁM SÁT CHẤT LƯỢNG KHÔNG KHÍ FREERTOS ===");

  // Khởi tạo các bộ khóa bảo vệ dữ liệu Mutex
  dataMutex = xSemaphoreCreateMutex();

  // Cấu hình phần cứng
  initSDCard();
  initBME680();
  pmsSerial.begin(9600, SERIAL_8N1, RXD1, TXD1);

  if (dataMutex != NULL) {
    // Tạo luồng xử lý riêng biệt (Dung lượng Stack tính bằng Bytes trên ESP32)
    xTaskCreate(taskPMS,     "Task PMS UART", 3072, NULL, 3, NULL);
    xTaskCreate(taskSensors, "Task Sensors",  4096, NULL, 2, NULL);
    xTaskCreate(taskSDCard,  "Task SD Log",   3584, NULL, 1, NULL);
    xTaskCreate(taskNetwork, "Task Net Cloud", 5120, NULL, 1, NULL);
    
    Serial.println("=== Khởi tạo các Task FreeRTOS thành công! ===");
  } else {
    Serial.println("Lỗi: Không tạo được Mutex bảo vệ!");
  }
}

void loop() {
  // Hoàn toàn để trống. Vòng lặp loop() mặc định bị triệt tiêu 
  // nhường tài nguyên hoàn toàn cho Core điều khiển quản lý các Task.
}#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>
#include <HardwareSerial.h>
#include <ArduinoJson.h>
#include <FS.h>
#include <SD.h>
#include <SPI.h>

const char* WIFI_SSID     = "TP-Link_4DDC";
const char* WIFI_PASSWORD = "00000000";
const char* MQTT_SERVER   = "broker.emqx.io"; 
const int   MQTT_PORT     = 1883;
const char* MQTT_USER     = "";
const char* MQTT_PASS     = "";
const char* MQTT_TOPIC    = "aqistation/data";

#define SD_CS_PIN   5 
#define SDA_PIN    21
#define SCL_PIN    22
#define RXD1       16
#define TXD1       17
#define MQ135_PIN  34

#define MA_SIZE    5      
#define MED_SIZE   11      
#define EMA_ALPHA  0.1f   

// Cấu hình tần suất cho các Task FreeRTOS
#define SENSOR_READ_INTERVAL_TICK  (10000 / portTICK_PERIOD_MS) // 10 giây đọc 1 lần
#define REPORT_INTERVAL_TICK       (10000 / portTICK_PERIOD_MS) // 10 giây báo cáo 1 lần

WiFiClient espClient;
PubSubClient mqttClient(espClient);
Adafruit_BME680 bme(&Wire);
HardwareSerial  pmsSerial(1);

bool sd_ok = false;
bool bme_ok = false;

// ─── SEMAPHORE MUTEX & ĐỐI TƯỢNG CHỨA DỮ LIỆU DÙNG CHUNG ──────────────────────
SemaphoreHandle_t dataMutex;

struct SharedData {
  float pm2_5 = 0;
  float pm10 = 0;
  float temperature = 0;
  float humidity = 0;
  float pressure = 0;
  float gas_resistance = 0;
  int mq135_value = 0;
  int aqi = 0;
  bool freshData = false; // Cờ báo hiệu có dữ liệu mới để lưu SD và gửi MQTT
};
SharedData systemData;

// ─── BỘ LỌC TOÁN HỌC (Giữ nguyên cấu trúc của bạn) ───────────────────────────
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

struct EMA {
  float value = 0;
  bool init = false;
  float update(float raw) {
    if (!init) { value = raw; init = true; }
    else         value = EMA_ALPHA * raw + (1.0f - EMA_ALPHA) * value;
    return value;
  }
};
EMA ema_temp, ema_hum, ema_pres, ema_gas;

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

// ─── THUẬT TOÁN TÍNH AQI (Giữ nguyên) ────────────────────────────────────────
int aqiFromPM25(float c) {
  const float bp[][4] = {
    {  0.0f,  12.0f,   0,  50}, { 12.1f,  35.4f,  51, 100}, { 35.5f,  55.4f, 101, 150},
    { 55.5f, 150.4f, 151, 200}, {150.5f, 250.4f, 201, 300}, {250.5f, 350.4f, 301, 400}, {350.5f, 500.4f, 401, 500},
  };
  for (auto& b : bp) { if (c <= b[1]) return (int)((b[3] - b[2]) / (b[1] - b[0]) * (c - b[0]) + b[2]); }
  return 500;
}

int aqiFromPM10(float c) {
  const float bp[][4] = {
    {  0,  54,   0,  50}, { 55, 154,  51, 100}, {155, 254, 101, 150},
    {255, 354, 151, 200}, {355, 424, 201, 300}, {425, 504, 301, 400}, {505, 604, 401, 500},
  };
  for (auto& b : bp) { if (c <= b[1]) return (int)((b[3] - b[2]) / (b[1] - b[0]) * (c - b[0]) + b[2]); }
  return 500;
}

int aqiFromMQ135(int analog_val) {
  if (analog_val < 800) return map(analog_val, 0, 800, 0, 50);
  if (analog_val < 1500) return map(analog_val, 801, 1500, 51, 100);
  if (analog_val < 2500) return map(analog_val, 1501, 2500, 101, 150);
  return map(analog_val, 2501, 4095, 151, 300);
}

int calculateComprehensiveAQI(float pm25_avg, float pm10_avg, int mq135_val) {
  int a25   = aqiFromPM25(pm25_avg);
  int a10   = aqiFromPM10(pm10_avg);
  int aGas  = aqiFromMQ135(mq135_val);
  return max(max(a25, a10), aGas);
}

// ─── KHỞI TẠO NGOẠI VI (Chạy trong setup) ─────────────────────────────────────
void initSDCard() {
  Serial.println("[SD Card] Đang khởi tạo...");
  if (!SD.begin(SD_CS_PIN)) {
    Serial.println("[SD Card] Khởi tạo thất bại!");
    sd_ok = false;
    return;
  }
  Serial.println("[SD Card] Khởi tạo thành công!");
  sd_ok = true;
  
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
}

void initBME680() {
  Wire.begin(SDA_PIN, SCL_PIN);
  delay(100);
  uint8_t addrs[] = {0x76, 0x77};
  for (int a = 0; a < 2 && !bme_ok; a++) {
    if (bme.begin(addrs[a])) {
      bme_ok = true;
      Serial.printf("[BME] Tìm thấy tại địa chỉ 0x%02X!\n", addrs[a]);
      bme.setTemperatureOversampling(BME680_OS_8X);
      bme.setHumidityOversampling(BME680_OS_2X);
      bme.setPressureOversampling(BME680_OS_4X);
      bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
      bme.setGasHeater(320, 150);
    }
  }
  if (!bme_ok) Serial.println("[BME] KHÔNG TÌM THẤY CẢM BIẾN BME680!");
}

// ─── PHẦN THỰC THI KHÔNG GIAN FREERTOS TASKS ──────────────────────────────────

// TASK 1: Đọc liên tục cổng Serial từ cảm biến bụi PMS5003 (Độ ưu tiên cao)
void taskPMS(void *pvParameters) {
  uint8_t buf[32];
  for (;;) {
    if (pmsSerial.available() >= 32) {
      pmsSerial.readBytes(buf, 32);
      if (buf[0] == 0x42 && buf[1] == 0x4D) {
        uint16_t raw_pm25 = (buf[12] << 8) | buf[13];
        uint16_t raw_pm10 = (buf[14] << 8) | buf[15];

        // Khóa Mutex để cập nhật dữ liệu vào bộ lọc an toàn
        if (xSemaphoreTake(dataMutex, portMAX_DELAY) == pdTRUE) {
          ma_pm25.push(raw_pm25);
          ma_pm10.push(raw_pm10);
          systemData.pm2_5 = ma_pm25.get();
          systemData.pm10  = ma_pm10.get();
          xSemaphoreGive(dataMutex);
        }
      }
    }
    vTaskDelay(50 / portTICK_PERIOD_MS); // Nghỉ 50ms để không nghẽn CPU Core
  }
}

// TASK 2: Thu thập dữ liệu định kỳ từ BME680 và MQ135 (Mỗi 10 giây)
void taskSensors(void *pvParameters) {
  TickType_t lastWakeTime = xTaskGetTickCount();
  for (;;) {
    // Đọc MQ135
    int raw_mq135 = analogRead(MQ135_PIN);
    med_mq135.push(raw_mq135);
    int filtered_mq135 = med_mq135.get();

    // Đọc BME680
    float t = 0, h = 0, p = 0, g = 0;
    if (bme_ok && bme.performReading()) {
      t = bme.temperature;
      h = bme.humidity;
      p = bme.pressure / 100.0f;
      g = bme.gas_resistance / 1000.0f;
    }

    // Khóa dữ liệu để cập nhật và tính toán AQI tổng hợp
    if (xSemaphoreTake(dataMutex, portMAX_DELAY) == pdTRUE) {
      systemData.temperature    = ema_temp.update(t);
      systemData.humidity       = ema_hum.update(h);
      systemData.pressure       = ema_pres.update(p);
      systemData.gas_resistance = ema_gas.update(g);
      systemData.mq135_value    = filtered_mq135;
      
      systemData.aqi = calculateComprehensiveAQI(systemData.pm2_5, systemData.pm10, systemData.mq135_value);
      systemData.freshData = true; // Kích hoạt cờ báo cho Task mạng và Task SD hoạt động
      
      Serial.printf("[Sensors] Đã cập nhật phép đo mới. AQI hiện tại: %d\n", systemData.aqi);
      xSemaphoreGive(dataMutex);
    }

    // Đảm bảo Task thức dậy chuẩn xác mỗi 10 giây nhờ vTaskDelayUntil
    vTaskDelayUntil(&lastWakeTime, SENSOR_READ_INTERVAL_TICK);
  }
}

// TASK 3: Đồng bộ lưu file cục bộ lên thẻ SD
void taskSDCard(void *pvParameters) {
  for (;;) {
    bool processData = false;
    SharedData localCopy;

    // Kiểm tra nhanh xem có dữ liệu mới không
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      if (systemData.freshData) {
        localCopy = systemData;
        processData = true;
        // Lưu ý: Không hạ cờ freshData ở đây vì cần để lại cho task MQTT nhận biết nữa
      }
      xSemaphoreGive(dataMutex);
    }

    if (processData && sd_ok) {
      File file = SD.open("/database.csv", FILE_APPEND);
      if (file) {
        file.printf("%lu,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%d,%d\n", 
                    millis(), localCopy.pm2_5, localCopy.pm10, localCopy.temperature, 
                    localCopy.humidity, localCopy.pressure, localCopy.gas_resistance, localCopy.mq135_value, localCopy.aqi);
        file.close();
        Serial.println("[SD Task] Đã lưu database.csv thành công.");
      }
    }

    vTaskDelay(500 / portTICK_PERIOD_MS); // Quét cờ kiểm tra mỗi 500ms
  }
}

// TASK 4: Quản lý WiFi, MQTT và đẩy dữ liệu lên Cloud
void taskNetwork(void *pvParameters) {
  // Kết nối WiFi lần đầu trong Task mạng
  Serial.printf("[Network] Kết nối WiFi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  while (WiFi.status() != WL_CONNECTED) {
    vTaskDelay(500 / portTICK_PERIOD_MS);
    Serial.print(".");
  }
  Serial.printf("\n[Network] WiFi OK! IP: %s\n", WiFi.localIP().toString().c_str());
  
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);

  for (;;) {
    // Duy trì WiFi
    if (WiFi.status() != WL_CONNECTED) {
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      while (WiFi.status() != WL_CONNECTED) {
        vTaskDelay(1000 / portTICK_PERIOD_MS);
      }
    }

    // Duy trì MQTT
    if (!mqttClient.connected()) {
      Serial.print("[MQTT] Đang kết nối Broker... ");
      String clientId = "ESP32_AQI_" + String(random(0xffff), HEX);
      if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
        Serial.println("Kết nối MQTT OK!");
      } else {
        Serial.printf("Lỗi MQTT (%d), thử lại sau 5s\n", mqttClient.state());
        vTaskDelay(5000 / portTICK_PERIOD_MS);
        continue;
      }
    }
    mqttClient.loop();

    // Kiểm tra và gửi dữ liệu khi có cờ báo freshData
    bool sendCloud = false;
    SharedData localCopy;

    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      if (systemData.freshData) {
        localCopy = systemData;
        sendCloud = true;
        systemData.freshData = false; // Đã xử lý xong dữ liệu vòng này, hạ cờ
      }
      xSemaphoreGive(dataMutex);
    }

    if (sendCloud) {
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
        Serial.println("[MQTT] Publish thất bại!");
      }
    }

    vTaskDelay(200 / portTICK_PERIOD_MS);
  }
}

// ─── KHỞI TẠO HỆ THỐNG ────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== HỆ THỐNG GIÁM SÁT CHẤT LƯỢNG KHÔNG KHÍ FREERTOS ===");

  // Khởi tạo các bộ khóa bảo vệ dữ liệu Mutex
  dataMutex = xSemaphoreCreateMutex();

  // Cấu hình phần cứng
  initSDCard();
  initBME680();
  pmsSerial.begin(9600, SERIAL_8N1, RXD1, TXD1);

  if (dataMutex != NULL) {
    // Tạo luồng xử lý riêng biệt (Dung lượng Stack tính bằng Bytes trên ESP32)
    xTaskCreate(taskPMS,     "Task PMS UART", 3072, NULL, 3, NULL);
    xTaskCreate(taskSensors, "Task Sensors",  4096, NULL, 2, NULL);
    xTaskCreate(taskSDCard,  "Task SD Log",   3584, NULL, 1, NULL);
    xTaskCreate(taskNetwork, "Task Net Cloud", 5120, NULL, 1, NULL);
    
    Serial.println("=== Khởi tạo các Task FreeRTOS thành công! ===");
  } else {
    Serial.println("Lỗi: Không tạo được Mutex bảo vệ!");
  }
}

void loop() {
  // Hoàn toàn để trống. Vòng lặp loop() mặc định bị triệt tiêu 
  // nhường tài nguyên hoàn toàn cho Core điều khiển quản lý các Task.
}