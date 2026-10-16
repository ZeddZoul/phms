import { Resend } from 'resend';
import AlertSettings from '@/models/AlertSettings';

// At most one alert email per hour, so a persistently critical plant
// doesn't flood the owner's inbox while the device keeps reporting.
const EMAIL_COOLDOWN_MS = 60 * 60 * 1000;

interface CriticalRecord {
  healthScore?: number;
  diagnosis?: string;
  recommendedActions?: string[];
  temperature: number;
  humidity: number;
  soilMoisture: number;
  timestamp: Date;
}

function buildEmail(record: CriticalRecord) {
  const score = record.healthScore ?? 0;
  const when = record.timestamp.toLocaleString();
  const actions = record.recommendedActions?.length
    ? record.recommendedActions
    : ['Inspect the plants as soon as possible.'];

  const subject = `Critical plant health alert — ${score}/100`;

  const text = [
    `Your maize & beans need attention — the latest AI assessment came back CRITICAL (${score}/100) at ${when}.`,
    '',
    `Diagnosis: ${record.diagnosis ?? 'No diagnosis available.'}`,
    '',
    'What you should do now:',
    ...actions.map((a, i) => `${i + 1}. ${a}`),
    '',
    `Conditions at capture — Temperature: ${record.temperature}°C · Humidity: ${record.humidity}% · Soil moisture: ${record.soilMoisture}%`,
    '',
    'Open the dashboard for the full picture, including the plant photo.',
  ].join('\n');

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <div style="background: #0C0E0D; border-radius: 16px 16px 0 0; padding: 20px 24px;">
        <span style="color: #CDF463; font-size: 20px; font-weight: 700;">PHMS</span>
      </div>
      <div style="border: 1px solid #E5E7EB; border-top: 0; border-radius: 0 0 16px 16px; padding: 24px;">
        <p style="display: inline-block; background: #FEE2E2; color: #DC2626; border-radius: 999px; padding: 4px 12px; font-size: 13px; font-weight: 600; margin: 0 0 12px;">CRITICAL — ${score}/100</p>
        <h1 style="font-size: 18px; margin: 0 0 8px;">Your maize &amp; beans need attention</h1>
        <p style="color: #6B7280; font-size: 13px; margin: 0 0 16px;">AI assessment from ${when}</p>
        <h2 style="font-size: 14px; margin: 0 0 6px;">Diagnosis</h2>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">${record.diagnosis ?? 'No diagnosis available.'}</p>
        <h2 style="font-size: 14px; margin: 0 0 6px;">What you should do now</h2>
        <ol style="font-size: 14px; line-height: 1.8; margin: 0 0 16px; padding-left: 20px;">
          ${actions.map((a) => `<li>${a}</li>`).join('')}
        </ol>
        <p style="font-size: 13px; color: #6B7280; margin: 0;">
          Conditions at capture — Temperature: <strong>${record.temperature}°C</strong> ·
          Humidity: <strong>${record.humidity}%</strong> ·
          Soil moisture: <strong>${record.soilMoisture}%</strong>
        </p>
      </div>
    </div>`;

  return { subject, text, html };
}

/**
 * Send the Critical-status alert email via Resend if the owner has
 * registered an address, alerts are enabled, and the cooldown has elapsed.
 * Never throws — the telemetry pipeline must not fail because email did.
 */
export async function maybeSendCriticalAlertEmail(
  record: CriticalRecord
): Promise<void> {
  try {
    const settings = await AlertSettings.findOne();
    if (!settings?.enabled || !settings.email) return;

    if (
      settings.lastEmailAt &&
      Date.now() - settings.lastEmailAt.getTime() < EMAIL_COOLDOWN_MS
    ) {
      console.log('Critical alert email skipped: within the 1-hour cooldown.');
      return;
    }

    const { subject, text, html } = buildEmail(record);
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      if (process.env.NODE_ENV !== 'production') {
        // Development fallback: render the email into the server log so the
        // alert flow can be exercised before the Resend key exists.
        console.log(
          `[dev email] RESEND_API_KEY not set — would have sent:\nTo: ${settings.email}\nSubject: ${subject}\n\n${text}`
        );
        settings.lastEmailAt = new Date();
        await settings.save();
      } else {
        console.warn(
          'Critical alert email skipped: RESEND_API_KEY is not configured.'
        );
      }
      return;
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.ALERT_FROM_EMAIL ?? 'PHMS Alerts <onboarding@resend.dev>',
      to: settings.email,
      subject,
      text,
      html,
    });
    if (error) {
      throw new Error(error.message ?? 'Resend send failed');
    }

    console.log(`Critical alert email sent to ${settings.email} via Resend.`);
    settings.lastEmailAt = new Date();
    await settings.save();
  } catch (e) {
    console.error('Critical alert email failed:', e);
  }
}
