// Seed the database with ~2.5 days of realistic per-container telemetry.
// WIPES the telemetry collection first (alert settings are untouched).
//
//   node scripts/seed.mjs
//
// The storyline: Container A stays on a healthy watering rhythm; Container B
// dries out over the first two days (Healthy -> Warning -> Critical), gets
// watered ~8 hours before "now", and recovers. A few records are marked as
// AI-skipped (rate limits), like a real pipeline.

import mongoose from 'mongoose';
import { readFileSync } from 'node:fs';

function loadEnvLocal() {
  if (process.env.MONGODB_URI) return;
  try {
    const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    const match = env.match(/^MONGODB_URI=(.+)$/m);
    if (match) {
      // Trim whitespace and surrounding quotes, like dotenv does
      process.env.MONGODB_URI = match[1].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // no .env.local — fall through to the check below
  }
}

loadEnvLocal();

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set (env or .env.local). Aborting.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI, {
  dbName: process.env.MONGODB_DB || 'phms',
});

const Telemetry = mongoose.connection.collection('telemetries');

// Real assets already in the project's Cloudinary account (from verified
// uploads), so the photo lightbox shows actual images.
const IMAGES = [
  'https://res.cloudinary.com/dpk6moubp/image/upload/v1792210853/plant-monitoring/ax5tyrjmbegwnszrvov7.webp',
  'https://res.cloudinary.com/dpk6moubp/image/upload/v1792210889/plant-monitoring/plant.webp',
];

const COUNT = 120; // every 30 min, ending now (~2.5 days)
const STEP_MS = 30 * 60 * 1000;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = (v) => Math.round(v * 10) / 10;
const noise = (amp) => (Math.random() - 0.5) * 2 * amp;

const statusOf = (score) =>
  score >= 70 ? 'Healthy' : score >= 40 ? 'Warning' : 'Critical';

const diagnosisFor = (phase, soilB) => {
  switch (phase) {
    case 'healthy':
      return 'Both containers look healthy: upright maize blades and firm bean leaves, soil moisture in the target band for A and B.';
    case 'warning':
      return `Container A remains healthy. Container B's soil is drifting low (${soilB}%) and its bean leaflets are starting to slacken — watering is due within the day.`;
    case 'critical':
      return `Container A is unaffected, but Container B's soil reading (${soilB}%) is critically low; its maize shows early leaf rolling and the bean is drooping. Water Container B immediately.`;
    case 'recovery':
      return `Container B was watered and its soil is back in range (${soilB}%); turgor is returning though some lower-leaf stress marks remain. Container A stayed healthy throughout.`;
    default:
      return 'Assessment summary unavailable.';
  }
};

const actionsFor = (phase) => {
  switch (phase) {
    case 'warning':
      return [
        'Water Container B within the next few hours, until drainage appears',
        'Re-check Container B soil moisture after watering',
        'Maintain current care for Container A',
      ];
    case 'critical':
      return [
        'Water Container B thoroughly right now, until water drains freely',
        'Shade Container B for the rest of the day to cut transpiration',
        'Re-check Container B in one hour; repeat a smaller watering if still below 35%',
        'Maintain current care for Container A',
      ];
    case 'recovery':
      return [
        'Keep Container B on the same watering schedule as A from now on',
        'Watch the lower bean leaves on B for lingering stress over the next two days',
      ];
    default:
      return ['Continue the current care routine', 'Keep the capture schedule running'];
  }
};

const now = Date.now();
const docs = [];
let prevSmoothed;
let soilA = 66;
let soilB = 62;
let wateredBAt = null;

for (let i = 0; i < COUNT; i++) {
  const ts = new Date(now - (COUNT - 1 - i) * STEP_MS);
  const hours = ts.getHours() + ts.getMinutes() / 60;
  const hoursFromEnd = (COUNT - 1 - i) * 0.5;

  // Diurnal cycle: warm mid-afternoon, cool pre-dawn
  const day = Math.sin(((hours - 9) / 24) * 2 * Math.PI);
  const tempA = round1(clamp(23 + 5.2 * day + noise(0.5), 16, 33));
  const tempB = round1(clamp(tempA + 0.4 + noise(0.5), 16, 34));
  const humA = round1(clamp(74 - 1.3 * (tempA - 20) + noise(2.5), 38, 92));
  const humB = round1(clamp(humA - 1.5 + noise(2), 35, 92));

  // Container A: steady watering rhythm (watered whenever it dips low)
  soilA -= 0.35 + (tempA > 26 ? 0.2 : 0) + Math.random() * 0.15;
  if (soilA < 44) soilA = 66 + noise(2);

  // Container B: neglected until ~8h before the end, then watered once
  if (wateredBAt === null && hoursFromEnd <= 8) {
    soilB = 64 + noise(2);
    wateredBAt = i;
  } else {
    soilB -= 0.55 + (tempB > 26 ? 0.3 : 0) + Math.random() * 0.2;
  }
  soilB = clamp(soilB, 9, 75);
  const sA = Math.round(clamp(soilA, 0, 100));
  const sB = Math.round(soilB);

  // ~8% of records: the AI was busy — reading stored without assessment
  const skipped = Math.random() < 0.08;

  let doc = {
    timestamp: ts,
    temperatureA: tempA,
    temperatureB: tempB,
    temperature: round1((tempA + tempB) / 2),
    humidityA: humA,
    humidityB: humB,
    humidity: round1((humA + humB) / 2),
    soilMoistureA: sA,
    soilMoistureB: sB,
    soilMoisture: round1((sA + sB) / 2),
    imageUrl: IMAGES[i % IMAGES.length],
  };

  if (skipped) {
    doc.assessmentError = Math.random() < 0.5 ? 'rate_limited' : 'unavailable';
  } else {
    // Container A: comfortably healthy, tracking its soil mildly
    const contA = Math.round(clamp(80 + (sA - 55) * 0.25 + noise(4), 70, 96));

    // Container B: driven by its soil, with a stress lag during recovery
    let contB;
    let phase;
    if (wateredBAt !== null && i >= wateredBAt) {
      const sinceWater = i - wateredBAt;
      contB = Math.round(clamp(48 + sinceWater * 2.2 + noise(3), 45, 78));
      phase = 'recovery';
    } else if (sB >= 45) {
      contB = Math.round(clamp(76 + (sB - 55) * 0.3 + noise(4), 68, 90));
      phase = 'healthy';
    } else if (sB >= 28) {
      contB = Math.round(clamp(40 + (sB - 28) * 1.1 + noise(3), 40, 62));
      phase = 'warning';
    } else {
      contB = Math.round(clamp(18 + (sB - 9) * 0.8 + noise(3), 15, 38));
      phase = 'critical';
    }

    const maizeA = Math.round(clamp(contA + noise(4), 60, 98));
    const beansA = Math.round(clamp(contA - 2 + noise(4), 55, 97));
    // Beans suffer earlier than maize when B dries out
    const maizeB = Math.round(clamp(contB + 4 + noise(3), 12, 95));
    const beansB = Math.round(clamp(contB - 4 + noise(3), 10, 93));

    const overall = Math.round(clamp(Math.min(contA, contB) - Math.random() * 2, 10, 96));
    const smoothed =
      prevSmoothed === undefined
        ? overall
        : Math.round(0.4 * overall + 0.6 * prevSmoothed);
    prevSmoothed = smoothed;

    doc = {
      ...doc,
      healthScore: overall,
      smoothedScore: smoothed,
      maizeScore: Math.round((maizeA + maizeB) / 2),
      beansScore: Math.round((beansA + beansB) / 2),
      containerAScore: contA,
      containerAStatus: statusOf(contA),
      containerADiagnosis:
        'Maize and bean in Container A look healthy with even colour and good turgor; soil is in the target band.',
      containerBScore: contB,
      containerBStatus: statusOf(contB),
      containerBDiagnosis: diagnosisFor(phase, sB),
      maizeAScore: maizeA,
      beansAScore: beansA,
      maizeBScore: maizeB,
      beansBScore: beansB,
      status: statusOf(overall),
      diagnosis: diagnosisFor(phase, sB),
      recommendedActions: actionsFor(phase),
    };
  }

  docs.push(doc);
}

const removed = await Telemetry.deleteMany({});
await Telemetry.insertMany(docs);

const assessed = docs.filter((d) => d.healthScore !== undefined).length;
console.log(
  `Removed ${removed.deletedCount} old records; seeded ${docs.length} per-container records (${assessed} assessed, ${docs.length - assessed} AI-skipped).`
);
await mongoose.disconnect();
