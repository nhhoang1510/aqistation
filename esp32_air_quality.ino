#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>
#include <HardwareSerial.h>
#include <ArduinoJson.h>

// --- WiFi & MQTT config ---
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;

WiFiClient espClient;
PubSubClient client(espClient);

// --- BME680 config ---
Adafruit_BME680 bme; // Sử dụng giao tiếp I2C (SCL, SDA)

// --- PMS5003 config ---
// Sử dụng HardwareSerial thay vì SoftwareSerial để ổn định hơn
HardwareSerial pmsSerial(1);
#define RXD1 16 // Nối với chân TX của PMS5003
#define TXD1 17 // Nối với chân RX của PMS5003

// --- MQ135 config ---
#define MQ135_PIN 34 // Chân đọc Analog cho MQ135

// --- SD Card config ---
#define SD_CS 5 // Chân Chip Select cho module SD Card

// Biến lưu dữ liệu
uint16_t pm1_0 = 0, pm2_5 = 0, pm10 = 0;
float temperature = 0, humidity = 0, pressure = 0, gas_resistance = 0;
int mq135_value = 0;
int aqi = 0;

void setup() {
  Serial.begin(115200);
  pmsSerial.begin(9600, SERIAL_8N1, RXD1, TXD1);

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);

  // Khởi tạo BME680
  if (!bme.begin()) {
    Serial.println("Không tìm thấy cảm biến BME680, kiểm tra lại dây nối!");
  } else {
    // Cài đặt thông số cho BME680
    bme.setTemperatureOversampling(BME680_OS_8X);
    bme.setHumidityOversampling(BME680_OS_2X);
    bme.setPressureOversampling(BME680_OS_4X);
    bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
    bme.setGasHeater(320, 150); // 320*C trong 150 ms
  }

  // Khởi tạo SD Card
  if (!SD.begin(SD_CS)) {
    Serial.println("Không thể mount SD Card!");
  } else {
    Serial.println("SD Card khởi tạo thành công.");
    File file = SD.open("/data.csv", FILE_APPEND);
    if (!file) {
      file = SD.open("/data.csv", FILE_WRITE);
      // Ghi header nếu file chưa tồn tại
      file.println("timestamp,pm1_0,pm2_5,pm10,temp,humidity,pressure,gas_res,mq135,aqi");
    }
    file.close();
  }
}

void setup_wifi() {
  delay(10);
  Serial.println();
  
  WiFi.mode(WIFI_STA);
  Serial.println("Đang chờ SmartConfig (Sử dụng app Esptouch)...");
  
  WiFi.beginSmartConfig();
  
  while (!WiFi.smartConfigDone()) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("");
  Serial.println("SmartConfig hoàn thành.");
  Serial.print("Đang kết nối WiFi: ");
  Serial.println(WiFi.SSID());
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("");
  Serial.println("WiFi đã kết nối");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Đang kết nối MQTT...");
    if (client.connect("ESP32_AirQuality_Client")) {
      Serial.println("Thành công");
    } else {
      Serial.print("Thất bại, rc=");
      Serial.print(client.state());
      Serial.println(" Thử lại sau 5s");
      delay(5000);
    }
  }
}

// Tính toán AQI đơn giản dựa trên PM2.5 theo chuẩn EPA
int calculateAQI(uint16_t pm25) {
  if (pm25 <= 12) return map(pm25, 0, 12, 0, 50);
  if (pm25 <= 35) return map(pm25, 13, 35, 51, 100);
  if (pm25 <= 55) return map(pm25, 36, 55, 101, 150);
  if (pm25 <= 150) return map(pm25, 56, 150, 151, 200);
  if (pm25 <= 250) return map(pm25, 151, 250, 201, 300);
  if (pm25 <= 350) return map(pm25, 251, 350, 301, 400);
  return map(pm25, 351, 500, 401, 500);
}

// Hàm đọc dữ liệu từ PMS5003
bool readPMS() {
  if (pmsSerial.available() < 32) {
    return false;
  }
  uint8_t buffer[32];
  pmsSerial.readBytes(buffer, 32);

  // Check header bytes
  if (buffer[0] == 0x42 && buffer[1] == 0x4D) {
    pm1_0 = (buffer[10] << 8) | buffer[11];
    pm2_5 = (buffer[12] << 8) | buffer[13];
    pm10 = (buffer[14] << 8) | buffer[15];
    return true;
  }
  return false;
}

// Ghi dữ liệu vào thẻ SD
void logToSD() {
  File file = SD.open("/data.csv", FILE_APPEND);
  if (file) {
    file.print(millis()); file.print(",");
    file.print(pm1_0); file.print(",");
    file.print(pm2_5); file.print(",");
    file.print(pm10); file.print(",");
    file.print(temperature); file.print(",");
    file.print(humidity); file.print(",");
    file.print(pressure); file.print(",");
    file.print(gas_resistance); file.print(",");
    file.print(mq135_value); file.print(",");
    file.println(aqi);
    file.close();
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  static unsigned long lastMsg = 0;
  unsigned long now = millis();
  
  // Đọc cảm biến và gửi dữ liệu mỗi 5 giây
  if (now - lastMsg > 5000) {
    lastMsg = now;

    // Đọc PMS5003 (Cần cho hàm readPMS lấy dần data vào buffer)
    readPMS();

    // Đọc BME680
    if (bme.performReading()) {
      temperature = bme.temperature;
      humidity = bme.humidity;
      pressure = bme.pressure / 100.0;
      gas_resistance = bme.gas_resistance / 1000.0; // KOhms
    }

    // Đọc MQ135
    mq135_value = analogRead(MQ135_PIN);

    // Tính AQI
    aqi = calculateAQI(pm2_5);

    // Chuẩn bị chuỗi JSON
    StaticJsonDocument<256> doc;
    doc["pm1_0"] = pm1_0;
    doc["pm2_5"] = pm2_5;
    doc["pm10"] = pm10;
    doc["temperature"] = temperature;
    doc["humidity"] = humidity;
    doc["pressure"] = pressure;
    doc["gas_resistance"] = gas_resistance;
    doc["mq135"] = mq135_value;
    doc["aqi"] = aqi;

    char out_buffer[256];
    serializeJson(doc, out_buffer);
    
    // Publish MQTT
    client.publish("sensor/airquality/hoang1510", out_buffer);

    // Lưu SD Card
    logToSD();

    Serial.println(out_buffer);
  }
}
