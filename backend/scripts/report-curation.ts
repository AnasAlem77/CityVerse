import 'dotenv/config';
import { Prisma } from '../generated/prisma/client';
import { scoreRawCandidate } from '../src/places/curation.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { getCityCoverage } from '../src/osm/city-coverage';

const CITY_NAMES = ['Jakarta', 'Bali', 'Paris', 'Dubai', 'Tokyo'];
const MINIMUM_SCORE = 35;
const HARD_CITY_MAX = 8000;
const PRODUCTION_PLACE_COUNTS: Record<string, number> = {
  Bali: 1391,
  Dubai: 1654,
  Jakarta: 1935,
  Paris: 12334,
  Tokyo: 867,
};
const RAW_PLACE_COUNTS: Record<string, number> = {
  Bali: 14306,
  Dubai: 22525,
  Jakarta: 9965,
  Paris: 58714,
  Tokyo: 80344,
};

function number(value: Prisma.Decimal | number) {
  return Number(value);
}
function cell(latitude: number, longitude: number, tileDegrees: number) {
  return `${Math.floor(latitude / tileDegrees)},${Math.floor(longitude / tileDegrees)}`;
}
function counts(values: string[]) {
  return values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
}
function percentile(values: number[], percent: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percent;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return lower === upper
    ? sorted[lower]
    : sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}
function scoreBands(values: number[]) {
  return {
    '90-100': values.filter((score) => score >= 90).length,
    '75-89': values.filter((score) => score >= 75 && score < 90).length,
    '60-74': values.filter((score) => score >= 60 && score < 75).length,
    '35-54': values.filter((score) => score >= 35 && score < 55).length,
    '<35': values.filter((score) => score < 35).length,
  };
}
function isInvalid(item: {
  name: string;
  category: string;
  osmId: string | null;
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
}) {
  return (
    !item.name.trim() ||
    !item.category.trim() ||
    !item.osmId ||
    !Number.isFinite(number(item.latitude)) ||
    !Number.isFinite(number(item.longitude))
  );
}

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const cities = await prisma.city.findMany({
    where: { name: { in: CITY_NAMES } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  for (const city of cities) {
    const coverage = getCityCoverage(city.name);
    const tileDegrees = coverage?.tileDegrees ?? 0.05;
    const [raw, curated, productionCount] = await Promise.all([
      prisma.rawPlace.findMany({ where: { cityId: city.id } }),
      prisma.curatedPlace.findMany({
        where: { cityId: city.id },
        include: { rawPlace: true },
      }),
      prisma.place.count({ where: { cityId: city.id } }),
    ]);
    const selectedIds = new Set(curated.map((item) => item.rawPlaceId));
    const curatedByRaw = new Map(
      curated.map((item) => [item.rawPlaceId, item]),
    );
    const assessed = raw.map((item) => {
      const latitude = number(item.latitude);
      const longitude = number(item.longitude);
      const outside = coverage
        ? latitude < coverage.south ||
          latitude > coverage.north ||
          longitude < coverage.west ||
          longitude > coverage.east
        : false;
      const noise = item.subtype === 'vacant' || item.subtype === 'yes';
      const invalid = isInvalid(item);
      const score = scoreRawCandidate(item);
      return {
        item,
        score,
        cell: cell(latitude, longitude, tileDegrees),
        outside,
        noise,
        invalid,
        selected: selectedIds.has(item.id),
        curated: curatedByRaw.get(item.id),
      };
    });
    const eligible = assessed.filter(
      (entry) =>
        !entry.noise &&
        !entry.invalid &&
        !entry.outside &&
        entry.score.tier !== 'TIER_4',
    );
    const validCandidates = assessed.filter(
      (entry) => !entry.noise && !entry.invalid,
    );
    const selected = assessed.filter((entry) => entry.selected);
    const selectedCategoryCounts = counts(
      selected.map((entry) => entry.item.category),
    );
    const selectedSubtypeCounts = counts(
      selected.map((entry) => entry.item.subtype ?? 'unknown'),
    );
    const selectedCellCounts = counts(selected.map((entry) => entry.cell));
    const eligibleCategoryCounts = counts(
      eligible.map((entry) => entry.item.category),
    );
    const eligibleSubtypeCounts = counts(
      eligible.map((entry) => entry.item.subtype ?? 'unknown'),
    );
    const selectedScores = selected.map(
      (entry) => entry.curated?.totalScore ?? entry.score.baseScore,
    );
    const eligibleScores = eligible.map((entry) => entry.score.baseScore);
    const validScores = validCandidates.map((entry) => entry.score.baseScore);
    const medianSelected = percentile(selectedScores, 0.5);
    const categoryShare = Object.values(selectedCategoryCounts).length
      ? Math.max(...Object.values(selectedCategoryCounts)) /
        Math.max(selected.length, 1)
      : 0;
    const subtypeShare = Object.values(selectedSubtypeCounts).length
      ? Math.max(...Object.values(selectedSubtypeCounts)) /
        Math.max(selected.length, 1)
      : 0;
    const selectedLatitudes = selected.map((entry) =>
      number(entry.item.latitude),
    );
    const selectedLongitudes = selected.map((entry) =>
      number(entry.item.longitude),
    );
    const duplicateOsmIds = Object.values(
      counts(selected.map((entry) => entry.item.osmId ?? 'missing')),
    ).filter((count) => count > 1).length;
    const duplicateRawPlaceIds = selected.length - selectedIds.size;
    const reasonedNonSelected = eligible
      .filter((entry) => !entry.selected)
      .map((entry) => {
        const subtype = entry.item.subtype ?? 'unknown';
        const categoryCount = selectedCategoryCounts[entry.item.category] ?? 0;
        const subtypeCount = selectedSubtypeCounts[subtype] ?? 0;
        const cellCount = selectedCellCounts[entry.cell] ?? 0;
        let reason = 'competition';
        if (selected.length >= HARD_CITY_MAX) reason = 'hard-cap';
        else if (cellCount >= 3 && entry.score.baseScore >= medianSelected - 8)
          reason = 'geographic-pressure';
        else if (
          subtype !== 'unknown' &&
          subtypeCount >= Math.max(3, Math.ceil(selected.length * 0.2)) &&
          entry.score.baseScore >= medianSelected - 8
        )
          reason = 'subtype-pressure';
        else if (
          categoryCount / Math.max(selected.length, 1) > 0.35 &&
          entry.score.baseScore >= medianSelected - 8
        )
          reason = 'category-pressure';
        return { entry, reason };
      });
    const reasonCounts = counts(
      reasonedNonSelected.map((entry) => entry.reason),
    );
    const allNonSelected = assessed
      .filter((entry) => !entry.selected)
      .map((entry) => {
        let reason = 'score-rejected';
        if (entry.noise) reason = 'noise-rejected';
        else if (entry.invalid) reason = 'invalid-rejected';
        else if (entry.outside) reason = 'boundary-rejected';
        else if (entry.score.tier !== 'TIER_4')
          reason =
            reasonedNonSelected.find(
              (candidate) => candidate.entry.item.id === entry.item.id,
            )?.reason ?? 'competition';
        return { entry, reason };
      });
    const bottomSelected = [...selected]
      .sort(
        (a, b) =>
          (a.curated?.totalScore ?? a.score.baseScore) -
            (b.curated?.totalScore ?? b.score.baseScore) ||
          a.item.id.localeCompare(b.item.id),
      )
      .slice(0, 100)
      .map((entry) => ({
        id: entry.item.id,
        name: entry.item.name,
        category: entry.item.category,
        subtype: entry.item.subtype ?? 'unknown',
        score: entry.curated?.totalScore ?? entry.score.baseScore,
        reason: entry.curated?.selectionReason,
      }));
    const topNonSelected = allNonSelected
      .sort(
        (a, b) =>
          b.entry.score.baseScore - a.entry.score.baseScore ||
          a.entry.item.id.localeCompare(b.entry.item.id),
      )
      .slice(0, 100)
      .map(({ entry, reason }) => ({
        id: entry.item.id,
        name: entry.item.name,
        category: entry.item.category,
        subtype: entry.item.subtype ?? 'unknown',
        score: entry.score.baseScore,
        reason,
      }));
    const funnel = {
      raw: raw.length,
      noiseRejected: assessed.filter((entry) => entry.noise).length,
      invalidRejected: assessed.filter((entry) => !entry.noise && entry.invalid)
        .length,
      boundaryRejected: assessed.filter(
        (entry) => !entry.noise && !entry.invalid && entry.outside,
      ).length,
      scoreRejected: assessed.filter(
        (entry) =>
          !entry.noise &&
          !entry.invalid &&
          !entry.outside &&
          entry.score.tier === 'TIER_4',
      ).length,
      eligible: eligible.length,
      categoryCompetition: reasonCounts['category-pressure'] ?? 0,
      subtypeCompetition: reasonCounts['subtype-pressure'] ?? 0,
      geographicCompetition: reasonCounts['geographic-pressure'] ?? 0,
      hardCap: reasonCounts['hard-cap'] ?? 0,
      selected: selected.length,
    };
    console.log(
      JSON.stringify({
        city: city.name,
        raw: raw.length,
        eligible: eligible.length,
        selected: selected.length,
        avgScore: Number(
          (
            selectedScores.reduce((sum, score) => sum + score, 0) /
            Math.max(selectedScores.length, 1)
          ).toFixed(2),
        ),
        percentiles: {
          p10: Number(percentile(selectedScores, 0.1).toFixed(2)),
          p25: Number(percentile(selectedScores, 0.25).toFixed(2)),
          p50: Number(percentile(selectedScores, 0.5).toFixed(2)),
          p75: Number(percentile(selectedScores, 0.75).toFixed(2)),
          p90: Number(percentile(selectedScores, 0.9).toFixed(2)),
          p95: Number(percentile(selectedScores, 0.95).toFixed(2)),
          p99: Number(percentile(selectedScores, 0.99).toFixed(2)),
        },
        strongCore: selectedScores.filter((score) => score >= 75).length,
        weakTail: selectedScores.filter((score) => score < 55).length,
        categoryConcentration: Number((categoryShare * 100).toFixed(2)),
        unknownSubtype: selectedSubtypeCounts.unknown ?? 0,
        unknownSubtypeShare: Number(
          (
            ((selectedSubtypeCounts.unknown ?? 0) /
              Math.max(selected.length, 1)) *
            100
          ).toFixed(2),
        ),
        cells: new Set(selected.map((entry) => entry.cell)).size,
        rawCells: new Set(eligible.map((entry) => entry.cell)).size,
        geographicConcentration: Number(
          (
            (Math.max(...Object.values(selectedCellCounts)) /
              Math.max(selected.length, 1)) *
            100
          ).toFixed(2),
        ),
        subtypeConcentration: Number((subtypeShare * 100).toFixed(2)),
        geographicCoverage: {
          minLatitude: Math.min(...selectedLatitudes),
          maxLatitude: Math.max(...selectedLatitudes),
          minLongitude: Math.min(...selectedLongitudes),
          maxLongitude: Math.max(...selectedLongitudes),
        },
        scoreDistribution: {
          allValidRaw: scoreBands(validScores),
          eligible: scoreBands(eligibleScores),
          selected: scoreBands(selectedScores),
        },
        tiers: {
          selected: counts(
            selected.map((entry) => entry.curated?.tier ?? entry.score.tier),
          ),
          eligible: counts(eligible.map((entry) => entry.score.tier)),
          tier4Rejected: assessed.filter(
            (entry) => entry.score.tier === 'TIER_4',
          ).length,
        },
        categoryShare: selectedCategoryCounts,
        subtypeShare: selectedSubtypeCounts,
        eligibleCategoryCounts,
        eligibleSubtypeCounts,
        funnel,
        dominantReason:
          Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
          'none',
        bottom100Selected: bottomSelected,
        top100NonSelected: topNonSelected,
        integrity: {
          curatedRows: curated.length,
          distinctRawPlaces: selectedIds.size,
          duplicateOsmIds,
          duplicateRawPlaceIds,
          blankNames: selected.filter((entry) => !entry.item.name.trim())
            .length,
          invalidCoordinates: selected.filter((entry) => entry.invalid).length,
          zeroCoordinates: selected.filter(
            (entry) =>
              number(entry.item.latitude) === 0 ||
              number(entry.item.longitude) === 0,
          ).length,
          orphanCuratedPlaces: curated.filter(
            (entry) => !entry.rawPlace || entry.rawPlace.cityId !== city.id,
          ).length,
          cityMismatch: curated.filter(
            (entry) => entry.rawPlace.cityId !== entry.cityId,
          ).length,
          outsideBoundary: selected.filter((entry) => entry.outside).length,
          noiseRecords: selected.filter((entry) => entry.noise).length,
          rawPlaceRowsUnchanged: raw.length === RAW_PLACE_COUNTS[city.name],
          productionPlaceRowsReadOnly: productionCount,
          productionPlaceRowsUnchanged:
            productionCount === PRODUCTION_PLACE_COUNTS[city.name],
        },
      }),
    );
  }
  await prisma.$disconnect();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
