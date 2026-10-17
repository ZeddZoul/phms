import { NextRequest, NextResponse, connection } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import AlertSettings from '@/models/AlertSettings';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  // This handler reads no request data, so under cacheComponents Next could
  // try to prerender it at build time and freeze a build-time DB snapshot —
  // connection() explicitly marks it as runtime-only.
  await connection();

  try {
    await connectToDatabase();
    const settings = await AlertSettings.findOne().lean();
    return NextResponse.json(
      {
        email: settings?.email ?? '',
        enabled: settings?.enabled ?? false,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching alert settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alert settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const enabled = Boolean(body.enabled);

    if (enabled && !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: 'A valid email address is required to enable email alerts' },
        { status: 400 }
      );
    }
    if (email && !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const settings = await AlertSettings.findOneAndUpdate(
      {},
      { $set: { email, enabled } },
      { upsert: true, new: true }
    );

    return NextResponse.json(
      { email: settings.email, enabled: settings.enabled },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error saving alert settings:', error);
    return NextResponse.json(
      { error: 'Failed to save alert settings' },
      { status: 500 }
    );
  }
}
