export type IntelligenceAvailability = 'available' | 'limited' | 'unavailable';

export type CitySignal = {
  type: string;
  availability: IntelligenceAvailability;
  value: unknown;
  location?: { latitude: number; longitude: number };
  observedAt?: string;
  source?: string;
  freshness?: string;
  reason?: string;
};

export type DigitalTwinState = {
  city: { id: string; name: string; country: string; latitude: string; longitude: string; timezone: string };
  generatedAt: string;
  capabilities: Record<string, IntelligenceAvailability>;
  signals: CitySignal[];
  layers: Array<{ id: string; label: string; availability: IntelligenceAvailability; source?: string; reason?: string }>;
  predictions?: { available: boolean; statuses: Record<string, string>; reason: string };
};
