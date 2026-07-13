import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import SensorData from '@/models/SensorData';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = parseInt(searchParams.get('page')) || 1;
    const pageSize = Math.min(parseInt(searchParams.get('pageSize')) || 50, 200);

    if (!from || !to) {
      return NextResponse.json({ error: 'Missing "from" and "to" query parameters' }, { status: 400 });
    }

    await connectToDatabase();

    const fromDate = new Date(from);
    const toDate = new Date(to);
    // Set toDate to end of day
    toDate.setHours(23, 59, 59, 999);

    const filter = {
      timestamp: { $gte: fromDate, $lte: toDate }
    };

    const total = await SensorData.countDocuments(filter);
    const totalPages = Math.ceil(total / pageSize);

    const data = await SensorData.find(filter)
      .sort({ timestamp: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    // Tính thống kê tổng hợp
    const stats = await SensorData.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          avgAqi: { $avg: '$aqi' },
          maxAqi: { $max: '$aqi' },
          minAqi: { $min: '$aqi' },
          avgPm25: { $avg: '$pm2_5' },
          maxPm25: { $max: '$pm2_5' },
          avgTemp: { $avg: '$temperature' },
          avgHumidity: { $avg: '$humidity' },
        }
      }
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages,
      stats: stats[0] || null,
    });
  } catch (error) {
    console.error('[History] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
