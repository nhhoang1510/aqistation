import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import SensorData from '@/models/SensorData';
import User from '@/models/User';
import { sendAlertEmail } from '@/lib/mailer';

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

    return NextResponse.json({
      success: true,
      currentAQI: latestData.aqi,
      alertsSent: alerts.length,
      details: alerts,
    });
  } catch (error) {
    console.error('[Alert] Error checking alerts:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
