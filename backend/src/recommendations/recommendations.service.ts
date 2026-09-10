import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { calculateCityVerseScore } from '../places/cityverse-score';
import { PrismaService } from '../prisma/prisma.service';
import { RecommendationMode, RecommendationResponse } from './recommendations.types';

const MAX_CANDIDATES = 100;

type Candidate = {
  id: string;
  name: string;
  category: string;
  subtype: string | null;
  description: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  openingHours: string | null;
  cuisine: string | null;
  wheelchair: string | null;
  internetAccess: string | null;
  osmId: string | null;
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
  cityId: string;
  _count: { reviews: number };
};

@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async recommend(options: { mode: RecommendationMode; cityId?: string; category?: string; subtype?: string; search?: string; latitude?: number; longitude?: number; placeId?: string; limit?: number }): Promise<RecommendationResponse> {
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
    let candidates: Candidate[];
    let sourcePlace: Candidate | null = null;

    if (options.mode === 'similar') {
      if (!options.placeId) throw new BadRequestException('placeId is required');
      sourcePlace = await this.prisma.place.findUnique({ where: { id: options.placeId }, select: this.select() }) as Candidate | null;
      if (!sourcePlace) throw new NotFoundException('Place not found');
      const similarityFilters: Prisma.PlaceWhereInput[] = [{ category: sourcePlace.category }];
      if (sourcePlace.subtype) similarityFilters.push({ subtype: sourcePlace.subtype });
      candidates = await this.prisma.place.findMany({
        where: { id: { not: sourcePlace.id }, cityId: sourcePlace.cityId, OR: similarityFilters },
        take: MAX_CANDIDATES,
        select: this.select(),
      }) as Candidate[];
    } else {
      const where: Prisma.PlaceWhereInput = {};
      if (options.cityId) where.cityId = options.cityId;
      if (options.category) where.category = options.category;
      if (options.subtype) where.subtype = options.subtype;
      if (options.search?.trim()) where.name = { contains: options.search.trim(), mode: 'insensitive' };
      if (options.mode === 'nearby') {
        if (options.latitude === undefined || options.longitude === undefined) throw new BadRequestException('latitude and longitude are required');
        const radius = 0.35;
        where.latitude = { gte: options.latitude - radius, lte: options.latitude + radius };
        where.longitude = { gte: options.longitude - radius, lte: options.longitude + radius };
      }
      candidates = await this.prisma.place.findMany({ where, take: MAX_CANDIDATES, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: this.select() }) as Candidate[];
    }

    const ranked = candidates.map((place) => {
      const score = calculateCityVerseScore(place);
      const ratingSignal = place._count.reviews > 0 ? Math.min(place._count.reviews, 20) * 0.15 : 0;
      const distancePenalty = options.latitude === undefined || options.longitude === undefined ? 0 : this.distance(options.latitude, options.longitude, Number(place.latitude), Number(place.longitude)) * 0.02;
      const similarity = sourcePlace ? (place.category === sourcePlace.category ? 8 : 0) + (place.subtype && place.subtype === sourcePlace.subtype ? 8 : 0) : 0;
      return { place, rawScore: score + ratingSignal + similarity - distancePenalty };
    });
    ranked.sort((a, b) => b.rawScore - a.rawScore || a.place.name.localeCompare(b.place.name) || a.place.id.localeCompare(b.place.id));

    const selected: Array<{ place: Candidate; rawScore: number; adjustedScore: number }> = [];
    const categoryCount = new Map<string, number>();
    const subtypeCount = new Map<string, number>();
    for (const item of ranked) {
      const categoryPenalty = (categoryCount.get(item.place.category) ?? 0) * 1.5;
      const subtypeKey = item.place.subtype ?? '';
      const subtypePenalty = (subtypeCount.get(subtypeKey) ?? 0) * 0.75;
      const adjusted = { ...item, adjustedScore: item.rawScore - categoryPenalty - subtypePenalty };
      selected.push(adjusted);
      categoryCount.set(item.place.category, (categoryCount.get(item.place.category) ?? 0) + 1);
      subtypeCount.set(subtypeKey, (subtypeCount.get(subtypeKey) ?? 0) + 1);
      if (selected.length >= limit) break;
    }
    selected.sort((a, b) => b.adjustedScore - a.adjustedScore || a.place.id.localeCompare(b.place.id));
    return {
      mode: options.mode,
      personalized: false,
      message: selected.length ? 'Recommendations are ranked from available CityVerse data.' : 'No recommendations are available for these filters.',
      recommendations: selected.map((item, index) => ({ placeId: item.place.id, rank: index + 1, score: Number(item.adjustedScore.toFixed(2)), reason: 'Ranked using deterministic CityVerse signals and diversity balancing.' })),
    };
  }

  private select() {
    return { id: true, name: true, category: true, subtype: true, description: true, address: true, website: true, phone: true, openingHours: true, cuisine: true, wheelchair: true, internetAccess: true, osmId: true, latitude: true, longitude: true, cityId: true, _count: { select: { reviews: true } } } as const;
  }

  private distance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const radians = (value: number) => value * Math.PI / 180;
    const dLat = radians(lat2 - lat1); const dLon = radians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
