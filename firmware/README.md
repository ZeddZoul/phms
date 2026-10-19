# PHMS — ESP32-S3-CAM Firmware

Arduino sketch that captures a photo of the maize & beans containers, reads
the environmental sensors, and posts everything to the PHMS server, then
deep-sleeps until the next cycle.

## Hardware

| Part | Notes |
| --- | --- |
| ESP32-S3-CAM board (OV2640) | Generic ESP32-S3-CAM / Freenove ESP32-S3-WROOM CAM (ESP32S3_EYE pin map). Must have PSRAM. |
| DHT11 | Temperature + humidity. Data → GPIO 14, VCC → 3V3, GND → GND. Add a 10kΩ pull-up data→3V3 if your module lacks one. Accuracy is ±2°C / ±5% RH with whole-number steps; the AI prompt tolerates that. |
| Capacitive soil moisture sensor (v1.2/v2.0) | AOUT → GPIO 1, VCC → 3V3, GND → GND. The primary, corrosion-proof probe. |
| Resistive soil moisture sensor (YL-69/FC-28 type) | Module AOUT → GPIO 2, VCC → 3V3, GND → GND. Second probe; the sketch averages both. Resistive forks corrode over weeks — when its readings start drifting, set `USE_RESISTIVE_SENSOR 0` and run capacitive-only. |

All three sensor pins are free on the ESP32S3_EYE camera pin map; change
`DHT_PIN` / `SOIL_CAP_PIN` / `SOIL_RES_PIN` in the sketch if you wire
differently. For a Seeed XIAO ESP32S3 Sense, replace the camera pin block
with that board's pin map (see the `CameraWebServer` example bundled with
arduino-esp32).

**Container convention (critical):** the two probes serve two different
containers — **Container A is the LEFT container in the camera frame and
holds the capacitive probe; Container B is the RIGHT container and holds
the resistive probe.** Mount the camera so this never changes (and re-check
it if you ever enable `CAM_HMIRROR`, which swaps left/right). The sketch
sends `soilMoistureA`, `soilMoistureB`, and their average (`soilMoisture`,
for backward compatibility); the AI matches each side of the photo with
that container's own soil reading and assesses the two containers
independently on the dashboard.

## Arduino IDE setup

1. Install **arduino-esp32** (v3.x) via Boards Manager.
2. Install libraries: **DHT sensor library** (Adafruit) + **Adafruit Unified
   Sensor** (Library Manager).
3. Board settings — select **ESP32S3 Dev Module**, then:
   - **PSRAM:** `OPI PSRAM` (Freenove/most S3-CAM boards)
   - **Flash Size:** match your board (usually 16MB)
   - **Partition Scheme:** `Huge APP (3MB No OTA)`
   - **USB CDC On Boot:** `Enabled` (so Serial works over USB)

## Configure the sketch

Edit the CONFIG block at the top of `esp32-s3-cam/esp32-s3-cam.ino`:

- `WIFI_SSID` / `WIFI_PASSWORD` — your Wi-Fi.
- `SERVER_URL` — copy from **Settings → Connect device** in the dashboard
  (your Vercel URL + `/api/telemetry`; for local testing use your
  computer's LAN IP).
- `DEVICE_API_KEY` — the `DEVICE_API_KEY` value from the server's
  environment (`.env.local` locally, Project → Environment Variables on
  Vercel). **Keep the real key out of git** — paste it only before
  flashing.
- `CAPTURE_INTERVAL_MINUTES` — default 30. Each capture costs one Gemini
  call; 30–60 min is plenty for plants.

## Calibrate the soil sensors

Do this once per probe (the Serial log labels them `cap` and `res`):

1. Flash, open Serial Monitor (115200 baud).
2. Hold each probe in dry air → note its `raw ADC` → set `CAP_ADC_DRY` /
   `RES_ADC_DRY`.
3. Submerge each probe to its line in a glass of water → note the values →
   set `CAP_ADC_WET` / `RES_ADC_WET`.
4. Re-flash. Both readings then map to 0–100% before being averaged.

## Aim the camera

Mount the board so both containers fill the frame, with steady lighting
(avoid backlight from a window). A fixed position and consistent light are
the single biggest lever for AI accuracy — the model compares each capture
against recent history.

## What a cycle looks like

Boot → read DHT11 (retries up to 5×; skips the cycle if the sensor fails) →
read both soil probes (8-sample average each, combined as above) → camera
warm-up (3 discarded frames for auto-exposure) → capture SVGA JPEG →
Wi-Fi connect → multipart POST with the `x-device-key` header (3 attempts
with backoff) → deep sleep.

Server responses land in the Serial Monitor: `HTTP 200` with a JSON id on
success, `401` if the device key is wrong, `400` for validation errors,
`500` if a cloud service is down (the server logs details).
