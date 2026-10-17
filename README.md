# Plant Health Monitoring System (PHMS)

AI-powered plant health monitoring for ESP32-S3-CAM IoT devices. A full-stack Next.js 16 app that ingests sensor telemetry and plant photos, stores images in Cloudinary and records in MongoDB, analyzes plant health with Google Gemini (`gemini-2.5-flash`), and presents everything on a live dashboard.

Built from the Kiro specs in [`.kiro/specs/ai-plant-health-monitoring/`](.kiro/specs/ai-plant-health-monitoring/).

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4)
- **MongoDB + Mongoose** — telemetry persistence
- **Cloudinary** — plant image storage
- **Google Gemini AI** (`@google/genai`, `gemini-2.5-flash`) — health analysis
- **Recharts + Lucide** — charts and icons

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables in `.env.local` (see `.env.example`):

   | Variable | Purpose |
   |---|---|
   | `MONGODB_URI` | MongoDB connection string (Atlas or local) |
   | `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary credentials |
   | `GEMINI_API_KEY` | Google Gemini API key |
   | `RESEND_API_KEY` | Resend API key for Critical email alerts (optional; dev logs the email instead) |
   | `ALERT_FROM_EMAIL` | Sender for alert emails (optional; defaults to Resend's test sender) |
   | `DASHBOARD_PASSWORD` | Owner password for the dashboard (`/login`) |
   | `SESSION_SECRET` | Random secret signing the session cookie (rotate to revoke sessions) |
   | `DEVICE_API_KEY` | Shared key the ESP32 sends in the `x-device-key` header |

   When `DASHBOARD_PASSWORD` and `SESSION_SECRET` are both set, every page and API requires sign-in; unset them for unguarded local development. **Always set them before hosting.**

   Missing `GEMINI_API_KEY` degrades gracefully (telemetry is stored without a health assessment). Missing Cloudinary credentials cause uploads to fail with HTTP 500.

3. (Optional, local dev) Seed sample data so the dashboard has something to show:

   ```bash
   node scripts/seed.mjs
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

   The dashboard is at `http://localhost:3000`.

## API

### `POST /api/telemetry`

Multipart form-data endpoint for IoT devices.

| Field | Type | Constraint |
|---|---|---|
| `image` | file (JPEG) | required, non-empty |
| `temperature` | number | °C |
| `humidity` | number | 0–100 (%) |
| `soilMoisture` | number | 0–100 (%) |

Example (device simulation):

```bash
curl -X POST http://localhost:3000/api/telemetry \
  -H "x-device-key: $DEVICE_API_KEY" \
  -F image=@plant.jpg \
  -F temperature=25.5 \
  -F humidity=60 \
  -F soilMoisture=45
```

The `x-device-key` header is required when security is enabled; browser submissions (the simulator) authenticate with the owner's session instead.

## Device firmware

The ESP32-S3-CAM sketch lives in [`firmware/esp32-s3-cam/`](firmware/esp32-s3-cam/esp32-s3-cam.ino) — wiring, Arduino IDE setup, soil-sensor calibration, and flashing steps are in [`firmware/README.md`](firmware/README.md). Fill in Wi-Fi credentials, the deployed endpoint URL, and `DEVICE_API_KEY` at flash time (never commit real values).

Responses: `200` `{ "message": "...", "id": "<mongo id>" }` · `400` `{ "error": "<validation message>" }` · `500` `{ "error": "<service failure>" }`.

Pipeline: validate → upload image to Cloudinary → Gemini health analysis (non-blocking) → persist to MongoDB.

**Dev fallback:** when Cloudinary is not configured and `NODE_ENV !== 'production'`, images are stored inline as data URIs (4MB cap) so the pipeline works before credentials exist. Production still returns 500 without Cloudinary.

**AI prompting:** all Gemini interaction lives in `lib/gemini.ts`. The system prompt is specialized for this project's fixed setup (exactly two maize + two bean seedlings in two containers) and is sent as a Gemini system instruction. Responses are forced into a structured JSON schema (overall + per-crop maize/beans scores, status enum); each request includes the last 5 readings and the previous diagnosis so scores stay consistent over time; stored records also carry an EWMA-smoothed score, and Critical emails only fire after two consecutive Critical assessments. It is sized ≥1,024 tokens so it qualifies for explicit context caching (1h TTL) — on free-tier keys (zero cache-storage quota) the code automatically falls back to sending it inline, and Gemini's implicit caching still discounts the repeated prefix.

### `GET /api/telemetry/history?limit=N`

Returns records newest-first as a JSON array. `limit` defaults to 100; invalid values return `400`.

```json
[
  {
    "_id": "…",
    "timestamp": "2026-10-16T08:42:44.429Z",
    "temperature": 20.9,
    "humidity": 45,
    "soilMoisture": 28,
    "imageUrl": "https://res.cloudinary.com/…",
    "healthScore": 82,
    "status": "Healthy",
    "diagnosis": "…",
    "recommendedActions": ["…"]
  }
]
```

## Device Simulator

`/simulator` stands in for the ESP32: set temperature/humidity/soil-moisture sliders (or **Randomize values**), pick a maize & beans photo (or **Use sample image**), and **Send to AI**. It posts the exact multipart request a device would, then shows the stored Gemini verdict (gauge, status, diagnosis, actions) — which also appears on the main dashboard.

## Dashboard

- Latest plant photo, radial health-score gauge (status-colored), status pill (green/yellow/red), diagnosis and recommended actions
- Environmental stat tiles (temperature, humidity, soil moisture, last update)
- Gradient time-series charts for each metric (last 50 readings)
- Auto-refreshes every 30 seconds (configurable in Settings)

## Reports, Notifications, Settings, Help

- **Reports** (`/reports`) — two tabs: Insights (avg/min/max per metric, average health score, status distribution, health-score and combined environmental charts) and Records (the full capture log), plus CSV export over a selectable window (25–200 records). Info icons explain each chart.
- **Notifications** — a bell at the top right of every page collects Warning/Critical assessments; a green dot marks unread alerts (read-state lives in the browser). Preferences in Settings.
- **Email alerts** — register an email in Settings and toggle alerts on: Critical assessments send a branded email (diagnosis + what to do) via Resend, at most once per hour. Without `RESEND_API_KEY`, dev renders the email to the server log.
- **Settings** (`/settings`) — dashboard refresh interval, bell alert preferences, default reports window, email alerts, and the device endpoint URL under "Connect device".
- **Help** (`/help`) — help-center style guide: search hero, topic cards, and an FAQ accordion.

The UI follows the project design system (green/black s.host-inspired palette + Material Design 3 conventions) — tokens live in `app/globals.css`, full spec in the design doc's **Visual Design System** section.

## Scripts

- `npm run dev` / `npm run build` / `npm start` — Next.js lifecycle
- `npm run lint` — ESLint
- `node scripts/seed.mjs` — wipe & seed the configured database with synthetic telemetry
