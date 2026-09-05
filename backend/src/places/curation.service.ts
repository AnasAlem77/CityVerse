import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getCityCoverage } from '../osm/city-coverage';

export const DEFAULT_CURATED_QUOTAS = {
  restaurant: 30,
  shop: 30,
  hotel: 15,
  attraction: 15,
  hospital: 5,
  university: 5,
} as const;

export const CITY_CURATED_QUOTAS: Record<string, Record<string, number>> = {
  Jakarta: { restaurant: 250, shop: 350, hotel: 120, attraction: 80, hospital: 40, university: 60 },
  Bali: { restaurant: 250, shop: 250, hotel: 180, attraction: 120, hospital: 30, university: 30 },
  Paris: { restaurant: 350, shop: 500, hotel: 180, attraction: 150, hospital: 40, university: 60 },
  Dubai: { restaurant: 300, shop: 400, hotel: 180, attraction: 100, hospital: 50, university: 50 },
  Tokyo: { restaurant: 350, shop: 500, hotel: 180, attraction: 150, hospital: 80, university: 80 },
};

type Candidate = {
  id: string;
  osmId: string | null;
  name: string;
  description: string;
  category: string;
  subtype: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  openingHours: string | null;
  cuisine?: string | null;
  wheelchair?: string | null;
  internetAccess?: string | null;
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
  cityId: string;
  rawTags?: unknown;
};

const CURATION_VERSION = '20260905-v3';
const MINIMUM_SCORE = 35;

function tagsOf(candidate: Candidate) {
  return candidate.rawTags && typeof candidate.rawTags === 'object'
    ? candidate.rawTags as Record<string, unknown>
    : {};
}

function scoreCandidate(candidate: Candidate) {
  const tags = tagsOf(candidate);
  const has = (...keys: string[]) => keys.some((key) => Boolean(tags[key]));
  const qualityScore = [
    candidate.name.trim().length >= 3,
    Number.isFinite(Number(candidate.latitude)) && Number.isFinite(Number(candidate.longitude)),
    Boolean(candidate.category),
    Boolean(candidate.subtype),
    Boolean(candidate.address),
    Boolean(candidate.website),
    Boolean(candidate.phone),
    Boolean(candidate.openingHours),
  ].filter(Boolean).length * 3;
  const importanceScore = Math.min(25, (
    (has('tourism') ? 6 : 0) +
    (has('historic', 'landmark', 'memorial') ? 7 : 0) +
    (has('wikidata', 'wikipedia') ? 5 : 0) +
    (['hospital', 'university', 'hotel'].includes(candidate.category) ? 5 : 0) +
    (has('building', 'operator') ? 2 : 0)
  ));
  const completenessScore = Math.min(20, (
    (candidate.address ? 5 : 0) +
    (candidate.website ? 4 : 0) +
    (candidate.phone ? 3 : 0) +
    (candidate.openingHours ? 3 : 0) +
    (candidate.cuisine ? 3 : 0) +
    (candidate.wheelchair ? 1 : 0) +
    (candidate.internetAccess ? 1 : 0)
  ));
  const relevanceScore = Math.min(15, (
    ({ attraction: 15, hotel: 12, hospital: 12, university: 12, restaurant: 10, shop: 7 } as Record<string, number>)[candidate.category] ?? 4
  ) + (candidate.subtype ? 2 : 0));
  const baseScore = Math.min(80, qualityScore + importanceScore + completenessScore + relevanceScore);
  const tier = baseScore >= 65 || importanceScore >= 18
    ? 'TIER_1'
    : baseScore >= 50
      ? 'TIER_2'
      : baseScore >= MINIMUM_SCORE
        ? 'TIER_3'
        : 'TIER_4';
  return { qualityScore, importanceScore, completenessScore, relevanceScore, baseScore, tier };
}

function cellKey(candidate: Candidate) {
  const latitude = Number(candidate.latitude);
  const longitude = Number(candidate.longitude);

  return `${Math.floor(latitude / 0.02)},${Math.floor(longitude / 0.02)}`;
}

function qualityScore(candidate: Candidate) {
  return [
    candidate.name.trim().length > 0,
    candidate.description.trim().length > 0,
    Boolean(candidate.address),
    Boolean(candidate.website),
    Boolean(candidate.phone),
    Boolean(candidate.openingHours),
    Boolean(candidate.subtype),
    Boolean(candidate.osmId),
  ].filter(Boolean).length;
}

@Injectable()
export class CurationService {
  constructor(private readonly prisma: PrismaService) {}

  async curateRawCity(cityId: string) {
    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      select: { id: true, name: true },
    });
    if (!city) throw new NotFoundException('City not found');

    const quotas = CITY_CURATED_QUOTAS[city.name] ?? DEFAULT_CURATED_QUOTAS;
    const coverage = getCityCoverage(city.name);
    const selected: Array<{
      rawPlaceId: string;
      cityId: string;
      qualityScore: number;
      importanceScore: number;
      completenessScore: number;
      geographicScore: number;
      diversityScore: number;
      totalScore: number;
      tier: string;
      curationVersion: string;
      selectionReason: string;
    }> = [];

    for (const [category, quota] of Object.entries(quotas)) {
      const candidates = await this.prisma.rawPlace.findMany({
        where: {
          cityId,
          category,
          name: { not: '' },
          OR: [
            { subtype: null },
            { NOT: [{ subtype: 'vacant' }, { subtype: 'yes' }] },
          ],
        },
        select: {
          id: true,
          osmId: true,
          name: true,
          description: true,
          category: true,
          subtype: true,
          address: true,
          website: true,
          phone: true,
          openingHours: true,
          cuisine: true,
          wheelchair: true,
          internetAccess: true,
          latitude: true,
          longitude: true,
          cityId: true,
          rawTags: true,
        },
      });
      const eligible = candidates
        .map((candidate) => ({ candidate, score: scoreCandidate(candidate) }))
        .filter((item) => {
          const latitude = Number(item.candidate.latitude);
          const longitude = Number(item.candidate.longitude);
          const inCoverage = coverage
            ? latitude >= coverage.south && latitude <= coverage.north && longitude >= coverage.west && longitude <= coverage.east
            : true;
          return item.score.tier !== 'TIER_4' && inCoverage;
        })
        .sort((left, right) => right.score.baseScore - left.score.baseScore || left.candidate.id.localeCompare(right.candidate.id));
      const target = Math.min(quota, eligible.length);
      const subtypeCap = Math.max(3, Math.ceil(Math.max(target, 1) * 0.3));
      const subtypeCounts = new Map<string, number>();
      const cells = new Map<string, number>();
      const chosenIds = new Set<string>();
      let categorySelected = 0;
      const cellLeaders = new Map<string, (typeof eligible)[number]>();

      for (const item of eligible) {
        const cell = `${Math.floor(Number(item.candidate.latitude) / 0.05)},${Math.floor(Number(item.candidate.longitude) / 0.05)}`;
        if (!cellLeaders.has(cell)) cellLeaders.set(cell, item);
      }

      const choose = (item: (typeof eligible)[number], geographicScore: number) => {
        if (chosenIds.has(item.candidate.id) || categorySelected >= target) return;
        const subtype = item.candidate.subtype ?? 'unknown';
        if (subtype !== 'unknown' && (subtypeCounts.get(subtype) ?? 0) >= subtypeCap) return;
        const cell = `${Math.floor(Number(item.candidate.latitude) / 0.05)},${Math.floor(Number(item.candidate.longitude) / 0.05)}`;
        const diversityScore = subtype === 'unknown' ? 3 : (subtypeCounts.has(subtype) ? 5 : 10);
        const totalScore = Math.min(100, item.score.baseScore + geographicScore + diversityScore);
        chosenIds.add(item.candidate.id);
        categorySelected++;
        subtypeCounts.set(subtype, (subtypeCounts.get(subtype) ?? 0) + 1);
        cells.set(cell, (cells.get(cell) ?? 0) + 1);
        selected.push({
          rawPlaceId: item.candidate.id,
          cityId,
          qualityScore: item.score.qualityScore,
          importanceScore: item.score.importanceScore,
          completenessScore: item.score.completenessScore,
          geographicScore,
          diversityScore,
          totalScore,
          tier: item.score.tier,
          curationVersion: CURATION_VERSION,
          selectionReason: `${category}:quality-importance-geography-subtype`,
        });
      };

      [...cellLeaders.values()]
        .sort((left, right) => right.score.baseScore - left.score.baseScore)
        .forEach((item) => choose(item, 10));
      eligible.forEach((item) => choose(item, 4));
    }

    await this.prisma.$transaction(
      async (transaction) => {
        await transaction.curatedPlace.deleteMany({ where: { cityId } });
        await transaction.curatedPlace.createMany({ data: selected });
      },
      { timeout: 120_000 },
    );

    return { city, quotas, selected: selected.length };
  }

  async preview(cityValue: string, requestedLimit = 100) {
    const city = await this.prisma.city.findFirst({
      where: {
        OR: [
          { id: cityValue },
          { name: { equals: cityValue, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
    });

    if (!city) {
      throw new NotFoundException('City not found');
    }

    const limit = Math.min(Math.max(Math.floor(requestedLimit), 1), 500);
    const entries = Object.entries(DEFAULT_CURATED_QUOTAS);
    const quotaParts = entries.map(([category, weight]) => {
      const exact = (weight / 100) * limit;
      return {
        category,
        base: Math.floor(exact),
        remainder: exact - Math.floor(exact),
      };
    });
    let remainingQuota =
      limit - quotaParts.reduce((sum, item) => sum + item.base, 0);

    quotaParts
      .sort((left, right) => right.remainder - left.remainder)
      .forEach((item) => {
        if (remainingQuota > 0) {
          item.base += 1;
          remainingQuota -= 1;
        }
      });

    const quotas = Object.fromEntries(
      quotaParts.map((item) => [item.category, item.base]),
    );

    const selected: Candidate[] = [];

    for (const [category, quota] of Object.entries(quotas)) {
      const candidates = await this.prisma.place.findMany({
        where: {
          cityId: city.id,
          category,
          name: { not: '' },
        },
        orderBy: [
          { updatedAt: 'desc' },
          { name: 'asc' },
        ],
        take: Math.min(500, Math.max(quota * 8, 50)),
        select: {
          id: true,
          osmId: true,
          name: true,
          description: true,
          category: true,
          subtype: true,
          address: true,
          website: true,
          phone: true,
          openingHours: true,
          latitude: true,
          longitude: true,
          cityId: true,
        },
      });

      const cellCounts = new Map<string, number>();
      const remaining = [...candidates].sort(
        (left, right) => qualityScore(right) - qualityScore(left),
      );

      while (
        remaining.length > 0 &&
        selected.filter((item) => item.category === category).length < quota
      ) {
        remaining.sort((left, right) => {
          const cellDifference =
            (cellCounts.get(cellKey(left)) ?? 0) -
            (cellCounts.get(cellKey(right)) ?? 0);

          return cellDifference || qualityScore(right) - qualityScore(left);
        });

        const candidate = remaining.shift();
        if (!candidate) break;

        selected.push(candidate);
        const key = cellKey(candidate);
        cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
      }
    }

    return {
      city,
      limit,
      quotas,
      selectedCount: selected.length,
      geographicCells: new Set(selected.map(cellKey)).size,
      data: selected.slice(0, limit),
    };
  }
}
