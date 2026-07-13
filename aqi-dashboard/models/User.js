import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  image: { type: String },
  alertEnabled: { type: Boolean, default: false },
  aqiThreshold: { type: Number, default: 100 },
  alertCooldown: { type: Number, default: 30 }, // minutes
  lastAlertSent: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
