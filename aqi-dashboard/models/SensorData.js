import mongoose from 'mongoose';

const SensorDataSchema = new mongoose.Schema({
  pm1_0: Number,
  pm2_5: Number,
  pm10: Number,
  temperature: Number,
  humidity: Number,
  pressure: Number,
  gas_resistance: Number,
  mq135: Number,
  aqi: Number,
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.models.SensorData || mongoose.model('SensorData', SensorDataSchema);
