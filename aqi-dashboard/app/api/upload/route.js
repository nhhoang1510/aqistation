import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import SensorData from '@/models/SensorData';

export async function POST(request) {
  try {
    const data = await request.json();
    console.log('Nhận dữ liệu từ ESP32:', data);

    await connectToDatabase();
    const newRecord = new SensorData(data);
    await newRecord.save();

    return NextResponse.json({ success: true, message: 'Đã lưu dữ liệu' }, { status: 201 });
  } catch (error) {
    console.error('Lỗi khi lưu dữ liệu:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
