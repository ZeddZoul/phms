import { ImageResponse } from 'next/og';

export const alt = 'PHMS — AI Plant Health Monitoring for maize & beans';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Brand OG card rendered at build time — served at /opengraph-image and
// auto-injected as og:image / twitter:image by Next's metadata pipeline.
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0C0E0D',
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 72,
              height: 72,
              borderRadius: 999,
              backgroundColor: '#17352C',
              fontSize: 40,
            }}
          >
            🌿
          </div>
          <div style={{ fontSize: 48, fontWeight: 700, color: '#CDF463' }}>
            PHMS
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1.1,
            }}
          >
            AI plant health monitoring
          </div>
          <div style={{ fontSize: 40, color: '#9CA3AF' }}>
            for maize &amp; beans — scored, diagnosed, alerted
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          {['📷  ESP32-S3-CAM', '🤖  Gemini AI', '📈  Live dashboard', '✉️  Email alerts'].map(
            (chip) => (
              <div
                key={chip}
                style={{
                  display: 'flex',
                  backgroundColor: '#17352C',
                  color: '#E5E7EB',
                  fontSize: 28,
                  padding: '14px 28px',
                  borderRadius: 999,
                }}
              >
                {chip}
              </div>
            )
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
