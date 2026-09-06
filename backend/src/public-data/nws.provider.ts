import { Injectable } from '@nestjs/common';
import { PublicSafetyProvider } from './public-data.types';
@Injectable()
export class NwsProvider implements PublicSafetyProvider {
  async getAlerts(latitude: number, longitude: number) {
    try { const response = await fetch(`https://api.weather.gov/alerts/active?point=${latitude},${longitude}`, { headers: { Accept: 'application/geo+json', 'User-Agent': 'CityVerse/2.0 public-data' } }); if (!response.ok) return { available: false, alerts: [], source: 'US National Weather Service', reason: `Provider returned ${response.status}` }; const data = await response.json() as any; return { available: true, source: 'US National Weather Service', alerts: (data.features ?? []).map((feature: any) => ({ id: feature.id, type: feature.properties?.event ?? 'alert', severity: feature.properties?.severity ?? 'unknown', title: feature.properties?.headline ?? feature.properties?.event ?? 'Public alert', description: feature.properties?.description ?? '', location: { latitude: feature.geometry?.coordinates?.[1], longitude: feature.geometry?.coordinates?.[0] }, startTime: feature.properties?.onset, endTime: feature.properties?.ends, source: 'US National Weather Service', sourceUrl: feature.properties?.web })) }; } catch { return { available: false, alerts: [], source: 'US National Weather Service', reason: 'Provider unavailable' }; }
  }
}
