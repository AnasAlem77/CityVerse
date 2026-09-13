import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../src/prisma/prisma.service';

// RawPlace is used only as metadata for its exact Place (cityId + osmId).
const batchSize = 100;
const requestedLimit = Number(
  process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] ??
    Number.POSITIVE_INFINITY,
);
const checkpointPath = join(
  process.cwd(),
  'logs',
  'photo-ingestion-checkpoint.json',
);
const safeLicense = /\b(cc[- ]?(by|zero)|public[ _-]?domain|pdm|gfdl)\b/i;
type Tags = Record<string, unknown>;
type Stats = Record<string, number>;
type Candidate = {
  fileName: string;
  provenance: 'OSM image' | 'OSM wikimedia_commons' | 'Wikidata P18';
};
type Image = {
  imageUrl: string;
  sourceUrl: string;
  license: string;
  author: string | null;
  attribution: string | null;
  width: number | null;
  height: number | null;
};
type Checkpoint = {
  version: 2;
  lastProcessedPlaceId: string | null;
  processedCount: number;
  startedAt: string;
  updatedAt: string;
  stats: Stats;
};
const emptyStats = (): Stats => ({
  attached: 0,
  existing: 0,
  noReferences: 0,
  noVerifiedImage: 0,
  duplicateCandidatesRejected: 0,
  invalidImageCandidates: 0,
  licenseReuseRejected: 0,
  httpFailures: 0,
  rateLimitEvents: 0,
  timeouts: 0,
  mapillaryUnavailable: 0,
  panoramaxUnavailable: 0,
  kartaViewUnavailable: 0,
  flickrLicenseRejected: 0,
  wikimediaCommons: 0,
  wikidataP18: 0,
  osmImage: 0,
});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const bump = (stats: Stats, key: string) => {
  stats[key] = (stats[key] ?? 0) + 1;
};
function isRecord(value: unknown): value is Tags {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function tagString(tags: Tags, key: string): string | null {
  const value = tags[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function commonsFileName(value: string | null): string | null {
  if (!value) return null;
  let candidate = value.trim();
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return null;
  }
  candidate = candidate
    .replace(
      /^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//i,
      '',
    )
    .replace(/^https?:\/\/commons\.wikimedia\.org\/wiki\/File:/i, '')
    .replace(/^File:/i, '');
  return candidate && !/^https?:\/\//i.test(candidate) ? candidate : null;
}
function wikidataId(tags: Tags): string | null {
  const id = tagString(tags, 'wikidata');
  return id && /^Q\d+$/i.test(id) ? id.toUpperCase() : null;
}
async function fetchJson(url: string, stats: Stats): Promise<unknown | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'CityVerse photo curation/1.0' },
      });
      if (response.status === 429) {
        bump(stats, 'rateLimitEvents');
        const retry = Number(response.headers.get('retry-after'));
        await sleep(
          Number.isFinite(retry)
            ? Math.min(retry * 1000, 60_000)
            : 1_500 * 2 ** attempt,
        );
        continue;
      }
      if (!response.ok) {
        bump(stats, 'httpFailures');
        return null;
      }
      return await response.json();
    } catch (error) {
      bump(
        stats,
        error instanceof Error && error.name === 'AbortError'
          ? 'timeouts'
          : 'httpFailures',
      );
      if (attempt < 2) await sleep(750 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}
async function wikidataP18(
  ids: string[],
  stats: Stats,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (let index = 0; index < ids.length; index += 50) {
    const chunk = ids.slice(index, index + 50);
    const params = new URLSearchParams({
      action: 'wbgetentities',
      ids: chunk.join('|'),
      props: 'claims',
      format: 'json',
    });
    const payload = (await fetchJson(
      `https://www.wikidata.org/w/api.php?${params}`,
      stats,
    )) as {
      entities?: Record<
        string,
        {
          claims?: {
            P18?: Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>;
          };
        }
      >;
    } | null;
    for (const id of chunk) {
      const file =
        payload?.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (typeof file === 'string' && file.trim()) result.set(id, file.trim());
    }
  }
  return result;
}
async function commonsImages(
  fileNames: string[],
  stats: Stats,
): Promise<Map<string, Image>> {
  const result = new Map<string, Image>();
  for (let index = 0; index < fileNames.length; index += 50) {
    const chunk = fileNames.slice(index, index + 50);
    const params = new URLSearchParams({
      action: 'query',
      titles: chunk.map((name) => `File:${name}`).join('|'),
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      iiurlwidth: '1200',
      format: 'json',
      origin: '*',
    });
    const payload = (await fetchJson(
      `https://commons.wikimedia.org/w/api.php?${params}`,
      stats,
    )) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            imageinfo?: Array<{
              thumburl?: unknown;
              url?: unknown;
              thumbwidth?: unknown;
              thumbheight?: unknown;
              extmetadata?: Record<string, { value?: string }>;
            }>;
          }
        >;
      };
    } | null;
    for (const page of Object.values(payload?.query?.pages ?? {})) {
      const name = commonsFileName(page.title ?? null);
      const info = page.imageinfo?.[0];
      const metadata = info?.extmetadata;
      const license =
        metadata?.LicenseShortName?.value ?? metadata?.UsageTerms?.value;
      if (
        !name ||
        !info ||
        typeof info.thumburl !== 'string' ||
        typeof info.url !== 'string'
      ) {
        bump(stats, 'invalidImageCandidates');
        continue;
      }
      if (!license || !safeLicense.test(license)) {
        bump(stats, 'licenseReuseRejected');
        continue;
      }
      result.set(name, {
        imageUrl: info.thumburl,
        sourceUrl: info.url,
        license,
        author: metadata?.Artist?.value ?? null,
        attribution:
          metadata?.Attribution?.value ?? metadata?.Credit?.value ?? null,
        width: typeof info.thumbwidth === 'number' ? info.thumbwidth : null,
        height: typeof info.thumbheight === 'number' ? info.thumbheight : null,
      });
    }
  }
  return result;
}
async function isUsableImage(url: string, stats: Stats): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'CityVerse photo curation/1.0' },
    });
    const type = response.headers.get('content-type') ?? '';
    const length = Number(response.headers.get('content-length') ?? 1);
    if (!response.ok || !type.startsWith('image/') || length === 0) {
      bump(stats, 'invalidImageCandidates');
      return false;
    }
    return true;
  } catch (error) {
    bump(
      stats,
      error instanceof Error && error.name === 'AbortError'
        ? 'timeouts'
        : 'httpFailures',
    );
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
async function loadCheckpoint(): Promise<Checkpoint> {
  try {
    const parsed = JSON.parse(
      await readFile(checkpointPath, 'utf8'),
    ) as Partial<Checkpoint>;
    if (
      parsed.version === 2 &&
      typeof parsed.processedCount === 'number' &&
      parsed.stats &&
      typeof parsed.startedAt === 'string'
    )
      return {
        version: 2,
        lastProcessedPlaceId:
          typeof parsed.lastProcessedPlaceId === 'string'
            ? parsed.lastProcessedPlaceId
            : null,
        processedCount: parsed.processedCount,
        startedAt: parsed.startedAt,
        updatedAt:
          typeof parsed.updatedAt === 'string'
            ? parsed.updatedAt
            : parsed.startedAt,
        stats: { ...emptyStats(), ...parsed.stats },
      };
  } catch {
    /* first run */
  }
  // Legacy checkpoint has no auditable run state. Restart is safe: inserts are idempotent.
  const now = new Date().toISOString();
  return {
    version: 2,
    lastProcessedPlaceId: null,
    processedCount: 0,
    startedAt: now,
    updatedAt: now,
    stats: emptyStats(),
  };
}
async function saveCheckpoint(checkpoint: Checkpoint) {
  checkpoint.updatedAt = new Date().toISOString();
  await mkdir(join(process.cwd(), 'logs'), { recursive: true });
  await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
}
async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const checkpoint = await loadCheckpoint();
  let runProcessed = 0;
  try {
    while (runProcessed < requestedLimit) {
      const places = await prisma.place.findMany({
        ...(checkpoint.lastProcessedPlaceId
          ? { cursor: { id: checkpoint.lastProcessedPlaceId }, skip: 1 }
          : {}),
        take: Math.min(batchSize, requestedLimit - runProcessed),
        orderBy: { id: 'asc' },
        select: { id: true, cityId: true, osmId: true },
      });
      if (!places.length) break;
      const rawPlaces = await prisma.rawPlace.findMany({
        where: {
          OR: places.map((place) => ({
            cityId: place.cityId,
            osmId: place.osmId!,
          })),
        },
        select: { cityId: true, osmId: true, rawTags: true },
      });
      const rawByIdentity = new Map(
        rawPlaces.map((raw) => [
          `${raw.cityId}|${raw.osmId}`,
          isRecord(raw.rawTags) ? raw.rawTags : {},
        ]),
      );
      const wikidataIds = [
        ...new Set(
          places
            .map((place) => rawByIdentity.get(`${place.cityId}|${place.osmId}`))
            .map((raw) => raw && wikidataId(raw))
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const p18 = await wikidataP18(wikidataIds, checkpoint.stats);
      const candidatesByPlace = new Map<string, Candidate[]>();
      for (const place of places) {
        const tags = rawByIdentity.get(`${place.cityId}|${place.osmId}`);
        if (!tags) {
          bump(checkpoint.stats, 'noVerifiedImage');
          continue;
        }
        const candidates: Candidate[] = [];
        const osmImage = commonsFileName(tagString(tags, 'image'));
        const commons = commonsFileName(tagString(tags, 'wikimedia_commons'));
        const p18File = p18.get(wikidataId(tags) ?? '');
        if (osmImage)
          candidates.push({ fileName: osmImage, provenance: 'OSM image' });
        if (commons)
          candidates.push({
            fileName: commons,
            provenance: 'OSM wikimedia_commons',
          });
        if (p18File)
          candidates.push({ fileName: p18File, provenance: 'Wikidata P18' });
        if (tagString(tags, 'mapillary'))
          bump(checkpoint.stats, 'mapillaryUnavailable');
        if (tagString(tags, 'panoramax'))
          bump(checkpoint.stats, 'panoramaxUnavailable');
        if (tagString(tags, 'kartaview'))
          bump(checkpoint.stats, 'kartaViewUnavailable');
        if (tagString(tags, 'flickr'))
          bump(checkpoint.stats, 'flickrLicenseRejected');
        const unique = [
          ...new Map(
            candidates.map((candidate) => [
              candidate.fileName.toLowerCase(),
              candidate,
            ]),
          ).values(),
        ];
        if (!unique.length) bump(checkpoint.stats, 'noReferences');
        candidatesByPlace.set(place.id, unique);
      }
      const images = await commonsImages(
        [
          ...new Set(
            [...candidatesByPlace.values()]
              .flat()
              .map((candidate) => candidate.fileName),
          ),
        ],
        checkpoint.stats,
      );
      for (const place of places) {
        let found = false;
        const seen = new Set<string>();
        for (const candidate of candidatesByPlace.get(place.id) ?? []) {
          const image = images.get(candidate.fileName);
          if (!image) continue;
          if (seen.has(image.imageUrl)) {
            bump(checkpoint.stats, 'duplicateCandidatesRejected');
            continue;
          }
          seen.add(image.imageUrl);
          if (!(await isUsableImage(image.imageUrl, checkpoint.stats)))
            continue;
          const duplicate = await prisma.placeImage.findFirst({
            where: { placeId: place.id, url: image.imageUrl },
            select: { id: true },
          });
          if (duplicate) {
            bump(checkpoint.stats, 'existing');
            found = true;
            continue;
          }
          await prisma.placeImage.create({
            data: {
              placeId: place.id,
              url: image.imageUrl,
              source:
                candidate.provenance === 'Wikidata P18'
                  ? 'Wikidata P18 / Wikimedia Commons'
                  : `${candidate.provenance} / Wikimedia Commons`,
              sourceUrl: image.sourceUrl,
              license: image.license,
              author: image.author,
              attribution: image.attribution,
              width: image.width,
              height: image.height,
            },
          });
          bump(checkpoint.stats, 'attached');
          bump(
            checkpoint.stats,
            candidate.provenance === 'Wikidata P18'
              ? 'wikidataP18'
              : candidate.provenance === 'OSM image'
                ? 'osmImage'
                : 'wikimediaCommons',
          );
          found = true;
        }
        if (!found && (candidatesByPlace.get(place.id)?.length ?? 0) > 0)
          bump(checkpoint.stats, 'noVerifiedImage');
      }
      checkpoint.lastProcessedPlaceId =
        places.at(-1)?.id ?? checkpoint.lastProcessedPlaceId;
      checkpoint.processedCount += places.length;
      runProcessed += places.length;
      await saveCheckpoint(checkpoint);
      console.log(
        JSON.stringify({
          processedThisRun: runProcessed,
          totalProcessed: checkpoint.processedCount,
          cursor: checkpoint.lastProcessedPlaceId,
          attached: checkpoint.stats.attached,
        }),
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
