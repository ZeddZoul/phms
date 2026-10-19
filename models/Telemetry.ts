import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITelemetry extends Document {
  timestamp: Date;
  temperature: number;
  humidity: number;
  soilMoisture: number;
  imageUrl: string;
  soilMoistureA?: number;
  soilMoistureB?: number;
  temperatureA?: number;
  temperatureB?: number;
  humidityA?: number;
  humidityB?: number;
  healthScore?: number;
  smoothedScore?: number;
  maizeScore?: number;
  beansScore?: number;
  containerAScore?: number;
  containerAStatus?: 'Healthy' | 'Warning' | 'Critical';
  containerADiagnosis?: string;
  containerBScore?: number;
  containerBStatus?: 'Healthy' | 'Warning' | 'Critical';
  containerBDiagnosis?: string;
  maizeAScore?: number;
  beansAScore?: number;
  maizeBScore?: number;
  beansBScore?: number;
  status?: 'Healthy' | 'Warning' | 'Critical';
  diagnosis?: string;
  recommendedActions?: string[];
  assessmentError?: string;
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
  soilMoistureA: {
    type: Number,
    min: 0,
    max: 100,
  },
  soilMoistureB: {
    type: Number,
    min: 0,
    max: 100,
  },
  temperatureA: {
    type: Number,
  },
  temperatureB: {
    type: Number,
  },
  humidityA: {
    type: Number,
    min: 0,
    max: 100,
  },
  humidityB: {
    type: Number,
    min: 0,
    max: 100,
  },
  smoothedScore: {
    type: Number,
    min: 0,
    max: 100,
  },
  maizeScore: {
    type: Number,
    min: 0,
    max: 100,
  },
  beansScore: {
    type: Number,
    min: 0,
    max: 100,
  },
  containerAScore: {
    type: Number,
    min: 0,
    max: 100,
  },
  containerAStatus: {
    type: String,
    enum: ['Healthy', 'Warning', 'Critical'],
  },
  containerADiagnosis: {
    type: String,
  },
  containerBScore: {
    type: Number,
    min: 0,
    max: 100,
  },
  containerBStatus: {
    type: String,
    enum: ['Healthy', 'Warning', 'Critical'],
  },
  containerBDiagnosis: {
    type: String,
  },
  maizeAScore: {
    type: Number,
    min: 0,
    max: 100,
  },
  beansAScore: {
    type: Number,
    min: 0,
    max: 100,
  },
  maizeBScore: {
    type: Number,
    min: 0,
    max: 100,
  },
  beansBScore: {
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
  assessmentError: {
    type: String,
  },
});

// Prevent model recompilation in development
const Telemetry: Model<ITelemetry> =
  mongoose.models.Telemetry || mongoose.model<ITelemetry>('Telemetry', TelemetrySchema);

export default Telemetry;
