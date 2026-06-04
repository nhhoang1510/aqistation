/*
 * ESP32 Air Quality Monitor
 * WiFi: kết nối trực tiếp bằng SSID/Password
 * Filters: Moving Average (PM), EMA (BME680), Median (MQ135)
 * AQI: US EPA standard, tính từ PM2.5 và PM10
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>
#include <HardwareSerial.h>
#include <ArduinoJson.h>

// ─── Cấu hình WiFi ────────────────────────────────────────────────────────────
const char* WIFI_SSID     = "TP-Link_4DDC";
const char* WIFI_PASSWORD = "00000000";

// ─── Server ───────────────────────────────────────────────────────────────────
const char* SERVER_URL = "http://192.168.0.105:3000/api/upload"; // Trỏ về Local Server trên Laptop

// ─── Pins ─────────────────────────────────────────────────────────────────────
#define SDA_PIN    21
#define SCL_PIN    22
#define RXD1       16
#define TXD1       17
#define MQ135_PIN  34

// ─── Timing ───────────────────────────────────────────────────────────────────
#define SEND_INTERVAL_MS  10000   // chu kỳ gửi dữ liệu (ms) - Đã chỉnh thành 10s theo cảm biến BME680

// ─── Filter config ────────────────────────────────────────────────────────────
// Mỗi mẫu cách nhau SEND_INTERVAL_MS → cửa sổ lọc = SIZE × 10s
#define MA_SIZE    5      
#define MED_SIZE   11      
#define EMA_ALPHA  0.1f   


Adafruit_BME680 bme(&Wire);
HardwareSerial  pmsSerial(1);

bool bme_ok = false;

// ─── Moving Average – PMS5003 ─────────────────────────────────────────────────
struct MovingAvg {
  uint16_t buf[MA_SIZE] = {0};
  int      idx          = 0;
  int      count        = 0;

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

float pm2_5 = 0, pm10 = 0;   // output sau filter


struct EMA {
  float value = 0;
  bool  init  = false;

  float update(float raw) {
    if (!init) { value = raw; init = true; }
    else        value = EMA_ALPHA * raw + (1.0f - EMA_ALPHA) * value;
    return value;
  }
};

EMA ema_temp, ema_hum, ema_pres, ema_gas;

float temperature = 0, humidity = 0, pressure = 0, gas_resistance = 0;

// ─── Median Filter – MQ135 ────────────────────────────────────────────────────
struct MedianFilter {
  int buf[MED_SIZE] = {0};
  int idx           = 0;
  int count         = 0;

  void push(int val) {
    buf[idx] = val;
    idx = (idx + 1) % MED_SIZE;
    if (count < MED_SIZE) count++;
  }

  int get() const {
    if (count == 0) return 0;
    int tmp[MED_SIZE];
    memcpy(tmp, buf, sizeof(int) * count);
    // Insertion sort
    for (int i = 1; i < count; i++) {
      int key = tmp[i], j = i - 1;
      while (j >= 0 && tmp[j] > key) { tmp[j+1] = tmp[j]; j--; }
      tmp[j+1] = key;
    }
    return tmp[count / 2];
  }
};

MedianFilter med_mq135;

int mq135_value = 0;
int aqi         = 0;

// ─── AQI – US EPA (PM2.5 + PM10) ─────────────────────────────────────────────
// Trả về AQI từ nồng độ PM2.5 (µg/m³)
int aqiFromPM25(float c) {
  // Breakpoints: {C_lo, C_hi, AQI_lo, AQI_hi}
  const float bp[][4] = {
    {  0.0f,  12.0f,   0,  50},
    { 12.1f,  35.4f,  51, 100},
    { 35.5f,  55.4f, 101, 150},
    { 55.5f, 150.4f, 151, 200},
    {150.5f, 250.4f, 201, 300},
    {250.5f, 350.4f, 301, 400},
    {350.5f, 500.4f, 401, 500},
  };
  for (auto& b : bp) {
    if (c <= b[1]) {
      return (int)((b[3] - b[2]) / (b[1] - b[0]) * (c - b[0]) + b[2]);
    }
  }
  return 500;
}

// Trả về AQI từ nồng độ PM10 (µg/m³)
int aqiFromPM10(float c) {
  const float bp[][4] = {
    {  0,  54,   0,  50},
    { 55, 154,  51, 100},
    {155, 254, 101, 150},
    {255, 354, 151, 200},
    {355, 424, 201, 300},
    {425, 504, 301, 400},
    {505, 604, 401, 500},
  };
  for (auto& b : bp) {
    if (c <= b[1]) {
      return (int)((b[3] - b[2]) / (b[1] - b[0]) * (c - b[0]) + b[2]);
    }
  }
  return 500;
}

int calculateAQI(float pm25_avg, float pm10_avg) {
  int a25  = aqiFromPM25(pm25_avg);
  int a10  = aqiFromPM10(pm10_avg);
  return max(a25, a10);   // US EPA: lấy chỉ số cao nhất
}

// ─── WiFi ─────────────────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - start > 15000) {
      Serial.println("\n[WiFi] Timeout! Restarting...");
      ESP.restart();
    }
  }
  Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
}

// ─── BME680 ───────────────────────────────────────────────────────────────────
void initBME680() {
  Wire.begin(SDA_PIN, SCL_PIN);
  delay(100);

  Serial.println("[I2C] Scanning...");
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("  -> Device at 0x%02X\n", addr);
    }
  }

  uint8_t addrs[] = {0x76, 0x77};
  for (int a = 0; a < 2 && !bme_ok; a++) {
    for (int attempt = 1; attempt <= 3 && !bme_ok; attempt++) {
      Serial.printf("[BME] Trying 0x%02X (attempt %d)...\n", addrs[a], attempt);
      if (bme.begin(addrs[a])) {
        bme_ok = true;
        Serial.printf("[BME] Found at 0x%02X!\n", addrs[a]);
        bme.setTemperatureOversampling(BME680_OS_8X);
        bme.setHumidityOversampling(BME680_OS_2X);
        bme.setPressureOversampling(BME680_OS_4X);
        bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
        bme.setGasHeater(320, 150);
      } else {
        delay(200);
      }
    }
  }

  if (!bme_ok) {
    Serial.println("[BME] NOT FOUND! Kiem tra:");
    Serial.println("  VCC -> 3.3V | GND -> GND");
    Serial.println("  SDA -> GPIO21 | SCL -> GPIO22");
    Serial.println("  CS  -> 3.3V (bat buoc I2C mode)");
    Serial.println("  SDO -> GND (0x76) hoac 3.3V (0x77)");
  }
}

// ─── PMS5003 ──────────────────────────────────────────────────────────────────
bool readPMS() {
  if (pmsSerial.available() < 32) return false;

  uint8_t buf[32];
  pmsSerial.readBytes(buf, 32);

  if (buf[0] != 0x42 || buf[1] != 0x4D) return false;

  uint16_t raw_pm25 = (buf[12] << 8) | buf[13];
  uint16_t raw_pm10 = (buf[14] << 8) | buf[15];

  ma_pm25.push(raw_pm25);
  ma_pm10.push(raw_pm10);

  pm2_5 = ma_pm25.get();
  pm10  = ma_pm10.get();

  Serial.printf("[PMS] raw PM2.5=%-3d PM10=%-3d | avg PM2.5=%.1f PM10=%.1f\n",
                raw_pm25, raw_pm10, pm2_5, pm10);
  return true;
}



// ─── setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== ESP32 Air Quality Monitor ===");

  initBME680();
  pmsSerial.begin(9600, SERIAL_8N1, RXD1, TXD1);
  connectWiFi();

  Serial.println("=== Setup complete ===\n");
}

// ─── loop ─────────────────────────────────────────────────────────────────────
void loop() {
  static unsigned long lastSend = 0;

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Lost, reconnecting...");
    connectWiFi();
  }

  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();

    // 1. PMS5003 – Moving Average
    readPMS();

    // 2. BME680 – EMA
    if (bme_ok && bme.performReading()) {
      temperature    = ema_temp.update(bme.temperature);
      humidity       = ema_hum.update(bme.humidity);
      pressure       = ema_pres.update(bme.pressure / 100.0f);
      gas_resistance = ema_gas.update(bme.gas_resistance / 1000.0f);
      Serial.printf("[BME] T=%.1f°C  H=%.1f%%  P=%.1fhPa  Gas=%.1fkOhm\n",
                    temperature, humidity, pressure, gas_resistance);
    } else if (bme_ok) {
      Serial.println("[BME] performReading() failed!");
    }

    // 3. MQ135 – Median Filter
    med_mq135.push(analogRead(MQ135_PIN));
    mq135_value = med_mq135.get();

    // 4. AQI từ PM2.5 và PM10
    aqi = calculateAQI(pm2_5, pm10);

    // 5. JSON payload
    StaticJsonDocument<256> doc;
    doc["pm2_5"]          = (int)pm2_5;
    doc["pm10"]           = (int)pm10;
    doc["temperature"]    = round(temperature * 10) / 10.0;
    doc["humidity"]       = round(humidity * 10) / 10.0;
    doc["pressure"]       = round(pressure * 10) / 10.0;
    doc["gas_resistance"] = round(gas_resistance * 10) / 10.0;
    doc["mq135"]          = mq135_value;
    doc["aqi"]            = aqi;

    String payload;
    serializeJson(doc, payload);
    Serial.println(payload);

    // 6. HTTP POST
    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(payload);
    if (code > 0) {
      Serial.printf("[HTTP] Response: %d\n", code);
    } else {
      Serial.printf("[HTTP] Error: %s\n", http.errorToString(code).c_str());
    }
    http.end();
  }
}
