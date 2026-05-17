require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const mqtt = require('mqtt');
const cors = require('cors');
const path = require('path');
const SensorData = require('./models/SensorData');

const app = express();
app.use(cors());
app.use(express.static('public'));

// Kết nối MongoDB (Atlas hoặc Local)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aqistation';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Đã kết nối cơ sở dữ liệu MongoDB'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// Kết nối MQTT Broker (HiveMQ)
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com');

mqttClient.on('connect', () => {
  console.log('✅ Đã kết nối MQTT Broker (HiveMQ)');
  // Subscribe vào topic trùng với code ESP32 của bạn
  mqttClient.subscribe('sensor/airquality/hoang1510', (err) => {
    if (!err) {
      console.log('✅ Đã đăng ký lắng nghe topic: sensor/airquality/hoang1510');
    }
  });
});

// Xử lý dữ liệu khi có tin nhắn MQTT đẩy lên
mqttClient.on('message', async (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    console.log('📥 Nhận dữ liệu MQTT mới:', data);
    
    // Tạo bản ghi và lưu thẳng vào MongoDB
    const newRecord = new SensorData(data);
    await newRecord.save();
  } catch (error) {
    console.error('❌ Lỗi khi xử lý tin nhắn MQTT:', error);
  }
});

// --- API Routes cho Dashboard ---

// Lấy bản ghi mới nhất
app.get('/api/data/latest', async (req, res) => {
  try {
    const latest = await SensorData.findOne().sort({ timestamp: -1 });
    res.json(latest || {});
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Lấy lịch sử 20 bản ghi gần nhất để vẽ biểu đồ
app.get('/api/data/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = await SensorData.find().sort({ timestamp: -1 }).limit(limit);
    // Đảo ngược mảng để vẽ từ cũ tới mới trên đồ thị
    res.json(history.reverse());
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Trang chủ hiển thị Dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Khởi chạy Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại cổng ${PORT}`);
});
