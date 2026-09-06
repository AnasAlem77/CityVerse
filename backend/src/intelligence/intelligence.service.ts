import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PublicDataService } from '../public-data/public-data.service';
import { WeatherService } from '../weather/weather.service';
import { PredictionService } from '../predictions/prediction.service';
import { CitySignal, DigitalTwinState, IntelligenceAvailability } from './intelligence.types';

const unavailableReason = 'No reliable free provider is configured for this capability.';

@Injectable()
export class IntelligenceService {
  private readonly cache = new Map<string, { expires: number; value: DigitalTwinState }>();
  private readonly inFlight = new Map<string, Promise<DigitalTwinState>>();
  private readonly ttlMs = 60_000;
  constructor(private readonly prisma: PrismaService, private readonly weather: WeatherService, private readonly publicData: PublicDataService, private readonly predictions: PredictionService) {}

  async getState(cityId: string): Promise<DigitalTwinState> {
    const cached = this.cache.get(cityId);
    if (cached && cached.expires > Date.now()) return cached.value;
    const active = this.inFlight.get(cityId);
    if (active) return active;
    const request = this.buildState(cityId);
    this.inFlight.set(cityId, request);
    try { const value = await request; this.cache.set(cityId, { expires: Date.now() + this.ttlMs, value }); return value; }
    finally { this.inFlight.delete(cityId); }
  }

  private async buildState(cityId: string): Promise<DigitalTwinState> {
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { id: true, name: true, country: true, latitude: true, longitude: true, timezone: true } });
    if (!city) throw new NotFoundException('City not found');
    const generatedAt = new Date().toISOString();
    const [weather, safety] = await Promise.all([this.weather.getWeather(cityId), this.publicData.getAlerts(cityId)]);
    const environmentAvailability: IntelligenceAvailability = weather.available ? 'available' : 'limited';
    const incidentAvailability: IntelligenceAvailability = safety.available ? 'available' : 'limited';
    const signals: CitySignal[] = [
      { type: 'environment', availability: environmentAvailability, value: weather.available ? weather.current ?? null : null, observedAt: weather.fetchedAt, source: weather.provider, freshness: weather.available ? 'current-provider-observation' : undefined, reason: 'reason' in weather ? weather.reason : undefined },
      { type: 'incident', availability: incidentAvailability, value: safety.alerts, observedAt: generatedAt, source: safety.source, freshness: safety.available ? 'provider-response' : undefined, reason: safety.reason },
    ];
    const capabilities: Record<string, IntelligenceAvailability> = { traffic: 'unavailable', incidents: incidentAvailability, transit: 'unavailable', events: 'unavailable', airQuality: 'unavailable', environment: environmentAvailability, mobility: 'unavailable', temporal: 'limited' };
    const layers = Object.entries(capabilities).map(([id, availability]) => ({ id, label: id === 'airQuality' ? 'Air quality' : id[0].toUpperCase() + id.slice(1), availability, ...(availability === 'unavailable' ? { reason: unavailableReason } : {}) }));
    return { city: { ...city, latitude: city.latitude.toString(), longitude: city.longitude.toString() }, generatedAt, capabilities, signals, layers, predictions: await this.predictions.capabilities() } as DigitalTwinState;
  }

  async getSignal(cityId: string, type: string) {
    const state = await this.getState(cityId);
    const signal = state.signals.find((item) => item.type === type);
    if (signal) return { city: state.city, generatedAt: state.generatedAt, signal };
    const availability: IntelligenceAvailability = state.capabilities[type] ?? 'unavailable';
    return { city: state.city, generatedAt: state.generatedAt, signal: { type, availability, value: null, reason: unavailableReason } };
  }
}
