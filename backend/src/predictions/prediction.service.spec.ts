import { PredictionService } from './prediction.service';

describe('PredictionService', () => {
  it('reports unavailable instead of fabricating a prediction', async () => {
    const service = new PredictionService({ city: { findUnique: jest.fn().mockResolvedValue({ id: 'city-1' }) } } as any);
    const prediction = await service.predict('city-1', 'traffic');
    expect(prediction.status).toBe('PREDICTION_UNAVAILABLE');
    expect(prediction.value).toBeNull();
    expect(prediction.features).toEqual([]);
  });

  it('exposes honest capability statuses', async () => {
    const service = new PredictionService({} as any);
    const capabilities = await service.capabilities();
    expect(capabilities.available).toBe(false);
    expect(capabilities.statuses.traffic).toBe('PREDICTION_UNAVAILABLE');
  });
});
