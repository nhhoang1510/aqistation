# Hướng Dẫn Kết Nối Database và Deploy Vercel (Dự Án AQI)

Tài liệu này tập trung hướng dẫn người mới tham gia dự án cách thiết lập kết nối cơ sở dữ liệu (MongoDB) và đưa ứng dụng (Next.js Dashboard) lên môi trường mạng thực tế (Vercel).

---

## 📚 Phần 0: Bức Tranh Tổng Quan Về Công Nghệ (Dành cho người mới)

Trước khi đi vào cấu hình chi tiết, đây là lời giải thích dễ hiểu nhất về 4 mảnh ghép công nghệ chính cấu thành nên phần Mạng và Giao diện của dự án này:

### 1. Node.js là gì?
- **Khái niệm:** Thông thường, ngôn ngữ lập trình Javascript chỉ có thể chạy trên trình duyệt web (như Chrome, Safari). **Node.js** là một môi trường đột phá cho phép đem Javascript xuống chạy trực tiếp trên hệ điều hành của máy tính/server.
- **Vai trò trong dự án:** Được dùng để viết `local_server` (Trạm trung chuyển). Nhờ Node.js, máy tính của bạn có thể chạy một đoạn code 24/7 để liên tục lắng nghe tín hiệu MQTT từ mạch ESP32 gửi về.

### 2. MongoDB là gì?
- **Khái niệm:** Là một hệ quản trị cơ sở dữ liệu (Database) thuộc nhóm NoSQL. Khác với SQL truyền thống (như MySQL, SQL Server) phải chia cột, chia bảng (Table) cứng nhắc, MongoDB lưu dữ liệu dưới dạng các "Tài liệu" (Document) giống hệt định dạng JSON.
- **Vai trò trong dự án:** Cực kỳ phù hợp cho dự án IoT vì cảm biến thường trả dữ liệu về dạng JSON, ta chỉ việc bê nguyên cục JSON đó ném vào MongoDB là xong. Dự án dùng bản **MongoDB Atlas** (được lưu trữ trên mây) để code từ máy bạn hay từ Vercel đều truy cập được.

### 3. Next.js là gì?
- **Khái niệm:** Là một Framework (khung làm việc) cực kỳ mạnh mẽ xây dựng dựa trên thư viện React.js. Nó giúp tạo ra các trang web tải siêu nhanh.
- **Vai trò trong dự án:** Được dùng để xây dựng thư mục `aqi-dashboard` (Giao diện bảng điều khiển). Điểm "ăn tiền" nhất của Next.js là khả năng **Full-stack**: Nó cho phép chúng ta viết luôn cả **Backend API** (cụ thể là file `route.js` lấy data từ MongoDB) nằm chung ngay trong một dự án Frontend, bỏ qua hoàn toàn việc phải xây dựng thêm một server Backend phức tạp khác!

### 4. Vercel là gì?
- **Khái niệm:** Là một công ty cung cấp dịch vụ điện toán đám mây (Cloud Hosting). Đáng chú ý: **Vercel chính là công ty đã đẻ ra Next.js!** Do đó, không có nơi nào chạy ứng dụng Next.js mượt mà và tối ưu hơn Vercel.
- **Vai trò trong dự án:** Là nơi để chúng ta đưa Dashboard lên mạng Internet (Deploy). Khi bạn đẩy code lên Vercel, các hàm API kéo dữ liệu sẽ tự động biến thành **Serverless Functions** (Hàm không máy chủ). Điều này nghĩa là sẽ không có cái máy tính nào chạy tốn điện 24/7 cả. Chỉ khi nào có người mở web của bạn lên xem, Vercel mới "đánh thức" server dậy trong 0.1 giây để lấy dữ liệu rồi lại "ngủ" tiếp. Rất tối ưu và hoàn toàn miễn phí cho dự án nhỏ!

---

## 🗄️ Phần 1: Kết nối Cơ Sở Dữ Liệu (MongoDB Atlas)

Dự án sử dụng **MongoDB Atlas** (Cloud Database) để lưu trữ các bản ghi đo đạc từ trạm quan trắc không khí. Next.js Dashboard sẽ kết nối trực tiếp vào Database này để lấy dữ liệu vẽ biểu đồ.

### 1. Cấu trúc Schema (Mongoose)
Trong file `models/SensorData.js`, dữ liệu được định nghĩa với các trường:
- Bụi mịn: `pm2_5`, `pm10`
- Khí hậu: `temperature`, `humidity`, `pressure`
- Khí gas: `gas_resistance`, `mq135`
- Chỉ số tổng hợp: `aqi`
- Thời gian: `timestamp` (tự động tạo)

### 2. File kết nối Database
Kết nối được quản lý trong file `lib/mongodb.js`. 
- Trong môi trường phát triển (Development), kết nối sẽ được "cache" lại trong biến toàn cục `global.mongoose` để tránh việc tạo quá nhiều kết nối rác mỗi khi Next.js reload lại code.
- Trong môi trường sản phẩm (Production), kết nối sẽ được mở trực tiếp.

### 3. API Lấy Dữ Liệu (`app/api/data/route.js`)
Trình duyệt không kết nối thẳng vào database mà gọi qua một API trung gian (REST API).
Khi trình duyệt gọi `GET /api/data?limit=30`:
1. Mở kết nối đến MongoDB.
2. Dùng lệnh `SensorData.find().sort({ timestamp: -1 }).limit(30)` để lấy 30 bản ghi mới nhất.
3. Trả về mảng dữ liệu định dạng JSON cho Frontend xử lý.

---

## 🚀 Phần 2: Hướng dẫn Deploy lên Vercel

Vercel là nền tảng tối ưu nhất để chạy các ứng dụng Next.js. Khi deploy, thư mục `app/api` sẽ tự động biến thành **Serverless Functions** (chỉ chạy khi có người truy cập web, giúp tiết kiệm chi phí).

**Quy trình đưa dự án lên Vercel:**

### Bước 1: Chuẩn bị Code trên GitHub
1. Đảm bảo bạn đã đẩy (push) toàn bộ thư mục code lên một kho lưu trữ (Repository) trên tài khoản GitHub cá nhân.

### Bước 2: Khởi tạo Project trên Vercel
1. Đăng nhập vào trang quản trị [Vercel.com](https://vercel.com/) bằng chính tài khoản GitHub của bạn.
2. Nhấn nút **Add New Project**.
3. Vercel sẽ hiện ra danh sách các repository của bạn trên GitHub. Chọn nút **Import** ở repository chứa code dự án này.

### Bước 3: Cấu hình Thư mục gốc (Root Directory)
*Lưu ý cực kỳ quan trọng:* Dự án này chứa cả code C++ (Arduino) và Node.js server. Vercel không thể build toàn bộ.
1. Ở giao diện cấu hình của Vercel, tìm mục **Root Directory**.
2. Nhấn **Edit** và chọn đúng thư mục `aqi-dashboard` (đây là thư mục chứa mã nguồn của Web Next.js).

### Bước 4: Khai báo Biến môi trường (Environment Variables)
Mã nguồn trên GitHub sẽ không chứa file `.env` để bảo mật thông tin database. Bạn phải khai báo thủ công trên Vercel:
1. Mở rộng phần **Environment Variables**.
2. Nhập ô **Key**: `MONGODB_URI`
3. Nhập ô **Value**: Dán chuỗi kết nối MongoDB Atlas của bạn vào (Ví dụ: `mongodb+srv://<username>:<password>@cluster.mongodb.net/dbname`).
4. Nhấn **Add**.

### Bước 5: Build và Tận hưởng
1. Nhấn nút **Deploy**. 
2. Vercel sẽ tự động tải các gói NPM, tiến hành Build Next.js và khởi tạo Serverless Functions. Quá trình này mất khoảng 1-2 phút.
3. Sau khi thành công, Vercel sẽ cấp cho bạn một đường link HTTPS miễn phí (ví dụ: `aqi-dashboard.vercel.app`). Bạn có thể gửi link này cho bất kỳ ai để xem chỉ số không khí theo thời gian thực!

> 💡 **Mẹo:** Từ bây giờ trở đi, mỗi khi bạn gõ lệnh `git push` code mới lên GitHub, Vercel sẽ tự động phát hiện và Build lại giao diện mới nhất ngay lập tức mà bạn không cần phải thao tác lại các bước trên.