import { RecommendationsService } from './recommendations.service';

describe('RecommendationsService', () => {
  it('ranks real candidates deterministically and excludes the source place', async () => {
    const candidate = (id: string, name: string, category = 'restaurant') => ({ id, name, category, subtype: null, description: 'A verified CityVerse place description.', address: null, website: null, phone: null, openingHours: null, cuisine: null, wheelchair: null, internetAccess: null, osmId: id, latitude: 48.85, longitude: 2.35, cityId: 'city-1', _count: { reviews: 3 } });
    const prisma = { place: { findUnique: jest.fn().mockResolvedValue(candidate('source', 'Source')), findMany: jest.fn().mockResolvedValue([candidate('a', 'Alpha'), candidate('b', 'Beta', 'hotel')]) } } as any;
    const service = new RecommendationsService(prisma);
    const first = await service.recommend({ mode: 'similar', placeId: 'source', limit: 2 });
    const second = await service.recommend({ mode: 'similar', placeId: 'source', limit: 2 });
    expect(first).toEqual(second);
    expect(first.recommendations.map((item) => item.placeId)).toEqual(['a', 'b']);
    expect(first.recommendations).not.toContainEqual(expect.objectContaining({ placeId: 'source' }));
    expect(prisma.place.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });
});
