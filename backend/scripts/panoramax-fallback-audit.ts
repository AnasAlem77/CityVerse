import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const CITY = process.argv.find((arg) => arg.startsWith("--city="))?.split("=")[1] ?? "Dubai";
const MAX_DISTANCE_METERS = 60;
const REQUEST_DELAY_MS = 150;
const MAX_RETRIES = 3;

const citySlug = CITY.toLowerCase().replace(/\s+/g, "-");

const mapillaryCheckpointPath = path.join(
  process.cwd(),
  "logs",
  "mapillary-production",
  `${citySlug}-checkpoint.json`,
);

const reportPath = path.join(
  process.cwd(),
  "logs",
  "panoramax-fallback-audit",
  `${citySlug}-report.json`,
);

type MapillaryCheckpointResult = {
  placeId: string;
  placeName: string;
  city: string;
  status: string;
};

type PanoramaxFeature = {
  id?: string;
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: Record<string, unknown>;
  assets?: Record<string, unknown>;
};

type PanoramaxSearchResponse = {
  features?: PanoramaxFeature[];
};

type AuditResult = {
  placeId: string;
  placeName: string;
  city: string;
  status: "matched" | "no_candidate" | "error";
  selected?: {
    id: string;
    latitude: number;
    longitude: number;
    distanceMeters: number;
  };
  candidateCount?: number;
  error?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const earthRadius = 6371000;

  const toRadians = (value: number) => (value * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return (
    earthRadius *
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

async function fetchJson(
  url: string,
): Promise<PanoramaxSearchResponse> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "CityVerse/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} ${response.statusText}`,
        );
      }

      return (await response.json()) as PanoramaxSearchResponse;
    } catch (error) {
      lastError = error;

      if (attempt < MAX_RETRIES) {
        await sleep(500 * attempt);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unknown request error");
}

function loadMapillaryNoCandidatePlaces(): MapillaryCheckpointResult[] {
  if (!fs.existsSync(mapillaryCheckpointPath)) {
    throw new Error(
      `Mapillary checkpoint not found: ${mapillaryCheckpointPath}`,
    );
  }

  const checkpoint = JSON.parse(
    fs.readFileSync(mapillaryCheckpointPath, "utf8"),
  ) as {
    results?: MapillaryCheckpointResult[];
  };

  if (!Array.isArray(checkpoint.results)) {
    throw new Error(
      `Invalid Mapillary checkpoint: results[] not found`,
    );
  }

  return checkpoint.results.filter(
    (result) => result.status === "no_candidate",
  );
}

async function findPanoramaxCandidate(
  latitude: number,
  longitude: number,
) {
  const url =
    `https://api.panoramax.xyz/api/search` +
    `?place_position=${longitude},${latitude}` +
    `&place_distance=0-${MAX_DISTANCE_METERS}`;

  const data = await fetchJson(url);

  const candidates = (data.features ?? [])
    .map((feature) => {
      const coordinates = feature.geometry?.coordinates;

      if (
        !coordinates ||
        coordinates.length < 2 ||
        !feature.id
      ) {
        return null;
      }

      const [candidateLongitude, candidateLatitude] =
        coordinates;

      const distanceMeters = haversineDistanceMeters(
        latitude,
        longitude,
        candidateLatitude,
        candidateLongitude,
      );

      if (distanceMeters > MAX_DISTANCE_METERS) {
        return null;
      }

      return {
        id: feature.id,
        latitude: candidateLatitude,
        longitude: candidateLongitude,
        distanceMeters,
      };
    })
    .filter(
      (
        candidate,
      ): candidate is {
        id: string;
        latitude: number;
        longitude: number;
        distanceMeters: number;
      } => candidate !== null,
    )
    .sort(
      (a, b) => a.distanceMeters - b.distanceMeters,
    );

  return {
    candidates,
    selected: candidates[0] ?? null,
  };
}

async function main() {
  fs.mkdirSync(
    path.dirname(reportPath),
    { recursive: true },
  );

  console.log("=== Panoramax Fallback Audit ===");
  console.log("");
  console.log(`City: ${CITY}`);
  console.log(`Search Radius: ≤${MAX_DISTANCE_METERS}m`);
  console.log("");

  const targets = loadMapillaryNoCandidatePlaces();

  console.log(
    `Mapillary No Candidate Places: ${targets.length}`,
  );
  console.log("");

  const results: AuditResult[] = [];

  let matched = 0;
  let noCandidate = 0;
  let errors = 0;

  for (let index = 0; index < targets.length; index++) {
    const place = targets[index];

    console.log(
      `[${index + 1}/${targets.length}] ${place.placeName}`,
    );

    try {
      const adapter = new PrismaPg({
        connectionString: process.env.DATABASE_URL!,
      });

      const prisma = new PrismaClient({ adapter });

      const dbPlace = await prisma.place.findUnique({
        where: {
          id: place.placeId,
        },
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

      await prisma.$disconnect();

      if (!dbPlace) {
        throw new Error(
          `Place not found in database: ${place.placeId}`,
        );
      }

      const result = await findPanoramaxCandidate(
        Number(dbPlace.latitude),
        Number(dbPlace.longitude),
      );

      if (result.selected) {
        matched++;

        console.log(
          `  ✓ Panoramax Selected | ${result.selected.distanceMeters.toFixed(2)}m | ${result.selected.id}`,
        );

        results.push({
          placeId: dbPlace.id,
          placeName: dbPlace.name,
          city: dbPlace.city.name,
          status: "matched",
          selected: result.selected,
          candidateCount: result.candidates.length,
        });
      } else {
        noCandidate++;

        console.log("  No valid Panoramax candidate");

        results.push({
          placeId: dbPlace.id,
          placeName: dbPlace.name,
          city: dbPlace.city.name,
          status: "no_candidate",
          candidateCount: 0,
        });
      }
    } catch (error) {
      errors++;

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.log(`  ✗ Error | ${message}`);

      results.push({
        placeId: place.placeId,
        placeName: place.placeName,
        city: place.city,
        status: "error",
        error: message,
      });
    }

    await sleep(REQUEST_DELAY_MS);
  }

  const distances = results
    .filter(
      (result) =>
        result.status === "matched" &&
        result.selected,
    )
    .map((result) => result.selected!.distanceMeters);

  const uniqueImages = new Set(
    results
      .filter(
        (result) =>
          result.status === "matched" &&
          result.selected,
      )
      .map((result) => result.selected!.id),
  );

  const averageDistance =
    distances.length > 0
      ? distances.reduce(
          (sum, value) => sum + value,
          0,
        ) / distances.length
      : 0;

  const coverage =
    targets.length > 0
      ? (matched / targets.length) * 100
      : 0;

  const report = {
    city: CITY,
    generatedAt: new Date().toISOString(),
    searchRadiusMeters: MAX_DISTANCE_METERS,
    targetPlaces: targets.length,
    matched,
    noCandidate,
    errors,
    coveragePercent: Number(coverage.toFixed(2)),
    uniqueImages: uniqueImages.size,
    averageDistanceMeters: Number(
      averageDistance.toFixed(2),
    ),
    results,
  };

  fs.writeFileSync(
    reportPath,
    JSON.stringify(report, null, 2),
  );

  console.log("");
  console.log("=== RESULT ===");
  console.log("");
  console.log(`City: ${CITY}`);
  console.log(`Target Places: ${targets.length}`);
  console.log(`Matched ≤60m: ${matched}`);
  console.log(`Coverage: ${coverage.toFixed(2)}%`);
  console.log(`Unique images: ${uniqueImages.size}`);
  console.log(`Errors: ${errors}`);
  console.log(
    `Avg distance: ${averageDistance.toFixed(2)}m`,
  );
  console.log("");
  console.log(`Report: ${reportPath}`);
  console.log("");
  console.log("=== END ===");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});