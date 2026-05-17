import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import SensorData from '@/models/SensorData';

export async function GET(request) {
  try {
    await connectToDatabase();
    
    // Lấy số lượng bản ghi từ query string (mặc định 20)
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 20;

    // Sắp xếp giảm dần theo thời gian (mới nhất lên trước) rồi giới hạn số lượng
    const history = await SensorData.find().sort({ timestamp: -1 }).limit(limit);
    
    // Đảo ngược mảng để phục vụ biểu đồ (từ cũ tới mới)
    return NextResponse.json(history.reverse());
  } catch (error) {
    console.error('Lỗi lấy dữ liệu:', error);
    return NextResponse.json({ success: false, error: 'Lỗi server' }, { status: 500 });
  }
}
