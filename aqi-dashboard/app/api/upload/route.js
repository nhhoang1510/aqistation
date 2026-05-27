import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import SensorData from '@/models/SensorData';

export async function POST(request) {
  try {
    const data = await request.json(); //đọc dữ liệu JSON từ request mà ESP32 gửi tới
    console.log('Nhận dữ liệu từ ESP32:', data);

    await connectToDatabase(); //gọi hàm hết nối tới MongoDB Atlas
    const newRecord = new SensorData(data);//tạo một bản ghi mới từ dữ liệu nhận được
    await newRecord.save(); //lưu bản ghi mới vào MongoDB

    return NextResponse.json({ success: true, message: 'Đã lưu dữ liệu' }, { status: 201 });
  } catch (error) {
    console.error('Lỗi khi lưu dữ liệu:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
