import { CurationService } from '../src/places/curation.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const prisma = new PrismaService();
  const curation = new CurationService(prisma);
  await prisma.$connect();

  const cities = await prisma.city.findMany({
    where: { name: { in: ['Jakarta', 'Bali', 'Paris', 'Dubai', 'Tokyo'] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  for (const city of cities) {
    const result = await curation.curateRawCity(city.id);
    console.log(JSON.stringify(result));
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
