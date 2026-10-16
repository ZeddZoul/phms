export interface TelemetryInput {
  temperature: number;
  humidity: number;
  soilMoisture: number;
  image: File;
}

export interface HealthAssessment {
  health_score: number;
  status: 'Healthy' | 'Warning' | 'Critical';
  diagnosis: string;
  recommended_actions: string[];
}

export interface TelemetryRecord {
  _id: string;
  timestamp: string;
  temperature: number;
  humidity: number;
  soilMoisture: number;
  imageUrl: string;
  healthScore?: number;
  status?: 'Healthy' | 'Warning' | 'Critical';
  diagnosis?: string;
  recommendedActions?: string[];
}

export interface TelemetryResponse {
  message: string;
  id: string;
}

export interface ErrorResponse {
  error: string;
}
