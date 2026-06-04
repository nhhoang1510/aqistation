const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Tên file Database (CSV)
const dbFile = path.join(__dirname, 'database.csv');

// Tạo header cho file CSV nếu file chưa tồn tại
if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, "timestamp,pm2_5,pm10,temperature,humidity,pressure,gas_resistance,mq135,aqi\n");
    console.log("Đã tạo file database.csv mới.");
}

// API nhận dữ liệu từ ESP32
app.post('/api/upload', (req, res) => {
    const data = req.body;
    
    // Lấy thời gian hiện tại
    const timestamp = new Date().toISOString();
    
    // Tạo 1 dòng dữ liệu CSV
    const csvLine = `${timestamp},${data.pm2_5},${data.pm10},${data.temperature},${data.humidity},${data.pressure},${data.gas_resistance},${data.mq135},${data.aqi}\n`;
    
    // Ghi nối tiếp (append) vào file
    fs.appendFileSync(dbFile, csvLine);
    
    console.log(`[${timestamp}] Đã lưu dữ liệu: T=${data.temperature}°C, H=${data.humidity}%`);
    
    res.status(200).json({ message: "Lưu dữ liệu thành công!" });
});

// Chạy Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`===========================================`);
    console.log(`🚀 LOCAL SERVER ĐANG CHẠY!`);
    console.log(`👉 API Endpoint: http://localhost:${PORT}/api/upload`);
    console.log(`👉 ESP32 Endpoint: http://192.168.0.105:${PORT}/api/upload`);
    console.log(`===========================================`);
});
