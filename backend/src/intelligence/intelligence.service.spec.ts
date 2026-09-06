import { IntelligenceService } from './intelligence.service';

describe('IntelligenceService', () => {
  const city = { id: 'city-1', name: 'Jakarta', country: 'Indonesia', latitude: '-6.2', longitude: '106.8', timezone: 'Asia/Jakarta' };
  it('returns grounded weather and incident signals with honest capability states', async () => {
    const service = new IntelligenceService(
      { city: { findUnique: jest.fn().mockResolvedValue({ ...city, latitude:  -6.2, longitude: 106.8 }) } } as any,
      { getWeather: jest.fn().mockResolvedValue({ cityId: 'city-1', provider: 'Open-Meteo', available: true, fetchedAt: '2026-01-01T00:00:00.000Z', current: { temperatureC: 28, condition: 'Clear' } }) } as any,
      { getAlerts: jest.fn().mockResolvedValue({ available: false, alerts: [], source: 'NWS', reason: 'Provider unavailable' }) } as any,
      { capabilities: jest.fn().mockResolvedValue({ available: false, statuses: { traffic: 'PREDICTION_UNAVAILABLE' }, reason: 'insufficient data' }) } as any,
    );
    const result = await service.getState('city-1');
    expect(result.city.name).toBe('Jakarta');
    expect(result.signals).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'environment', availability: 'available', source: 'Open-Meteo' }), expect.objectContaining({ type: 'incident', availability: 'limited', value: [] })]));
    expect(result.capabilities.traffic).toBe('unavailable');
    expect(result.capabilities.transit).toBe('unavailable');
  });

  it('does not invent a signal for an unsupported type', async () => {
    const service = new IntelligenceService(
      { city: { findUnique: jest.fn().mockResolvedValue({ ...city, latitude: -6.2, longitude: 106.8 }) } } as any,
      { getWeather: jest.fn().mockResolvedValue({ available: false, fetchedAt: 'now', provider: 'Open-Meteo', reason: 'unavailable' }) } as any,
      { getAlerts: jest.fn().mockResolvedValue({ available: false, alerts: [], source: 'NWS' }) } as any,
      { capabilities: jest.fn().mockResolvedValue({ available: false, statuses: {}, reason: 'insufficient data' }) } as any,
    );
    const result = await service.getSignal('city-1', 'events');
    expect(result.signal).toEqual(expect.objectContaining({ type: 'events', availability: 'unavailable', value: null }));
  });
});
