import { PrismaService } from '../src/prisma/prisma.service';
import { getCityCoverage } from '../src/osm/city-coverage';

const previousCurated: Record<string, number> = {
  Bali: 860,
  Dubai: 1040,
  Jakarta: 851,
  Paris: 1280,
  Tokyo: 1340,
};

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const cities = await prisma.city.findMany({
    where: { name: { in: Object.keys(previousCurated) } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  for (const city of cities) {
    const [raw, curated] = await Promise.all([
      prisma.rawPlace.findMany({
        where: { cityId: city.id },
        select: { id: true, category: true, subtype: true, name: true, latitude: true, longitude: true },
      }),
      prisma.curatedPlace.findMany({
        where: { cityId: city.id },
        select: { totalScore: true, tier: true, rawPlace: { select: { category: true, subtype: true, latitude: true, longitude: true } } },
      }),
    ]);
    const counts = (values: string[]) => values.reduce<Record<string, number>>((result, value) => { result[value] = (result[value] ?? 0) + 1; return result; }, {});
    const rawCells = new Set(raw.map((item) => `${Math.floor(Number(item.latitude) / 0.05)},${Math.floor(Number(item.longitude) / 0.05)}`));
    const curatedCells = new Set(curated.map((item) => `${Math.floor(Number(item.rawPlace.latitude) / 0.05)},${Math.floor(Number(item.rawPlace.longitude) / 0.05)}`));
    const coverage = getCityCoverage(city.name);
    const outside = raw.filter((item) => coverage && (Number(item.latitude) < coverage.south || Number(item.latitude) > coverage.north || Number(item.longitude) < coverage.west || Number(item.longitude) > coverage.east)).length;
    const noisy = raw.filter((item) => item.subtype === 'vacant' || item.subtype === 'yes').length;
    const scores = curated.map((item) => item.totalScore);

    console.log(`\n[CURATION] ${city.name}`);
    console.log(JSON.stringify({
      raw: raw.length,
      oldCurated: previousCurated[city.name],
      newCurated: curated.length,
      reductionFromRawPercent: Number(((1 - curated.length / Math.max(raw.length, 1)) * 100).toFixed(2)),
      added: Math.max(0, curated.length - previousCurated[city.name]),
      removed: Math.max(0, previousCurated[city.name] - curated.length),
      rejected: raw.length - curated.length,
      noisy,
      outsideBoundary: outside,
      rawCells: rawCells.size,
      curatedCells: curatedCells.size,
      averageScore: Number((scores.reduce((sum, score) => sum + score, 0) / Math.max(scores.length, 1)).toFixed(2)),
      scoreBands: {
        '90-100': scores.filter((score) => score >= 90).length,
        '75-89': scores.filter((score) => score >= 75 && score < 90).length,
        '60-74': scores.filter((score) => score >= 60 && score < 75).length,
        '35-59': scores.filter((score) => score < 60).length,
      },
      tiers: counts(curated.map((item) => item.tier)),
      categories: counts(curated.map((item) => item.rawPlace.category)),
      topSubtypes: Object.entries(counts(curated.map((item) => item.rawPlace.subtype ?? 'unknown'))).sort((left, right) => right[1] - left[1]).slice(0, 10),
    }));
  }
  await prisma.$disconnect();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
