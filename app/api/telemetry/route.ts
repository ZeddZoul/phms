import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import connectToDatabase from '@/lib/mongodb';
import { analyzePlantHealth } from '@/lib/gemini';
import {
  classifyAiError,
  computeSmoothedScore,
  describeAiError,
  isSecondConsecutiveCritical,
} from '@/lib/scoring';
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
    // Per-container readings: A = left container (capacitive soil probe +
    // its own DHT), B = right container (resistive probe + its own DHT).
    // Legacy devices send only the combined fields; when both per-container
    // values arrive, the combined value is derived as their average.
    const soilMoistureA = formData.get('soilMoistureA');
    const soilMoistureB = formData.get('soilMoistureB');
    const temperatureA = formData.get('temperatureA');
    const temperatureB = formData.get('temperatureB');
    const humidityA = formData.get('humidityA');
    const humidityB = formData.get('humidityB');
    const hasPerContainer = Boolean(soilMoistureA && soilMoistureB);
    const hasPerContainerAir = Boolean(
      temperatureA && temperatureB && humidityA && humidityB
    );

    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }

    if (
      ((!temperature || !humidity) && !hasPerContainerAir) ||
      (!soilMoisture && !hasPerContainer)
    ) {
      return NextResponse.json(
        { error: 'Missing required telemetry fields' },
        { status: 400 }
      );
    }

    const avg = (a: number, b: number) => Math.round(((a + b) / 2) * 10) / 10;

    let tempAValue: number | undefined;
    let tempBValue: number | undefined;
    let humidityAValue: number | undefined;
    let humidityBValue: number | undefined;
    let tempValue: number;
    let humidityValue: number;

    if (hasPerContainerAir) {
      tempAValue = parseFloat(temperatureA as string);
      tempBValue = parseFloat(temperatureB as string);
      humidityAValue = parseFloat(humidityA as string);
      humidityBValue = parseFloat(humidityB as string);
      if (isNaN(tempAValue) || isNaN(tempBValue)) {
        return NextResponse.json(
          { error: 'Temperature A and B must be valid numbers' },
          { status: 400 }
        );
      }
      if (
        isNaN(humidityAValue) || humidityAValue < 0 || humidityAValue > 100 ||
        isNaN(humidityBValue) || humidityBValue < 0 || humidityBValue > 100
      ) {
        return NextResponse.json(
          { error: 'Humidity A and B must be numbers between 0 and 100' },
          { status: 400 }
        );
      }
      tempValue = avg(tempAValue, tempBValue);
      humidityValue = avg(humidityAValue, humidityBValue);
    } else {
      tempValue = parseFloat(temperature as string);
      humidityValue = parseFloat(humidity as string);

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
    }

    let soilAValue: number | undefined;
    let soilBValue: number | undefined;
    let soilMoistureValue: number;

    if (hasPerContainer) {
      soilAValue = parseFloat(soilMoistureA as string);
      soilBValue = parseFloat(soilMoistureB as string);
      if (
        isNaN(soilAValue) || soilAValue < 0 || soilAValue > 100 ||
        isNaN(soilBValue) || soilBValue < 0 || soilBValue > 100
      ) {
        return NextResponse.json(
          { error: 'Soil moisture A and B must be numbers between 0 and 100' },
          { status: 400 }
        );
      }
      // Combined value kept for backward compatibility (old records, charts)
      soilMoistureValue = Math.round(((soilAValue + soilBValue) / 2) * 10) / 10;
    } else {
      soilMoistureValue = parseFloat(soilMoisture as string);
      if (isNaN(soilMoistureValue) || soilMoistureValue < 0 || soilMoistureValue > 100) {
        return NextResponse.json(
          { error: 'Soil moisture must be a number between 0 and 100' },
          { status: 400 }
        );
      }
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
        'timestamp temperature humidity soilMoisture soilMoistureA soilMoistureB healthScore smoothedScore containerAScore containerBScore status diagnosis'
      )
      .lean<
        Array<{
          timestamp: Date;
          temperature: number;
          humidity: number;
          soilMoisture: number;
          soilMoistureA?: number;
          soilMoistureB?: number;
          healthScore?: number;
          smoothedScore?: number;
          containerAScore?: number;
          containerBScore?: number;
          status?: string;
          diagnosis?: string;
        }>
      >();

    // AI analysis — non-blocking: failures are logged and telemetry is stored
    // without a health assessment (graceful degradation). The maize/beans
    // system prompt is context-cached inside lib/gemini.ts.
    let healthAssessment: Partial<HealthAssessment> = {};
    let assessmentError: string | undefined;

    try {
      healthAssessment = await analyzePlantHealth(
        buffer,
        mimeType,
        {
          temperature: tempValue,
          humidity: humidityValue,
          soilMoisture: soilMoistureValue,
          soilMoistureA: soilAValue,
          soilMoistureB: soilBValue,
          temperatureA: tempAValue,
          temperatureB: tempBValue,
          humidityA: humidityAValue,
          humidityB: humidityBValue,
        },
        recent
      );
      if (healthAssessment.health_score === undefined) {
        // The call succeeded but the payload failed validation
        assessmentError = 'invalid_response';
        console.warn(describeAiError('invalid_response'));
      }
    } catch (aiError) {
      const kind = classifyAiError(aiError);
      assessmentError = kind;
      console.error(`AI analysis failed (${kind}): ${describeAiError(kind)}`, aiError);
      // Continue without health assessment
    }

    let smoothedScore: number | undefined;
    if (typeof healthAssessment.health_score === 'number') {
      smoothedScore = computeSmoothedScore(healthAssessment.health_score, recent);
    }

    const telemetryDoc = new Telemetry({
      timestamp: new Date(),
      temperature: tempValue,
      humidity: humidityValue,
      soilMoisture: soilMoistureValue,
      soilMoistureA: soilAValue,
      soilMoistureB: soilBValue,
      temperatureA: tempAValue,
      temperatureB: tempBValue,
      humidityA: humidityAValue,
      humidityB: humidityBValue,
      imageUrl: uploadResult,
      healthScore: healthAssessment.health_score,
      smoothedScore,
      maizeScore: healthAssessment.maize_score,
      beansScore: healthAssessment.beans_score,
      containerAScore: healthAssessment.container_a_score,
      containerAStatus: healthAssessment.container_a_status,
      containerADiagnosis: healthAssessment.container_a_diagnosis,
      containerBScore: healthAssessment.container_b_score,
      containerBStatus: healthAssessment.container_b_status,
      containerBDiagnosis: healthAssessment.container_b_diagnosis,
      maizeAScore: healthAssessment.maize_a_score,
      beansAScore: healthAssessment.beans_a_score,
      maizeBScore: healthAssessment.maize_b_score,
      beansBScore: healthAssessment.beans_b_score,
      status: healthAssessment.status,
      diagnosis: healthAssessment.diagnosis,
      recommendedActions: healthAssessment.recommended_actions,
      assessmentError,
    });

    await telemetryDoc.save();

    // Email hysteresis: a single Critical can be noise (lighting, model
    // variance) — alert only when two consecutive assessments are Critical
    if (healthAssessment.status === 'Critical') {
      if (isSecondConsecutiveCritical(recent)) {
        await maybeSendCriticalAlertEmail({
          healthScore: healthAssessment.health_score,
          diagnosis: healthAssessment.diagnosis,
          recommendedActions: healthAssessment.recommended_actions,
          temperature: tempValue,
          humidity: humidityValue,
          soilMoisture: soilMoistureValue,
          soilMoistureA: soilAValue,
          soilMoistureB: soilBValue,
          temperatureA: tempAValue,
          temperatureB: tempBValue,
          humidityA: humidityAValue,
          humidityB: humidityBValue,
          containerA:
            typeof healthAssessment.container_a_score === 'number'
              ? {
                  score: healthAssessment.container_a_score,
                  status: healthAssessment.container_a_status,
                  diagnosis: healthAssessment.container_a_diagnosis,
                }
              : undefined,
          containerB:
            typeof healthAssessment.container_b_score === 'number'
              ? {
                  score: healthAssessment.container_b_score,
                  status: healthAssessment.container_b_status,
                  diagnosis: healthAssessment.container_b_diagnosis,
                }
              : undefined,
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
