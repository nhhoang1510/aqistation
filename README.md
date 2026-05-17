# Dự án Đo Chất Lượng Không Khí (AQI Station)
Dự án sử dụng vi điều khiển ESP32 và các cảm biến (PMS5003, BME680, MQ135) để đo đạc các thông số chất lượng không khí. Dữ liệu được gửi lên MQTT Broker, sau đó một Server backend (Node.js) sẽ thu thập, lưu trữ vào cơ sở dữ liệu MongoDB và hiển thị lên một Web Dashboard thời gian thực cực kỳ hiện đại.

## 1. Thành phần phần cứng
- **ESP32** (Microcontroller có tích hợp WiFi).
- **Cảm biến PMS5003**: Đo nồng độ bụi mịn PM1.0, PM2.5, PM10.
- **Cảm biến BME680**: Đo nhiệt độ, độ ẩm, áp suất, chất lượng không khí.
- **Cảm biến MQ135**: Đo các khí độc hại.
- **Module thẻ nhớ MicroSD (SPI)**: Lưu trữ cục bộ.

## 2. Sơ đồ kết nối dây (Pinout)
**Cảm biến PMS5003 (UART):**
- VCC -> 5V | GND -> GND | TX -> Chân D16 | RX -> Chân D17

**Cảm biến BME680 (I2C):**
- VCC -> 3.3V | GND -> GND | SCL -> Chân D22 | SDA -> Chân D21

**Cảm biến MQ135 (Analog):**
- VCC -> 5V | GND -> GND | A0 -> Chân D34

**Module thẻ SD (SPI):**
- VCC -> 3.3V/5V | GND -> GND | MISO -> D19 | MOSI -> D23 | SCK -> D18 | CS -> D5

## 3. Cài đặt phần mềm cho ESP32
1. Cài đặt Arduino IDE và Board ESP32.
2. Cài đặt các thư viện: `PubSubClient`, `Adafruit_Sensor`, `Adafruit_BME680`, `ArduinoJson`.
3. Mở file `esp32_air_quality.ino`, kết nối cáp USB và ấn Upload.
4. Tải app **Esptouch** trên điện thoại.
5. Mở Serial Monitor (baudrate 115200), dùng Esptouch truyền mật khẩu WiFi để ESP32 kết nối mạng.
*Mạch sẽ tự động lấy dữ liệu và gửi lên MQTT qua địa chỉ `broker.hivemq.com`.*

## 4. Cài đặt Hệ thống Server Backend (Node.js + MongoDB)
Kiến trúc backend hiện tại vô cùng gọn nhẹ, sử dụng Node.js để xử lý logic và MongoDB để lưu trữ dữ liệu.

### Chạy thử trên máy tính (Local)
1. Đảm bảo máy tính đã cài đặt **Node.js** và **MongoDB**.
2. Mở Terminal (CMD) và truy cập vào thư mục `backend`.
3. Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```
4. Khởi chạy Server:
   ```bash
   npm start
   ```
5. Mở trình duyệt web truy cập vào: `http://localhost:3000` để xem Live Dashboard.

## 5. Hướng dẫn Deploy lên Cloud (Render.com + MongoDB Atlas) MIỄN PHÍ
Để hệ thống có thể chạy 24/7 và bạn có thể truy cập Web Dashboard từ điện thoại ở bất kỳ đâu, hãy làm theo các bước sau:

### Bước 1: Tạo Database trên MongoDB Atlas
1. Truy cập [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) và tạo một tài khoản miễn phí.
2. Tạo một Cluster (Gói M0 Free).
3. Trong phần Security -> Database Access, tạo 1 user và mật khẩu.
4. Trong phần Network Access, chọn "Allow Access From Anywhere" (IP: `0.0.0.0/0`).
5. Bấm nút **Connect** -> Chọn **Drivers** -> Copy lại chuỗi kết nối URI. (Đừng quên thay `<password>` bằng mật khẩu bạn vừa tạo).

### Bước 2: Deploy Web lên Render.com
1. Đẩy (Push) toàn bộ thư mục code của bạn lên GitHub.
2. Đăng nhập [Render.com](https://render.com), chọn tạo **New Web Service**.
3. Kết nối với tài khoản GitHub và chọn kho chứa code của bạn.
4. Cấu hình Render như sau:
   - **Name**: `aqistation-web` (Hoặc tên tuỳ thích).
   - **Language**: `Node`
   - **Root Directory**: `backend` (Rất quan trọng, phải gõ đúng chữ `backend`).
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Cuộn xuống phần **Environment Variables** (Biến môi trường) và thêm 1 biến:
   - **Key**: `MONGODB_URI`
   - **Value**: Dán chuỗi kết nối MongoDB Atlas mà bạn đã lấy ở Bước 1 vào đây.
6. Ấn **Create Web Service**. 

Sau khoảng 2-3 phút, Render sẽ cung cấp cho bạn một đường link dạng `https://aqistation-web.onrender.com`. Bạn có thể truy cập vào đó để xem Dashboard AQI vô cùng đẹp mắt! Dữ liệu từ ESP32 sẽ được tự động vẽ lên biểu đồ thông qua giao thức MQTT.
