import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const places = await prisma.place.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        cityId: true,
        latitude: true,
        longitude: true,
        category: true,
        subtype: true,
        address: true,
        city: { select: { name: true } },
      },
    });
    const output = join(process.cwd(), 'logs', 'osv5m-audit', 'places.json');
    await mkdir(join(process.cwd(), 'logs', 'osv5m-audit'), {
      recursive: true,
    });
    await writeFile(
      output,
      JSON.stringify(
        places.map((p) => ({
          ...p,
          latitude: p.latitude.toString(),
          longitude: p.longitude.toString(),
          cityName: p.city.name,
        })),
      ),
    );
    console.log(JSON.stringify({ output, places: places.length }));
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
