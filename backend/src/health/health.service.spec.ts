import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports application and database readiness separately', async () => {
    const service = new HealthService({ $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as any);
    await expect(service.check()).resolves.toEqual(expect.objectContaining({ status: 'ok', application: 'ok', database: 'ok' }));
  });
  it('does not mark the application down when the database is unavailable', async () => {
    const service = new HealthService({ $queryRaw: jest.fn().mockRejectedValue(new Error('offline')) } as any);
    await expect(service.check()).resolves.toEqual(expect.objectContaining({ status: 'degraded', application: 'ok', database: 'unavailable' }));
  });
});
