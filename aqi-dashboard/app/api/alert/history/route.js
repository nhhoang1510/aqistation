import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import AlertLog from '@/models/AlertLog';

// GET: Lấy danh sách lịch sử các lần cảnh báo
export async function GET(request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const logs = await AlertLog.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error('[Alert History] GET error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// POST: Tạo thủ công 1 bản ghi lịch sử cảnh báo (Ví dụ khi Web Banner phát hiện AQI cao)
export async function POST(request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { email, aqi, level, pm2_5, pm10, message } = body;

    if (aqi == null) {
      return NextResponse.json({ error: 'Thiếu thông số AQI' }, { status: 400 });
    }

    // Kiểm tra trùng lặp trong 5 phút gần nhất để tránh ghi lặp log quá dày
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existing = await AlertLog.findOne({
      aqi,
      timestamp: { $gte: fiveMinsAgo }
    });

    if (existing) {
      return NextResponse.json({ success: true, message: 'Đã lưu trước đó', log: existing });
    }

    const newLog = await AlertLog.create({
      email: email || 'Hệ thống Dashboard',
      aqi,
      level: level || 'Cảnh báo',
      pm2_5: pm2_5 || 0,
      pm10: pm10 || 0,
      message: message || `AQI = ${aqi} vượt ngưỡng cảnh báo`,
      timestamp: new Date()
    });

    return NextResponse.json({ success: true, log: newLog });
  } catch (error) {
    console.error('[Alert History] POST error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
