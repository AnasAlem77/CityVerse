import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { calculateCityVerseScore } from '../places/cityverse-score';
import { PrismaService } from '../prisma/prisma.service';

type Metric = { count: number; percentage: number };

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [cities, places, users, reviews, ratings, savedPlaces, images, categories, cityRows] = await Promise.all([
      this.prisma.city.count(), this.prisma.place.count(), this.prisma.user.count(), this.prisma.review.count(), this.prisma.placeRating.count(), this.prisma.savedPlace.count(), this.prisma.placeImage.count(),
      this.prisma.place.groupBy({ by: ['category'], _count: { _all: true }, orderBy: { _count: { category: 'desc' } } }),
      this.prisma.city.findMany({ select: { id: true, name: true, country: true, timezone: true, _count: { select: { places: true } } }, orderBy: { name: 'asc' } }),
    ]);
    const scoreStats = await this.scoreStats();
    return { totals: { cities, places, users, reviews, ratings, savedPlaces, images }, categories: categories.map((item) => ({ category: item.category, count: item._count._all })), cities: cityRows.map((city) => ({ ...city, placeCount: city._count.places, _count: undefined })), scoreStats, userActivity: { users, ratings, reviews, savedPlaces } };
  }

  async city(cityId: string) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { id: true, name: true, country: true, timezone: true, latitude: true, longitude: true } });
    if (!city) throw new NotFoundException('City not found');
    const where: Prisma.PlaceWhereInput = { cityId };
    const [total, categories, subtypes, scoreStats, quality, ratingStats, reviewCount, geographic, topScores, topReviews] = await Promise.all([
      this.prisma.place.count({ where }),
      this.prisma.place.groupBy({ by: ['category'], where, _count: { _all: true }, orderBy: { _count: { category: 'desc' } } }),
      this.prisma.place.groupBy({ by: ['category', 'subtype'], where: { ...where, subtype: { not: null } }, _count: { _all: true }, orderBy: [{ category: 'asc' }, { _count: { subtype: 'desc' } }] }),
      this.scoreStats(undefined, cityId), this.qualityStats(where), this.ratingStats(cityId), this.prisma.review.count({ where: { place: { cityId } } }),
      this.prisma.place.aggregate({ where, _min: { latitude: true, longitude: true }, _max: { latitude: true, longitude: true }, _avg: { latitude: true, longitude: true } }),
      this.prisma.cityVerseScore.findMany({ where: { place: { cityId } }, orderBy: [{ score: 'desc' }, { placeId: 'asc' }], take: 10, select: { placeId: true, score: true, place: { select: { name: true, category: true, subtype: true } } } }),
      this.prisma.placeRating.groupBy({ by: ['placeId'], where: { place: { cityId } }, _avg: { rating: true }, _count: { _all: true }, orderBy: { _avg: { rating: 'desc' } }, take: 10 }),
    ]);
    return { city, totalPlaces: total, categories: categories.map((item) => ({ category: item.category, count: item._count._all, percentage: this.percent(item._count._all, total) })), subtypes: subtypes.map((item) => ({ category: item.category, subtype: item.subtype, count: item._count._all })), scoreStats, quality, ratings: { ...ratingStats, reviewCount }, geography: geographic, topPlaces: { byCityVerseScore: topScores, byUserRating: topReviews }, capabilities: this.capabilities() };
  }

  private async scoreStats(_where?: Prisma.PlaceWhereInput, cityId?: string) {
    const query = cityId
      ? Prisma.sql`SELECT count(*)::int AS available, avg(s.score)::float AS average, percentile_cont(0.5) WITHIN GROUP (ORDER BY s.score)::float AS median, count(*) FILTER (WHERE s.score >= 0 AND s.score < 5)::int AS bucket0, count(*) FILTER (WHERE s.score >= 5 AND s.score < 10)::int AS bucket5, count(*) FILTER (WHERE s.score >= 10 AND s.score < 15)::int AS bucket10, count(*) FILTER (WHERE s.score >= 15)::int AS bucket15 FROM "CityVerseScore" s JOIN "Place" p ON p.id = s."placeId" WHERE p."cityId" = ${cityId}`
      : Prisma.sql`SELECT count(*)::int AS available, avg(score)::float AS average, percentile_cont(0.5) WITHIN GROUP (ORDER BY score)::float AS median, count(*) FILTER (WHERE score >= 0 AND score < 5)::int AS bucket0, count(*) FILTER (WHERE score >= 5 AND score < 10)::int AS bucket5, count(*) FILTER (WHERE score >= 10 AND score < 15)::int AS bucket10, count(*) FILTER (WHERE score >= 15)::int AS bucket15 FROM "CityVerseScore"`;
    const [row] = await this.prisma.$queryRaw<Array<{ available: number; average: number | null; median: number | null; bucket0: number; bucket5: number; bucket10: number; bucket15: number }>>(query);
    return { available: row.available, average: row.average === null ? null : Number(row.average.toFixed(2)), median: row.median === null ? null : Number(row.median.toFixed(2)), distribution: [{ range: '0-5', count: row.bucket0 }, { range: '5-10', count: row.bucket5 }, { range: '10-15', count: row.bucket10 }, { range: '15+', count: row.bucket15 }] };
  }

  private async qualityStats(where: Prisma.PlaceWhereInput): Promise<Record<string, Metric>> {
    const total = await this.prisma.place.count({ where });
    const [address, website, phone, openingHours, subtype, images, scores, coordinates] = await Promise.all([
      this.prisma.place.count({ where: { ...where, address: { not: null } } }), this.prisma.place.count({ where: { ...where, website: { not: null } } }), this.prisma.place.count({ where: { ...where, phone: { not: null } } }), this.prisma.place.count({ where: { ...where, openingHours: { not: null } } }), this.prisma.place.count({ where: { ...where, subtype: { not: null } } }), this.prisma.place.count({ where: { ...where, images: { some: {} } } }), this.prisma.cityVerseScore.count({ where: { place: where } }), this.prisma.place.count({ where }),
    ]);
    return Object.fromEntries(Object.entries({ address, website, phone, openingHours, subtype, images, scores, coordinates }).map(([key, count]) => [key, { count, percentage: this.percent(count as number, total) }]));
  }

  private async ratingStats(cityId?: string) { const where = cityId ? { place: { cityId } } : undefined; const result = await this.prisma.placeRating.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }); return { count: result._count._all, average: result._avg.rating === null ? null : Number(result._avg.rating.toFixed(2)) }; }
  private percent(value: number, total: number) { return total ? Number((value / total * 100).toFixed(2)) : 0; }
  private capabilities() { return { places: true, map: true, recommendations: true, assistant: true, analytics: true, weather: true, routing: true, alerts: 'provider-dependent' }; }
}
