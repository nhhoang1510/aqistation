import mongoose from 'mongoose';

const PushSubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true, unique: true },
  expirationTime: { type: Date, default: null },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.PushSubscription || mongoose.model('PushSubscription', PushSubscriptionSchema);
