import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITelemetry extends Document {
  timestamp: Date;
  temperature: number;
  humidity: number;
  soilMoisture: number;
  imageUrl: string;
  healthScore?: number;
  status?: 'Healthy' | 'Warning' | 'Critical';
  diagnosis?: string;
  recommendedActions?: string[];
}

const TelemetrySchema: Schema = new Schema({
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true, // Index for efficient sorting
  },
  temperature: {
    type: Number,
    required: true,
  },
  humidity: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  soilMoisture: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  healthScore: {
    type: Number,
    min: 0,
    max: 100,
  },
  status: {
    type: String,
    enum: ['Healthy', 'Warning', 'Critical'],
  },
  diagnosis: {
    type: String,
  },
  recommendedActions: {
    type: [String],
  },
});

// Prevent model recompilation in development
const Telemetry: Model<ITelemetry> =
  mongoose.models.Telemetry || mongoose.model<ITelemetry>('Telemetry', TelemetrySchema);

export default Telemetry;
