import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Telemetry from '@/models/Telemetry';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 100;

    if (isNaN(limit) || limit < 1) {
      return NextResponse.json({ error: 'Invalid limit parameter' }, { status: 400 });
    }

    await connectToDatabase();

    const records = await Telemetry.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json(records, { status: 200 });
  } catch (error) {
    console.error('Error fetching telemetry history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch telemetry history' },
      { status: 500 }
    );
  }
}
