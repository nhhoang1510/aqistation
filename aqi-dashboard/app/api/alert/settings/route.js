import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';

// GET: Lấy cài đặt cảnh báo của user hiện tại
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email }).lean();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      alertEnabled: user.alertEnabled,
      aqiThreshold: user.aqiThreshold,
      alertCooldown: user.alertCooldown,
      lastAlertSent: user.lastAlertSent,
    });
  } catch (error) {
    console.error('[Alert Settings] GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT: Cập nhật cài đặt cảnh báo
export async function PUT(request) {
  try {
    const session = await getServerSession();
    const body = await request.json();
    const { email, alertEnabled, aqiThreshold, alertCooldown } = body;

    const targetEmail = session?.user?.email || email;
    if (!targetEmail) {
      return NextResponse.json({ error: 'Vui lòng cung cấp địa chỉ Email' }, { status: 400 });
    }

    await connectToDatabase();

    const updateData = {
      alertEnabled: typeof alertEnabled === 'boolean' ? alertEnabled : true,
    };
    
    if (typeof aqiThreshold === 'number' && aqiThreshold >= 10 && aqiThreshold <= 500) {
      updateData.aqiThreshold = aqiThreshold;
    }
    if (typeof alertCooldown === 'number' && [5, 15, 30, 60, 180].includes(alertCooldown)) {
      updateData.alertCooldown = alertCooldown;
    }

    const name = session?.user?.name || targetEmail.split('@')[0];

    const user = await User.findOneAndUpdate(
      { email: targetEmail },
      { 
        $set: updateData,
        $setOnInsert: { name, email: targetEmail, createdAt: new Date() }
      },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json({
      success: true,
      email: user.email,
      alertEnabled: user.alertEnabled,
      aqiThreshold: user.aqiThreshold,
      alertCooldown: user.alertCooldown,
    });
  } catch (error) {
    console.error('[Alert Settings] PUT error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
