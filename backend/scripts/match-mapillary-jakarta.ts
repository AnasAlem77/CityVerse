import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const CHECKPOINT = path.resolve(
  "logs/mapillary-bulk-test-jakarta-checkpoint.json"
);

const OUTPUT = path.resolve(
  "logs/mapillary-jakarta-matched.json"
);

const MAX_DISTANCE_METERS = 60;
const MIN_QUALITY = 0.60;

type MapillaryImage = {
  id: string;
  latitude: number;
  longitude: number;
  qualityScore: number;
  capturedAt: string;
  sequence: string;
};

type Match = {
  placeId: string;
  placeName: string;
  latitude: number;
  longitude: number;
  imageId: string;
  imageLatitude: number;
  imageLongitude: number;
  distanceMeters: number;
  qualityScore: number;
  capturedAt: string;
  sequence: string;
};

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

function scoreCandidate(distance: number, quality: number): number {
  // Same scoring philosophy as our previous Mapillary pilot:
  // quality 60%, distance 40%.
  const distanceScore = 1 - distance / MAX_DISTANCE_METERS;
  return quality * 0.6 + distanceScore * 0.4;
}

async function main() {
  if (!fs.existsSync(CHECKPOINT)) {
    throw new Error(`Checkpoint not found: ${CHECKPOINT}`);
  }

  const checkpoint = JSON.parse(
    fs.readFileSync(CHECKPOINT, "utf8")
  ) as {
    completedTiles: unknown[];
    images: MapillaryImage[];
  };

  const images = checkpoint.images ?? [];

  console.log("=== Mapillary Jakarta Local Matching ===");
  console.log(`Mapillary images: ${images.length}`);
  console.log(`Max distance: ${MAX_DISTANCE_METERS}m`);
  console.log(`Min quality: ${MIN_QUALITY}`);

  const places = await prisma.place.findMany({
    where: {
      city: {
        name: {
          equals: "Jakarta",
          mode: "insensitive",
        },
      },
    },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      cityId: true,
    },
  });

  console.log(`Jakarta Places: ${places.length}`);

  if (places.length !== 8000) {
    console.warn(
      `⚠ Expected 8000 Jakarta Places, found ${places.length}`
    );
  }

  // Build a lightweight spatial grid.
  // 0.001 degree is roughly 100m at Jakarta's latitude.
  const CELL_SIZE = 0.001;

  const grid = new Map<string, MapillaryImage[]>();

  function cellKey(lat: number, lon: number): string {
    const latCell = Math.floor(lat / CELL_SIZE);
    const lonCell = Math.floor(lon / CELL_SIZE);
    return `${latCell}:${lonCell}`;
  }

  for (const image of images) {
    if (
      !Number.isFinite(image.latitude) ||
      !Number.isFinite(image.longitude) ||
      !Number.isFinite(image.qualityScore)
    ) {
      continue;
    }

    const key = cellKey(image.latitude, image.longitude);

    const bucket = grid.get(key);

    if (bucket) {
      bucket.push(image);
    } else {
      grid.set(key, [image]);
    }
  }

  console.log(`Spatial grid cells: ${grid.size}`);

  const matches: Match[] = [];
  const matchedImageIds = new Set<string>();

  let noCandidate = 0;
  let noQualityCandidate = 0;

  for (let i = 0; i < places.length; i++) {
    const place = places[i];

    const lat = Number(place.latitude);
    const lon = Number(place.longitude);

    const baseLatCell = Math.floor(lat / CELL_SIZE);
    const baseLonCell = Math.floor(lon / CELL_SIZE);

    let best:
      | {
          image: MapillaryImage;
          distance: number;
          score: number;
        }
      | undefined;

    let hadDistanceCandidate = false;

    // Search neighboring cells.
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLon = -1; dLon <= 1; dLon++) {
        const key = `${baseLatCell + dLat}:${baseLonCell + dLon}`;
        const bucket = grid.get(key);

        if (!bucket) continue;

        for (const image of bucket) {
          const distance = haversineMeters(
            lat,
            lon,
            image.latitude,
            image.longitude
          );

          if (distance > MAX_DISTANCE_METERS) {
            continue;
          }

          hadDistanceCandidate = true;

          if (image.qualityScore < MIN_QUALITY) {
            continue;
          }

          const score = scoreCandidate(
            distance,
            image.qualityScore
          );

          if (!best || score > best.score) {
            best = {
              image,
              distance,
              score,
            };
          }
        }
      }
    }

    if (!best) {
      if (hadDistanceCandidate) {
        noQualityCandidate++;
      } else {
        noCandidate++;
      }
      continue;
    }

    matches.push({
      placeId: place.id,
      placeName: place.name,
      latitude: lat,
      longitude: lon,
      imageId: best.image.id,
      imageLatitude: best.image.latitude,
      imageLongitude: best.image.longitude,
      distanceMeters: Number(best.distance.toFixed(2)),
      qualityScore: best.image.qualityScore,
      capturedAt: best.image.capturedAt,
      sequence: best.image.sequence,
    });

    matchedImageIds.add(best.image.id);

    if ((i + 1) % 500 === 0) {
      console.log(`Processed ${i + 1}/${places.length}`);
    }
  }

  const uniqueSelectedImages = new Set(
    matches.map((m) => m.imageId)
  );

  const averageDistance =
    matches.length > 0
      ? matches.reduce((sum, m) => sum + m.distanceMeters, 0) /
        matches.length
      : 0;

  const averageQuality =
    matches.length > 0
      ? matches.reduce((sum, m) => sum + m.qualityScore, 0) /
        matches.length
      : 0;

  const coverage =
    places.length > 0
      ? (matches.length / places.length) * 100
      : 0;

  const duplicateSelectedImages =
    matches.length - uniqueSelectedImages.size;

  const result = {
    generatedAt: new Date().toISOString(),
    city: "Jakarta",
    placesTested: places.length,
    mapillaryImages: images.length,
    thresholds: {
      maxDistanceMeters: MAX_DISTANCE_METERS,
      minQuality: MIN_QUALITY,
    },
    summary: {
      placesWithValidImage: matches.length,
      placesWithoutImage: places.length - matches.length,
      coveragePercent: Number(coverage.toFixed(2)),
      uniqueSelectedImages: uniqueSelectedImages.size,
      duplicateSelectedImages,
      averageDistanceMeters: Number(
        averageDistance.toFixed(2)
      ),
      averageQuality: Number(
        averageQuality.toFixed(3)
      ),
      noCandidateWithinDistance: noCandidate,
      candidateButBelowQuality: noQualityCandidate,
    },
    matches,
  };

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(result, null, 2)
  );

  console.log("");
  console.log("=== RESULT ===");
  console.log(`Places tested: ${places.length}`);
  console.log(
    `Places with valid image: ${matches.length}`
  );
  console.log(
    `Places without image: ${places.length - matches.length}`
  );
  console.log(
    `Coverage: ${coverage.toFixed(2)}%`
  );
  console.log(
    `Unique selected images: ${uniqueSelectedImages.size}`
  );
  console.log(
    `Duplicate selected images: ${duplicateSelectedImages}`
  );
  console.log(
    `Average distance: ${averageDistance.toFixed(2)}m`
  );
  console.log(
    `Average quality: ${averageQuality.toFixed(3)}`
  );
  console.log(
    `No candidate within 60m: ${noCandidate}`
  );
  console.log(
    `Candidate but quality < 0.60: ${noQualityCandidate}`
  );
  console.log(`Output: ${OUTPUT}`);
  console.log("");
  console.log(
    "✓ No database records were modified."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
