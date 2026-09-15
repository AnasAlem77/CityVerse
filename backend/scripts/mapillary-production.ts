import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// ============================================================
// CITYVERSE — MAPILLARY PRODUCTION IMAGE ACQUISITION
// ============================================================
//
// Safe production pipeline:
//
// Place
//   ↓
// targeted Mapillary bbox
//   ↓
// distance <= 60m
//   ↓
// quality >= 0.60
//   ↓
// best candidate
//   ↓
// thumbnail verification
//   ↓
// PlaceImage
//
// IMPORTANT:
// - Does NOT delete existing PlaceImage records.
// - Does NOT modify mapillary-pilot-2.ts.
// - Resumable through checkpoint.
// - City is selected with --city.
// - Default mode is DRY RUN.
// - Use --write to enable database writes.
// ============================================================

const ROOT = path.resolve(__dirname, "..");

const TOKEN = process.env.MAPILLARY_ACCESS_TOKEN ?? "";
const DATABASE_URL = process.env.DATABASE_URL ?? "";

if (!TOKEN) {
  throw new Error("MAPILLARY_ACCESS_TOKEN is missing from .env");
}

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from .env");
}

// ============================================================
// CONFIG
// ============================================================

const DEFAULT_CITY = "Paris";

const BBOX_DELTA = 0.001;

const MAX_DISTANCE_METERS = 60;

const MIN_QUALITY = 0.60;

const QUALITY_WEIGHT = 0.60;
const DISTANCE_WEIGHT = 0.40;

const REQUEST_DELAY_MS = 700;
const MAX_RETRIES = 3;
const API_LIMIT = 100;

const THUMBNAIL_TIMEOUT_MS = 20_000;

const OUTPUT_DIR = path.join(
  ROOT,
  "logs",
  "mapillary-production",
);

fs.mkdirSync(OUTPUT_DIR, {
  recursive: true,
});

// ============================================================
// CLI
// ============================================================

const args = process.argv.slice(2);

function getArg(name: string): string | null {
  const index = args.indexOf(name);

  if (index === -1) {
    return null;
  }

  return args[index + 1] ?? null;
}

function hasFlag(name: string): boolean {
  return args.includes(name);
}

const CITY = getArg("--city") ?? DEFAULT_CITY;

const WRITE_MODE = hasFlag("--write");

const RESET_CHECKPOINT = hasFlag("--reset");

const citySlug = CITY.toLowerCase().replace(
  /[^a-z0-9]+/g,
  "-",
);

const CHECKPOINT = path.join(
  OUTPUT_DIR,
  `${citySlug}-checkpoint.json`,
);

const REPORT = path.join(
  OUTPUT_DIR,
  `${citySlug}-report.json`,
);

// ============================================================
// PRISMA
// ============================================================

const adapter = new PrismaPg({
  connectionString: DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

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

  thumbnailUrl: string | null;

  width: number | null;

  height: number | null;

  creatorUsername: string | null;
};

type Candidate = MapillaryImage & {
  score: number;
  distanceScore: number;
  normalizedQuality: number;
  recencyScore: number;
};

type PlaceResult = {
  placeId: string;
  placeName: string;
  city: string;

  status:
    | "selected"
    | "no_candidate"
    | "existing_image"
    | "error";

  selected: Candidate | null;

  candidateCount: number;

  error?: string;
};

type Checkpoint = {
  city: string;

  generatedAt: string;

  completed: string[];

  results: PlaceResult[];
};

// ============================================================
// HELPERS
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, ms),
  );
}

function round(
  value: number,
  decimals = 4,
): number {
  const factor = 10 ** decimals;

  return (
    Math.round(value * factor) / factor
  );
}

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadius = 6371000;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return (
    earthRadius *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    )
  );
}

function scoreHash(value: string): string {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

// ============================================================
// RECENCY
// ============================================================

function recencyScore(
  capturedAt: number | null,
): number {
  if (
    capturedAt === null ||
    !Number.isFinite(capturedAt)
  ) {
    return 0;
  }

  const ageDays =
    (Date.now() - capturedAt) /
    (1000 * 60 * 60 * 24);

  if (ageDays <= 180) return 1;
  if (ageDays <= 365) return 0.8;
  if (ageDays <= 730) return 0.6;
  if (ageDays <= 1095) return 0.4;
  if (ageDays <= 1825) return 0.2;

  return 0;
}

// ============================================================
// MAPILLARY API
// ============================================================

async function fetchMapillary(
  place: PlaceRow,
): Promise<MapillaryImage[]> {
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error(
      `Invalid coordinates for ${place.id}`,
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
    "thumb_1024_url",
    "thumb_2048_url",
    "thumb_original_url",
    "width",
    "height",
    "creator",
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
          `HTTP ${response.status}: ${body.slice(
            0,
            500,
          )}`,
        );
      }

      const json = JSON.parse(body) as {
        data?: Array<{
          id?: string;

          computed_geometry?: {
            coordinates?: number[];
          };

          quality_score?: number | null;

          captured_at?: number | null;

          thumb_1024_url?: string | null;

          thumb_2048_url?: string | null;

          thumb_original_url?: string | null;

          width?: number | null;

          height?: number | null;

          creator?: {
            username?: string | null;
            id?: string | null;
          } | null;
        }>;
      };

      const images: MapillaryImage[] = [];

      for (const image of json.data ?? []) {
        const coordinates =
          image.computed_geometry?.coordinates;

        if (
          !image.id ||
          !coordinates ||
          coordinates.length !== 2
        ) {
          continue;
        }

        const imageLongitude =
          Number(coordinates[0]);

        const imageLatitude =
          Number(coordinates[1]);

        if (
          !Number.isFinite(imageLatitude) ||
          !Number.isFinite(imageLongitude)
        ) {
          continue;
        }

        const distance =
          distanceMeters(
            latitude,
            longitude,
            imageLatitude,
            imageLongitude,
          );

        const thumbnailUrl =
          image.thumb_2048_url ??
          image.thumb_1024_url ??
          image.thumb_original_url ??
          null;

        images.push({
          id: image.id,

          latitude: imageLatitude,

          longitude: imageLongitude,

          distanceMeters: distance,

          qualityScore:
            typeof image.quality_score ===
            "number"
              ? image.quality_score
              : null,

          capturedAt:
            typeof image.captured_at ===
            "number"
              ? image.captured_at
              : null,

          thumbnailUrl,

          width:
            typeof image.width ===
            "number"
              ? image.width
              : null,

          height:
            typeof image.height ===
            "number"
              ? image.height
              : null,

          creatorUsername:
            image.creator?.username ??
            null,
        });
      }

      return images;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(String(error));

      console.log(
        `    Mapillary ${attempt}/${MAX_RETRIES}: ${lastError.message}`,
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
// CANDIDATE SCORING
// ============================================================

function normalizedQuality(
  quality: number | null,
): number {
  if (
    quality === null ||
    !Number.isFinite(quality)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(1, quality),
  );
}

function distanceScore(
  distance: number,
): number {
  if (
    distance >=
    MAX_DISTANCE_METERS
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      1,
      1 -
        distance /
          MAX_DISTANCE_METERS,
    ),
  );
}

function scoreCandidate(
  image: MapillaryImage,
): Candidate {
  const q =
    normalizedQuality(
      image.qualityScore,
    );

  const d =
    distanceScore(
      image.distanceMeters,
    );

  const r =
    recencyScore(
      image.capturedAt,
    );

  return {
    ...image,

    score:
      QUALITY_WEIGHT * q +
      DISTANCE_WEIGHT * d,

    distanceScore: d,

    normalizedQuality: q,

    recencyScore: r,
  };
}

function compareCandidates(
  a: Candidate,
  b: Candidate,
): number {
  const scoreDifference =
    b.score - a.score;

  if (
    Math.abs(scoreDifference) >
    0.015
  ) {
    return scoreDifference;
  }

  const qualityDifference =
    b.normalizedQuality -
    a.normalizedQuality;

  if (
    Math.abs(qualityDifference) >
    0.02
  ) {
    return qualityDifference;
  }

  const distanceDifference =
    a.distanceMeters -
    b.distanceMeters;

  if (
    Math.abs(distanceDifference) >
    2
  ) {
    return distanceDifference;
  }

  const recencyDifference =
    b.recencyScore -
    a.recencyScore;

  if (
    Math.abs(recencyDifference) >
    0.05
  ) {
    return recencyDifference;
  }

  return a.id.localeCompare(b.id);
}

// ============================================================
// EXISTING PLACE IMAGE CHECK
// ============================================================

async function getPlacesWithImages(
  placeIds: string[],
): Promise<Set<string>> {
  const result =
    new Set<string>();

  const rows =
    await prisma.placeImage.findMany({
      where: {
        placeId: {
          in: placeIds,
        },
      },
      select: {
        placeId: true,
      },
      distinct: ["placeId"],
    });

  for (const row of rows) {
    result.add(row.placeId);
  }

  return result;
}

// ============================================================
// IMAGE VERIFICATION
// ============================================================

async function verifyThumbnail(
  url: string,
): Promise<boolean> {
  const controller =
    new AbortController();

  const timeout = setTimeout(
    () =>
      controller.abort(),
    THUMBNAIL_TIMEOUT_MS,
  );

  try {
    const response =
      await fetch(url, {
        method: "GET",
        headers: {
          Accept: "image/*",
        },
        signal:
          controller.signal,
      });

    if (!response.ok) {
      return false;
    }

    const contentType =
      response.headers.get(
        "content-type",
      ) ?? "";

    return contentType
      .toLowerCase()
      .startsWith("image/");
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// CHECKPOINT
// ============================================================

function loadCheckpoint():
  | Checkpoint
  | null {
  if (
    RESET_CHECKPOINT ||
    !fs.existsSync(CHECKPOINT)
  ) {
    return null;
  }

  try {
    return JSON.parse(
      fs.readFileSync(
        CHECKPOINT,
        "utf8",
      ),
    ) as Checkpoint;
  } catch {
    console.warn(
      "Invalid checkpoint. Starting fresh.",
    );

    return null;
  }
}

function saveCheckpoint(
  checkpoint: Checkpoint,
): void {
  fs.writeFileSync(
    CHECKPOINT,
    JSON.stringify(
      checkpoint,
      null,
      2,
    ),
    "utf8",
  );
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
    "CITYVERSE — MAPILLARY PRODUCTION",
  );
  console.log(
    "====================================================",
  );

  console.log(`City: ${CITY}`);

  console.log(
    `Mode: ${
      WRITE_MODE
        ? "DATABASE WRITE"
        : "DRY RUN"
    }`,
  );

  console.log(
    `Distance: <= ${MAX_DISTANCE_METERS}m`,
  );

  console.log(
    `Quality: >= ${MIN_QUALITY}`,
  );

  console.log("");

  if (!WRITE_MODE) {
    console.log(
      "DRY RUN: no PlaceImage records will be created.",
    );
    console.log(
      "Use --write only after reviewing the dry-run result.",
    );
    console.log("");
  }

  // ----------------------------------------------------------
  // LOAD CITY PLACES
  // ----------------------------------------------------------

  const places =
    (await prisma.place.findMany({
      where: {
        city: {
          name: CITY,
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

      orderBy: {
        id: "asc",
      },
    })) as unknown as PlaceRow[];

  console.log(
    `Production Places in ${CITY}: ${places.length}`,
  );

  if (!places.length) {
    throw new Error(
      `No Places found for city "${CITY}".`,
    );
  }

  // ----------------------------------------------------------
  // EXISTING IMAGES
  // ----------------------------------------------------------

  const existingImages =
    await getPlacesWithImages(
      places.map(
        (place) => place.id,
      ),
    );

  console.log(
    `Places already having images: ${existingImages.size}`,
  );

  console.log(
    `Places requiring Mapillary attempt: ${
      places.length -
      existingImages.size
    }`,
  );

  console.log("");

  // ----------------------------------------------------------
  // CHECKPOINT
  // ----------------------------------------------------------

  let checkpoint =
    loadCheckpoint();

  if (
    !checkpoint ||
    checkpoint.city !== CITY
  ) {
    checkpoint = {
      city: CITY,

      generatedAt:
        new Date().toISOString(),

      completed: [],

      results: [],
    };

    saveCheckpoint(
      checkpoint,
    );

    console.log(
      "Created new production checkpoint.",
    );
  } else {
    console.log(
      `Resuming checkpoint: ${checkpoint.completed.length} completed.`,
    );
  }

  const completed =
    new Set(
      checkpoint.completed,
    );

  const results =
    new Map<string, PlaceResult>();

  for (
    const result of checkpoint.results
  ) {
    results.set(
      result.placeId,
      result,
    );
  }

  // ----------------------------------------------------------
  // GLOBAL IMAGE USAGE
  // ----------------------------------------------------------

  const selectedImageIds =
    new Set<string>();

  for (
    const result of results.values()
  ) {
    if (
      result.selected
    ) {
      selectedImageIds.add(
        result.selected.id,
      );
    }
  }

  // ----------------------------------------------------------
  // PROCESS PLACES
  // ----------------------------------------------------------

  let processed =
    completed.size;

  let selectedCount = 0;

  let existingCount = 0;

  let rejectedCount = 0;

  let errorCount = 0;

  for (const place of places) {
    if (
      completed.has(place.id)
    ) {
      continue;
    }

    processed++;

    console.log(
      `[${processed}/${places.length}] ${place.name}`,
    );

    // --------------------------------------------------------
    // Existing image
    // --------------------------------------------------------

    if (
      existingImages.has(
        place.id,
      )
    ) {
      const result: PlaceResult =
        {
          placeId:
            place.id,

          placeName:
            place.name,

          city:
            place.city.name,

          status:
            "existing_image",

          selected:
            null,

          candidateCount: 0,
        };

      results.set(
        place.id,
        result,
      );

      checkpoint.completed.push(
        place.id,
      );

      checkpoint.results =
        [...results.values()];

      saveCheckpoint(
        checkpoint,
      );

      existingCount++;

      console.log(
        "    Existing PlaceImage — skipped",
      );

      continue;
    }

    try {
      const images =
        await fetchMapillary(
          place,
        );

      const candidates =
        images
          .filter(
            (image) =>
              image.distanceMeters <=
                MAX_DISTANCE_METERS &&
              image.qualityScore !==
                null &&
              image.qualityScore >=
                MIN_QUALITY &&
              image.thumbnailUrl,
          )
          .map(scoreCandidate)
          .sort(compareCandidates);

      // Prefer a unique image.
      const uniqueCandidates =
        candidates.filter(
          (candidate) =>
            !selectedImageIds.has(
              candidate.id,
            ),
        );

      const pool =
        uniqueCandidates.length
          ? uniqueCandidates
          : candidates;

      let chosen:
        | Candidate
        | null =
        null;

      // Verify candidates in score order.
      for (const candidate of pool) {
        if (
          !candidate.thumbnailUrl
        ) {
          continue;
        }

        const valid =
          await verifyThumbnail(
            candidate.thumbnailUrl,
          );

        if (valid) {
          chosen = candidate;
          break;
        }
      }

      if (!chosen) {
        const result: PlaceResult =
          {
            placeId:
              place.id,

            placeName:
              place.name,

            city:
              place.city.name,

            status:
              "no_candidate",

            selected:
              null,

            candidateCount:
              candidates.length,
          };

        results.set(
          place.id,
          result,
        );

        checkpoint.completed.push(
          place.id,
        );

        checkpoint.results =
          [...results.values()];

        saveCheckpoint(
          checkpoint,
        );

        rejectedCount++;

        console.log(
          `    No valid candidate (${candidates.length} eligible)`,
        );
      } else {
        selectedImageIds.add(
          chosen.id,
        );

        const result: PlaceResult =
          {
            placeId:
              place.id,

            placeName:
              place.name,

            city:
              place.city.name,

            status:
              "selected",

            selected:
              chosen,

            candidateCount:
              candidates.length,
          };

        results.set(
          place.id,
          result,
        );

        checkpoint.completed.push(
          place.id,
        );

        checkpoint.results =
          [...results.values()];

        saveCheckpoint(
          checkpoint,
        );

        selectedCount++;

        console.log(
          `    ✓ ${chosen.distanceMeters.toFixed(
            1,
          )}m | Q=${chosen.qualityScore?.toFixed(
            3,
          )} | ${chosen.id}`,
        );

        // ------------------------------------------------------
        // DATABASE WRITE
        // ------------------------------------------------------

        if (WRITE_MODE) {
          const sourceUrl =
            `https://www.mapillary.com/app/?pKey=${chosen.id}`;

          const attribution =
            chosen.creatorUsername
              ? `Mapillary image by ${chosen.creatorUsername}, licensed under CC BY-SA`
              : `Mapillary image ${chosen.id}, licensed under CC BY-SA`;

          await prisma.placeImage.create({
            data: {
              url:
                chosen.thumbnailUrl!,

              placeId:
                place.id,

              source:
                "mapillary",

              sourceUrl,

              license:
                "CC BY-SA",

              author:
                chosen.creatorUsername,

              attribution,

              width:
                chosen.width,

              height:
                chosen.height,
            },
          });

          console.log(
            "    ✓ PlaceImage created",
          );
        }
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      const result: PlaceResult =
        {
          placeId:
            place.id,

          placeName:
            place.name,

          city:
            place.city.name,

          status:
            "error",

          selected:
            null,

          candidateCount: 0,

          error: message,
        };

      results.set(
        place.id,
        result,
      );

      checkpoint.completed.push(
        place.id,
      );

      checkpoint.results =
        [...results.values()];

      saveCheckpoint(
        checkpoint,
      );

      errorCount++;

      console.log(
        `    ERROR: ${message}`,
      );
    }

    await sleep(
      REQUEST_DELAY_MS,
    );
  }

  // ----------------------------------------------------------
  // FINAL REPORT
  // ----------------------------------------------------------

  const allResults =
    [...results.values()];

  const selected =
    allResults.filter(
      (result) =>
        result.status ===
        "selected",
    );

  const existing =
    allResults.filter(
      (result) =>
        result.status ===
        "existing_image",
    );

  const rejected =
    allResults.filter(
      (result) =>
        result.status ===
        "no_candidate",
    );

  const errors =
    allResults.filter(
      (result) =>
        result.status ===
        "error",
    );

  const selectedDistances =
    selected
      .map(
        (result) =>
          result.selected
            ?.distanceMeters,
      )
      .filter(
        (
          value,
        ): value is number =>
          typeof value ===
          "number",
      );

  const selectedQualities =
    selected
      .map(
        (result) =>
          result.selected
            ?.normalizedQuality,
      )
      .filter(
        (
          value,
        ): value is number =>
          typeof value ===
          "number",
      );

  const report = {
    generatedAt:
      new Date().toISOString(),

    city: CITY,

    writeMode:
      WRITE_MODE,

    configuration: {
      maxDistanceMeters:
        MAX_DISTANCE_METERS,

      minQuality:
        MIN_QUALITY,

      qualityWeight:
        QUALITY_WEIGHT,

      distanceWeight:
        DISTANCE_WEIGHT,

      requestDelayMs:
        REQUEST_DELAY_MS,
    },

    summary: {
      totalPlaces:
        places.length,

      alreadyHadImage:
        existing.length,

      selected:
        selected.length,

      rejected:
        rejected.length,

      errors:
        errors.length,

      newCoveragePercent:
        round(
          places.length > 0
            ? (selected.length /
                places.length) *
                100
            : 0,
          2,
        ),

      averageDistanceMeters:
        round(
          selectedDistances.length
            ? selectedDistances.reduce(
                (sum, value) =>
                  sum + value,
                0,
              ) /
                selectedDistances.length
            : 0,
          2,
        ),

      averageQuality:
        round(
          selectedQualities.length
            ? selectedQualities.reduce(
                (sum, value) =>
                  sum + value,
                0,
              ) /
                selectedQualities.length
            : 0,
          4,
        ),
    },

    results: allResults,
  };

  fs.writeFileSync(
    REPORT,
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
    "PRODUCTION RESULT",
  );
  console.log(
    "====================================================",
  );

  console.log(
    `City:             ${CITY}`,
  );

  console.log(
    `Places:           ${places.length}`,
  );

  console.log(
    `Existing images:  ${existing.length}`,
  );

  console.log(
    `Selected:         ${selected.length}`,
  );

  console.log(
    `Rejected:         ${rejected.length}`,
  );

  console.log(
    `Errors:            ${errors.length}`,
  );

  console.log(
    `New coverage:     ${
      report.summary.newCoveragePercent
    }%`,
  );

  console.log(
    `Avg distance:     ${report.summary.averageDistanceMeters}m`,
  );

  console.log(
    `Avg quality:      ${report.summary.averageQuality}`,
  );

  console.log("");

  console.log(
    `Report: ${REPORT}`,
  );

  console.log(
    `Checkpoint: ${CHECKPOINT}`,
  );

  console.log("");

  if (WRITE_MODE) {
    console.log(
      "DATABASE: PlaceImage records WERE written.",
    );
  } else {
    console.log(
      "DATABASE: DRY RUN — no PlaceImage records were written.",
    );
  }

  console.log(
    "====================================================",
  );

  await prisma.$disconnect();
}

main().catch(
  async (error) => {
    console.error("");
    console.error(
      "MAPILLARY PRODUCTION FAILED",
    );
    console.error(error);

    try {
      await prisma.$disconnect();
    } catch {
      // Ignore disconnect errors.
    }

    process.exit(1);
  },
);