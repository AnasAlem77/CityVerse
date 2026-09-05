import { OsmService } from '../src/osm/osm.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const prisma = new PrismaService();
  const osm = new OsmService(prisma);

  await prisma.$connect();
  const requestedCities = process.env.COLLECT_CITIES?.split(',').map((name) => name.trim()).filter(Boolean);
  const cities = await prisma.city.findMany({
    where: { name: { in: requestedCities?.length ? requestedCities : ['Jakarta', 'Bali', 'Paris', 'Dubai', 'Tokyo'] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  for (const city of cities) {
    console.log(`[OSM] Collecting ${city.name} into RawPlace...`);
    const result = await osm.collectRawPlacesForCity(city.id, true);
    console.log(JSON.stringify({
      city: result.cityName,
      rawCandidates: result.candidates,
      failedTiles: result.failedTiles,
      byCategory: result.byCategory,
      persisted: result.persisted,
    }));
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
