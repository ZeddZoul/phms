/*
 * PHMS — ESP32-S3-CAM telemetry firmware
 * =======================================
 * Wakes on a timer, reads temperature/humidity (DHT11) and soil moisture
 * (capacitive + resistive probes, averaged), captures a JPEG of the maize &
 * beans containers, and POSTs everything as multipart/form-data to the
 * PHMS server:
 *
 *   POST {SERVER_URL}  (x-device-key header)
 *     image        JPEG file
 *     temperature  °C
 *     humidity     %
 *     soilMoisture %
 *
 * Then deep-sleeps until the next capture. See firmware/README.md for
 * wiring, libraries, board settings, and calibration.
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <DHT.h>

// ======================= CONFIG — EDIT THIS BLOCK =======================

const char *WIFI_SSID     = "YOUR_WIFI_SSID";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Your deployed endpoint (Settings → Connect device shows the exact URL).
// For local testing use http://<your-computer-ip>:3000/api/telemetry
const char *SERVER_URL = "https://my-phms.vercel.app/api/telemetry";

// DEVICE_API_KEY from the server's environment (.env.local / Vercel).
// Never commit the real value — paste it only onto the device you flash.
const char *DEVICE_API_KEY = "sk_live_esp32-s3-cam";

// Minutes between captures (deep-sleep period)
const uint32_t CAPTURE_INTERVAL_MINUTES = 30;

// Sensor pins (free pins on the ESP32S3_EYE/Freenove camera pin map —
// adjust to your wiring)
#define DHT_PIN      14  // DHT11 data
#define DHT_TYPE     DHT11
#define SOIL_CAP_PIN 1   // capacitive soil sensor AOUT (ADC1 pin: GPIO 1-10)
#define SOIL_RES_PIN 2   // resistive soil sensor AOUT  (ADC1 pin: GPIO 1-10)

// Set to 0 to run on the capacitive probe alone (resistive probes corrode
// over weeks — drop this to 0 when yours starts drifting)
#define USE_RESISTIVE_SENSOR 1

// Soil calibration, per probe: raw 12-bit ADC readings for fully dry air
// and for the probe submerged in water. Both probe types read HIGH when
// dry and LOW when wet; exact values differ per module. Read the Serial
// log ("cap raw"/"res raw"), then tune these.
const int CAP_ADC_DRY = 3100;
const int CAP_ADC_WET = 1350;
const int RES_ADC_DRY = 3900;
const int RES_ADC_WET = 1500;

// ================== CAMERA PINS (ESP32S3_EYE pin map) ==================
// Matches most generic "ESP32-S3-CAM" boards and the Freenove
// ESP32-S3-WROOM CAM. For Seeed XIAO ESP32S3 Sense, see README.
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

DHT dht(DHT_PIN, DHT_TYPE);

void goToSleep() {
  Serial.printf("Sleeping for %u minutes...\n", CAPTURE_INTERVAL_MINUTES);
  Serial.flush();
  esp_sleep_enable_timer_wakeup((uint64_t)CAPTURE_INTERVAL_MINUTES * 60ULL * 1000000ULL);
  esp_deep_sleep_start();
}

bool initCamera() {
  camera_config_t config;
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
  config.frame_size   = FRAMESIZE_SVGA; // 800x600 — plenty for the AI
  config.jpeg_quality = 12;             // lower number = higher quality
  config.fb_count     = 2;
  config.fb_location  = CAMERA_FB_IN_PSRAM;
  config.grab_mode    = CAMERA_GRAB_LATEST;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return false;
  }
  return true;
}

bool connectWiFi() {
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

int readProbePct(int pin, int adcDry, int adcWet, const char *label) {
  // Average a few samples for a steadier reading
  long sum = 0;
  const int samples = 8;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delay(20);
  }
  int raw = sum / samples;

  // Map raw (dry..wet) to 0..100% and clamp
  int pct = map(raw, adcDry, adcWet, 0, 100);
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  Serial.printf("Soil %s raw ADC: %d -> %d%%\n", label, raw, pct);
  return pct;
}

int readSoilMoisturePct() {
  int capPct = readProbePct(SOIL_CAP_PIN, CAP_ADC_DRY, CAP_ADC_WET, "cap");
#if USE_RESISTIVE_SENSOR
  int resPct = readProbePct(SOIL_RES_PIN, RES_ADC_DRY, RES_ADC_WET, "res");
  if (abs(capPct - resPct) > 30) {
    // Big disagreement usually means a corroding resistive probe or a
    // probe out of the soil — trust the capacitive reading alone.
    Serial.println("WARNING: probes disagree by >30% — using capacitive only.");
    return capPct;
  }
  return (capPct + resPct) / 2;
#else
  return capPct;
#endif
}

bool postTelemetry(camera_fb_t *fb, float temperature, float humidity, int soilPct) {
  const String boundary = "----phms-" + String((uint32_t)esp_random(), HEX);

  String fieldTpl =
    "--" + boundary + "\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n";

  String head;
  char buf[160];
  snprintf(buf, sizeof(buf), fieldTpl.c_str(), "temperature", String(temperature, 1).c_str());
  head += buf;
  snprintf(buf, sizeof(buf), fieldTpl.c_str(), "humidity", String(humidity, 1).c_str());
  head += buf;
  snprintf(buf, sizeof(buf), fieldTpl.c_str(), "soilMoisture", String(soilPct).c_str());
  head += buf;
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"image\"; filename=\"capture.jpg\"\r\n";
  head += "Content-Type: image/jpeg\r\n\r\n";

  String tail = "\r\n--" + boundary + "--\r\n";

  size_t total = head.length() + fb->len + tail.length();
  uint8_t *body = (uint8_t *)ps_malloc(total);
  if (!body) {
    Serial.println("Out of memory building request body.");
    return false;
  }
  memcpy(body, head.c_str(), head.length());
  memcpy(body + head.length(), fb->buf, fb->len);
  memcpy(body + head.length() + fb->len, tail.c_str(), tail.length());

  bool https = strncmp(SERVER_URL, "https://", 8) == 0;
  WiFiClientSecure secureClient;
  WiFiClient plainClient;
  if (https) {
    // Pragmatic for a hobby device; pin the server's root CA to harden.
    secureClient.setInsecure();
  }

  bool ok = false;
  for (int attempt = 1; attempt <= 3 && !ok; attempt++) {
    HTTPClient http;
    http.setTimeout(30000);
    bool began = https ? http.begin(secureClient, SERVER_URL)
                       : http.begin(plainClient, SERVER_URL);
    if (!began) {
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

    ok = (code == 200);
    if (!ok && attempt < 3) delay(5000 * attempt);
  }

  free(body);
  return ok;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\nPHMS capture cycle starting");

  analogReadResolution(12);
  analogSetPinAttenuation(SOIL_CAP_PIN, ADC_11db); // full 0-3.3V range
#if USE_RESISTIVE_SENSOR
  analogSetPinAttenuation(SOIL_RES_PIN, ADC_11db);
#endif

  dht.begin();
  delay(2000); // DHT11 needs a moment after power-up

  // Read sensors (retry DHT a few times — it is a slow, grumpy sensor)
  float temperature = NAN, humidity = NAN;
  for (int i = 0; i < 5 && (isnan(temperature) || isnan(humidity)); i++) {
    temperature = dht.readTemperature();
    humidity = dht.readHumidity();
    if (isnan(temperature) || isnan(humidity)) delay(2500);
  }
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT read failed — skipping this cycle.");
    goToSleep();
  }
  if (humidity < 0) humidity = 0;
  if (humidity > 100) humidity = 100;

  int soilPct = readSoilMoisturePct();
  Serial.printf("Temp: %.1f°C  Humidity: %.1f%%  Soil: %d%%\n",
                temperature, humidity, soilPct);

  if (!initCamera()) goToSleep();

  // Let auto-exposure/white-balance settle: discard a few frames. A stable,
  // well-exposed photo matters a lot for the AI's accuracy.
  for (int i = 0; i < 3; i++) {
    camera_fb_t *warmup = esp_camera_fb_get();
    if (warmup) esp_camera_fb_return(warmup);
    delay(350);
  }

  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed.");
    goToSleep();
  }
  Serial.printf("Captured %u bytes\n", (unsigned)fb->len);

  if (connectWiFi()) {
    postTelemetry(fb, temperature, humidity, soilPct);
    WiFi.disconnect(true);
  }

  esp_camera_fb_return(fb);
  goToSleep();
}

void loop() {
  // Never reached — every cycle ends in deep sleep.
}
