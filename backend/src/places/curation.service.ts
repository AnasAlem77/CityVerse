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

type Candidate = {
  id: string;
  osmId: string | null;
  name: string;
  description: string | null;
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

const CURATION_VERSION = '20260906-v1';
// Balancing may reorder candidates above this floor, but cannot promote a
// minimally tagged record into the curated set.
const MINIMUM_SCORE = 35;
const HARD_CITY_MAX = 8000;
const CATEGORY_USEFULNESS: Record<string, number> = {
  attraction: 1.35,
  hotel: 1.15,
  hospital: 1.05,
  university: 1.05,
  restaurant: 0.95,
  shop: 0.75,
  default: 0.6,
};

function tagsOf(candidate: Candidate) {
  return candidate.rawTags && typeof candidate.rawTags === 'object'
    ? (candidate.rawTags as Record<string, unknown>)
    : {};
}

function decimalToNumber(value: Prisma.Decimal) {
  return Number(value);
}

function cellKey(candidate: Candidate, tileDegrees = 0.05) {
  const latitude = decimalToNumber(candidate.latitude);
  const longitude = decimalToNumber(candidate.longitude);
  return `${Math.floor(latitude / tileDegrees)},${Math.floor(longitude / tileDegrees)}`;
}

function categoryWeight(category: string) {
  return CATEGORY_USEFULNESS[category] ?? CATEGORY_USEFULNESS.default;
}

export function scoreRawCandidate(candidate: Candidate) {
  const tags = tagsOf(candidate);
  const has = (...keys: string[]) => keys.some((key) => Boolean(tags[key]));
  const name = candidate.name.trim();
  const description = candidate.description?.trim() ?? '';
  const qualityScore =
    (name.length >= 3 ? 8 : 0) +
    (name.length >= 8 ? 3 : 0) +
    (description.length >= 16 ? 3 : 0) +
    (Number.isFinite(decimalToNumber(candidate.latitude)) &&
    Number.isFinite(decimalToNumber(candidate.longitude))
      ? 7
      : 0) +
    (Boolean(candidate.category) ? 4 : 0) +
    (Boolean(candidate.subtype) ? 1 : 0) +
    (Boolean(candidate.osmId) ? 5 : 0);
  const importanceScore = Math.min(
    28,
    (has('tourism', 'attraction') ? 7 : 0) +
      (has(
        'historic',
        'landmark',
        'memorial',
        'museum',
        'castle',
        'monument',
        'archaeological_site',
      )
        ? 8
        : 0) +
      (has('wikidata', 'wikipedia') ? 6 : 0) +
      (has('operator', 'official_name', 'brand', 'network') ? 3 : 0) +
      (has('information', 'public_transport') ? 2 : 0) +
      (['hospital', 'university', 'hotel'].includes(candidate.category)
        ? 4
        : 0),
  );
  const completenessScore = Math.min(
    12,
    (candidate.address ? 2 : 0) +
      (candidate.website ? 2 : 0) +
      (candidate.phone ? 2 : 0) +
      (candidate.openingHours ? 2 : 0) +
      (candidate.cuisine ? 2 : 0) +
      (candidate.wheelchair ? 1 : 0) +
      (candidate.internetAccess ? 1 : 0),
  );
  const relevanceScore = Math.min(
    20,
    ((
      {
        attraction: 18,
        hotel: 15,
        hospital: 15,
        university: 15,
        restaurant: 12,
        shop: 9,
      } as Record<string, number>
    )[candidate.category] ?? 5) +
      (candidate.subtype ? 2 : 0) +
      (has('shop') ? 1 : 0),
  );
  const baseScore = Math.min(
    90,
    qualityScore + importanceScore + completenessScore + relevanceScore,
  );
  const tier =
    baseScore >= 75 || importanceScore >= 18
      ? 'TIER_1'
      : baseScore >= 55
        ? 'TIER_2'
        : baseScore >= MINIMUM_SCORE
          ? 'TIER_3'
          : 'TIER_4';
  return {
    qualityScore,
    importanceScore,
    completenessScore,
    relevanceScore,
    baseScore,
    tier,
  };
}

function qualityScore(candidate: Candidate) {
  return [
    candidate.name.trim().length > 0,
    (candidate.description?.trim().length ?? 0) > 0,
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
      select: { id: true, name: true, latitude: true, longitude: true },
    });
    if (!city) throw new NotFoundException('City not found');

    const coverage = getCityCoverage(city.name);
    const tileDegrees = coverage?.tileDegrees ?? 0.05;
    const selectionLimit = HARD_CITY_MAX;
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

    const candidates = await this.prisma.rawPlace.findMany({
      where: {
        cityId,
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

    const assessed = candidates
      .map((candidate) => {
        const score = scoreRawCandidate(candidate);
        const latitude = decimalToNumber(candidate.latitude);
        const longitude = decimalToNumber(candidate.longitude);
        const inCoverage = coverage
          ? latitude >= coverage.south &&
            latitude <= coverage.north &&
            longitude >= coverage.west &&
            longitude <= coverage.east
          : true;
        return {
          candidate,
          score,
          inCoverage,
          cell: cellKey(candidate, tileDegrees),
        };
      })
      .filter((item) => item.inCoverage && item.score.tier !== 'TIER_4')
      .sort(
        (left, right) =>
          right.score.baseScore - left.score.baseScore ||
          left.candidate.id.localeCompare(right.candidate.id),
      );

    const eligible = assessed.filter(
      (item) => item.inCoverage && item.score.tier !== 'TIER_4',
    );
    const totalEligible = eligible.length;
    const subtypeCounts = new Map<string, number>();
    const cellCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const categoryTotals = new Map<string, number>();
    const subtypeTotals = new Map<string, number>();
    const cellTotals = new Map<string, number>();
    for (const item of eligible) {
      categoryTotals.set(
        item.candidate.category,
        (categoryTotals.get(item.candidate.category) ?? 0) + 1,
      );
      const subtype = item.candidate.subtype ?? 'unknown';
      subtypeTotals.set(subtype, (subtypeTotals.get(subtype) ?? 0) + 1);
      cellTotals.set(item.cell, (cellTotals.get(item.cell) ?? 0) + 1);
    }
    const categoryWeightSum = [...categoryTotals.keys()].reduce(
      (sum, category) => sum + categoryWeight(category),
      0,
    );
    eligible.sort((left, right) => {
      const rank = (item: (typeof eligible)[number]) => {
        const categoryShare =
          (categoryTotals.get(item.candidate.category) ?? 0) /
          Math.max(totalEligible, 1);
        const categoryTarget =
          categoryWeight(item.candidate.category) /
          Math.max(categoryWeightSum, 1);
        const subtype = item.candidate.subtype ?? 'unknown';
        const subtypeShare =
          (subtypeTotals.get(subtype) ?? 0) / Math.max(totalEligible, 1);
        const subtypeTarget = subtype === 'unknown' ? 0.35 : 0.2;
        const cellShare =
          (cellTotals.get(item.cell) ?? 0) / Math.max(totalEligible, 1);
        return (
          item.score.baseScore -
          Math.min(4, Math.max(0, categoryShare - categoryTarget) * 12) -
          Math.min(3, Math.max(0, subtypeShare - subtypeTarget) * 10) -
          Math.min(2, cellShare * 4)
        );
      };
      const baseGap = right.score.baseScore - left.score.baseScore;
      if (Math.abs(baseGap) > 4) return baseGap;
      return (
        rank(right) - rank(left) ||
        baseGap ||
        left.candidate.id.localeCompare(right.candidate.id)
      );
    });
    for (const item of eligible.slice(0, selectionLimit)) {
      const subtype = item.candidate.subtype ?? 'unknown';
      const selectedCount = selected.length;
      const categoryShare =
        (categoryCounts.get(item.candidate.category) ?? 0) /
        Math.max(selectedCount, 1);
      // Category usefulness sets a soft preference, not a quota derived
      // from raw OSM volume. This makes overrepresented categories face
      // progressively stronger competition without excluding strong items.
      const targetShare =
        categoryWeight(item.candidate.category) /
        Math.max(
          [...categoryTotals.keys()].reduce(
            (sum, category) => sum + categoryWeight(category),
            0,
          ),
          1,
        );
      const categoryPenalty = Math.min(
        8,
        Math.max(0, categoryShare - targetShare) * 18,
      );
      const subtypeCount = subtypeCounts.get(subtype) ?? 0;
      const subtypeShare = subtypeCount / Math.max(selectedCount, 1);
      const subtypeTarget = subtype === 'unknown' ? 0.35 : 0.2;
      const subtypePenalty = Math.min(
        8,
        Math.max(0, subtypeShare - subtypeTarget) * 16 +
          (subtype === 'unknown'
            ? subtypeCount * 0.05
            : Math.max(0, subtypeCount - 2) * 0.35),
      );
      const cellCount = cellCounts.get(item.cell) ?? 0;
      const geographicScore = Math.min(
        4,
        cellCount === 0 ? 4 : 1 / (cellCount + 1),
      );
      const diversityScore = Math.min(
        4,
        subtypeCount === 0 ? 4 : 1 / (subtypeCount + 1),
      );
      const totalScore = Math.min(
        100,
        item.score.baseScore + geographicScore + diversityScore,
      );
      if (item.score.tier === 'TIER_4') continue;
      selected.push({
        rawPlaceId: item.candidate.id,
        cityId,
        qualityScore: item.score.qualityScore,
        importanceScore: item.score.importanceScore,
        completenessScore: item.score.completenessScore,
        geographicScore,
        diversityScore,
        totalScore: Math.round(totalScore * 100) / 100,
        tier: item.score.tier,
        curationVersion: CURATION_VERSION,
        selectionReason: `ranked:${item.candidate.category}:base+bounded-coverage+diminishing-diversity`,
      });
      subtypeCounts.set(subtype, (subtypeCounts.get(subtype) ?? 0) + 1);
      cellCounts.set(item.cell, (cellCounts.get(item.cell) ?? 0) + 1);
      categoryCounts.set(
        item.candidate.category,
        (categoryCounts.get(item.candidate.category) ?? 0) + 1,
      );
    }

    await this.prisma.$transaction(
      async (transaction) => {
        await transaction.curatedPlace.deleteMany({ where: { cityId } });
        await transaction.curatedPlace.createMany({ data: selected });
      },
      { timeout: 120_000 },
    );

    return {
      city,
      selected: selected.length,
      eligible: totalEligible,
      maxSelected: selectionLimit,
    };
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
        orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
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
