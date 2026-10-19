/*
 * PHMS — ESP32-S3 N16R8 + OV5640 telemetry firmware (per-container)
 * ==================================================================
 * Hardware: ESP32-S3-WROOM-1 N16R8 (16 MB flash, 8 MB OPI PSRAM) + OV5640.
 *
 * CONTAINER CONVENTION (do not break this):
 *   - Container A = LEFT container in the camera frame = CAPACITIVE probe
 *   - Container B = RIGHT container in the camera frame = RESISTIVE probe
 *   - The camera must be mounted so this never changes: the AI matches what
 *     it sees on each side of the photo with that side's soil reading.
 *
 * Every cycle it:
 *   1. reads BOTH DHT11s (one per container) + BOTH soil probes
 *   2. takes a JPEG of the two containers with the OV5640
 *   3. POSTs multipart/form-data to the PHMS server:
 *
 *        POST {SERVER_URL}   (x-device-key header)
 *          image          JPEG file
 *          temperatureA   °C Container A   humidityA  %  Container A
 *          temperatureB   °C Container B   humidityB  %  Container B
 *          soilMoistureA  %  Container A (left, capacitive)
 *          soilMoistureB  %  Container B (right, resistive)
 *          temperature / humidity / soilMoisture — averages (legacy/back-compat)
 *
 *   4. deep-sleeps until the next capture (or loops quickly in DEMO_MODE)
 *
 * ---------------- ARDUINO IDE BOARD SETTINGS (important!) ----------------
 *   Board:            ESP32S3 Dev Module
 *   Flash Size:       16MB (128Mb)
 *   PSRAM:            OPI PSRAM          <-- N16R8 = octal PSRAM. Wrong setting = camera fails.
 *   Partition Scheme: 16M Flash (3MB APP/9.9MB FATFS)
 *   USB CDC On Boot:  Enabled (if you upload/monitor through the native USB port)
 *   Library:          "DHT sensor library" by Adafruit (+ Adafruit Unified Sensor)
 *   ESP32 core:       esp32 by Espressif, v2.0.14+ or 3.x
 *
 * Note: with OPI PSRAM, GPIO 35, 36, 37 are used internally — never wire to them.
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <DHT.h>

// ======================= CONFIG — EDIT THIS BLOCK =======================

const char *WIFI_SSID     = "YOUR_WIFI_SSID";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char *SERVER_URL = "https://my-phms.vercel.app/api/telemetry";

// Must match the DEVICE_API_KEY set in the website's Vercel environment
// variables (NOT the dashboard login password). HTTP 401 = wrong key.
const char *DEVICE_API_KEY = "sk_live_esp32-s3-cam";

// Normal mode: minutes between captures (deep sleep in between)
const uint32_t CAPTURE_INTERVAL_MINUTES = 7;

// DEMO_MODE = 1 -> no deep sleep, sends a photo + readings every DEMO_INTERVAL_SECONDS.
// Handy for testing and live presentations. Don't go much below 60 s —
// every upload costs a Gemini AI call on the server.
#define DEMO_MODE 1
const uint32_t DEMO_INTERVAL_SECONDS = 60;

// Sensor pins (free pins on this board's camera pin map — adjust to your wiring)
#define DHT_A_PIN    14  // DHT11 at Container A (LEFT)
#define DHT_B_PIN    21  // DHT11 at Container B (RIGHT)
#define DHT_TYPE     DHT11
#define SOIL_CAP_PIN 1   // CAPACITIVE probe — Container A (LEFT).  ADC1: GPIO 1-10
#define SOIL_RES_PIN 2   // RESISTIVE probe  — Container B (RIGHT). ADC1: GPIO 1-10

// Set to 0 to run on the capacitive probe alone (resistive probes corrode
// over weeks). NOTE: with 0 the server falls back to a single combined soil
// reading and per-container soil data stops.
#define USE_RESISTIVE_SENSOR 1

// Soil calibration, per probe: raw 12-bit ADC in dry air and in water.
// Watch Serial ("A raw" / "B raw") and tune these for YOUR probes.
const int CAP_ADC_DRY = 3100;
const int CAP_ADC_WET = 1350;
const int RES_ADC_DRY = 3900;
const int RES_ADC_WET = 1500;

// ----- OV5640 image settings -----
// UXGA = 1600x1200: sharp enough for leaf spots, yellowing and curling,
// still small enough (~150-350 KB) for Vercel's ~4.5 MB body limit.
#define CAM_FRAME_SIZE   FRAMESIZE_UXGA
#define CAM_JPEG_QUALITY 10   // 0-63, lower = better quality / bigger file

// Flip the picture if it comes out upside-down or mirrored on the dashboard.
// CAUTION: flipping horizontally SWAPS which container appears left/right —
// re-check the container convention after changing CAM_HMIRROR.
#define CAM_VFLIP   0
#define CAM_HMIRROR 0

// ============ CAMERA PINS — ESP32-S3 N16R8 CAM board (OV5640) ============
#define PWDN_GPIO_NUM  -1
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM  15
#define SIOD_GPIO_NUM  4
#define SIOC_GPIO_NUM  5
#define Y9_GPIO_NUM    16
#define Y8_GPIO_NUM    17
#define Y7_GPIO_NUM    18
#define Y6_GPIO_NUM    12
#define Y5_GPIO_NUM    10
#define Y4_GPIO_NUM    8
#define Y3_GPIO_NUM    9
#define Y2_GPIO_NUM    11
#define VSYNC_GPIO_NUM 6
#define HREF_GPIO_NUM  7
#define PCLK_GPIO_NUM  13

// =======================================================================

DHT dhtA(DHT_A_PIN, DHT_TYPE);
DHT dhtB(DHT_B_PIN, DHT_TYPE);
bool cameraReady = false;

// Read one DHT with retries; returns false if it never answers.
bool readDht(DHT &sensor, const char *label, float &tempOut, float &humOut) {
  for (int i = 0; i < 5; i++) {
    tempOut = sensor.readTemperature();
    humOut  = sensor.readHumidity();
    if (!isnan(tempOut) && !isnan(humOut)) {
      humOut = constrain(humOut, 0, 100);
      return true;
    }
    delay(2500);
  }
  Serial.printf("DHT %s read failed — check wiring/pull-up.\n", label);
  return false;
}

// ---------------------------------------------------------------------------
void finishCycle() {
  if (cameraReady) {
    esp_camera_deinit();   // release the OV5640 cleanly before sleeping
    cameraReady = false;
  }
#if DEMO_MODE
  Serial.printf("DEMO_MODE: next capture in %u s\n\n", DEMO_INTERVAL_SECONDS);
  delay(DEMO_INTERVAL_SECONDS * 1000UL);
#else
  Serial.printf("Sleeping for %u minutes...\n", CAPTURE_INTERVAL_MINUTES);
  Serial.flush();
  esp_sleep_enable_timer_wakeup((uint64_t)CAPTURE_INTERVAL_MINUTES * 60ULL * 1000000ULL);
  esp_deep_sleep_start();
#endif
}

// ---------------------------------------------------------------------------
bool initCamera() {
  if (!psramFound()) {
    Serial.println("ERROR: PSRAM not found. Set Tools > PSRAM > OPI PSRAM.");
    return false;
  }

  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size   = CAM_FRAME_SIZE;
  config.jpeg_quality = CAM_JPEG_QUALITY;
  config.fb_count     = 2;
  config.fb_location  = CAMERA_FB_IN_PSRAM;
  config.grab_mode    = CAMERA_GRAB_LATEST;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x  (check ribbon cable, PSRAM setting, pin map)\n", err);
    return false;
  }
  cameraReady = true;

  sensor_t *s = esp_camera_sensor_get();
  if (s) {
    if (s->id.PID == OV5640_PID) {
      Serial.println("Camera: OV5640 detected");
    } else {
      Serial.printf("Camera: sensor PID 0x%x (not OV5640 — check module)\n", s->id.PID);
    }
    s->set_vflip(s, CAM_VFLIP);
    s->set_hmirror(s, CAM_HMIRROR);
    // Natural colours matter for disease detection (yellowing, spots)
    s->set_whitebal(s, 1);
    s->set_awb_gain(s, 1);
    s->set_exposure_ctrl(s, 1);
    s->set_gain_ctrl(s, 1);
    s->set_brightness(s, 0);
    s->set_saturation(s, 0);
    s->set_sharpness(s, 1);
  }
  return true;
}

// ---------------------------------------------------------------------------
camera_fb_t *capturePhoto() {
  // OV5640 auto-exposure / white balance needs longer than the OV2640 to
  // settle. Throw away ~2.5 s of frames so the AI gets a well-exposed photo.
  for (int i = 0; i < 8; i++) {
    camera_fb_t *warmup = esp_camera_fb_get();
    if (warmup) esp_camera_fb_return(warmup);
    delay(300);
  }
  for (int attempt = 1; attempt <= 3; attempt++) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (fb && fb->len > 1000) return fb;   // reject empty/corrupt frames
    if (fb) esp_camera_fb_return(fb);
    Serial.printf("Capture attempt %d failed, retrying...\n", attempt);
    delay(500);
  }
  return nullptr;
}

// ---------------------------------------------------------------------------
bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connection failed.");
    return false;
  }
  Serial.print("WiFi connected: ");
  Serial.println(WiFi.localIP());
  return true;
}

// ---------------------------------------------------------------------------
int readProbePct(int pin, int adcDry, int adcWet, const char *label) {
  long sum = 0;
  const int samples = 8;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delay(20);
  }
  int raw = sum / samples;
  int pct = constrain(map(raw, adcDry, adcWet, 0, 100), 0, 100);
  Serial.printf("Soil %s raw ADC: %d -> %d%%\n", label, raw, pct);
  return pct;
}

// ---------------------------------------------------------------------------
bool postTelemetry(const uint8_t *img, size_t imgLen,
                   float tempA, float humA, float tempB, float humB,
                   int soilAPct, int soilBPct, bool hasB) {
  const String boundary = "----phms-" + String((uint32_t)esp_random(), HEX);

  auto field = [&](const char *name, const String &value) {
    return "--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name +
           "\"\r\n\r\n" + value + "\r\n";
  };

  String head;
  // Per-container air readings + legacy averages for backward compatibility
  head += field("temperatureA", String(tempA, 1));
  head += field("temperatureB", String(tempB, 1));
  head += field("humidityA",    String(humA, 1));
  head += field("humidityB",    String(humB, 1));
  head += field("temperature",  String((tempA + tempB) / 2.0f, 1));
  head += field("humidity",     String((humA + humB) / 2.0f, 1));
  if (hasB) {
    // Per-container soil: A = left/capacitive, B = right/resistive.
    head += field("soilMoistureA", String(soilAPct));
    head += field("soilMoistureB", String(soilBPct));
    head += field("soilMoisture",  String((soilAPct + soilBPct) / 2));
  } else {
    head += field("soilMoisture", String(soilAPct));
  }
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"image\"; filename=\"capture.jpg\"\r\n";
  head += "Content-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + boundary + "--\r\n";

  size_t total = head.length() + imgLen + tail.length();
  uint8_t *body = (uint8_t *)ps_malloc(total);
  if (!body) {
    Serial.println("Out of memory building request body.");
    return false;
  }
  memcpy(body, head.c_str(), head.length());
  memcpy(body + head.length(), img, imgLen);
  memcpy(body + head.length() + imgLen, tail.c_str(), tail.length());

  WiFiClientSecure client;
  client.setInsecure();   // fine for a student project; pin the root CA to harden

  bool ok = false;
  for (int attempt = 1; attempt <= 3 && !ok; attempt++) {
    HTTPClient http;
    http.setTimeout(45000);   // server waits for Gemini to analyse the photo
    if (!http.begin(client, SERVER_URL)) {
      Serial.println("http.begin() failed.");
      break;
    }
    http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
    http.addHeader("x-device-key", DEVICE_API_KEY);

    Serial.printf("POST attempt %d (%u bytes)...\n", attempt, (unsigned)total);
    int code = http.POST(body, total);
    String response = http.getString();
    Serial.printf("HTTP %d: %s\n", code, response.c_str());
    http.end();

    if (code == 200 || code == 201) {
      ok = true;
    } else if (code == 401 || code == 403) {
      Serial.println("Server rejected DEVICE_API_KEY — get the correct key from the Vercel env vars.");
      break;   // retrying won't help
    } else if (code == 413) {
      Serial.println("Image too large — use a smaller CAM_FRAME_SIZE or higher CAM_JPEG_QUALITY number.");
      break;
    } else if (attempt < 3) {
      delay(5000 * attempt);
    }
  }

  free(body);
  return ok;
}

// ---------------------------------------------------------------------------
void runCycle() {
  Serial.println("\n=== PHMS capture cycle starting ===");

  // ---- Sensors ----
  float tempA = NAN, humA = NAN, tempB = NAN, humB = NAN;
  bool okA = readDht(dhtA, "A (left)", tempA, humA);
  bool okB = readDht(dhtB, "B (right)", tempB, humB);
  if (!okA && !okB) {
    Serial.println("Both DHTs failed — skipping this cycle.");
    finishCycle();
    return;
  }
  // One sensor down: reuse the working container's air reading so the
  // cycle (and per-container soil data) still goes through.
  if (!okA) { tempA = tempB; humA = humB; }
  if (!okB) { tempB = tempA; humB = humA; }

  int soilAPct = readProbePct(SOIL_CAP_PIN, CAP_ADC_DRY, CAP_ADC_WET, "A (left, cap)");
#if USE_RESISTIVE_SENSOR
  int soilBPct = readProbePct(SOIL_RES_PIN, RES_ADC_DRY, RES_ADC_WET, "B (right, res)");
  const bool hasB = true;
#else
  int soilBPct = 0;
  const bool hasB = false;
#endif
  Serial.printf("A: %.1fC %.1f%%RH soil %d%%  |  B: %.1fC %.1f%%RH soil %s\n",
                tempA, humA, soilAPct, tempB, humB,
                hasB ? String(soilBPct).c_str() : "n/a");

  // ---- Camera ----
  if (!cameraReady && !initCamera()) { finishCycle(); return; }

  camera_fb_t *fb = capturePhoto();
  if (!fb) {
    Serial.println("Camera capture failed.");
    finishCycle();
    return;
  }
  Serial.printf("Captured %ux%u JPEG, %u bytes\n", fb->width, fb->height, (unsigned)fb->len);

  // ---- Upload ----
  if (connectWiFi()) {
    bool sent = postTelemetry(fb->buf, fb->len, tempA, humA, tempB, humB,
                              soilAPct, soilBPct, hasB);
    Serial.println(sent ? "Upload OK — check the dashboard." : "Upload FAILED.");
  }
  esp_camera_fb_return(fb);

#if !DEMO_MODE
  WiFi.disconnect(true);
#endif
  finishCycle();
}

// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.printf("PHMS firmware — ESP32-S3 N16R8 + OV5640  |  PSRAM: %u bytes\n", ESP.getPsramSize());

  analogReadResolution(12);
  analogSetPinAttenuation(SOIL_CAP_PIN, ADC_11db);   // full 0-3.3 V range
#if USE_RESISTIVE_SENSOR
  analogSetPinAttenuation(SOIL_RES_PIN, ADC_11db);
#endif

  dhtA.begin();
  dhtB.begin();
  delay(2000);   // DHT11s need a moment after power-up

  runCycle();    // in normal mode this never returns (deep sleep restarts setup)
}

void loop() {
#if DEMO_MODE
  runCycle();
#endif
}
