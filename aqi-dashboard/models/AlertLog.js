import mongoose from 'mongoose';

const AlertLogSchema = new mongoose.Schema({
  email:     { type: String, default: null },
  aqi:       { type: Number, required: true },
  level:     { type: String, required: true },
  pm2_5:     { type: Number, default: 0 },
  pm10:      { type: Number, default: 0 },
  message:   { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.models.AlertLog || mongoose.model('AlertLog', AlertLogSchema);
