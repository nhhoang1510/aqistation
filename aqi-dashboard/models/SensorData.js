import mongoose from 'mongoose';

const SensorDataSchema = new mongoose.Schema({
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

export default mongoose.models.SensorData || mongoose.model('SensorData', SensorDataSchema);
