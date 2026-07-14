require('dotenv').config();
const mqtt = require('mqtt');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Mongoose Schema cho MongoDB
const sensorDataSchema = new mongoose.Schema({
  pm2_5: Number,
  pm10: Number,
  temperature: Number,
  humidity: Number,
  pressure: Number,
  gas_resistance: Number,
  mq135: Number,
  aqi: Number,
  wifi_rssi: Number,
  uptime: Number,
  timestamp: { type: Date, default: Date.now }
});
const SensorData = mongoose.models.SensorData || mongoose.model('SensorData', sensorDataSchema);

// Hàm lấy tên file CSV theo ngày (YYMMDD.csv)
function getDailyCsvFile() {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const filename = `${year}${month}${day}.csv`;
  const filepath = path.join(__dirname, filename);
  
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, "timestamp,pm2_5,pm10,temperature,humidity,pressure,gas_resistance,mq135,aqi\n");
    console.log(`Đã tạo file mới: ${filename}`);
  }
  return filepath;
}

// Cấu hình MQTT (Đồng bộ với cấu hình trên ESP32)
const MQTT_SERVER = "mqtt://broker.emqx.io";
const MQTT_TOPIC = "aqistation/data";

async function main() {
  console.log(`===========================================`);
  console.log(`🚀 LOCAL SERVER & MQTT SUBSCRIBER ĐANG CHẠY`);
  console.log(`===========================================`);

  // 1. Kết nối MongoDB
  try {
    if(process.env.MONGODB_URI) {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Đã kết nối MongoDB Atlas thành công.');
    } else {
        console.log('⚠️ Không tìm thấy MONGODB_URI trong file .env, bỏ qua lưu trữ Đám mây.');
    }
  } catch (err) {
    console.error('❌ Lỗi kết nối MongoDB:', err);
  }

  // 2. Kết nối MQTT Broker
  console.log(`⏳ Đang kết nối MQTT Broker tại ${MQTT_SERVER}...`);
  const client = mqtt.connect(MQTT_SERVER);

  client.on('connect', () => {
    console.log('✅ Đã kết nối MQTT Broker thành công.');
    client.subscribe(MQTT_TOPIC, (err) => {
      if (!err) {
        console.log(`📡 Đang lắng nghe dữ liệu từ topic: ${MQTT_TOPIC}`);
        console.log(`===========================================`);
      } else {
        console.error('❌ Lỗi Subscribe:', err);
      }
    });
  });

  client.on('message', async (topic, message) => {
    try {
      const payload = message.toString();
      console.log(`\n[${new Date().toISOString()}] Nhận dữ liệu từ ${topic}: ${payload}`);
      
      const data = JSON.parse(payload);
      
      // Ghi vào file CSV theo ngày
      const timestamp = new Date().toISOString();
      const csvLine = `${timestamp},${data.pm2_5},${data.pm10},${data.temperature},${data.humidity},${data.pressure},${data.gas_resistance},${data.mq135},${data.aqi}\n`;
      const dailyFile = getDailyCsvFile();
      fs.appendFileSync(dailyFile, csvLine);

      // Ghi vào database.csv tổng hợp
      const dbFile = path.join(__dirname, 'database.csv');
      if (!fs.existsSync(dbFile)) {
        fs.writeFileSync(dbFile, "timestamp,pm2_5,pm10,temperature,humidity,pressure,gas_resistance,mq135,aqi\n");
      }
      fs.appendFileSync(dbFile, csvLine);

      console.log(`📝 Đã lưu cục bộ vào file ${path.basename(dailyFile)} và database.csv`);

      // Lưu lên MongoDB
      if (mongoose.connection.readyState === 1) {
        const newRecord = new SensorData(data);
        await newRecord.save();
        console.log('☁️ Đã lưu bản ghi lên MongoDB Atlas để Dashboard hiển thị');
      }

    } catch (error) {
      console.error('❌ Lỗi xử lý dữ liệu:', error);
    }
  });

  client.on('error', (err) => {
    console.error('❌ MQTT Error:', err);
  });
}

main();
