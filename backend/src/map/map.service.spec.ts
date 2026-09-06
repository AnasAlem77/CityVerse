import { BadRequestException } from '@nestjs/common';
import { MapService } from './map.service';

describe('MapService', () => {
  it('rejects inverted latitude bounds before querying places', async () => {
    const prisma = { city: { findUnique: jest.fn() } } as any;
    const service = new MapService(prisma);
    await expect(service.getCityPlaces('city', { north: 1, south: 2, east: 3, west: 2, limit: 10 })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.city.findUnique).not.toHaveBeenCalled();
  });
});
