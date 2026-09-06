import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RatePlaceDto } from './dto/rate-place.dto';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async rate(userId: string, data: RatePlaceDto) {
    const place = await this.prisma.place.findUnique({
      where: { id: data.placeId },
      select: { id: true },
    });
    if (!place) throw new NotFoundException('Place not found');
    return this.prisma.placeRating.upsert({
      where: { userId_placeId: { userId, placeId: data.placeId } },
      create: { userId, placeId: data.placeId, rating: data.rating },
      update: { rating: data.rating },
    });
  }

  async summary(placeId: string) {
    const aggregate = await this.prisma.placeRating.aggregate({
      where: { placeId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    return {
      average: aggregate._avg.rating
        ? Number(aggregate._avg.rating.toFixed(1))
        : 0,
      count: aggregate._count.rating,
    };
  }
}
