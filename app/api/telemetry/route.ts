import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import connectToDatabase from '@/lib/mongodb';
import { analyzePlantHealth } from '@/lib/gemini';
import { maybeSendCriticalAlertEmail } from '@/lib/alerts';
import Telemetry from '@/models/Telemetry';
import type { HealthAssessment } from '@/types/telemetry';

// Inline (data URI) image storage is a development-only fallback used when
// Cloudinary is not configured; keep stored images small enough for MongoDB.
const MAX_INLINE_IMAGE_BYTES = 4 * 1024 * 1024;

// Devices and tools (e.g. curl) sometimes post images as
// application/octet-stream — recover the real type from magic bytes so
// Gemini and the dashboard always get a valid image MIME type.
function detectImageMimeType(buffer: Buffer, declared: string | undefined): string {
  if (declared && declared.startsWith('image/')) return declared;
  if (
    buffer.length > 11 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return 'image/png';
  }
  return 'image/jpeg';
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const image = formData.get('image');
    const temperature = formData.get('temperature');
    const humidity = formData.get('humidity');
    const soilMoisture = formData.get('soilMoisture');

    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }

    if (!temperature || !humidity || !soilMoisture) {
      return NextResponse.json(
        { error: 'Missing required telemetry fields' },
        { status: 400 }
      );
    }

    const tempValue = parseFloat(temperature as string);
    const humidityValue = parseFloat(humidity as string);
    const soilMoistureValue = parseFloat(soilMoisture as string);

    if (isNaN(tempValue)) {
      return NextResponse.json(
        { error: 'Temperature must be a valid number' },
        { status: 400 }
      );
    }

    if (isNaN(humidityValue) || humidityValue < 0 || humidityValue > 100) {
      return NextResponse.json(
        { error: 'Humidity must be a number between 0 and 100' },
        { status: 400 }
      );
    }

    if (isNaN(soilMoistureValue) || soilMoistureValue < 0 || soilMoistureValue > 100) {
      return NextResponse.json(
        { error: 'Soil moisture must be a number between 0 and 100' },
        { status: 400 }
      );
    }

    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mimeType = detectImageMimeType(buffer, image.type);

    const cloudinaryConfigured = Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );

    let uploadResult: string;
    if (cloudinaryConfigured) {
      try {
        uploadResult = await new Promise<string>((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              { folder: 'plant-monitoring', resource_type: 'image' },
              (error, result) => {
                if (error || !result) reject(error ?? new Error('Empty upload result'));
                else resolve(result.secure_url);
              }
            )
            .end(buffer);
        });
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError);
        return NextResponse.json(
          { error: 'Failed to upload image to storage' },
          { status: 500 }
        );
      }
    } else if (process.env.NODE_ENV !== 'production') {
      // Development-only fallback: store the image inline so the pipeline can
      // be exercised before Cloudinary credentials exist.
      if (buffer.length > MAX_INLINE_IMAGE_BYTES) {
        return NextResponse.json(
          {
            error:
              'Image too large for inline dev storage (4MB max) — configure Cloudinary',
          },
          { status: 500 }
        );
      }
      console.warn(
        '[dev fallback] Cloudinary not configured — storing image inline as a data URI'
      );
      uploadResult = `data:${mimeType};base64,${buffer.toString('base64')}`;
    } else {
      console.error(
        'Cloudinary environment variables are missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env.local.'
      );
      return NextResponse.json(
        { error: 'Image storage is not configured' },
        { status: 500 }
      );
    }

    await connectToDatabase();

    // Recent records feed the AI (temporal consistency), the EWMA smoothing,
    // and the two-consecutive-Criticals alert hysteresis
    const recent = await Telemetry.find()
      .sort({ timestamp: -1 })
      .limit(5)
      .select(
        'timestamp temperature humidity soilMoisture healthScore smoothedScore status diagnosis'
      )
      .lean<
        Array<{
          timestamp: Date;
          temperature: number;
          humidity: number;
          soilMoisture: number;
          healthScore?: number;
          smoothedScore?: number;
          status?: string;
          diagnosis?: string;
        }>
      >();

    // AI analysis — non-blocking: failures are logged and telemetry is stored
    // without a health assessment (graceful degradation). The maize/beans
    // system prompt is context-cached inside lib/gemini.ts.
    let healthAssessment: Partial<HealthAssessment> = {};

    try {
      healthAssessment = await analyzePlantHealth(
        buffer,
        mimeType,
        {
          temperature: tempValue,
          humidity: humidityValue,
          soilMoisture: soilMoistureValue,
        },
        recent
      );
    } catch (aiError) {
      console.error('AI analysis failed:', aiError);
      // Continue without health assessment
    }

    // EWMA smoothing (alpha = 0.4): a trend-stable score that damps
    // single-capture noise from lighting or model variance
    let smoothedScore: number | undefined;
    if (typeof healthAssessment.health_score === 'number') {
      const previous =
        recent.find((r) => typeof r.smoothedScore === 'number')?.smoothedScore ??
        recent.find((r) => typeof r.healthScore === 'number')?.healthScore;
      smoothedScore =
        previous === undefined
          ? healthAssessment.health_score
          : Math.round(0.4 * healthAssessment.health_score + 0.6 * previous);
    }

    const telemetryDoc = new Telemetry({
      timestamp: new Date(),
      temperature: tempValue,
      humidity: humidityValue,
      soilMoisture: soilMoistureValue,
      imageUrl: uploadResult,
      healthScore: healthAssessment.health_score,
      smoothedScore,
      maizeScore: healthAssessment.maize_score,
      beansScore: healthAssessment.beans_score,
      status: healthAssessment.status,
      diagnosis: healthAssessment.diagnosis,
      recommendedActions: healthAssessment.recommended_actions,
    });

    await telemetryDoc.save();

    // Email hysteresis: a single Critical can be noise (lighting, model
    // variance) — alert only when two consecutive assessments are Critical
    if (healthAssessment.status === 'Critical') {
      const previousAssessed = recent.find((r) => r.status);
      if (previousAssessed?.status === 'Critical') {
        await maybeSendCriticalAlertEmail({
          healthScore: healthAssessment.health_score,
          diagnosis: healthAssessment.diagnosis,
          recommendedActions: healthAssessment.recommended_actions,
          temperature: tempValue,
          humidity: humidityValue,
          soilMoisture: soilMoistureValue,
          timestamp: telemetryDoc.timestamp,
        });
      } else {
        console.log(
          'First Critical assessment — alert email deferred until a second consecutive Critical confirms it.'
        );
      }
    }

    return NextResponse.json(
      {
        message: 'Telemetry data received successfully',
        id: telemetryDoc._id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing telemetry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
