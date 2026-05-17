# 🌍 Trạm Quan Trắc Chất Lượng Không Khí (AQI Station - Serverless IoT)

Dự án sử dụng vi điều khiển ESP32 kết hợp với các cảm biến để đo đạc chất lượng không khí. Điểm đặc biệt của kiến trúc này là sử dụng giải pháp **Serverless IoT (Không cần máy chủ nền)** kết hợp với Next.js và Vercel.

---

## 📊 Sơ Đồ Hệ Thống (Architecture Diagram)

```mermaid
sequenceDiagram
    participant S as Cảm Biến (PMS, BME, MQ)
    participant E as Vi Điều Khiển (ESP32)
    participant V_API as Vercel (Next.js API)
    participant DB as MongoDB Atlas (Cloud)
    participant V_WEB as Vercel (Web Dashboard)

    S->>E: Đo đạc chỉ số (PM2.5, Nhiệt độ...)
    E->>V_API: Gửi JSON qua HTTP POST (Mỗi 5s)
    V_API->>DB: Xác thực & Lưu bản ghi mới
    V_WEB->>V_API: Trình duyệt gọi HTTP GET định kỳ
    V_API->>DB: Truy vấn 15 bản ghi mới nhất
    DB-->>V_API: Trả về dữ liệu NoSQL
    V_API-->>V_WEB: Cập nhật biểu đồ & giao diện
```

---

## 🧠 Giải Thích Nguyên Lý Hoạt Động (Rất hữu ích cho Báo Cáo)

Hệ thống được thiết kế theo kiến trúc 3 lớp hiện đại, đảm bảo tính bảo mật, miễn phí vận hành và không cần máy chủ (Serverless):

### 1. Lớp Thu Thập Dữ Liệu (ESP32 & Sensors)
- ESP32 liên tục giao tiếp với các cảm biến qua các chuẩn: **UART** (PMS5003), **I2C** (BME680), và **Analog** (MQ135).
- Thay vì sử dụng giao thức MQTT truyền thống (đòi hỏi phải có một Broker chạy ngầm 24/7 như Mosquitto tốn kém tài nguyên), ESP32 được lập trình để **đóng gói dữ liệu thành chuẩn JSON** và gọi thẳng phương thức **HTTP POST** tới địa chỉ mạng của Vercel API.
- **Lợi ích**: Bỏ qua hoàn toàn bước trung gian, tương thích tuyệt đối với kiến trúc Serverless.

### 2. Lớp Máy Chủ & API (Next.js Backend trên Vercel)
Vercel cung cấp môi trường Serverless Functions (Hàm không máy chủ). Ứng dụng Next.js khai báo 2 đường dẫn API chính:
- **`POST /api/upload`**: Đầu nhận dữ liệu từ ESP32. Khi nhận được file JSON từ chip, API này lập tức thức dậy, "mở cửa" MongoDB và lưu trữ dữ liệu. Xong việc, API tự động "ngủ" để tiết kiệm RAM.
- **`GET /api/data?limit=15`**: API dành cho giao diện Web Frontend. Khi người dùng mở web, API này được gọi để truy vấn và lôi ra 15 bản ghi lịch sử gần nhất.

### 3. Lớp Lưu Trữ (MongoDB Atlas) & Giao Diện (React.js)
- **Cơ sở dữ liệu NoSQL (MongoDB)**: Phù hợp tuyệt đối với dữ liệu IoT. Toàn bộ JSON từ ESP32 được lưu nguyên bản thành các Documents cực kỳ nhanh.
- **Giao diện người dùng (Frontend)**: Được code bằng React.js và Tailwind CSS (giao diện kính mờ Glassmorphism). Ứng dụng áp dụng kỹ thuật **Polling** - trình duyệt sẽ tự động gọi lại API `GET` sau mỗi 5 giây để vẽ lại biểu đồ Chart.js (Real-time giả lập) mà người dùng không cần tải lại trang (F5).

---

## 🛠 Thành Phần Phần Cứng & Kết Nối (Pinout)
* **ESP32** (Microcontroller có tích hợp WiFi).
* **Cảm biến PMS5003 (Bụi mịn):** TX nối với D16 | RX nối với D17
* **Cảm biến BME680 (Nhiệt/Ẩm):** SCL nối với D22 | SDA nối với D21
* **Cảm biến MQ135 (Khí Độc):** Chân A0 nối với D34

---

## 🚀 Hướng Dẫn Chạy & Triển Khai Hệ Thống

### Bước 1: Tạo Database (MongoDB Atlas)
1. Đăng ký tài khoản tại [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) và tạo 1 Cluster miễn phí.
2. Truy cập mục **Security -> Database Access**, tạo 1 tài khoản (VD: User `admin`, Pass `123456`).
3. Truy cập mục **Network Access**, chọn **"Allow Access From Anywhere"** (Điền `0.0.0.0/0`) để Vercel có thể kết nối vào Database.
4. Bấm **Connect** -> Chọn **Drivers** (Node.js) -> Copy lại **Chuỗi kết nối (URI)**. Nó có dạng: `mongodb+srv://admin:123456@cluster0...`

### Bước 2: Test Code Trên Máy Tính (Tuỳ chọn)
1. Cài đặt Node.js. Mở Terminal tại thư mục `aqi-dashboard` và gõ `npm install` (Nếu bị lỗi chạy script thì gõ `npm.cmd install`).
2. Tạo file `.env` và dán chuỗi kết nối MongoDB vào: `MONGODB_URI=Chuỗi_Kết_Nối_Của_Bạn`.
3. Gõ `npm run dev` và truy cập `http://localhost:3000`.
4. **Mẹo Test Biểu đồ**: Bạn có thể vào trang web MongoDB Atlas -> Database `test` -> Collection `sensordatas` và bấm **Insert Document** để chèn một đoạn mã JSON ảo vào. F5 lại web localhost là biểu đồ sẽ vẽ theo!

### Bước 3: Đưa Web Lên Đám Mây (Deploy to Vercel)
1. Tải thư mục code này lên GitHub cá nhân của bạn.
2. Đăng nhập [Vercel.com](https://vercel.com), bấm **Add New... -> Project** và Import repo GitHub chứa code này.
3. Cài đặt Vercel:
   - **Framework Preset**: `Next.js`.
   - **Root Directory**: Chọn mục `aqi-dashboard`.
   - **Environment Variables**: Nhập Key là `MONGODB_URI` và Value là chuỗi kết nối Atlas của bạn.
4. Nhấn **Deploy**. Chờ 1-2 phút là bạn có một trang Web trạm thời tiết xịn sò!

### Bước 4: Cập Nhật Code Cho ESP32
1. Mở file `esp32_air_quality.ino`.
2. Sửa dòng cấu hình Server thành địa chỉ Web Vercel của bạn cộng thêm đuôi `/api/upload`:
   ```cpp
   const char* serverName = "https://ten-web-cua-ban.vercel.app/api/upload"; 
   ```
3. Lưu lại và Upload code vào ESP32. Cắm điện và thưởng thức thành quả!
