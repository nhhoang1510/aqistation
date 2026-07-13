import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import SensorData from '@/models/SensorData';
import User from '@/models/User';
import PushSubscription from '@/models/PushSubscription';
import { sendAlertEmail } from '@/lib/mailer';
import webpush from 'web-push';

function initWebPush() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BH5_fzF0HLX-9qjYr26OHl307AyNGFPoYPbimW1SJKrkr_EgtlqHF0LbMUeCrdOD75zfOJFgOIe5IXvT0xXyIPU";
  const priv = process.env.VAPID_PRIVATE_KEY || "NlHWRhgJfuItWyI15LBn2wfcouF_y5p-S-I0ilyKFEI";
  if (pub && priv) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
      pub,
      priv
    );
    return true;
  }
  return false;
}

export async function POST() {
  try {
    await connectToDatabase();

    // Lấy bản ghi mới nhất
    const latestData = await SensorData.findOne().sort({ timestamp: -1 }).lean();

    if (!latestData) {
      return NextResponse.json({ message: 'No data available' });
    }

    // Kiểm tra dữ liệu có fresh không (trong 60 giây)
    const age = Date.now() - new Date(latestData.timestamp).getTime();
    if (age > 60000) {
      return NextResponse.json({ message: 'Data is stale, skipping alert check' });
    }

    // Tìm tất cả user có bật cảnh báo
    const alertUsers = await User.find({ alertEnabled: true }).lean();

    if (alertUsers.length === 0) {
      return NextResponse.json({ message: 'No users with alerts enabled' });
    }

    const now = new Date();
    const alerts = [];

    for (const user of alertUsers) {
      // Kiểm tra AQI có vượt ngưỡng không
      if (latestData.aqi < user.aqiThreshold) continue;

      // Kiểm tra cooldown
      if (user.lastAlertSent) {
        const cooldownMs = (user.alertCooldown || 30) * 60 * 1000;
        const timeSinceLastAlert = now.getTime() - new Date(user.lastAlertSent).getTime();
        if (timeSinceLastAlert < cooldownMs) continue;
      }

      // Gửi email cảnh báo
      try {
        await sendAlertEmail(user.email, user.name, latestData);
        await User.updateOne(
          { _id: user._id },
          { $set: { lastAlertSent: now } }
        );
        alerts.push({ email: user.email, aqi: latestData.aqi });
        console.log(`[Alert] Email sent to ${user.email} (AQI: ${latestData.aqi})`);
      } catch (emailError) {
        console.error(`[Alert] Failed to send email to ${user.email}:`, emailError.message);
      }
    }

    // --- Send Web Push Notifications (Global check, e.g., AQI >= 100) ---
    // In a real system, you'd link subscriptions to users and their thresholds.
    // Here we send a global push if AQI >= 100 (Kém) to all subscribers.
    let webPushSent = 0;
    if (latestData.aqi >= 100 && initWebPush()) {
      const subs = await PushSubscription.find().lean();
      if (subs.length > 0) {
        const payload = JSON.stringify({
          title: `Cảnh báo AQI: ${latestData.aqi}`,
          body: `Chất lượng không khí đang ở mức xấu. PM2.5: ${latestData.pm2_5} µg/m³.`,
        });
        
        for (const sub of subs) {
          try {
            await webpush.sendNotification(sub, payload);
            webPushSent++;
          } catch (e) {
            if (e.statusCode === 410 || e.statusCode === 404) {
              await PushSubscription.deleteOne({ _id: sub._id });
            }
            console.error('[Web Push] Error:', e.message);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      currentAQI: latestData.aqi,
      alertsSent: alerts.length,
      webPushSent,
      details: alerts,
    });
  } catch (error) {
    console.error('[Alert] Error checking alerts:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
