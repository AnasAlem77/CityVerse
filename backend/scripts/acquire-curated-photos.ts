import 'dotenv/config';
import { PrismaService } from '../src/prisma/prisma.service';

const limitArg = process.argv
  .find((arg) => arg.startsWith('--limit='))
  ?.split('=')[1];
const limit = Math.min(100, Math.max(1, Number(limitArg ?? 25)));
function tags(value: unknown) {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
function candidate(tagData: unknown) {
  const data = tags(tagData);
  const image =
    typeof data.image === 'string'
      ? data.image
      : typeof data.image_url === 'string'
        ? data.image_url
        : null;
  if (!image) return null;
  const source =
    image.includes('wikimedia') || image.includes('wikipedia')
      ? 'Wikimedia Commons'
      : 'OSM';
  return {
    imageUrl: image,
    source,
    sourceUrl: image,
    confidenceScore: 1,
    matchStatus: 'MATCHED',
  };
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value: string) {
  return new Set(
    normalize(value)
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
}

async function findWikimediaPhoto(name: string, city: string) {
  const query = `${name} ${city}`.trim();
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '1200',
    format: 'json',
    origin: '*',
  });
  const response = await fetch(
    `https://commons.wikimedia.org/w/api.php?${params}`,
    {
      headers: {
        'User-Agent': 'CityVerse/1.0 photo-curation (contact unavailable)',
      },
    },
  );
  if (!response.ok) throw new Error(`Wikimedia returned ${response.status}`);
  const payload = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        { title: string; imageinfo?: Array<Record<string, unknown>> }
      >;
    };
  };
  const placeTokens = tokens(name);
  const cityTokens = tokens(city);
  const candidates = Object.values(payload.query?.pages ?? [])
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (
        !info ||
        typeof info.thumburl !== 'string' ||
        typeof info.url !== 'string'
      )
        return null;
      const haystack = tokens(
        `${page.title} ${info.extmetadata && typeof info.extmetadata === 'object' ? JSON.stringify(info.extmetadata) : ''}`,
      );
      const placeMatches = [...placeTokens].filter((token) =>
        haystack.has(token),
      ).length;
      const cityMatches = [...cityTokens].filter((token) =>
        haystack.has(token),
      ).length;
      const confidence = placeTokens.size
        ? (placeMatches / placeTokens.size) * 0.8 +
          (cityTokens.size ? (cityMatches / cityTokens.size) * 0.2 : 0)
        : 0;
      return { page, info, confidence };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .filter((value) => value.confidence >= 0.55)
    .sort((a, b) => b.confidence - a.confidence)[0];
  if (!candidates) return null;
  const metadata = candidates.info.extmetadata as
    Record<string, { value?: string }> | undefined;
  return {
    imageUrl: candidates.info.thumburl as string,
    source: 'Wikimedia Commons',
    sourceUrl: candidates.info.url as string,
    license: metadata?.LicenseShortName?.value ?? null,
    author: metadata?.Artist?.value ?? null,
    attribution:
      metadata?.Attribution?.value ?? metadata?.Credit?.value ?? null,
    width:
      typeof candidates.info.thumbwidth === 'number'
        ? candidates.info.thumbwidth
        : null,
    height:
      typeof candidates.info.thumbheight === 'number'
        ? candidates.info.thumbheight
        : null,
    confidenceScore: Number(candidates.confidence.toFixed(3)),
    matchStatus: 'MATCHED',
  };
}
async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const places = await prisma.curatedPlace.findMany({
    orderBy: [{ cityId: 'asc' }, { id: 'asc' }],
    take: limit,
    include: { rawPlace: true, city: true, photos: { take: 1 } },
  });
  let attached = 0;
  let skipped = 0;
  let failures = 0;
  for (const place of places) {
    let photo;
    try {
      photo =
        candidate(place.rawPlace.rawTags) ??
        (place.photos.length === 0
          ? await findWikimediaPhoto(place.rawPlace.name, place.city.name)
          : null);
    } catch (error) {
      failures += 1;
      console.warn(
        `Photo lookup failed for ${place.rawPlace.name}: ${error instanceof Error ? error.message : error}`,
      );
      continue;
    }
    if (!photo) {
      skipped += 1;
      continue;
    }
    await prisma.curatedPlacePhoto.upsert({
      where: {
        curatedPlaceId_imageUrl: {
          curatedPlaceId: place.id,
          imageUrl: photo.imageUrl,
        },
      },
      create: { curatedPlaceId: place.id, ...photo },
      update: photo,
    });
    attached += 1;
  }
  console.log(
    JSON.stringify({
      requested: limit,
      processed: places.length,
      attached,
      skipped,
      failures,
      idempotent: true,
    }),
  );
  await prisma.$disconnect();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
