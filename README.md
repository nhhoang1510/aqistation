# 🌍 Trạm Quan Trắc Chất Lượng Không Khí (AQI Station - Serverless IoT)

Dự án sử dụng vi điều khiển ESP32 kết hợp với các cảm biến để đo đạc chất lượng không khí. Điểm đặc biệt của kiến trúc này là sử dụng giải pháp **Serverless IoT (Không cần máy chủ nền)**. Dữ liệu từ ESP32 sẽ được bắn trực tiếp thẳng lên hệ thống API của Vercel (Next.js) thông qua giao thức HTTP POST và lưu vào MongoDB.

---

## 📊 Sơ Đồ Hệ Thống (Architecture Diagram)

```mermaid
sequenceDiagram
    participant S as Cảm Biến (PMS, BME, MQ)
    participant E as Vi Điều Khiển (ESP32)
    participant V_API as Vercel (Next.js API)
    participant DB as Cơ Sở Dữ Liệu (MongoDB)
    participant V_WEB as Vercel (Web Dashboard)

    S->>E: Đo đạc chỉ số (PM2.5, Nhiệt độ...)
    E->>V_API: Gửi JSON qua HTTP POST (Cứ mỗi 5s)
    V_API->>DB: Xác thực & Lưu bản ghi mới
    V_WEB->>V_API: Trình duyệt người dùng gọi HTTP GET
    V_API->>DB: Truy vấn dữ liệu mới nhất
    DB-->>V_API: Trả về dữ liệu
    V_API-->>V_WEB: Cập nhật biểu đồ & giao diện
```

1. **Thu thập**: Cảm biến đo lường và đẩy dữ liệu cho ESP32.
2. **Truyền dẫn**: Trái với các hệ thống IoT cũ dùng MQTT, ESP32 ở đây gọi thẳng API HTTP POST của Vercel. Không cần phải thuê server chạy ngầm Mosquitto/Telegraf.
3. **Lưu trữ**: Vercel API nhận tín hiệu và lưu trữ vào MongoDB Atlas (Cloud Database).
4. **Hiển thị**: Web Dashboard (React/Next.js) lấy dữ liệu từ API và hiển thị dưới dạng đồ thị giao diện Glassmorphism hiện đại.

---

## 🛠 Thành Phần Phần Cứng & Kết Nối (Pinout)
* **ESP32** (Microcontroller có tích hợp WiFi).
* **Cảm biến PMS5003 (Bụi mịn):** TX nối với D16 | RX nối với D17
* **Cảm biến BME680 (Nhiệt/Ẩm):** SCL nối với D22 | SDA nối với D21
* **Cảm biến MQ135 (Khí Độc):** Chân A0 nối với D34

---

## 🚀 Hướng Dẫn Chạy & Triển Khai Hệ Thống

Dưới đây là các bước từ A-Z để bạn có thể tự mình đưa hệ thống này hoạt động trên Internet hoàn toàn miễn phí.

### Bước 1: Tạo Database (MongoDB Atlas)
Đầu tiên, chúng ta cần một chỗ chứa dữ liệu.
1. Đăng ký tài khoản tại [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).
2. Tạo 1 **Cluster miễn phí** (chọn gói M0 Free).
3. Truy cập mục **Security -> Database Access**, tạo 1 tài khoản (VD: User `admin`, Pass `123456`).
4. Truy cập mục **Network Access**, chọn **"Allow Access From Anywhere"** (Điền `0.0.0.0/0`) để Vercel có thể kết nối vào Database.
5. Quay lại trang chủ, bấm **Connect** -> Chọn **Drivers** (Node.js) -> Copy lại **Chuỗi kết nối (URI)**.
   *(Nó có dạng: `mongodb+srv://admin:123456@cluster0...`)*

### Bước 2: Chạy Thử Trên Máy Tính (Local Testing - Tuỳ chọn)
Để xem giao diện trước khi đưa lên mạng, bạn có thể chạy thử trên máy tính cá nhân.
1. Mở Terminal (CMD/PowerShell) tại thư mục `aqi-dashboard`.
2. Chạy lệnh cài đặt thư viện:
   ```bash
   npm install
   ```
3. Tạo một file tên là `.env` (ngang hàng với `package.json` trong `aqi-dashboard`), ghi vào đó:
   ```env
   MONGODB_URI=Dán_Chuỗi_Kết_Nối_Atlas_Của_Bạn_Vào_Đây
   ```
4. Khởi chạy Web:
   ```bash
   npm run dev
   ```
5. Mở trình duyệt truy cập `http://localhost:3000` để chiêm ngưỡng giao diện.

### Bước 3: Đưa Web Lên Đám Mây (Deploy to Vercel)
Bước này giúp mọi người trên thế giới có thể truy cập Web của bạn bằng điện thoại.
1. Tải toàn bộ thư mục code dự án này lên GitHub cá nhân của bạn.
2. Đăng nhập [Vercel.com](https://vercel.com).
3. Bấm **Add New... -> Project**, cấp quyền truy cập GitHub và Import kho chứa code này vào.
4. Ở màn hình cấu hình Deploy của Vercel, cài đặt như sau:
   - **Framework Preset**: Chắc chắn nó đang ghi là `Next.js`.
   - **Root Directory**: Nhấn Edit và chọn mục `aqi-dashboard`.
   - **Environment Variables**: Nhập Key là `MONGODB_URI` và Value là chuỗi kết nối Atlas (lấy ở Bước 1).
5. Nhấn **Deploy**. Ngồi uống ngụm nước và chờ 1-2 phút.
6. Khi hoàn tất, Vercel sẽ cấp cho bạn một tên miền (Ví dụ: `https://my-aqi-app.vercel.app`). Bấm vào đó để kiểm tra!

### Bước 4: Cập Nhật Code Cho ESP32
Giờ Web đã có mặt trên mạng Internet. Bạn cần bảo con chip ESP32 biết chỗ để gửi dữ liệu tới.
1. Mở file `esp32_air_quality.ino` bằng Arduino IDE.
2. Tìm đến dòng số 12:
   ```cpp
   const char* serverName = "http://<IP_MAY_TINH_CUA_BAN>:3000/api/upload"; 
   ```
3. Đổi nó thành địa chỉ Web Vercel mà bạn vừa nhận được ở Bước 3, cộng thêm đuôi `/api/upload`.
   Ví dụ:
   ```cpp
   const char* serverName = "https://my-aqi-app.vercel.app/api/upload"; 
   ```
4. Lưu lại, cắm cáp USB và bấm **Upload** nạp code vào ESP32.

🎉 **HOÀN TẤT!** 
Từ giờ, cứ cắm sạc dự phòng cho mạch ESP32 ở ban công, dữ liệu sẽ ngay lập tức bay thẳng lên MongoDB và hiện đồ thị Live Data siêu mượt trên điện thoại của bạn ở bất cứ đâu!
