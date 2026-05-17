# Dự án Đo Chất Lượng Không Khí (AQI Station - Next.js & Vercel)
Dự án sử dụng ESP32 và các cảm biến để đo đạc chất lượng không khí. Dữ liệu được ESP32 gửi trực tiếp lên **Vercel API (HTTP POST)**, sau đó được tự động lưu vào **MongoDB**. Web Dashboard hiển thị dữ liệu thời gian thực được xây dựng bằng **Next.js** và **Tailwind CSS**.

## 1. Thành phần phần cứng
- **ESP32** (Microcontroller có tích hợp WiFi).
- **Cảm biến PMS5003**, **BME680**, **MQ135**.

## 2. Sơ đồ kết nối dây (Pinout)
- **PMS5003 (UART):** TX -> D16 | RX -> D17
- **BME680 (I2C):** SCL -> D22 | SDA -> D21
- **MQ135 (Analog):** A0 -> D34

## 3. Code ESP32 (Gửi HTTP POST thẳng lên Vercel)
Trong file `esp32_air_quality.ino`, tìm đến dòng sau và **đổi IP/Domain** thành URL thật của dự án trên Vercel của bạn (Vd: `https://aqi-station-web.vercel.app/api/upload`):
```cpp
const char* serverName = "http://<IP_MAY_TINH_CUA_BAN>:3000/api/upload"; 
```

## 4. Hướng dẫn Deploy lên Vercel & MongoDB Atlas (MIỄN PHÍ 100%)

### Bước 1: Tạo Database trên MongoDB Atlas
1. Đăng ký/Đăng nhập [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).
2. Tạo 1 Cluster miễn phí (M0 Free).
3. Trong phần Security -> Database Access, tạo 1 user và mật khẩu.
4. Trong phần Network Access, chọn "Allow Access From Anywhere" (IP: `0.0.0.0/0`).
5. Bấm **Connect** -> Chọn **Drivers** -> Copy chuỗi kết nối URI (`mongodb+srv://...`).

### Bước 2: Deploy toàn bộ Web Dashboard lên Vercel
1. Đẩy (Push) toàn bộ thư mục code (hoặc toàn bộ repo này) lên GitHub.
2. Đăng nhập [Vercel.com](https://vercel.com) bằng tài khoản GitHub.
3. Bấm **Add New... -> Project** và Import repo GitHub chứa thư mục `aqi-dashboard`.
4. Trong phần cài đặt Deploy của Vercel:
   - **Framework Preset**: Tự động nhận diện là `Next.js`.
   - **Root Directory**: Chọn thư mục `aqi-dashboard`.
   - **Environment Variables**: Thêm 1 biến có tên là `MONGODB_URI` và dán chuỗi kết nối Atlas của bạn vào đây.
5. Bấm **Deploy**. Chờ 2 phút là xong!

Truy cập đường link Vercel cấp để xem Dashboard mượt mà của bạn. Chúc mừng bạn đã có một kiến trúc Serverless IoT đỉnh cao!
