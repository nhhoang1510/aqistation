# Dự án Đo Chất Lượng Không Khí Đa Thông Số

Dự án này sử dụng vi điều khiển ESP32 và các cảm biến (PMS5003, BME680, MQ135) để đo đạc các thông số chất lượng không khí, tính toán chỉ số AQI, lưu trữ dữ liệu vào thẻ SD, và gửi dữ liệu lên server qua MQTT. Hệ thống server sử dụng InfluxDB để lưu trữ dữ liệu và Grafana để hiển thị lên Dashboard.

## 1. Thành phần phần cứng

- **ESP32** (Microcontroller có tích hợp WiFi).
- **Cảm biến PMS5003**: Đo nồng độ bụi mịn PM1.0, PM2.5, PM10.
- **Cảm biến BME680**: Đo nhiệt độ, độ ẩm, áp suất khí quyển, và chất lượng không khí (Gas Resistance/VOCs).
- **Cảm biến MQ135**: Đo các khí độc hại như CO2, NH3, NOx, Benzene.
- **Module thẻ nhớ MicroSD (SPI)**: Để lưu trữ cục bộ.
- Dây nối, breadboard, và nguồn cấp.

## 2. Sơ đồ kết nối dây (Pinout)


**Cảm biến PMS5003 (UART):**
- VCC -> 5V
- GND -> GND
- TX -> Chân D16 (RXD1) của ESP32
- RX -> Chân D17 (TXD1) của ESP32

**Cảm biến BME680 (I2C):**
- VCC -> 3.3V
- GND -> GND
- SCL -> Chân D22 của ESP32 (SCL mặc định)
- SDA -> Chân D21 của ESP32 (SDA mặc định)

**Cảm biến MQ135 (Analog):**
- VCC -> 5V
- GND -> GND
- A0 -> Chân D34 của ESP32

**Module thẻ SD (SPI):**
- VCC -> 3.3V / 5V (Tuỳ module)
- GND -> GND
- MISO -> Chân D19 của ESP32
- MOSI -> Chân D23 của ESP32
- SCK -> Chân D18 của ESP32
- CS -> Chân D5 của ESP32

## 3. Cài đặt phần mềm cho ESP32

1. Cài đặt **Arduino IDE**.
2. Cài đặt Board **ESP32** cho Arduino IDE.
3. Cài đặt các thư viện sau thông qua Library Manager (Sketch -> Include Library -> Manage Libraries):
   - `PubSubClient` (của Nick O'Leary)
   - `Adafruit_Sensor`
   - `Adafruit_BME680`
   - `ArduinoJson`
4. Mở file `esp32_air_quality/esp32_air_quality.ino`.
5. Sửa cấu hình MQTT broker ở đầu file (Không cần điền tên WiFi vì ta dùng SmartConfig):
   ```cpp
   const char* mqtt_server = "broker.hivemq.com";
   ```
6. Cắm cáp USB kết nối ESP32 và tải code xuống (Upload).
7. Tải ứng dụng **Esptouch** (hoặc ESP8266 SmartConfig) trên điện thoại (Android/iOS).
8. Mở Serial Monitor với baudrate 115200. Bạn sẽ thấy dòng "Đang chờ SmartConfig (Sử dụng app Esptouch)...".
9. Mở app Esptouch, nhập mật khẩu WiFi nhà bạn và ấn Confirm. ESP32 sẽ tự động nhận WiFi và kết nối.

## 4. Triển khai Hệ thống Backend (Chạy trực tiếp trên Windows)

Hệ thống Backend (Server) gồm các thành phần sau, bạn cần tải và cài đặt trực tiếp trên Windows:
- **Mosquitto (MQTT Broker)**: Nhận dữ liệu từ ESP32.
- **Telegraf**: Nhận dữ liệu từ Mosquitto và lưu vào InfluxDB.
- **InfluxDB**: Cơ sở dữ liệu Time-Series.
- **Grafana**: Dashboard hiển thị biểu đồ.

### Hướng dẫn cài đặt và chạy:

1. **Cài đặt InfluxDB (v2.x):**
   - Tải InfluxDB cho Windows từ trang chủ InfluxData.
   - Giải nén vào một thư mục (VD: `C:\influxdb`).
   - Mở Command Prompt (CMD) tại thư mục đó và chạy: `influxd.exe`. (Giữ cửa sổ này mở).
   - Vào trình duyệt gõ `http://localhost:8086`, thiết lập ban đầu: tạo Username, Password, Organization (VD: `iot_org`), và Bucket (VD: `airquality`).
   - Lấy chuỗi **API Token** vừa được tạo ra để dùng cho Telegraf và Grafana.

3. **Cài đặt Telegraf:**
   - Tải Telegraf cho Windows từ InfluxData.
   - Giải nén vào một thư mục (VD: `C:\telegraf`).
   - Copy nội dung file `backend/telegraf/telegraf.conf` trong dự án này đè vào file `telegraf.conf` của thư mục vừa giải nén.
   - Mở file `telegraf.conf` lên chỉnh sửa:
     - Thay đổi host InfluxDB thành `http://localhost:8086`.
     - Thay đổi host Mosquitto thành `tcp://broker.hivemq.com:1883`.
     - Cập nhật `token`, `organization`, `bucket` theo đúng cấu hình InfluxDB ở bước 2.
   - Mở CMD tại thư mục Telegraf và chạy: `telegraf.exe --config telegraf.conf`. (Giữ cửa sổ CMD này mở).

4. **Cài đặt Grafana:**
   - Tải bản cài đặt cho Windows từ trang chủ Grafana.
   - Cài đặt xong, chạy service Grafana hoặc mở CMD chạy `bin\grafana-server.exe` trong thư mục cài đặt.

## 5. Cấu hình Grafana Dashboard

1. Mở trình duyệt và truy cập Grafana theo địa chỉ: `http://localhost:3000` (hoặc IP của máy tính).
2. Đăng nhập với tài khoản:
   - **User**: `admin`
   - **Password**: `adminpassword`
3. Thêm Data Source (Nguồn dữ liệu):
   - Vào **Connections** -> **Data Sources** -> Chọn **Add new data source**.
   - Chọn **InfluxDB**.
   - Cấu hình InfluxDB:
     - Query Language: **Flux**
     - URL: `http://localhost:8086`
     - Tắt tuỳ chọn Basic Auth nếu không cần.
     - Trong phần InfluxDB Details:
       - Organization: `iot_org`
       - Token: `my-super-secret-auth-token`
       - Default Bucket: `airquality`
   - Nhấn **Save & test** để kiểm tra kết nối.
4. Tạo Dashboard:
   - Vào **Dashboards** -> **New Dashboard** -> **Add a new panel**.
   - Sử dụng giao diện Query builder (Flux) để chọn Bucket là `airquality`, Measurement là `mqtt_consumer`, Field là các thông số cảm biến (vd: `pm2_5`, `temperature`, `aqi`).
   - Tùy chỉnh biểu đồ (Time series, Gauge...) và lưu lại.

## 6. Tính toán AQI

Trong code hiện tại, chỉ số chất lượng không khí (AQI) đang được tính dựa trên nồng độ **PM2.5** theo tiêu chuẩn của EPA. Hàm `calculateAQI()` chuyển đổi giá trị PM2.5 sang mức AQI từ 0 đến 500.

## 7. Khắc phục sự cố (Troubleshoot)

- **ESP32 không lên kết nối WiFi / MQTT**: Kiểm tra lại việc thiết lập WiFi bằng SmartConfig. `mqtt_server` đảm bảo đang để là `broker.hivemq.com`.
- **Lỗi không tìm thấy thẻ SD**: Kiểm tra lại chân kết nối CS, định dạng thẻ SD ở FAT32.
- **Không có dữ liệu trong InfluxDB**: Kiểm tra ESP32 xem có gửi được lên MQTT hay không bằng cách dùng ứng dụng MQTT Explorer kết nối tới Broker. Hoặc kiểm tra cửa sổ CMD đang chạy Telegraf xem có báo lỗi cấu hình/kết nối không.

## 8. Hướng dẫn đưa hệ thống lên Internet (Deploy Production)

Để có thể truy cập hệ thống từ bất kỳ đâu (ví dụ: `weatherstation.com`) và các mạch ESP32 có thể gửi dữ liệu qua Internet thay vì chỉ trong mạng LAN, bạn có thể làm theo các bước kiến trúc sau:

### 1. Chuẩn bị Tài nguyên
- **Thuê VPS (Virtual Private Server):** Nên thuê máy chủ ảo chạy Linux (Ubuntu 22.04 hoặc 24.04). Các nhà cung cấp giá rẻ uy tín như DigitalOcean, Vultr, Linode, AWS EC2, Google Cloud (chi phí chỉ khoảng $5/tháng). Linux an toàn, nhẹ và tốn ít tài nguyên hơn Windows Server rất nhiều.
- **Mua Tên miền (Domain):** Mua tên miền tại Namecheap, Cloudflare, Hostinger, Mắt Bão (Ví dụ: `weatherstation.com`).

### 2. Cấu hình DNS
- Vào trang quản lý Tên miền của bạn và tạo các bản ghi (Record) để trỏ tên miền về **IP Public của VPS**:
  - `A Record`: `weatherstation.com` trỏ về `[IP_VPS]` (Dùng cho giao diện web Grafana).
  - `A Record`: `mqtt.weatherstation.com` trỏ về `[IP_VPS]` (Dùng cho kết nối từ mạch ESP32).

### 3. Triển khai Hệ thống trên VPS (Khuyên dùng lại Docker)
- Mặc dù bạn có thể cài trực tiếp trên Windows/Linux, nhưng khi đưa lên Internet, **Docker là tiêu chuẩn công nghiệp**. Nó giúp cài đặt nhanh, quản lý dễ dàng và tính cô lập bảo mật cao hơn rất nhiều so với cài trực tiếp.
- Kết nối vào VPS bằng SSH.
- Cài đặt `Docker` và `Docker Compose`.
- Copy thư mục `backend` của bạn lên VPS, truy cập vào thư mục đó và chạy lệnh:
  ```bash
  docker-compose up -d
  ```

### 4. Thiết lập Cửa ngõ (Nginx) & Bảo mật SSL (Let's Encrypt)
- Không nên mở trực tiếp cổng `3000` của Grafana ra Internet (ví dụ: truy cập kiểu `weatherstation.com:3000`). Thay vào đó:
- Cài đặt **Nginx** trên VPS để làm Reverse Proxy. Nginx sẽ nhận traffic chuẩn từ cổng `80/443` của tên miền và định tuyến ngầm vào cổng `3000` của Grafana.
- Sử dụng **Certbot** (Let's Encrypt) để tự động tạo và cài đặt chứng chỉ SSL miễn phí. Website của bạn sẽ chạy qua `HTTPS://` (có ổ khoá an toàn bảo mật).

### 5. Cấu hình Bảo mật (Bắt buộc)
Khi đưa lên mạng lưới Internet, hệ thống của bạn sẽ liên tục bị rà quét:
- **Tường lửa (UFW trên Ubuntu):** Chỉ cho phép mở các cổng cần thiết ra ngoài: `80` & `443` (Web/Nginx), `1883` hoặc `8883` (MQTT), `22` (SSH). **TUYỆT ĐỐI chặn** các cổng database như `8086` của InfluxDB từ bên ngoài mạng.
- **Mật khẩu MQTT:** Cần cấu hình và bật tính năng xác thực bằng `username` và `password` trong file cấu hình `mosquitto.conf` để tránh việc người lạ gửi dữ liệu rác vào hệ thống của bạn.

### 6. Cập nhật Code ESP32
- Trong file `esp32_air_quality.ino`, bạn tiến hành đổi IP Local thành Domain MQTT đã trỏ ở bước 2:
  ```cpp
  const char* mqtt_server = "mqtt.weatherstation.com";
  ```
- Nạp lại code cho mạch. Lúc này, bạn có thể mang mạch ESP32 đi bất cứ đâu trên thế giới (miễn là kết nối được WiFi) để đo đạc và nó sẽ tự động gửi dữ liệu về hệ thống máy chủ `weatherstation.com` của bạn.
