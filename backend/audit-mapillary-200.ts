import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import fs from "node:fs/promises";

const TOKEN: string = process.env.MAPILLARY_ACCESS_TOKEN ?? "";

if (!TOKEN) {
  throw new Error("MAPILLARY_ACCESS_TOKEN is not set");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});

const prisma = new PrismaClient({ adapter });

const OUTPUT = "logs/mapillary-audit-1000.json";
const SAMPLE_SIZE = 1000;

// Search radius.
// bbox half-size of 0.001 degrees is roughly ~100m north/south
// and somewhat wider east/west depending on latitude.
const BBOX_DELTA = 0.001;

const REQUEST_DELAY_MS = 700;
const MAX_RETRIES = 3;

type AuditResult = {
  placeId: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;

  status: "images" | "no_images" | "error";

  imageCount: number;

  nearestDistanceMeters: number | null;
  within10m: number;
  within25m: number;
  within50m: number;
  within100m: number;

  uniqueImages: number;
  uniqueSequences: number;

  bestQuality: number | null;
  averageQuality: number | null;

  images: Array<{
    id: string;
    latitude: number | null;
    longitude: number | null;
    distanceMeters: number | null;
    qualityScore: number | null;
    capturedAt: number | null;
  }>;

  error?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371000;

  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) *
      Math.cos(p2) *
      Math.sin(dl / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function mapillaryRequest(
  url: string,
  attempt = 1,
): Promise<any> {
  try {
    const response = await fetch(url);

    const text = await response.text();

    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Invalid JSON response (${response.status}): ${text.slice(0, 300)}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${JSON.stringify(data).slice(0, 500)}`,
      );
    }

    return data;
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      throw error;
    }

    const backoff = attempt * 2000;

    console.log(
      `    Retry ${attempt}/${MAX_RETRIES - 1} after ${backoff}ms...`,
    );

    await sleep(backoff);

    return mapillaryRequest(url, attempt + 1);
  }
}

async function loadExistingResults(): Promise<AuditResult[]> {
  try {
    const raw = await fs.readFile(OUTPUT, "utf8");
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed.results)) {
      return parsed.results;
    }
  } catch {
    // No checkpoint yet.
  }

  return [];
}

async function saveResults(results: AuditResult[]) {
  await fs.mkdir("logs", { recursive: true });

  const summary = buildSummary(results);

  await fs.writeFile(
    OUTPUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sampleSize: SAMPLE_SIZE,
        completed: results.length,
        summary,
        results,
      },
      null,
      2,
    ),
  );
}

function buildSummary(results: AuditResult[]) {
  const successful = results.filter(
    (r) => r.status !== "error",
  );

  const withImages = successful.filter(
    (r) => r.imageCount > 0,
  );

  const noImages = successful.filter(
    (r) => r.imageCount === 0,
  );

  const countWithin = (distance: number) =>
    successful.filter(
      (r) =>
        r.nearestDistanceMeters !== null &&
        r.nearestDistanceMeters <= distance,
    ).length;

  const citySummary: Record<
    string,
    {
      tested: number;
      withImages: number;
      noImages: number;
      within10m: number;
      within25m: number;
      within50m: number;
      within100m: number;
    }
  > = {};

  for (const result of successful) {
    if (!citySummary[result.city]) {
      citySummary[result.city] = {
        tested: 0,
        withImages: 0,
        noImages: 0,
        within10m: 0,
        within25m: 0,
        within50m: 0,
        within100m: 0,
      };
    }

    const city = citySummary[result.city];

    city.tested++;

    if (result.imageCount > 0) {
      city.withImages++;
    } else {
      city.noImages++;
    }

    if (result.within10m > 0) city.within10m++;
    if (result.within25m > 0) city.within25m++;
    if (result.within50m > 0) city.within50m++;
    if (result.within100m > 0) city.within100m++;
  }

  const uniqueImageIds = new Set<string>();

  for (const result of results) {
    for (const image of result.images) {
      uniqueImageIds.add(image.id);
    }
  }

  return {
    tested: results.length,
    successful: successful.length,
    errors: results.length - successful.length,

    withImages: withImages.length,
    noImages: noImages.length,

    coveragePercent:
      successful.length > 0
        ? Number(
            ((withImages.length / successful.length) * 100).toFixed(2),
          )
        : 0,

    within10m: countWithin(10),
    within25m: countWithin(25),
    within50m: countWithin(50),
    within100m: countWithin(100),

    uniqueImageIds: uniqueImageIds.size,

    citySummary,
  };
}

async function main() {
  await fs.mkdir("logs", { recursive: true });

  console.log("==========================================");
  console.log("Mapillary Coverage Audit - 200 Places");
  console.log("==========================================");
  console.log("Database modified: NO");
  console.log("");

  const allPlaces = await prisma.place.findMany({
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      city: {
        select: {
          name: true,
        },
      },
    },
  });

  console.log(`Production Places found: ${allPlaces.length}`);

  if (allPlaces.length !== 40000) {
    console.warn(
      `WARNING: Expected 40000 Places, found ${allPlaces.length}`,
    );
  }

  // Deterministic random sample based on place IDs.
  // This avoids changing the sample if the script is resumed.
  const shuffled = [...allPlaces].sort((a, b) =>
    String(a.id).localeCompare(String(b.id)),
  );

  // Simple deterministic pseudo-random ordering.
  shuffled.sort((a, b) => {
    const hash = (value: string) => {
      let h = 2166136261;

      for (let i = 0; i < value.length; i++) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }

      return h >>> 0;
    };

    return hash(String(a.id)) - hash(String(b.id));
  });

  const sample = shuffled.slice(0, SAMPLE_SIZE);

  const existingResults = await loadExistingResults();

  const completedIds = new Set(
    existingResults.map((result) => result.placeId),
  );

  console.log(`Sample size: ${sample.length}`);
  console.log(`Already completed: ${completedIds.size}`);
  console.log("");

  const results = [...existingResults];

  for (let i = 0; i < sample.length; i++) {
    const place = sample[i];

    if (completedIds.has(String(place.id))) {
      continue;
    }

    const lat = Number(place.latitude);
    const lon = Number(place.longitude);

    console.log(
      `${i + 1}/${sample.length}. ${place.name} (${place.city.name})`,
    );

    try {
      const west = lon - BBOX_DELTA;
      const south = lat - BBOX_DELTA;
      const east = lon + BBOX_DELTA;
      const north = lat + BBOX_DELTA;

      const bbox = `${west},${south},${east},${north}`;

      const fields = [
        "id",
        "computed_geometry",
        "quality_score",
        "captured_at",
        "sequence",
      ].join(",");

      const url =
        "https://graph.mapillary.com/images" +
        `?access_token=${encodeURIComponent(TOKEN)}` +
        `&fields=${encodeURIComponent(fields)}` +
        `&bbox=${encodeURIComponent(bbox)}` +
        `&limit=100`;

      const data = await mapillaryRequest(url);

      const apiImages = Array.isArray(data?.data)
        ? data.data
        : [];

      const images = apiImages.map((image: any) => {
        const imageLat =
          image?.computed_geometry?.coordinates?.[1] ?? null;

        const imageLon =
          image?.computed_geometry?.coordinates?.[0] ?? null;

        const distance =
          imageLat !== null && imageLon !== null
            ? distanceMeters(lat, lon, imageLat, imageLon)
            : null;

        return {
          id: String(image.id),
          latitude:
            imageLat !== null ? Number(imageLat) : null,
          longitude:
            imageLon !== null ? Number(imageLon) : null,
          distanceMeters:
            distance !== null
              ? Number(distance.toFixed(2))
              : null,
          qualityScore:
            image.quality_score !== undefined &&
            image.quality_score !== null
              ? Number(image.quality_score)
              : null,
          capturedAt:
            image.captured_at !== undefined &&
            image.captured_at !== null
              ? Number(image.captured_at)
              : null,
          sequence:
            image.sequence !== undefined &&
            image.sequence !== null
              ? String(image.sequence)
              : null,
        };
      });

      images.sort(
        (a: any, b: any) =>
          (a.distanceMeters ?? Infinity) -
          (b.distanceMeters ?? Infinity),
      );

      const distances = images
        .map((image: any) => image.distanceMeters)
        .filter(
          (distance: any): distance is number =>
            typeof distance === "number",
        );

      const nearest =
        distances.length > 0 ? distances[0] : null;

      const qualityValues = images
        .map((image: any) => image.qualityScore)
        .filter(
          (quality: any): quality is number =>
            typeof quality === "number",
        );

      const sequences = new Set(
        images
          .map((image: any) => image.sequence)
          .filter(Boolean),
      );

      const result: AuditResult = {
        placeId: String(place.id),
        name: place.name,
        city: place.city.name,
        latitude: lat,
        longitude: lon,

        status:
          images.length > 0 ? "images" : "no_images",

        imageCount: images.length,

        nearestDistanceMeters: nearest,

        within10m: distances.filter((d) => d <= 10).length,
        within25m: distances.filter((d) => d <= 25).length,
        within50m: distances.filter((d) => d <= 50).length,
        within100m: distances.filter((d) => d <= 100).length,

        uniqueImages: new Set(
          images.map((image: any) => image.id),
        ).size,

        uniqueSequences: sequences.size,

        bestQuality:
          qualityValues.length > 0
            ? Number(Math.max(...qualityValues).toFixed(3))
            : null,

        averageQuality:
          qualityValues.length > 0
            ? Number(
                (
                  qualityValues.reduce(
                    (sum, value) => sum + value,
                    0,
                  ) / qualityValues.length
                ).toFixed(3),
              )
            : null,

        images: images.map((image: any) => ({
          id: image.id,
          latitude: image.latitude,
          longitude: image.longitude,
          distanceMeters: image.distanceMeters,
          qualityScore: image.qualityScore,
          capturedAt: image.capturedAt,
        })),
      };

      results.push(result);

      console.log(
        `   ${images.length > 0 ? "✅" : "❌"} ${images.length} image(s)` +
          ` | nearest: ${nearest !== null ? `${nearest}m` : "—"}` +
          ` | best quality: ${
            result.bestQuality !== null
              ? result.bestQuality
              : "—"
          }`,
      );

      await saveResults(results);
    } catch (error: any) {
      const result: AuditResult = {
        placeId: String(place.id),
        name: place.name,
        city: place.city.name,
        latitude: lat,
        longitude: lon,

        status: "error",

        imageCount: 0,

        nearestDistanceMeters: null,

        within10m: 0,
        within25m: 0,
        within50m: 0,
        within100m: 0,

        uniqueImages: 0,
        uniqueSequences: 0,

        bestQuality: null,
        averageQuality: null,

        images: [],

        error: String(error?.message ?? error),
      };

      results.push(result);

      console.log(`   ⚠️ ERROR: ${result.error}`);

      await saveResults(results);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  const summary = buildSummary(results);

  console.log("");
  console.log("==========================================");
  console.log("FINAL SUMMARY");
  console.log("==========================================");
  console.log(`Places tested: ${summary.tested}`);
  console.log(`Successful: ${summary.successful}`);
  console.log(`Errors: ${summary.errors}`);
  console.log(`With images: ${summary.withImages}`);
  console.log(`No images: ${summary.noImages}`);
  console.log(`Coverage: ${summary.coveragePercent}%`);
  console.log("");
  console.log(`Within 10m: ${summary.within10m}`);
  console.log(`Within 25m: ${summary.within25m}`);
  console.log(`Within 50m: ${summary.within50m}`);
  console.log(`Within 100m: ${summary.within100m}`);
  console.log("");
  console.log(`Unique Mapillary images: ${summary.uniqueImageIds}`);
  console.log("");
  console.log("City breakdown:");

  console.log(
    JSON.stringify(summary.citySummary, null, 2),
  );

  console.log("");
  console.log(`Report: ${OUTPUT}`);
  console.log("Database modified: NO");
  console.log("==========================================");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
