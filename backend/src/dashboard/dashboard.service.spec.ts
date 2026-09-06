import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('builds global totals and category analytics from aggregate results', async () => {
    const prisma = {
      city: { count: jest.fn().mockResolvedValue(2), findMany: jest.fn().mockResolvedValue([{ id: 'city-1', name: 'Future City', country: 'Example', timezone: 'UTC', _count: { places: 4 } }]) },
      place: { count: jest.fn(), groupBy: jest.fn().mockResolvedValue([{ category: 'restaurant', _count: { _all: 3 } }]) },
      user: { count: jest.fn().mockResolvedValue(1) }, review: { count: jest.fn().mockResolvedValue(2) }, placeRating: { count: jest.fn().mockResolvedValue(3) }, savedPlace: { count: jest.fn().mockResolvedValue(4) }, placeImage: { count: jest.fn().mockResolvedValue(5) },
      cityVerseScore: {}, $queryRaw: jest.fn().mockResolvedValue([{ available: 4, average: 12.5, median: 12, bucket0: 0, bucket5: 1, bucket10: 2, bucket15: 1 }]),
    } as any;
    prisma.place.count.mockResolvedValue(4);
    const result = await new DashboardService(prisma).overview();
    expect(result.totals).toEqual({ cities: 2, places: 4, users: 1, reviews: 2, ratings: 3, savedPlaces: 4, images: 5 });
    expect(result.categories).toEqual([{ category: 'restaurant', count: 3 }]);
    expect(result.scoreStats.average).toBe(12.5);
  });

  it('rejects an unknown city without querying analytics data', async () => {
    const prisma = { city: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
    await expect(new DashboardService(prisma).city('missing')).rejects.toThrow('City not found');
  });
});
