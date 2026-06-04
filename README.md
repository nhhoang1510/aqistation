# 🌍 TÀI LIỆU ONBOARDING TOÀN DIỆN DỰ ÁN AQI IOT (BTL VXL)

Chào mừng bạn đến với tài liệu hướng dẫn kỹ thuật chuyên sâu của dự án **Hệ Thống Quan Trắc Không Khí Đa Thông Số (AQI IoT System)**. Tài liệu này được biên soạn để cung cấp cho bạn bức tranh toàn cảnh từ phần cứng vi điều khiển cấp thấp (Low-level Hardware) cho tới giao diện Web hiện đại cấp cao (High-level Frontend), cùng cách thức chúng giao tiếp với nhau theo **Kiến trúc IoT 4 Tầng chuẩn mực**.

Bất kể bạn tham gia vào khâu thiết kế phần cứng, viết script server hay làm frontend UI, tài liệu này sẽ là "kim chỉ nam" giúp bạn nắm vững mọi ngóc ngách của dự án.

---

## 🏗️ PHẦN 1: TỔNG QUAN KIẾN TRÚC 4 TẦNG (4-LAYER IOT ARCHITECTURE)

Dự án này là minh chứng rõ nét cho một hệ thống IoT hoàn chỉnh, bao gồm 4 tầng (Layer) được phân tách chức năng rõ ràng:

1. **Tầng 1: Perception Layer (Thiết bị & Cảm biến):** Xử lý tín hiệu điện, thu thập dữ liệu thô từ môi trường, lọc nhiễu thuật toán.
2. **Tầng 2: Network Layer (Mạng lưới truyền dẫn):** Bọc dữ liệu thành gói tin JSON và bắn lên đám mây thông qua Wi-Fi & MQTT Protocol.
3. **Tầng 3: Processing Layer (Xử lý & Lưu trữ):** Trạm Server Node.js hứng gói tin MQTT, lưu cục bộ làm backup (CSV) và đẩy lên Cloud Database (MongoDB).
4. **Tầng 4: Application Layer (Ứng dụng người dùng):** Giao diện Next.js Web Dashboard trực quan, tương tác trực tiếp với Database để vẽ biểu đồ Real-time.

Dưới đây, chúng ta sẽ đi sâu vào từng tầng.

---

## ⚡ PHẦN 2: TẦNG THIẾT BỊ & CẢM BIẾN (`/esp32_air_quality`)

Bộ não của phần cứng là vi điều khiển **ESP32**. Code được viết bằng C++ (Arduino IDE) và được thiết kế rất tối ưu với các thuật toán lọc số (Digital Filtering) để đảm bảo dữ liệu không bị sai lệch do nhiễu vật lý.

### 2.1 Các Thành Phần Cảm Biến

*   **BME680 (Giao tiếp I2C - SDA:21, SCL:22):** 
    *   Đo 4 thông số: Nhiệt độ (°C), Độ ẩm (%), Áp suất khí quyển (hPa) và Điện trở Khí gas (Gas Resistance - kΩ).
    *   Sử dụng cơ chế **Oversampling** và **IIR Filter** tích hợp sẵn của thư viện Adafruit để tăng độ chính xác.
*   **PMS5003 (Giao tiếp UART - RX:16, TX:17):** 
    *   Cảm biến bụi mịn Laser chuyên dụng. Nó bắn luồng dữ liệu 32-byte liên tục về ESP32.
    *   ESP32 parse luồng byte này để lấy nồng độ hạt **PM2.5** và **PM10** (đơn vị: µg/m³).
*   **MQ-135 (Giao tiếp Analog - Pin 34):**
    *   Cảm biến đo khí độc hại (CO, NH3, CO2, v.v.). Trả về giá trị điện áp từ 0-4095 (do ESP32 có ADC 12-bit).
*   **Module MicroSD (Giao tiếp SPI - CS:5):**
    *   Bảo vệ dữ liệu khỏi mất mát khi rớt mạng bằng cách ghi nối tiếp (append) trực tiếp vào thẻ nhớ vật lý gắn trên board.

### 2.2 Thuật Toán Xử Lý Tín Hiệu (DSP Algorithms)

ESP32 không gửi dữ liệu thô ngay lập tức mà áp dụng 3 bộ lọc khác nhau:
1.  **Moving Average (Trung bình động) cho Bụi mịn (PMS5003):** Tạo một mảng (buffer) lưu 5 giá trị gần nhất. Giá trị gửi đi là trung bình cộng của mảng này. Giúp làm phẳng các gai nhọn (spikes) do bụi bay lướt qua.
2.  **EMA (Exponential Moving Average) cho BME680:** Bộ lọc hàm mũ (Hệ số Alpha = 0.1). Giúp nhiệt độ và độ ẩm biến thiên mượt mà, bám sát xu hướng thay đổi chậm của thời tiết thay vì nhảy số liên tục.
3.  **Median Filter (Bộ lọc trung vị) cho MQ135:** Lấy 11 mẫu, sắp xếp (Insertion Sort) và lấy giá trị đứng ở giữa (Median). Đây là bộ lọc "vô địch" trong việc triệt tiêu nhiễu xung (impulse noise) đặc trưng của cảm biến điện hóa.

### 2.3 Thuật Toán Tính AQI (Theo chuẩn EPA Hoa Kỳ)

*   Sử dụng bảng Piecewise Linear (Hàm tuyến tính từng khúc) dựa trên tiêu chuẩn EPA của Mỹ.
*   Hệ thống tính `AQI_PM25`, `AQI_PM10`, `AQI_GAS`. Sau đó, chỉ số AQI tổng quát được quyết định bởi giá trị **tồi tệ nhất (Max)** trong 3 thông số này.

---

## 🌐 PHẦN 3: TẦNG TRUYỀN DẪN MQTT

Hệ thống **không dùng HTTP** ở thiết bị IoT vì HTTP quá nặng nề và tốn pin. Thay vào đó, nó dùng **MQTT** (Message Queuing Telemetry Transport).

*   **Broker:** Đang sử dụng server công cộng `broker.emqx.io` ở port 1883.
*   **Topic:** `aqistation/data`.
*   **Cơ chế:** ESP32 đóng vai trò là *Publisher* (Người xuất bản), cứ mỗi 10 giây (SEND_INTERVAL_MS), nó gộp 8 thông số lại thành 1 chuỗi JSON và bắn vào Topic.

**Ví dụ gói tin JSON từ ESP32:**
```json
{
  "pm2_5": 15.2,
  "pm10": 20.4,
  "temperature": 28.5,
  "humidity": 65.2,
  "pressure": 1012.3,
  "gas_resistance": 45.6,
  "mq135": 1200,
  "aqi": 58
}
```

---

## ⚙️ PHẦN 4: TRẠM XỬ LÝ TRUNG TÂM (LOCAL SERVER)

Thư mục `local_server/server.js` là một script Node.js đóng vai trò là "Nhà ga trung chuyển" (*Subscriber*).

*   **Kết nối MQTT:** Nó túc trực 24/7, lắng nghe Topic `aqistation/data`. Khi ESP32 bắn JSON lên, server này lập tức chộp lấy.
*   **Chiến lược Dual Storage (Lưu trữ Kép Vững Chắc):**
    1.  **Ổ cứng (Local CSV):** Mở file `database.csv` trên ổ cứng và ghi đè thêm 1 dòng. Đây là bước để giữ liệu an toàn tuyệt đối. Các nhà nghiên cứu Data Science rất chuộng format này.
    2.  **Đám Mây (MongoDB Atlas):** Dùng thư viện `Mongoose` định nghĩa Schema kiểu dáng dữ liệu. Sau đó, nó bọc gói JSON kia thành Document và thực hiện `await newRecord.save()` để đẩy thẳng lên Cloud Database. Nhờ vậy, Web Dashboard mới có thể lấy dữ liệu để vẽ biểu đồ!

---

## 🎨 PHẦN 5: WEB DASHBOARD VÀ HIỂN THỊ (NEXT.JS)

Nằm trong thư mục `aqi-dashboard`, đây là phần tương tác với người dùng cuối, được xây dựng cực kỳ công phu.

### 5.1 Công Nghệ Lõi
*   **Next.js (App Router):** Xử lý từ UI đến Server API.
*   **Tailwind CSS:** Thiết kế giao diện (Styling) theo phong cách hiện đại.
*   **Chart.js & react-chartjs-2:** Thư viện chịu trách nhiệm vẽ 6 biểu đồ đường (Line Chart) mượt mà cho 6 loại thông số.

### 5.2 Giao Diện Glassmorphism & Động Lực Học (Dynamic UI)

Giao diện không cứng nhắc mà phản ứng hoàn toàn theo chỉ số AQI:
*   Hàm `getAQIConfig(aqi)` kiểm tra mức độ ô nhiễm và trả về một bộ thiết lập giao diện (Config).
*   **Cấp độ màu (6 dải EPA):** Good (Xanh lá) ➔ Moderate (Vàng) ➔ Poor (Cam) ➔ Unhealthy (Đỏ) ➔ Severe (Tím) ➔ Hazardous (Đỏ sậm).
*   **Hiệu ứng:** 
    *   Màu gradient của khối hiển thị chính sẽ chuyển màu tương ứng.
    *   Emoji biểu cảm của nhân vật thay đổi (từ 😊 sang 😷, 🤮, ☠️).
    *   Thanh trượt mức độ ô nhiễm (AQI Scale Bar) sẽ di chuyển mũi tên đến đúng phần trăm (%) nguy hiểm hiện tại.
*   Các thẻ (Cards) bên dưới sử dụng kỹ thuật Glassmorphism (Kính mờ - `backdrop-blur-xl`) để tạo chiều sâu giao diện.

### 5.3 Backend API của Dashboard (`app/api/data/route.js`)

Đây là nơi cung cấp dữ liệu cho biểu đồ vẽ.
*   **Cải tiến đột phá:** Ban đầu file này đọc trực tiếp file `.csv` ở ổ cứng (C:\...). Nhưng để đưa lên môi trường Đám mây (Vercel), chúng ta đã viết lại hoàn toàn. 
*   **Cách hoạt động hiện tại:** Nó gọi module `lib/mongodb.js` để kết nối vào MongoDB Atlas. Sau đó dùng `SensorData.find().sort({ timestamp: -1 }).limit(limit)` để lấy N bản ghi mới nhất. Trả về mảng dữ liệu cho Frontend thông qua API chuẩn REST.

> [!TIP]
> Việc cho phép Client truyền param `?limit=...` kết hợp với Menu Dropdown "🕒 Time Selector" trên giao diện giúp người dùng có thể linh hoạt chuyển đổi xem dữ liệu 5 phút trước hay 24 giờ qua.

---

## 🚀 PHẦN 6: HƯỚNG DẪN DEPLOY LÊN VERCEL

Dự án này sinh ra là để chạy trên hệ sinh thái **Vercel** (nhà đẻ của Next.js). Khi Deploy, toàn bộ thư mục `app/api` sẽ được Vercel tự động biến thành **Serverless Functions**. Điều này có nghĩa là server không chạy ngầm tốn tiền 24/7, mà khi nào trình duyệt web request, server mới "tỉnh giấc" trong phần nghìn giây để móc dữ liệu từ MongoDB và trả về.

**Để deploy dự án lên Internet toàn cầu:**
1.  Đảm bảo code hiện tại đã push hết lên một kho lưu trữ (Repository) trên GitHub (như `nhhoang1510/aqistation`).
2.  Đăng nhập trang quản trị Vercel bằng tài khoản GitHub đó.
3.  Bấm **Add New Project**, chọn Repo `aqistation`.
4.  Ở phần Root Directory, nhớ chọn đúng thư mục `aqi-dashboard` (vì thư mục gốc chứa cả code Arduino và Node.js).
5.  Mở phần **Environment Variables** ra, nhập vào biến tên là `MONGODB_URI` và dán chuỗi kết nối (như trong file `.env`) vào.
6.  Bấm **Deploy** và tận hưởng! Vercel sẽ cấp cho bạn một domain HTTPS miễn phí mãi mãi.

---

## 💻 PHẦN 7: HƯỚNG DẪN CHẠY LOCAL KHI PHÁT TRIỂN

Nếu bạn là Developer mới tham gia, đây là quy trình để bạn chạy toàn bộ dự án trên máy tính của mình để fix bug:

**Bước 1: Nạp Code cho Mạch (Chỉ người làm phần cứng)**
*   Mở Arduino IDE, sửa `WIFI_SSID` và `PASSWORD` cho đúng mạng nhà bạn. Cắm cáp nạp code vào ESP32.

**Bước 2: Khởi động Trạm Trung Chuyển MQTT**
*   Mở Terminal thứ 1, gõ:
    ```bash
    cd "btl vxl/local_server"
    npm install
    node server.js
    ```
*   *(Nhìn màn hình báo "Đã kết nối MQTT Broker thành công" là yên tâm).*

**Bước 3: Chạy Web Dashboard**
*   Mở Terminal thứ 2, gõ:
    ```bash
    cd "btl vxl/aqi-dashboard"
    npm install
    npm run dev
    ```
*   Trình duyệt sẽ mở ra ở `http://localhost:3000`. Dashboard sẽ bắt đầu tự động refresh 5 giây một lần để kéo dữ liệu mới nhất.

---
*Chúc bạn có khoảng thời gian phát triển dự án vui vẻ và học hỏi được nhiều kiến thức!*
