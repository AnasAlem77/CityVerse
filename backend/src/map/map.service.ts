import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MapBoundsDto } from './dto/map-bounds.dto';

@Injectable()
export class MapService {
  constructor(private readonly prisma: PrismaService) {}

  async getCityPlaces(cityId: string, bounds: MapBoundsDto) {
    if (bounds.south > bounds.north) throw new BadRequestException('south must be less than north');
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { id: true, name: true, latitude: true, longitude: true } });
    if (!city) throw new NotFoundException('City not found');
    const where: Prisma.PlaceWhereInput = {
      cityId,
      latitude: { gte: bounds.south, lte: bounds.north },
      ...(bounds.west <= bounds.east
        ? { longitude: { gte: bounds.west, lte: bounds.east } }
        : { OR: [{ longitude: { gte: bounds.west } }, { longitude: { lte: bounds.east } }] }),
    };
    if (bounds.category?.trim()) where.category = bounds.category.trim();
    const places = await this.prisma.place.findMany({
      where,
      take: Math.min(bounds.limit ?? 300, 500),
      orderBy: { id: 'asc' },
      select: { id: true, name: true, category: true, subtype: true, latitude: true, longitude: true },
    });
    return { city, data: places, limit: bounds.limit ?? 300, truncated: places.length >= (bounds.limit ?? 300) };
  }
}
