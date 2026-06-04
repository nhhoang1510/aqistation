import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import SensorData from '@/models/SensorData';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 20;

    // Kết nối tới MongoDB Atlas
    await connectToDatabase();

    // Lấy 'limit' bản ghi mới nhất từ MongoDB, sắp xếp theo timestamp giảm dần
    const data = await SensorData.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    // Đảo ngược mảng để trả về thứ tự từ cũ đến mới (chuẩn để vẽ biểu đồ từ trái qua phải)
    const recentData = data.reverse();

    return NextResponse.json(recentData);
  } catch (error) {
    console.error('Lỗi lấy dữ liệu từ MongoDB:', error);
    return NextResponse.json({ success: false, error: 'Lỗi server' }, { status: 500 });
  }
}
