
#include "wifiConfig.h"

#include <Adafruit_BME680.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>
#include <HardwareSerial.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <esp_task_wdt.h>

// Cấu hình WiFi (hardcode – fallback nếu NVS trống)
const char *WIFI_SSID = "TP-Link_4DDC";
const char *WIFI_PASSWORD = "00000000";

const char *MQTT_SERVER = "broker.emqx.io";
const int MQTT_PORT = 1883;
const char *MQTT_USER = "";
const char *MQTT_PASS = "";
const char *MQTT_TOPIC = "aqistation/data";

// Chân GPIO
#define SDA_PIN 21
#define SCL_PIN 22
#define RXD1 16
#define TXD1 17
#define MQ135_PIN 34

// Cấu hình bộ lọc
#define MA_SIZE 5
#define MED_SIZE 11
#define EMA_ALPHA 0.1f

#define TEMP_OFFSET (-3.0f)

// Cấu hình FreeRTOS
#define SENSOR_READ_INTERVAL_MS 10000
#define WDT_TIMEOUT_S 30

// Event Group bit: thông báo data mới cho MQTT task
#define BIT_MQTT_READY (1 << 0)

// Đối tượng toàn cục
WiFiClient espClient;
PubSubClient mqttClient(espClient);
Adafruit_BME680 bme(&Wire);
HardwareSerial pmsSerial(1);

volatile bool bme_ok = false;

SemaphoreHandle_t dataMutex;       // Bảo vệ SharedData
EventGroupHandle_t dataReadyEvent; // Thông báo data mới cho MQTT

// Dữ liệu dùng chung giữa các task
struct SharedData {
  float pm2_5 = 0;
  float pm10 = 0;
  float temperature = 0;
  float humidity = 0;
  float pressure = 0;
  float gas_resistance = 0;
  int mq135_value = 0;
  int aqi = 0;
};
SharedData systemData;

struct MovingAvg {
  uint16_t buf[MA_SIZE] = {0};
  int idx = 0;
  int count = 0;
  void push(uint16_t val) {
    buf[idx] = val;
    idx = (idx + 1) % MA_SIZE;
    if (count < MA_SIZE)
      count++;
  }
  float get() const {
    if (count == 0)
      return 0;
    float sum = 0;
    for (int i = 0; i < count; i++)
      sum += buf[i];
    return sum / count;
  }
};
MovingAvg ma_pm25, ma_pm10;

struct EMA {
  float value = 0;
  bool initialized = false;
  float update(float raw) {
    if (!initialized) {
      value = raw;
      initialized = true;
    } else
      value = EMA_ALPHA * raw + (1.0f - EMA_ALPHA) * value;
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
    if (count < MED_SIZE)
      count++;
  }
  int get() const {
    if (count == 0)
      return 0;
    int tmp[MED_SIZE];
    memcpy(tmp, buf, sizeof(int) * count);
    for (int i = 1; i < count; i++) {
      int key = tmp[i], j = i - 1;
      while (j >= 0 && tmp[j] > key) {
        tmp[j + 1] = tmp[j];
        j--;
      }
      tmp[j + 1] = key;
    }
    return tmp[count / 2];
  }
};
MedianFilter med_mq135;

int aqiFromPM25(float c) {
  const float bp[][4] = {
      {0.0f, 12.0f, 0, 50},       {12.1f, 35.4f, 51, 100},
      {35.5f, 55.4f, 101, 150},   {55.5f, 150.4f, 151, 200},
      {150.5f, 250.4f, 201, 300}, {250.5f, 350.4f, 301, 400},
      {350.5f, 500.4f, 401, 500},
  };
  for (auto &b : bp) {
    if (c <= b[1])
      return (int)((b[3] - b[2]) / (b[1] - b[0]) * (c - b[0]) + b[2]);
  }
  return 500;
}

int aqiFromPM10(float c) {
  const float bp[][4] = {
      {0, 54, 0, 50},       {55, 154, 51, 100},   {155, 254, 101, 150},
      {255, 354, 151, 200}, {355, 424, 201, 300}, {425, 504, 301, 400},
      {505, 604, 401, 500},
  };
  for (auto &b : bp) {
    if (c <= b[1])
      return (int)((b[3] - b[2]) / (b[1] - b[0]) * (c - b[0]) + b[2]);
  }
  return 500;
}

int aqiFromMQ135(int analog_val) {

  if (analog_val < 500)
    return map(analog_val, 0, 500, 0, 25);
  if (analog_val < 1000)
    return map(analog_val, 500, 1000, 25, 50);
  if (analog_val < 2000)
    return map(analog_val, 1001, 2000, 51, 100);
  if (analog_val < 3000)
    return map(analog_val, 2001, 3000, 101, 150);
  return map(analog_val, 3001, 4095, 151, 300);
}

int calculateComprehensiveAQI(float pm25_avg, float pm10_avg, int mq135_val) {
  int a25 = aqiFromPM25(pm25_avg);
  int a10 = aqiFromPM10(pm10_avg);
  return max(a25, a10);
}

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
  if (!bme_ok)
    Serial.println("[BME680] KHONG TIM THAY CAM BIEN!");
}

void taskPMS(void *pvParameters) {
  esp_task_wdt_add(NULL);
  Serial.println("[PMS5003] Task khoi dong - Core " + String(xPortGetCoreID()));

  unsigned long lastReceiveTime = millis();
  bool pms_connected = true;
  unsigned long lastPrintTime = 0;

  for (;;) {
    esp_task_wdt_reset();

    if (pmsSerial.available() < 1) {
      if (millis() - lastReceiveTime > 5000) {
        if (pms_connected) {
          pms_connected = false;
        }
        if (millis() - lastPrintTime > 5000) {
          lastPrintTime = millis();
          Serial.println("-----------------------------");
          Serial.println("[LỖI] Không tìm thấy cảm biến PMS5003, vui lòng kiểm "
                         "tra kết nối dây!");
          Serial.println("-----------------------------");
        }

        if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
          systemData.pm2_5 = 0;
          systemData.pm10 = 0;
          ma_pm25.count = 0;
          ma_pm25.idx = 0;
          ma_pm10.count = 0;
          ma_pm10.idx = 0;
          xSemaphoreGive(dataMutex);
        }
      }
      vTaskDelay(pdMS_TO_TICKS(10));
      continue;
    }

    uint8_t startByte = pmsSerial.read();
    if (startByte != 0x42)
      continue;

    unsigned long waitStart = millis();
    while (!pmsSerial.available()) {
      if (millis() - waitStart > 100)
        break;
      vTaskDelay(pdMS_TO_TICKS(1));
    }
    if (!pmsSerial.available())
      continue;

    uint8_t secondByte = pmsSerial.read();
    if (secondByte != 0x4D)
      continue;
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
    if (bytesRead < 30)
      continue;

    uint16_t checksum_received = ((uint16_t)buf[28] << 8) | buf[29];
    uint16_t checksum_calc = 0x42 + 0x4D;
    for (int i = 0; i < 28; i++)
      checksum_calc += buf[i];
    if (checksum_calc != checksum_received)
      continue;

    uint16_t raw_pm1_0 = ((uint16_t)buf[8] << 8) | buf[9];
    uint16_t raw_pm25 = ((uint16_t)buf[10] << 8) | buf[11];
    uint16_t raw_pm10 = ((uint16_t)buf[12] << 8) | buf[13];

    uint16_t p0_3 = ((uint16_t)buf[14] << 8) | buf[15];
    uint16_t p0_5 = ((uint16_t)buf[16] << 8) | buf[17];
    uint16_t p1_0 = ((uint16_t)buf[18] << 8) | buf[19];
    uint16_t p2_5 = ((uint16_t)buf[20] << 8) | buf[21];
    uint16_t p5_0 = ((uint16_t)buf[22] << 8) | buf[23];
    uint16_t p10_0 = ((uint16_t)buf[24] << 8) | buf[25];

    lastReceiveTime = millis();
    pms_connected = true;

    if (millis() - lastPrintTime > 5000) {
      lastPrintTime = millis();
      Serial.println("-----------------------------");
      Serial.println("[PMS5003]");
      Serial.println("Concentration Units (atmospheric)");
      Serial.printf("PM 1.0: %-9d PM 2.5: %-9d PM 10: %-9d\n", raw_pm1_0,
                    raw_pm25, raw_pm10);
      Serial.println("-----------------------------");
      Serial.println("Particles > 0.3um / 0.1L air:");
      Serial.printf("0.3um: %-9d 0.5um: %-9d 1.0um: %-9d\n", p0_3, p0_5, p1_0);
      Serial.printf("2.5um: %-9d 5.0um: %-9d 10um: %-9d\n", p2_5, p5_0, p10_0);
      Serial.println("-----------------------------");
    }

    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
      ma_pm25.push(raw_pm25);
      ma_pm10.push(raw_pm10);
      systemData.pm2_5 = ma_pm25.get();
      systemData.pm10 = ma_pm10.get();
      xSemaphoreGive(dataMutex);
    }

    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

void taskSensors(void *pvParameters) {
  esp_task_wdt_add(NULL);
  Serial.println("[Sensors] Task khoi dong - Core " + String(xPortGetCoreID()));

  TickType_t lastWakeTime = xTaskGetTickCount();

  for (;;) {
    esp_task_wdt_reset();

    int raw_mq135 = analogRead(MQ135_PIN);
    int filtered_mq135 = 0;

    Serial.println("\n=============================================");

    Serial.println("[MQ135]");
    if (raw_mq135 < 50 || raw_mq135 == 4095) {
      Serial.println("[LỖI] Không tìm thấy cảm biến MQ135 (hoặc dữ liệu bất "
                     "thường), vui lòng kiểm tra kết nối dây!");
      med_mq135.count = 0;
      med_mq135.idx = 0;
      filtered_mq135 = 0;
    } else {
      med_mq135.push(raw_mq135);
      filtered_mq135 = med_mq135.get();
      float Vrl = raw_mq135 * (3.3 / 4095.0);
      float Rs = (Vrl > 0) ? ((3.3 * 10000.0 / Vrl) - 10000.0) : 0;
      Serial.printf("ADC: %-5d Rs: %.1f Ohm\n", raw_mq135, Rs);
    }
    Serial.println("-----------------------------");

    float t = 0, h = 0, p = 0, g = 0;
    bool bme_reading_ok = (bme_ok && bme.performReading());

    if (bme_reading_ok) {
      t = bme.temperature + TEMP_OFFSET;
      h = bme.humidity;
      p = bme.pressure / 100.0f;
      g = bme.gas_resistance / 1000.0f;

      Serial.println("[BME680]");
      Serial.printf("Nhiệt độ: %.2f °C (Đã bù trừ %.2f °C)\n", t, TEMP_OFFSET);
      Serial.printf("Độ ẩm:    %.2f %%\n", h);
      Serial.printf("Áp suất:  %.2f hPa\n", p);
      Serial.printf("Điện trở Khí: %.2f KOhms\n", g);
    } else {
      Serial.println("[LỖI] Không tìm thấy cảm biến BME680, vui lòng kiểm tra "
                     "kết nối dây!");
    }
    Serial.println("-----------------------------");

    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      if (bme_reading_ok) {
        systemData.temperature = ema_temp.update(t);
        systemData.humidity = ema_hum.update(h);
        systemData.pressure = ema_pres.update(p);
        systemData.gas_resistance = ema_gas.update(g);
      } else {
        ema_temp.initialized = false;
        ema_hum.initialized = false;
        ema_pres.initialized = false;
        ema_gas.initialized = false;
        systemData.temperature = 0;
        systemData.humidity = 0;
        systemData.pressure = 0;
        systemData.gas_resistance = 0;
      }

      systemData.mq135_value = filtered_mq135;

      systemData.aqi = calculateComprehensiveAQI(
          systemData.pm2_5, systemData.pm10, systemData.mq135_value);

      Serial.printf("[Hệ Thống] AQI hiện tại: %d\n", systemData.aqi);
      Serial.println("=============================================\n");
      xSemaphoreGive(dataMutex);

      xEventGroupSetBits(dataReadyEvent, BIT_MQTT_READY);
    }

    vTaskDelayUntil(&lastWakeTime, pdMS_TO_TICKS(SENSOR_READ_INTERVAL_MS));
  }
}

void taskNetwork(void *pvParameters) {
  esp_task_wdt_add(NULL);
  Serial.println("[Network] Task khoi dong - Core " + String(xPortGetCoreID()));

  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setBufferSize(512);

  for (;;) {
    esp_task_wdt_reset();

    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[Network] Mat WiFi, dang thu ket noi lai...");
      wifiConfig.setMode(WIFI_MODE_LOST);
      WiFi.begin(wifiConfig.getSSID().c_str(), wifiConfig.getPass().c_str());
      vTaskDelay(pdMS_TO_TICKS(15000));
      continue;
    }
    wifiConfig.setMode(WIFI_MODE_CONNECTED);

    if (!mqttClient.connected()) {
      String clientId = "ESP32_AQI_" + String(random(0xffff), HEX);
      if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
        Serial.println("[MQTT] Ket noi OK!");
      } else {
        Serial.printf("[MQTT] Loi (rc=%d), thu lai sau 5s\n",
                      mqttClient.state());
        vTaskDelay(pdMS_TO_TICKS(5000));
        continue;
      }
    }
    mqttClient.loop();

    EventBits_t bits = xEventGroupWaitBits(
        dataReadyEvent, BIT_MQTT_READY, pdTRUE, pdFALSE, pdMS_TO_TICKS(1000));
    if (!(bits & BIT_MQTT_READY))
      continue;

    SharedData localCopy;
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      localCopy = systemData;
      xSemaphoreGive(dataMutex);
    } else {
      continue;
    }

    StaticJsonDocument<384> doc;
    doc["pm2_5"] = round(localCopy.pm2_5 * 10) / 10.0;
    doc["pm10"] = round(localCopy.pm10 * 10) / 10.0;
    doc["temperature"] = round(localCopy.temperature * 10) / 10.0;
    doc["humidity"] = round(localCopy.humidity * 10) / 10.0;
    doc["pressure"] = round(localCopy.pressure * 10) / 10.0;
    doc["gas_resistance"] = round(localCopy.gas_resistance * 10) / 10.0;
    doc["mq135"] = localCopy.mq135_value;
    doc["aqi"] = localCopy.aqi;
    doc["wifi_rssi"] = WiFi.RSSI();
    doc["uptime"] = millis() / 1000;

    String payload;
    serializeJson(doc, payload);

    if (mqttClient.publish(MQTT_TOPIC, payload.c_str())) {
      Serial.println("[MQTT] Publish thanh cong!");
    } else {
      Serial.println("[MQTT] Publish that bai!");
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== HE THONG GIAM SAT CHAT LUONG KHONG KHI - FreeRTOS ===");

  dataMutex = xSemaphoreCreateMutex();
  dataReadyEvent = xEventGroupCreate();

  if (dataMutex == NULL || dataReadyEvent == NULL) {
    Serial.println("FATAL: Khong tao duoc Mutex/EventGroup!");
    while (1) {
      delay(1000);
    }
  }

  initBME680();
  pmsSerial.begin(9600, SERIAL_8N1, RXD1, TXD1);

  wifiConfig.begin(WIFI_SSID, WIFI_PASSWORD);

  esp_task_wdt_config_t wdt_config = {.timeout_ms = WDT_TIMEOUT_S * 1000,
                                      .idle_core_mask = 0,
                                      .trigger_panic = true};
  esp_task_wdt_reconfigure(&wdt_config);

  xTaskCreatePinnedToCore(taskPMS, "PMS_UART", 3072, NULL, 3, NULL, 1);
  xTaskCreatePinnedToCore(taskSensors, "Sensors", 4096, NULL, 2, NULL, 1);
  xTaskCreatePinnedToCore(taskNetwork, "Network", 6144, NULL, 1, NULL, 0);

  Serial.println("=== Khoi tao FreeRTOS thanh cong! ===");
}

void loop() {
  wifiConfig.run();
  vTaskDelay(pdMS_TO_TICKS(100));
}