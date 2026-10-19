export interface TelemetryInput {
  temperature: number;
  humidity: number;
  soilMoisture: number;
  image: File;
}

export interface HealthAssessment {
  health_score: number;
  maize_score?: number;
  beans_score?: number;
  container_a_score?: number;
  container_a_status?: 'Healthy' | 'Warning' | 'Critical';
  container_a_diagnosis?: string;
  container_b_score?: number;
  container_b_status?: 'Healthy' | 'Warning' | 'Critical';
  container_b_diagnosis?: string;
  maize_a_score?: number;
  beans_a_score?: number;
  maize_b_score?: number;
  beans_b_score?: number;
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
  /** Why the AI assessment is missing (rate_limited | unavailable | auth | invalid_response | unknown) */
  assessmentError?: string;
}

export interface TelemetryResponse {
  message: string;
  id: string;
}

export interface ErrorResponse {
  error: string;
}
