#include "wifiConfig.h"

#include <Adafruit_BME680.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>
#include <HardwareSerial.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <esp_task_wdt.h>

// ==========================================
// PHẦN 1: CẤU HÌNH THÔNG SỐ (CONFIGURATION)
// ==========================================

// Cấu hình WiFi mặc định (sẽ dùng nếu chưa cài đặt qua Web WiFi Manager)
const char *WIFI_SSID = "TP-Link_4DDC";
const char *WIFI_PASSWORD = "00000000";

// Cấu hình máy chủ MQTT (Nơi gửi dữ liệu lên Internet)
const char *MQTT_SERVER = "broker.emqx.io";
const int MQTT_PORT = 1883;
const char *MQTT_USER = "";
const char *MQTT_PASS = "";
const char *MQTT_TOPIC = "aqistation/data";

// Khai báo các chân cắm vật lý (GPIO) nối với cảm biến
#define SDA_PIN 21       // Chân SDA của I2C (BME680)
#define SCL_PIN 22       // Chân SCL của I2C (BME680)
#define RXD1 16          // Chân nhận dữ liệu UART (PMS5003)
#define TXD1 17          // Chân gửi dữ liệu UART (PMS5003 - không dùng)
#define MQ135_PIN 34     // Chân đọc tín hiệu Analog (MQ135)

// ==========================================
// PHẦN 2: CẤU HÌNH BỘ LỌC VÀ HỆ ĐIỀU HÀNH
// ==========================================

// Kích thước các bộ lọc dữ liệu (chống nhiễu)
#define MA_SIZE 5        // Số mẫu cho bộ lọc Trung bình cộng (PMS5003)
#define MED_SIZE 11      // Số mẫu cho bộ lọc Trung vị (MQ135)
#define EMA_ALPHA 0.1f   // Hệ số làm mượt cho bộ lọc EMA (BME680)

// Thông số bù trừ nhiệt độ (BME680 bị nóng do bản thân nó sinh nhiệt)
#define TEMP_OFFSET (-3.0f) 

// Cấu hình thời gian cho hệ điều hành FreeRTOS
#define SENSOR_READ_INTERVAL_MS 10000 // Tần suất đọc cảm biến BME/MQ135: 10 giây/lần
#define WDT_TIMEOUT_S 30              // Thời gian tối đa của Watchdog (chống treo máy): 30s

// Cờ (Flag) dùng để báo hiệu giữa các Task: Báo cho Task Mạng biết đã có dữ liệu mới để gửi
#define BIT_MQTT_READY (1 << 0)

// ==========================================
// PHẦN 3: KHỞI TẠO CÁC ĐỐI TƯỢNG TOÀN CỤC
// ==========================================

WiFiClient espClient;                 // Đối tượng xử lý kết nối WiFi
PubSubClient mqttClient(espClient);   // Đối tượng xử lý giao thức MQTT
Adafruit_BME680 bme(&Wire);           // Đối tượng điều khiển BME680 qua I2C
HardwareSerial pmsSerial(1);          // Đối tượng đọc Serial (UART 1) cho PMS5003

volatile bool bme_ok = false;         // Biến lưu trạng thái BME680 có đang hoạt động không

SemaphoreHandle_t dataMutex;       // Ổ khóa (Mutex) để bảo vệ dữ liệu, tránh việc 2 task cùng đọc/ghi 1 lúc
EventGroupHandle_t dataReadyEvent; // Nhóm sự kiện (EventGroup) để các task "gọi" nhau

// Cấu trúc (Struct) lưu trữ toàn bộ dữ liệu đo được từ các cảm biến
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
SharedData systemData; // Biến toàn cục chứa dữ liệu thực tế

// ==========================================
// PHẦN 4: CÁC THUẬT TOÁN LỌC DỮ LIỆU
// ==========================================

// 1. Bộ lọc Trung bình trượt (Moving Average) - Dành cho bụi mịn (PM2.5, PM10)
// Tác dụng: Cộng dồn 5 giá trị gần nhất rồi chia trung bình để dữ liệu không bị nhảy chớp nhoáng.
struct MovingAvg {
  uint16_t buf[MA_SIZE] = {0}; // Mảng chứa 5 giá trị
  int idx = 0;                 // Vị trí con trỏ hiện tại
  int count = 0;               // Số lượng mẫu đã có
  
  // Hàm đẩy giá trị mới vào mảng
  void push(uint16_t val) {
    buf[idx] = val;
    idx = (idx + 1) % MA_SIZE; // Quay vòng (0-1-2-3-4-0...)
    if (count < MA_SIZE) count++;
  }
  
  // Hàm lấy ra giá trị trung bình
  float get() const {
    if (count == 0) return 0;
    float sum = 0;
    for (int i = 0; i < count; i++) sum += buf[i];
    return sum / count;
  }
};
MovingAvg ma_pm25, ma_pm10; // Tạo 2 bộ lọc cho PM2.5 và PM10

// 2. Bộ lọc Trung bình mũ (Exponential Moving Average) - Dành cho BME680
// Tác dụng: Làm mượt dữ liệu theo đồ thị hàm mũ, dữ liệu mới sẽ từ từ thay thế dữ liệu cũ.
struct EMA {
  float value = 0;
  bool initialized = false;
  
  float update(float raw) {
    if (!initialized) {
      value = raw; // Nếu là lần đo đầu tiên, lấy thẳng giá trị đó
      initialized = true;
    } else {
      // Công thức: 10% giá trị mới + 90% giá trị cũ
      value = EMA_ALPHA * raw + (1.0f - EMA_ALPHA) * value;
    }
    return value;
  }
};
EMA ema_temp, ema_hum, ema_pres, ema_gas;

// 3. Bộ lọc Trung vị (Median Filter) - Dành cho cảm biến Analog MQ135
// Tác dụng: Sắp xếp 11 giá trị từ thấp đến cao, lấy giá trị đứng ở giữa (bỏ qua các nhiễu quá thấp/quá cao).
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
    memcpy(tmp, buf, sizeof(int) * count); // Copy ra mảng tạm để sắp xếp
    
    // Thuật toán sắp xếp chèn (Insertion Sort)
    for (int i = 1; i < count; i++) {
      int key = tmp[i], j = i - 1;
      while (j >= 0 && tmp[j] > key) {
        tmp[j + 1] = tmp[j];
        j--;
      }
      tmp[j + 1] = key;
    }
    // Trả về phần tử nằm chính giữa mảng
    return tmp[count / 2];
  }
};
MedianFilter med_mq135;

// ==========================================
// PHẦN 5: CÁC HÀM TÍNH TOÁN CHỈ SỐ AQI
// ==========================================

// Hàm chuyển đổi nồng độ bụi PM2.5 (ug/m3) sang điểm AQI theo chuẩn EPA Hoa Kỳ
int aqiFromPM25(float c) {
  // Bảng phân cấp Breakpoints của EPA (Từ thấp đến cao)
  const float bp[][4] = {
      {0.0f, 12.0f, 0, 50},       {12.1f, 35.4f, 51, 100},
      {35.5f, 55.4f, 101, 150},   {55.5f, 150.4f, 151, 200},
      {150.5f, 250.4f, 201, 300}, {250.5f, 350.4f, 301, 400},
      {350.5f, 500.4f, 401, 500},
  };
  for (auto &b : bp) {
    // Công thức nội suy tuyến tính tính điểm AQI
    if (c <= b[1]) return (int)((b[3] - b[2]) / (b[1] - b[0]) * (c - b[0]) + b[2]);
  }
  return 500; // Mức tối đa
}

// Hàm chuyển đổi nồng độ bụi PM10 (ug/m3) sang điểm AQI theo chuẩn EPA Hoa Kỳ
int aqiFromPM10(float c) {
  const float bp[][4] = {
      {0, 54, 0, 50},       {55, 154, 51, 100},   {155, 254, 101, 150},
      {255, 354, 151, 200}, {355, 424, 201, 300}, {425, 504, 301, 400},
      {505, 604, 401, 500},
  };
  for (auto &b : bp) {
    if (c <= b[1]) return (int)((b[3] - b[2]) / (b[1] - b[0]) * (c - b[0]) + b[2]);
  }
  return 500;
}

// Hàm quy đổi điện áp (ADC) của cảm biến khí MQ135 sang điểm AQI ước lượng
int aqiFromMQ135(int analog_val) {
  if (analog_val < 500)  return map(analog_val, 0, 500, 0, 25);
  if (analog_val < 1000) return map(analog_val, 500, 1000, 25, 50);
  if (analog_val < 2000) return map(analog_val, 1001, 2000, 51, 100);
  if (analog_val < 3000) return map(analog_val, 2001, 3000, 101, 150);
  return map(analog_val, 3001, 4095, 151, 300);
}

// Hàm tính AQI tổng hợp (Lấy giá trị tồi tệ nhất giữa bụi 2.5 và bụi 10)
int calculateComprehensiveAQI(float pm25_avg, float pm10_avg, int mq135_val) {
  int a25 = aqiFromPM25(pm25_avg);
  int a10 = aqiFromPM10(pm10_avg);
  return max(a25, a10); // Tiêu chuẩn EPA: Lấy chất ô nhiễm có AQI cao nhất làm AQI chung
}

// ==========================================
// PHẦN 6: CÁC TASK HOẠT ĐỘNG (CHẠY SONG SONG BẰNG FREERTOS)
// ==========================================

// Hàm cấu hình và khởi động cảm biến BME680
void initBME680() {
  Wire.begin(SDA_PIN, SCL_PIN); // Mở chuẩn giao tiếp I2C
  delay(100);

  uint8_t addrs[] = {0x76, 0x77}; // Quét thử 2 địa chỉ I2C phổ biến của BME680
  for (int a = 0; a < 2 && !bme_ok; a++) {
    if (bme.begin(addrs[a])) {
      bme_ok = true;
      Serial.printf("[BME680] Tim thay tai 0x%02X\n", addrs[a]);
      // Cấu hình tăng cường độ chính xác (Oversampling) và kích hoạt mâm nhiệt (Heater)
      bme.setTemperatureOversampling(BME680_OS_8X);
      bme.setHumidityOversampling(BME680_OS_2X);
      bme.setPressureOversampling(BME680_OS_4X);
      bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
      bme.setGasHeater(320, 150); // Nung nóng cảm biến gas ở 320 độ C trong 150ms
    }
  }
  if (!bme_ok) Serial.println("[BME680] KHONG TIM THAY CAM BIEN!");
}

// --- TASK 1: Đọc cảm biến bụi PMS5003 (Chạy liên tục không ngừng) ---
void taskPMS(void *pvParameters) {
  esp_task_wdt_add(NULL); // Đăng ký Task này vào danh sách theo dõi của Watchdog (chống treo máy)
  Serial.println("[PMS5003] Task khoi dong - Core " + String(xPortGetCoreID()));

  unsigned long lastReceiveTime = millis();
  bool pms_connected = true;
  unsigned long lastPrintTime = 0;

  for (;;) { // Vòng lặp vô hạn của Task
    esp_task_wdt_reset(); // Vuốt ve Watchdog (báo cáo là máy không bị treo)

    // NẾU KHÔNG CÓ DỮ LIỆU GỬI ĐẾN (Bị đứt cáp hoặc cảm biến hỏng)
    if (pmsSerial.available() < 1) {
      if (millis() - lastReceiveTime > 5000) { // Nếu quá 5 giây không thấy gì
        if (pms_connected) pms_connected = false;
        
        // Cứ 5s in ra màn hình 1 lần dòng cảnh báo
        if (millis() - lastPrintTime > 5000) {
          lastPrintTime = millis();
          Serial.println("-----------------------------");
          Serial.println("[LỖI] Không tìm thấy cảm biến PMS5003, vui lòng kiểm tra kết nối dây!");
          Serial.println("-----------------------------");
        }

        // Lấy chìa khóa (Mutex) để an toàn thay đổi biến dùng chung
        if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
          systemData.pm2_5 = 0; // Đặt bụi về 0
          systemData.pm10 = 0;
          // Xóa sạch bộ nhớ lịch sử của bộ lọc
          ma_pm25.count = 0; ma_pm25.idx = 0;
          ma_pm10.count = 0; ma_pm10.idx = 0;
          xSemaphoreGive(dataMutex); // Trả lại chìa khóa
        }
      }
      vTaskDelay(pdMS_TO_TICKS(10)); // Tạm nghỉ 10ms để nhường CPU cho việc khác
      continue;
    }

    // NẾU CÓ DỮ LIỆU: Tìm byte bắt đầu (Header) của PMS5003 (Mã Hex: 0x42 và 0x4D)
    uint8_t startByte = pmsSerial.read();
    if (startByte != 0x42) continue;

    unsigned long waitStart = millis();
    while (!pmsSerial.available()) {
      if (millis() - waitStart > 100) break;
      vTaskDelay(pdMS_TO_TICKS(1));
    }
    if (!pmsSerial.available()) continue;

    uint8_t secondByte = pmsSerial.read();
    if (secondByte != 0x4D) continue;
    
    // Khi đã thấy đủ 2 byte Header, chuẩn bị mảng trống 30 byte để hứng phần còn lại
    uint8_t buf[30];
    waitStart = millis();
    int bytesRead = 0;
    while (bytesRead < 30) {
      if (pmsSerial.available()) {
        buf[bytesRead++] = pmsSerial.read(); // Gom từng byte vào mảng
      } else if (millis() - waitStart > 200) {
        break; // Lỗi Time-out nếu chờ quá lâu
      } else {
        vTaskDelay(pdMS_TO_TICKS(1));
      }
    }
    if (bytesRead < 30) continue;

    // Tính toán mã xác thực (Checksum) để đảm bảo không bị lỗi đường truyền
    uint16_t checksum_received = ((uint16_t)buf[28] << 8) | buf[29];
    uint16_t checksum_calc = 0x42 + 0x4D;
    for (int i = 0; i < 28; i++) checksum_calc += buf[i];
    if (checksum_calc != checksum_received) continue; // Nếu sai Checksum -> Loại bỏ gói tin này

    // --- Bắt đầu bóc tách dữ liệu từ mảng Byte ---
    uint16_t raw_pm1_0 = ((uint16_t)buf[8] << 8) | buf[9];
    uint16_t raw_pm25 = ((uint16_t)buf[10] << 8) | buf[11];
    uint16_t raw_pm10 = ((uint16_t)buf[12] << 8) | buf[13];

    uint16_t p0_3 = ((uint16_t)buf[14] << 8) | buf[15];
    uint16_t p0_5 = ((uint16_t)buf[16] << 8) | buf[17];
    uint16_t p1_0 = ((uint16_t)buf[18] << 8) | buf[19];
    uint16_t p2_5 = ((uint16_t)buf[20] << 8) | buf[21];
    uint16_t p5_0 = ((uint16_t)buf[22] << 8) | buf[23];
    uint16_t p10_0 = ((uint16_t)buf[24] << 8) | buf[25];

    lastReceiveTime = millis(); // Cập nhật thời điểm nhận dữ liệu cuối cùng
    pms_connected = true;

    // Cứ 5 giây in kết quả bụi ra màn hình Serial 1 lần
    if (millis() - lastPrintTime > 5000) {
      lastPrintTime = millis();
      Serial.println("-----------------------------");
      Serial.println("[PMS5003]");
      Serial.println("Concentration Units (atmospheric)");
      Serial.printf("PM 1.0: %-9d PM 2.5: %-9d PM 10: %-9d\n", raw_pm1_0, raw_pm25, raw_pm10);
      Serial.println("-----------------------------");
      Serial.println("Particles > 0.3um / 0.1L air:");
      Serial.printf("0.3um: %-9d 0.5um: %-9d 1.0um: %-9d\n", p0_3, p0_5, p1_0);
      Serial.printf("2.5um: %-9d 5.0um: %-9d 10um: %-9d\n", p2_5, p5_0, p10_0);
      Serial.println("-----------------------------");
    }

    // Đẩy dữ liệu PM2.5 và PM10 mới nhận vào bộ lọc Trung bình cộng và cập nhật lên biến toàn cục
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

// --- TASK 2: Đọc cảm biến MQ135 và BME680 (10 giây chạy 1 lần) ---
void taskSensors(void *pvParameters) {
  esp_task_wdt_add(NULL);
  Serial.println("[Sensors] Task khoi dong - Core " + String(xPortGetCoreID()));

  TickType_t lastWakeTime = xTaskGetTickCount();

  for (;;) {
    esp_task_wdt_reset();

    // -- Xử lý Cảm biến khí gas MQ135 --
    int raw_mq135 = analogRead(MQ135_PIN); // Đọc điện áp dạng Analog (0-4095)
    int filtered_mq135 = 0;

    Serial.println("\n=============================================");
    Serial.println("[MQ135]");
    
    // Nếu mức điện áp quá thấp (<50) hoặc chạm trần (4095), nghĩa là đang bị lỗi nối dây
    if (raw_mq135 < 50 || raw_mq135 == 4095) {
      Serial.println("[LỖI] Không tìm thấy cảm biến MQ135 (hoặc dữ liệu bất thường), vui lòng kiểm tra kết nối dây!");
      med_mq135.count = 0; med_mq135.idx = 0; // Xóa bộ lọc
      filtered_mq135 = 0;
    } else {
      med_mq135.push(raw_mq135); // Đưa vào bộ lọc Trung vị
      filtered_mq135 = med_mq135.get(); // Lấy giá trị đã làm mượt
      
      // Công thức quy đổi giá trị ADC thành điện trở Rs của cảm biến
      float Vrl = raw_mq135 * (3.3 / 4095.0);
      float Rs = (Vrl > 0) ? ((3.3 * 10000.0 / Vrl) - 10000.0) : 0;
      Serial.printf("ADC: %-5d Rs: %.1f Ohm\n", raw_mq135, Rs);
    }
    Serial.println("-----------------------------");

    // -- Xử lý Cảm biến môi trường BME680 --
    float t = 0, h = 0, p = 0, g = 0;
    bool bme_reading_ok = (bme_ok && bme.performReading()); // Lệnh yêu cầu BME680 đọc dữ liệu

    if (bme_reading_ok) {
      t = bme.temperature + TEMP_OFFSET; // Cộng thêm giá trị bù trừ sai số nhiệt
      h = bme.humidity;
      p = bme.pressure / 100.0f; // Đổi sang đơn vị hPa
      g = bme.gas_resistance / 1000.0f; // Đổi sang đơn vị KOhms

      Serial.println("[BME680]");
      Serial.printf("Nhiệt độ: %.2f °C (Đã bù trừ %.2f °C)\n", t, TEMP_OFFSET);
      Serial.printf("Độ ẩm:    %.2f %%\n", h);
      Serial.printf("Áp suất:  %.2f hPa\n", p);
      Serial.printf("Điện trở Khí: %.2f KOhms\n", g);
    } else {
      Serial.println("[LỖI] Không tìm thấy cảm biến BME680, vui lòng kiểm tra kết nối dây!");
    }
    Serial.println("-----------------------------");

    // Cập nhật tất cả dữ liệu (BME680, MQ135) vào biến hệ thống và Tính AQI
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      if (bme_reading_ok) {
        // Đưa qua bộ lọc EMA
        systemData.temperature = ema_temp.update(t);
        systemData.humidity = ema_hum.update(h);
        systemData.pressure = ema_pres.update(p);
        systemData.gas_resistance = ema_gas.update(g);
      } else {
        // Nếu BME680 lỗi, xóa sạch bộ lọc và set về 0
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

      // Tính tổng hợp chỉ số ô nhiễm không khí AQI
      systemData.aqi = calculateComprehensiveAQI(systemData.pm2_5, systemData.pm10, systemData.mq135_value);

      Serial.printf("[Hệ Thống] AQI hiện tại: %d\n", systemData.aqi);
      Serial.println("=============================================\n");
      xSemaphoreGive(dataMutex);

      // Kích hoạt Cờ (Flag) báo cho Task Mạng biết: "Đã tổng hợp xong dữ liệu, gửi đi!"
      xEventGroupSetBits(dataReadyEvent, BIT_MQTT_READY);
    }

    // Task này đi ngủ 10 giây (10000ms), sau 10 giây tự tỉnh dậy lặp lại vòng lặp
    vTaskDelayUntil(&lastWakeTime, pdMS_TO_TICKS(SENSOR_READ_INTERVAL_MS));
  }
}

// --- TASK 3: Quản lý WiFi và gửi dữ liệu MQTT lên Internet ---
void taskNetwork(void *pvParameters) {
  esp_task_wdt_add(NULL);
  Serial.println("[Network] Task khoi dong - Core " + String(xPortGetCoreID()));

  mqttClient.setServer(MQTT_SERVER, MQTT_PORT); // Thiết lập địa chỉ Server MQTT
  mqttClient.setBufferSize(512); // Tăng kích thước bộ đệm (vì gói JSON khá dài)

  for (;;) {
    esp_task_wdt_reset();

    // Kiểm tra kết nối WiFi
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[Network] Mat WiFi, dang thu ket noi lai...");
      wifiConfig.setMode(WIFI_MODE_LOST);
      WiFi.begin(wifiConfig.getSSID().c_str(), wifiConfig.getPass().c_str());
      vTaskDelay(pdMS_TO_TICKS(15000)); // Chờ 15s rồi mới thử lại
      continue;
    }
    wifiConfig.setMode(WIFI_MODE_CONNECTED); // Đèn LED xanh lá (Kết nối thành công)

    // Kiểm tra kết nối MQTT
    if (!mqttClient.connected()) {
      // Tạo một cái ID ngẫu nhiên để không bị trùng với thiết bị khác
      String clientId = "ESP32_AQI_" + String(random(0xffff), HEX);
      if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
        Serial.println("[MQTT] Ket noi OK!");
      } else {
        Serial.printf("[MQTT] Loi (rc=%d), thu lai sau 5s\n", mqttClient.state());
        vTaskDelay(pdMS_TO_TICKS(5000));
        continue;
      }
    }
    mqttClient.loop(); // Lệnh duy trì nhịp tim kết nối (Ping) với Server MQTT

    // Đứng chờ Cờ (Flag) từ TaskSensors gửi tới (báo hiệu có dữ liệu mới)
    EventBits_t bits = xEventGroupWaitBits(dataReadyEvent, BIT_MQTT_READY, pdTRUE, pdFALSE, pdMS_TO_TICKS(1000));
    if (!(bits & BIT_MQTT_READY)) continue; // Nếu chờ 1 giây không thấy cờ, quay lại vòng lặp

    // Copy bộ dữ liệu ra một biến tạm để xử lý (tránh giam giữ Mutex quá lâu làm chậm các Task khác)
    SharedData localCopy;
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      localCopy = systemData;
      xSemaphoreGive(dataMutex);
    } else {
      continue;
    }

    // Đóng gói dữ liệu thành định dạng JSON để gửi qua mạng
    StaticJsonDocument<384> doc;
    doc["pm2_5"] = round(localCopy.pm2_5 * 10) / 10.0;
    doc["pm10"] = round(localCopy.pm10 * 10) / 10.0;
    doc["temperature"] = round(localCopy.temperature * 10) / 10.0;
    doc["humidity"] = round(localCopy.humidity * 10) / 10.0;
    doc["pressure"] = round(localCopy.pressure * 10) / 10.0;
    doc["gas_resistance"] = round(localCopy.gas_resistance * 10) / 10.0;
    doc["mq135"] = localCopy.mq135_value;
    doc["aqi"] = localCopy.aqi;
    doc["wifi_rssi"] = WiFi.RSSI(); // Cường độ sóng WiFi
    doc["uptime"] = millis() / 1000; // Thời gian chạy từ lúc bật máy (giây)

    String payload;
    serializeJson(doc, payload); // Chuyển từ mảng Json sang chuỗi String

    // Xuất chuỗi đó lên Topic MQTT
    if (mqttClient.publish(MQTT_TOPIC, payload.c_str())) {
      Serial.println("[MQTT] Publish thanh cong!");
    } else {
      Serial.println("[MQTT] Publish that bai!");
    }
  }
}

// ==========================================
// PHẦN 7: HÀM SETUP (CHẠY ĐẦU TIÊN MỘT LẦN DUY NHẤT)
// ==========================================
void setup() {
  Serial.begin(115200); // Mở cổng Serial tốc độ 115200
  delay(500);
  Serial.println("\n=== HE THONG GIAM SAT CHAT LUONG KHONG KHI - FreeRTOS ===");

  // Tạo các cơ chế quản lý đa luồng (Đồng bộ hóa)
  dataMutex = xSemaphoreCreateMutex();
  dataReadyEvent = xEventGroupCreate();

  if (dataMutex == NULL || dataReadyEvent == NULL) {
    Serial.println("FATAL: Khong tao duoc Mutex/EventGroup!");
    while (1) { delay(1000); } // Lỗi nặng, kẹt ở đây vĩnh viễn
  }

  // Khởi động các cổng cứng
  initBME680();
  pmsSerial.begin(9600, SERIAL_8N1, RXD1, TXD1);

  // Kích hoạt thư viện WiFi tự chế (wifiConfig.h) - Bật chế độ Captive Portal (Web cấu hình)
  wifiConfig.begin(WIFI_SSID, WIFI_PASSWORD);

  // Kích hoạt còi báo động treo máy (Watchdog Timer - 30 giây)
  esp_task_wdt_config_t wdt_config = {.timeout_ms = WDT_TIMEOUT_S * 1000,
                                      .idle_core_mask = 0,
                                      .trigger_panic = true}; // Nếu bị treo, ép ESP32 tự Reset
  esp_task_wdt_reconfigure(&wdt_config);

  // PHÂN CHIA NHIỆM VỤ (Tạo các Task giao cho 2 Nhân CPU của ESP32 xử lý)
  // Task PMS chạy ở Core 1 (ưu tiên cao 3)
  xTaskCreatePinnedToCore(taskPMS, "PMS_UART", 3072, NULL, 3, NULL, 1);
  // Task Cảm biến chạy ở Core 1 (ưu tiên 2)
  xTaskCreatePinnedToCore(taskSensors, "Sensors", 4096, NULL, 2, NULL, 1);
  // Task Mạng chạy độc lập ở Core 0 (ưu tiên 1) để không ảnh hưởng đến phần cứng
  xTaskCreatePinnedToCore(taskNetwork, "Network", 6144, NULL, 1, NULL, 0);

  Serial.println("=== Khoi tao FreeRTOS thanh cong! ===");
}

// ==========================================
// PHẦN 8: HÀM LOOP (CHẠY VÒNG LẶP LIÊN TỤC TRÊN CORE 1)
// ==========================================
void loop() {
  wifiConfig.run(); // Hàm này chạy ngầm để điều khiển đèn LED báo WiFi và quét nút bấm Reset WiFi
  vTaskDelay(pdMS_TO_TICKS(100)); // Nghỉ 0.1s cho đỡ nóng chip
}