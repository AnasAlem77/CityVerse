import { Test, TestingModule } from '@nestjs/testing';
import { PlacesService } from './places.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PlacesService', () => {
  let service: PlacesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlacesService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<PlacesService>(PlacesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('searches a place with a null description without throwing', async () => {
    const place = {
      id: 'place-1', osmId: 'node/1', name: 'Coffee House', description: null,
      category: 'restaurant', subtype: null, address: null, latitude: 1, longitude: 2,
      cityId: 'city-1', createdAt: new Date(), updatedAt: new Date(),
      city: { id: 'city-1', name: 'Jakarta', country: 'Indonesia' }, _count: { reviews: 0 },
    };
    const prisma = {
      place: { count: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([1, [place]]),
    } as any;
    const nullableService = new PlacesService(prisma);
    await expect(nullableService.getPlaces({ search: 'coffee' })).resolves.toMatchObject({
      total: 1,
      data: [expect.objectContaining({ id: 'place-1', description: null })],
    });
  });
});
