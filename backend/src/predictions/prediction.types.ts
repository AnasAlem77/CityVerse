export type PredictionStatus = 'AVAILABLE' | 'PREDICTION_UNAVAILABLE' | 'INSUFFICIENT_DATA' | 'DEGRADED';

export type FeatureValue = { name: string; value: number | string | boolean | null; observedAt?: string; source?: string };

export type Prediction = {
  type: string;
  cityId: string;
  target: string;
  horizon: string;
  generatedAt: string;
  status: PredictionStatus;
  value: unknown;
  model: { name: string; version: string };
  features: FeatureValue[];
  reason?: string;
};

export interface PredictionProvider {
  predict(input: { cityId: string; type: string; horizon: string; features: FeatureValue[] }): Promise<Prediction>;
}
