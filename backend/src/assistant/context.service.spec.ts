import { AssistantContextService } from './context.service';

describe('AssistantContextService', () => {
  it('returns a place with a null description without failing score calculation', async () => {
    const prisma = {
      place: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'place-1', name: 'Verified Place', description: null, category: 'restaurant', subtype: null,
          address: null, latitude: 1, longitude: 2, cityId: 'city-1', osmId: 'node/1', website: null,
          phone: null, openingHours: null, cuisine: null, wheelchair: null, internetAccess: null,
          _count: { reviews: 0 },
        }]),
      },
    } as any;
    const service = new AssistantContextService(prisma);
    await expect(service.places({ cityId: 'city-1' })).resolves.toEqual([
      expect.objectContaining({ placeId: 'place-1', description: null }),
    ]);
  });
});
