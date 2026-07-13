import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  email:        { type: String, required: true, unique: true },
  password:     { type: String, default: null },   // null = Google-only account
  image:        { type: String, default: null },
  provider:     { type: String, default: 'credentials' }, // 'google' | 'credentials'
  alertEnabled: { type: Boolean, default: false },
  aqiThreshold: { type: Number, default: 100 },
  alertCooldown:{ type: Number, default: 30 },
  lastAlertSent:{ type: Date, default: null },
  createdAt:    { type: Date, default: Date.now },
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
