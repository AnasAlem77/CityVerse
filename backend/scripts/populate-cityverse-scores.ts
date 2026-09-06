import 'dotenv/config';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  calculateCityVerseScoreBreakdown,
  CITYVERSE_SCORE_VERSION,
} from '../src/places/cityverse-score';

const limitArg = process.argv
  .find((arg) => arg.startsWith('--limit='))
  ?.split('=')[1];
const limit = limitArg ? Math.max(1, Math.min(1000, Number(limitArg))) : 1000;

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const places = await prisma.place.findMany({
    orderBy: { id: 'asc' },
    take: limit,
  });
  for (const place of places) {
    const breakdown = calculateCityVerseScoreBreakdown(place);
    await prisma.cityVerseScore.upsert({
      where: { placeId: place.id },
      create: {
        placeId: place.id,
        formulaVersion: CITYVERSE_SCORE_VERSION,
        ...breakdown,
      },
      update: {
        formulaVersion: CITYVERSE_SCORE_VERSION,
        calculatedAt: new Date(),
        ...breakdown,
      },
    });
  }
  console.log(
    JSON.stringify({
      requested: limit,
      processed: places.length,
      formulaVersion: CITYVERSE_SCORE_VERSION,
    }),
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
