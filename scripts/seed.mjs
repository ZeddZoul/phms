// Seed the database with synthetic telemetry for local development.
// Usage: MONGODB_URI=... node scripts/seed.mjs   (or rely on .env.local)
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';

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

const TelemetrySchema = new mongoose.Schema({
  timestamp: { type: Date, required: true, index: true },
  temperature: { type: Number, required: true },
  humidity: { type: Number, required: true, min: 0, max: 100 },
  soilMoisture: { type: Number, required: true, min: 0, max: 100 },
  imageUrl: { type: String, required: true },
  healthScore: { type: Number, min: 0, max: 100 },
  status: { type: String, enum: ['Healthy', 'Warning', 'Critical'] },
  diagnosis: String,
  recommendedActions: [String],
});

const Telemetry =
  mongoose.models.Telemetry || mongoose.model('Telemetry', TelemetrySchema);

// Cloudinary's public demo image — stands in for a device capture during dev
const DEMO_IMAGE = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';

const now = Date.now();
const records = Array.from({ length: 12 }, (_, i) => {
  const minutesAgo = (11 - i) * 30;
  return {
    timestamp: new Date(now - minutesAgo * 60 * 1000),
    temperature: Math.round((23 + 3 * Math.sin(i / 2)) * 10) / 10,
    humidity: Math.round(55 + 10 * Math.sin(i / 3 + 1)),
    soilMoisture: Math.round(48 - i * 1.5 + 4 * Math.sin(i)),
    imageUrl: DEMO_IMAGE,
  };
});

// Latest record carries a full AI health assessment
Object.assign(records[records.length - 1], {
  healthScore: 82,
  status: 'Healthy',
  diagnosis:
    'Foliage shows uniform colour with no visible lesions. Soil moisture is trending down; conditions remain within the healthy range.',
  recommendedActions: [
    'Water within the next 24 hours to keep soil moisture above 40%',
    'Maintain current light exposure',
  ],
});

await mongoose.connect(process.env.MONGODB_URI, {
  dbName: process.env.MONGODB_DB || 'phms',
});
await Telemetry.deleteMany({});
await Telemetry.insertMany(records);
const count = await Telemetry.countDocuments();
console.log(`Seeded ${count} telemetry records.`);
await mongoose.disconnect();
