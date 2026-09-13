import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// ============================================================
// CONFIG
// ============================================================

const ROOT = path.resolve(__dirname, "..");

const MATCHED_FILE = path.join(
  ROOT,
  "logs",
  "mapillary-jakarta-matched.json",
);

const OUTPUT = path.join(
  ROOT,
  "logs",
  "mapillary-uncovered-jakarta-100.json",
);

const CHECKPOINT = path.join(
  ROOT,
  "logs",
  "mapillary-uncovered-jakarta-100-checkpoint.json",
);

const TOKEN = process.env.MAPILLARY_ACCESS_TOKEN ?? "";

if (!TOKEN) {
  throw new Error(
    "MAPILLARY_ACCESS_TOKEN is missing from .env",
  );
}

const PILOT_SIZE = 100;

// Query area around each Place.
// Exact distance is calculated afterwards.
const BBOX_DELTA = 0.001;

const MAX_DISTANCE_METERS = 60;
const MIN_QUALITY = 0.60;

const QUALITY_WEIGHT = 0.6;
const DISTANCE_WEIGHT = 0.4;

const REQUEST_DELAY_MS = 700;
const MAX_RETRIES = 3;
const API_LIMIT = 100;

// ============================================================
// TYPES
// ============================================================

type PlaceRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  city: {
    name: string;
  };
};

type MapillaryImage = {
  id: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  qualityScore: number | null;
  capturedAt: number | null;
};

type Result = {
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
  within60m: number;

  images: MapillaryImage[];

  error?: string;
};

type Checkpoint = {
  generatedAt: string;
  samplePlaceIds: string[];
  completed: string[];
  results: Result[];
};

// ============================================================
// PRISMA
// ============================================================

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from .env");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

// ============================================================
// HELPERS
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function hashScore(value: string): string {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadius = 6371000;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    );

  return earthRadius * c;
}

// ============================================================
// MAPILLARY
// ============================================================

async function fetchMapillary(
  place: PlaceRow,
): Promise<MapillaryImage[]> {
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(
      `Invalid coordinates for ${place.id}: ${latitude}, ${longitude}`,
    );
  }

  const bbox = [
    longitude - BBOX_DELTA,
    latitude - BBOX_DELTA,
    longitude + BBOX_DELTA,
    latitude + BBOX_DELTA,
  ]
    .map(String)
    .join(",");

  const fields = [
    "id",
    "computed_geometry",
    "quality_score",
    "captured_at",
  ].join(",");

  const params = new URLSearchParams({
    access_token: TOKEN,
    fields,
    bbox,
    limit: String(API_LIMIT),
  });

  const url =
    `https://graph.mapillary.com/images?${params.toString()}`;

  let lastError: Error | null = null;

  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      const body = await response.text();

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${body.slice(0, 500)}`,
        );
      }

      const json = JSON.parse(body) as {
        data?: Array<{
          id?: string;
          computed_geometry?: {
            coordinates?: [number, number];
          };
          quality_score?: number | null;
          captured_at?: number | null;
        }>;
      };

      const data = Array.isArray(json.data)
        ? json.data
        : [];

      const images: MapillaryImage[] = [];

      for (const image of data) {
        const coordinates =
          image.computed_geometry?.coordinates;

        if (
          !image.id ||
          !coordinates ||
          coordinates.length !== 2
        ) {
          continue;
        }

        const [imageLongitude, imageLatitude] =
          coordinates;

        if (
          !Number.isFinite(imageLatitude) ||
          !Number.isFinite(imageLongitude)
        ) {
          continue;
        }

        images.push({
          id: image.id,
          latitude: imageLatitude,
          longitude: imageLongitude,

          distanceMeters: distanceMeters(
            latitude,
            longitude,
            imageLatitude,
            imageLongitude,
          ),

          qualityScore:
            typeof image.quality_score === "number"
              ? image.quality_score
              : null,

          capturedAt:
            typeof image.captured_at === "number"
              ? image.captured_at
              : null,
        });
      }

      return images;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(String(error));

      console.log(
        `    Attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}`,
      );

      if (attempt < MAX_RETRIES) {
        await sleep(attempt * 1500);
      }
    }
  }

  throw (
    lastError ??
    new Error("Unknown Mapillary error")
  );
}

// ============================================================
// CHECKPOINT
// ============================================================

function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT)) {
    return null;
  }

  try {
    return JSON.parse(
      fs.readFileSync(CHECKPOINT, "utf8"),
    ) as Checkpoint;
  } catch {
    console.warn(
      "Checkpoint unreadable. Starting fresh.",
    );

    return null;
  }
}

function saveCheckpoint(
  checkpoint: Checkpoint,
): void {
  fs.writeFileSync(
    CHECKPOINT,
    JSON.stringify(checkpoint, null, 2),
    "utf8",
  );
}

// ============================================================
// SELECT BEST CANDIDATE
// ============================================================

function scoreCandidate(
  image: MapillaryImage,
): number {
  const distanceScore =
    Math.max(
      0,
      Math.min(
        1,
        1 -
          image.distanceMeters /
            MAX_DISTANCE_METERS,
      ),
    );

  const qualityScore =
    image.qualityScore ?? 0;

  return (
    QUALITY_WEIGHT * qualityScore +
    DISTANCE_WEIGHT * distanceScore
  );
}

function selectBest(
  images: MapillaryImage[],
): MapillaryImage | null {
  const eligible = images
    .filter(
      (image) =>
        image.distanceMeters <=
          MAX_DISTANCE_METERS &&
        image.qualityScore !== null &&
        image.qualityScore >= MIN_QUALITY,
    )
    .sort((a, b) => {
      const scoreDifference =
        scoreCandidate(b) -
        scoreCandidate(a);

      if (
        Math.abs(scoreDifference) >
        0.015
      ) {
        return scoreDifference;
      }

      const qualityDifference =
        (b.qualityScore ?? 0) -
        (a.qualityScore ?? 0);

      if (
        Math.abs(qualityDifference) >
        0.02
      ) {
        return qualityDifference;
      }

      return (
        a.distanceMeters -
        b.distanceMeters
      );
    });

  return eligible[0] ?? null;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("");
  console.log(
    "====================================================",
  );
  console.log(
    "CityVerse — Mapillary Uncovered Jakarta Test",
  );
  console.log(
    "====================================================",
  );
  console.log("");

  console.log(
    "Target: 100 Jakarta Places that failed bulk matching",
  );

  console.log(
    `Distance threshold: ${MAX_DISTANCE_METERS}m`,
  );

  console.log(
    `Quality threshold: ${MIN_QUALITY}`,
  );

  console.log(
    "DB writes: NONE",
  );

  console.log("");

  // ----------------------------------------------------------
  // Load bulk matching
  // ----------------------------------------------------------

  if (!fs.existsSync(MATCHED_FILE)) {
    throw new Error(
      `Missing file:\n${MATCHED_FILE}`,
    );
  }

  const matchedData = JSON.parse(
    fs.readFileSync(
      MATCHED_FILE,
      "utf8",
    ),
  ) as {
    matches?: Array<{
      placeId: string;
    }>;
  };

  if (!Array.isArray(matchedData.matches)) {
    throw new Error(
      "mapillary-jakarta-matched.json does not contain matches[]",
    );
  }

  const matchedPlaceIds = new Set(
    matchedData.matches.map(
      (match) => match.placeId,
    ),
  );

  console.log(
    `Bulk-matched Jakarta Places: ${matchedPlaceIds.size}`,
  );

  // ----------------------------------------------------------
  // Load Places
  // ----------------------------------------------------------

  const places =
    (await prisma.place.findMany({
      where: {
        city: {
          name: "Jakarta",
        },
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
    })) as unknown as PlaceRow[];

  console.log(
    `Jakarta production Places: ${places.length}`,
  );

  // ----------------------------------------------------------
  // Uncovered Places
  // ----------------------------------------------------------

  const uncovered = places.filter(
    (place) =>
      !matchedPlaceIds.has(place.id),
  );

  console.log(
    `Uncovered after bulk matching: ${uncovered.length}`,
  );

  if (uncovered.length < PILOT_SIZE) {
    throw new Error(
      `Only ${uncovered.length} uncovered Places available.`,
    );
  }

  // Deterministic sample.
  uncovered.sort(
    (a, b) =>
      hashScore(a.id).localeCompare(
        hashScore(b.id),
      ),
  );

  const sample =
    uncovered.slice(0, PILOT_SIZE);

  console.log(
    `Targeted test sample: ${sample.length}`,
  );

  console.log("");

  // ----------------------------------------------------------
  // Checkpoint
  // ----------------------------------------------------------

  let checkpoint =
    loadCheckpoint();

  const sampleIds =
    sample.map(
      (place) => place.id,
    );

  if (
    !checkpoint ||
    checkpoint.samplePlaceIds.join(",") !==
      sampleIds.join(",")
  ) {
    checkpoint = {
      generatedAt:
        new Date().toISOString(),

      samplePlaceIds:
        sampleIds,

      completed: [],

      results: [],
    };

    saveCheckpoint(checkpoint);

    console.log(
      "Created new checkpoint.",
    );
  } else {
    console.log(
      `Resuming checkpoint: ${checkpoint.completed.length}/${sample.length}`,
    );
  }

  const completed =
    new Set(checkpoint.completed);

  const resultsByPlace =
    new Map<string, Result>();

  for (const result of checkpoint.results) {
    resultsByPlace.set(
      result.placeId,
      result,
    );
  }

  // ----------------------------------------------------------
  // PREFLIGHT
  // ----------------------------------------------------------

  console.log(
    "Running Mapillary preflight...",
  );

  const preflight =
    sample[0];

  const preflightImages =
    await fetchMapillary(preflight);

  console.log(
    `✓ Preflight OK — ${preflightImages.length} images returned`,
  );

  if (preflightImages.length) {
    console.log(
      `  Nearest: ${Math.min(
        ...preflightImages.map(
          (image) =>
            image.distanceMeters,
        ),
      ).toFixed(2)}m`,
    );
  }

  console.log("");

  // ----------------------------------------------------------
  // API LOOP
  // ----------------------------------------------------------

  let processed =
    completed.size;

  for (const place of sample) {
    if (completed.has(place.id)) {
      continue;
    }

    processed++;

    console.log(
      `[${processed}/${sample.length}] ${place.name}`,
    );

    try {
      const images =
        await fetchMapillary(place);

      const sorted =
        [...images].sort(
          (a, b) =>
            a.distanceMeters -
            b.distanceMeters,
        );

      const result: Result = {
        placeId: place.id,
        name: place.name,
        city: place.city.name,
        latitude: Number(place.latitude),
        longitude: Number(place.longitude),

        status:
          images.length > 0
            ? "images"
            : "no_images",

        imageCount: images.length,

        nearestDistanceMeters:
          sorted.length
            ? round(
                sorted[0]
                  .distanceMeters,
                2,
              )
            : null,

        within10m:
          images.filter(
            (image) =>
              image.distanceMeters <=
              10,
          ).length,

        within25m:
          images.filter(
            (image) =>
              image.distanceMeters <=
              25,
          ).length,

        within50m:
          images.filter(
            (image) =>
              image.distanceMeters <=
              50,
          ).length,

        within60m:
          images.filter(
            (image) =>
              image.distanceMeters <=
              60,
          ).length,

        images:
          images.map(
            (image) => ({
              ...image,
              distanceMeters:
                round(
                  image.distanceMeters,
                  2,
                ),
            }),
          ),
      };

      resultsByPlace.set(
        place.id,
        result,
      );

      checkpoint.completed.push(
        place.id,
      );

      checkpoint.results =
        [...resultsByPlace.values()];

      saveCheckpoint(checkpoint);

      const best =
        selectBest(images);

      console.log(
        `    Images: ${images.length}`,
      );

      console.log(
        `    Nearest: ${
          result.nearestDistanceMeters ??
          "none"
        }m`,
      );

      console.log(
        `    Selected: ${
          best
            ? `YES (${best.distanceMeters.toFixed(
                2,
              )}m, Q=${best.qualityScore})`
            : "NO"
        }`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.log(
        `    ERROR: ${message}`,
      );

      const result: Result = {
        placeId: place.id,
        name: place.name,
        city: place.city.name,
        latitude: Number(place.latitude),
        longitude: Number(place.longitude),

        status: "error",

        imageCount: 0,
        nearestDistanceMeters: null,

        within10m: 0,
        within25m: 0,
        within50m: 0,
        within60m: 0,

        images: [],

        error: message,
      };

      resultsByPlace.set(
        place.id,
        result,
      );

      checkpoint.results =
        [...resultsByPlace.values()];

      saveCheckpoint(checkpoint);
    }

    await sleep(
      REQUEST_DELAY_MS,
    );
  }

  // ----------------------------------------------------------
  // FINAL ANALYSIS
  // ----------------------------------------------------------

  const results = sample
    .map((place) =>
      resultsByPlace.get(place.id),
    )
    .filter(
      (result): result is Result =>
        Boolean(result),
    );

  const successful =
    results.filter(
      (result) =>
        result.status !== "error",
    );

  const withImages =
    successful.filter(
      (result) =>
        result.status === "images",
    );

  const selected =
    results
      .map((result) => ({
        result,
        image: selectBest(result.images),
      }))
      .filter(
        (
          item,
        ): item is {
          result: Result;
          image: MapillaryImage;
        } => Boolean(item.image),
      );

  const uniqueSelected =
    new Set(
      selected.map(
        (item) => item.image.id,
      ),
    );

  const avgDistance =
    selected.length
      ? selected.reduce(
          (sum, item) =>
            sum +
            item.image.distanceMeters,
          0,
        ) / selected.length
      : 0;

  const avgQuality =
    selected.length
      ? selected.reduce(
          (sum, item) =>
            sum +
            (item.image.qualityScore ?? 0),
          0,
        ) / selected.length
      : 0;

  const selectionRate =
    results.length
      ? selected.length /
        results.length
      : 0;

  const report = {
    generatedAt:
      new Date().toISOString(),

    purpose:
      "Targeted Mapillary test on Jakarta Places not matched by the bulk spatial scan.",

    configuration: {
      sampleSize: sample.length,
      maxDistanceMeters:
        MAX_DISTANCE_METERS,
      minQuality:
        MIN_QUALITY,
      bboxDelta:
        BBOX_DELTA,
      qualityWeight:
        QUALITY_WEIGHT,
      distanceWeight:
        DISTANCE_WEIGHT,
    },

    source: {
      bulkMatchedPlaces:
        matchedPlaceIds.size,
      uncoveredPlaces:
        uncovered.length,
      testedPlaces:
        sample.length,
    },

    summary: {
      placesTested:
        results.length,

      successful:
        successful.length,

      errors:
        results.length -
        successful.length,

      placesWithImages:
        withImages.length,

      placesSelected:
        selected.length,

      imageCoveragePercent:
        successful.length
          ? round(
              (withImages.length /
                successful.length) *
                100,
              2,
            )
          : 0,

      selectionRatePercent:
        round(
          selectionRate * 100,
          2,
        ),

      projected40k:
        Math.round(
          selectionRate * 40000,
        ),

      uniqueSelectedImages:
        uniqueSelected.size,

      duplicateSelectedImages:
        selected.length -
        uniqueSelected.size,

      averageSelectedDistanceMeters:
        round(avgDistance, 2),

      averageSelectedQuality:
        round(avgQuality, 4),
    },

    results,

    selections:
      selected.map(
        (item) => ({
          placeId:
            item.result.placeId,

          placeName:
            item.result.name,

          imageId:
            item.image.id,

          distanceMeters:
            round(
              item.image.distanceMeters,
              2,
            ),

          qualityScore:
            item.image.qualityScore,

          capturedAt:
            item.image.capturedAt,
        }),
      ),
  };

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(
      report,
      null,
      2,
    ),
    "utf8",
  );

  console.log("");
  console.log(
    "====================================================",
  );
  console.log(
    "TARGETED 100 RESULT",
  );
  console.log(
    "====================================================",
  );

  console.log(
    `Places tested:       ${results.length}`,
  );

  console.log(
    `Successful:          ${successful.length}`,
  );

  console.log(
    `Errors:               ${
      results.length -
      successful.length
    }`,
  );

  console.log(
    `With images:          ${withImages.length}`,
  );

  console.log(
    `Selected Q>=0.60:     ${selected.length}`,
  );

  console.log(
    `Selection rate:       ${(selectionRate * 100).toFixed(2)}%`,
  );

  console.log(
    `Projected 40K:        ${Math.round(
      selectionRate * 40000,
    )}`,
  );

  console.log(
    `Unique selected:      ${uniqueSelected.size}`,
  );

  console.log(
    `Duplicate selected:   ${
      selected.length -
      uniqueSelected.size
    }`,
  );

  console.log(
    `Avg distance:         ${avgDistance.toFixed(
      2,
    )}m`,
  );

  console.log(
    `Avg quality:          ${avgQuality.toFixed(
      3,
    )}`,
  );

  console.log("");

  console.log(
    `Output: ${OUTPUT}`,
  );

  console.log(
    `Checkpoint: ${CHECKPOINT}`,
  );

  console.log("");

  console.log(
    "✓ NO DATABASE WRITES.",
  );

  console.log(
    "✓ PlaceImage was NOT modified.",
  );

  console.log(
    "✓ mapillary-pilot-2.ts was NOT modified.",
  );

  console.log(
    "====================================================",
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("");
  console.error(
    "TARGETED TEST FAILED",
  );
  console.error(error);

  try {
    await prisma.$disconnect();
  } catch {
    // Ignore disconnect errors.
  }

  process.exit(1);
});
