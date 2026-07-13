import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import PushSubscription from '@/models/PushSubscription';

export async function POST(req) {
  try {
    const subscription = await req.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ success: false, error: 'Invalid subscription' }, { status: 400 });
    }

    await connectToDatabase();

    // Upsert subscription using endpoint as unique key
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      subscription,
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, message: 'Subscribed successfully' });
  } catch (error) {
    console.error('[Push Subscribe] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
