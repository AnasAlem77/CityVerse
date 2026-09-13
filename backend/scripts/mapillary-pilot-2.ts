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

const PREVIOUS_AUDIT = path.join(
  ROOT,
  "logs",
  "mapillary-audit-1000.json",
);

const OUTPUT_AUDIT = path.join(
  ROOT,
  "logs",
  "mapillary-pilot-2-audit-1000.json",
);

const OUTPUT_SCORING = path.join(
  ROOT,
  "logs",
  "mapillary-pilot-2-scoring-1000.json",
);

const CHECKPOINT = path.join(
  ROOT,
  "logs",
  "mapillary-pilot-2-checkpoint.json",
);

const TOKEN: string =
  process.env.MAPILLARY_ACCESS_TOKEN ?? "";

if (!TOKEN) {
  throw new Error(
    "MAPILLARY_ACCESS_TOKEN is missing from .env",
  );
}

const MAPILLARY_TOKEN: string = TOKEN;

// Pilot size.
const PILOT_SIZE = 1000;

// Mapillary bbox.
// This is intentionally a little wider than 50m.
// We calculate exact distance afterwards.
const BBOX_DELTA = 0.001;

// Maximum accepted distance.
const MAX_DISTANCE_METERS = 50;

// Minimum Mapillary quality.
const MIN_QUALITY = 0.6;

// Scoring weights.
const QUALITY_WEIGHT = 0.6;
const DISTANCE_WEIGHT = 0.4;

// API behavior.
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

type PilotResult = {
  placeId: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;

  status:
    | "images"
    | "no_images"
    | "error";

  imageCount: number;

  nearestDistanceMeters:
    | number
    | null;

  within10m: number;
  within25m: number;
  within50m: number;
  within100m: number;

  uniqueImages: number;

  bestQuality:
    | number
    | null;

  averageQuality:
    | number
    | null;

  images: MapillaryImage[];

  error?: string;
};

type Checkpoint = {
  generatedAt: string;

  samplePlaceIds: string[];

  completed: string[];

  results: PilotResult[];
};

// ============================================================
// PRISMA
// ============================================================

const connectionString =
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is missing from .env",
  );
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

function sleep(
  ms: number,
): Promise<void> {
  return new Promise(
    (resolve) =>
      setTimeout(resolve, ms),
  );
}

function round(
  value: number,
  decimals = 4,
): number {
  const factor = 10 ** decimals;

  return (
    Math.round(value * factor) /
    factor
  );
}

function average(
  values: number[],
): number {
  if (!values.length) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) / values.length
  );
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

// ============================================================
// DISTANCE
// ============================================================

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadius = 6371000;

  const dLat =
    ((lat2 - lat1) *
      Math.PI) /
    180;

  const dLon =
    ((lon2 - lon1) *
      Math.PI) /
    180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(
      (lat1 * Math.PI) / 180,
    ) *
      Math.cos(
        (lat2 * Math.PI) / 180,
      ) *
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
// DETERMINISTIC HASH
// ============================================================

function hashScore(
  value: string,
): string {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

// ============================================================
// MAPILLARY API
// ============================================================

async function fetchMapillary(
  place: PlaceRow,
): Promise<MapillaryImage[]> {
  // Prisma can return Decimal-backed coordinate values at runtime.
  // Convert explicitly to primitive JavaScript numbers before
  // building the Mapillary bbox.
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
      `Invalid Place coordinates: ` +
      `place=${place.id} ` +
      `name="${place.name}" ` +
      `latitude=${String(place.latitude)} ` +
      `longitude=${String(place.longitude)}`,
    );
  }

  const west = longitude - BBOX_DELTA;
  const south = latitude - BBOX_DELTA;
  const east = longitude + BBOX_DELTA;
  const north = latitude + BBOX_DELTA;

  const bboxValues = [
    west,
    south,
    east,
    north,
  ];

  if (
    bboxValues.some(
      (value) => !Number.isFinite(value),
    )
  ) {
    throw new Error(
      `Invalid bbox: ` +
      `place=${place.id} ` +
      `lat=${latitude} ` +
      `lon=${longitude} ` +
      `bbox=${bboxValues.join(",")}`,
    );
  }

  const bbox = bboxValues
    .map((value) => value.toString())
    .join(",");

  const fields = [
    "id",
    "computed_geometry",
    "quality_score",
    "captured_at",
  ].join(",");

  const params = new URLSearchParams({
    access_token: MAPILLARY_TOKEN,
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
          `HTTP ${response.status}: ${body.slice(0, 1000)}`,
        );
      }

      let json: {
        data?: Array<{
          id?: string;

          computed_geometry?: {
            coordinates?: [
              number,
              number,
            ];
          };

          quality_score?: number | null;

          captured_at?: number | null;
        }>;
      };

      try {
        json = JSON.parse(body);
      } catch {
        throw new Error(
          `Mapillary returned non-JSON response: ${body.slice(
            0,
            500,
          )}`,
        );
      }

      const data =
        Array.isArray(json.data)
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

        const [
          imageLongitude,
          imageLatitude,
        ] = coordinates;

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

        images.push({
          id: image.id,
          latitude: imageLatitude,
          longitude: imageLongitude,
          distanceMeters: distance,

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
        `    Mapillary attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}`,
      );

      if (attempt < MAX_RETRIES) {
        await sleep(attempt * 1500);
      }
    }
  }

  throw (
    lastError ??
    new Error("Unknown Mapillary API error")
  );
}

// ============================================================
// BUILD RESULT
// ============================================================

function buildResult(
  place: PlaceRow,
  images: MapillaryImage[],
): PilotResult {
  const sorted =
    [...images].sort(
      (a, b) =>
        a.distanceMeters -
        b.distanceMeters,
    );

  const qualityValues =
    images
      .map(
        (image) =>
          image.qualityScore,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null &&
          Number.isFinite(value),
      );

  return {
    placeId: place.id,

    name: place.name,

    city:
      place.city.name,

    latitude:
      place.latitude,

    longitude:
      place.longitude,

    status:
      images.length > 0
        ? "images"
        : "no_images",

    imageCount:
      images.length,

    nearestDistanceMeters:
      sorted.length > 0
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

    within100m:
      images.filter(
        (image) =>
          image.distanceMeters <=
          100,
      ).length,

    uniqueImages:
      new Set(
        images.map(
          (image) =>
            image.id,
        ),
      ).size,

    bestQuality:
      qualityValues.length
        ? Math.max(
            ...qualityValues,
          )
        : null,

    averageQuality:
      qualityValues.length
        ? round(
            average(
              qualityValues,
            ),
            4,
          )
        : null,

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
}

// ============================================================
// SCORING
// ============================================================

function distanceScore(
  distance: number,
): number {
  if (
    distance >=
    MAX_DISTANCE_METERS
  ) {
    return 0;
  }

  return clamp(
    1 -
      distance /
        MAX_DISTANCE_METERS,
    0,
    1,
  );
}

function qualityScore(
  quality: number | null,
): number {
  if (
    quality === null ||
    !Number.isFinite(
      quality,
    )
  ) {
    return 0;
  }

  return clamp(
    quality,
    0,
    1,
  );
}

function recencyScore(
  capturedAt: number | null,
): number {
  if (
    capturedAt === null ||
    !Number.isFinite(
      capturedAt,
    )
  ) {
    return 0;
  }

  const ageMs =
    Date.now() -
    capturedAt;

  if (ageMs < 0) {
    return 0;
  }

  const ageDays =
    ageMs /
    (1000 * 60 * 60 * 24);

  if (ageDays <= 180)
    return 1;

  if (ageDays <= 365)
    return 0.8;

  if (ageDays <= 730)
    return 0.6;

  if (ageDays <= 1095)
    return 0.4;

  if (ageDays <= 1825)
    return 0.2;

  return 0;
}

type ScoredCandidate =
  MapillaryImage & {
    score: number;
    distanceScore: number;
    qualityScoreNormalized: number;
    recencyScore: number;
  };

function scoreCandidate(
  image: MapillaryImage,
): ScoredCandidate {
  const d =
    distanceScore(
      image.distanceMeters,
    );

  const q =
    qualityScore(
      image.qualityScore,
    );

  const r =
    recencyScore(
      image.capturedAt,
    );

  const score =
    QUALITY_WEIGHT * q +
    DISTANCE_WEIGHT * d;

  return {
    ...image,

    score,

    distanceScore: d,

    qualityScoreNormalized: q,

    recencyScore: r,
  };
}

function compareCandidates(
  a: ScoredCandidate,
  b: ScoredCandidate,
): number {
  const scoreDifference =
    b.score - a.score;

  if (
    Math.abs(
      scoreDifference,
    ) > 0.015
  ) {
    return scoreDifference;
  }

  const qualityDifference =
    b.qualityScoreNormalized -
    a.qualityScoreNormalized;

  if (
    Math.abs(
      qualityDifference,
    ) > 0.02
  ) {
    return qualityDifference;
  }

  const distanceDifference =
    a.distanceMeters -
    b.distanceMeters;

  if (
    Math.abs(
      distanceDifference,
    ) > 2
  ) {
    return distanceDifference;
  }

  const recencyDifference =
    b.recencyScore -
    a.recencyScore;

  if (
    Math.abs(
      recencyDifference,
    ) > 0.05
  ) {
    return recencyDifference;
  }

  return a.id.localeCompare(
    b.id,
  );
}

// ============================================================
// SELECT BEST IMAGE
// ============================================================

type SelectedResult = {
  placeId: string;
  city: string;
  placeName: string;

  selected:
    | ScoredCandidate
    | null;

  candidatesConsidered: number;

  eligibleCandidates: number;

  rejectedReason:
    | string
    | null;
};

function selectBestImage(
  result: PilotResult,
): SelectedResult {
  const images =
    result.images;

  const eligible =
    images
      .filter(
        (image) =>
          image.distanceMeters <=
            MAX_DISTANCE_METERS &&
          image.qualityScore !==
            null &&
          image.qualityScore >=
            MIN_QUALITY,
      )
      .map(scoreCandidate)
      .sort(compareCandidates);

  if (!eligible.length) {
    let reason =
      "no_eligible_candidate";

    if (!images.length) {
      reason =
        "no_mapillary_images";
    } else {
      const close =
        images.some(
          (image) =>
            image.distanceMeters <=
            MAX_DISTANCE_METERS,
        );

      const quality =
        images.some(
          (image) =>
            image.qualityScore !==
              null &&
            image.qualityScore >=
              MIN_QUALITY,
        );

      if (!close) {
        reason =
          "no_image_within_distance";
      } else if (!quality) {
        reason =
          "no_image_meets_quality";
      }
    }

    return {
      placeId:
        result.placeId,

      city:
        result.city,

      placeName:
        result.name,

      selected: null,

      candidatesConsidered:
        images.length,

      eligibleCandidates:
        0,

      rejectedReason:
        reason,
    };
  }

  return {
    placeId:
      result.placeId,

    city:
      result.city,

    placeName:
      result.name,

    selected:
      eligible[0],

    candidatesConsidered:
      images.length,

    eligibleCandidates:
      eligible.length,

    rejectedReason:
      null,
  };
}

// ============================================================
// LOAD PREVIOUS SAMPLE
// ============================================================

function loadPreviousIds(): Set<string> {
  if (
    !fs.existsSync(
      PREVIOUS_AUDIT,
    )
  ) {
    throw new Error(
      `Previous audit not found:\n${PREVIOUS_AUDIT}`,
    );
  }

  const raw =
    fs.readFileSync(
      PREVIOUS_AUDIT,
      "utf8",
    );

  const data =
    JSON.parse(raw) as {
      results?: Array<{
        placeId: string;
      }>;
    };

  if (
    !Array.isArray(
      data.results,
    )
  ) {
    throw new Error(
      "Previous audit does not contain results[]",
    );
  }

  return new Set(
    data.results.map(
      (result) =>
        result.placeId,
    ),
  );
}

// ============================================================
// LOAD / SAVE CHECKPOINT
// ============================================================

function loadCheckpoint():
  | Checkpoint
  | null {
  if (
    !fs.existsSync(
      CHECKPOINT,
    )
  ) {
    return null;
  }

  try {
    const raw =
      fs.readFileSync(
        CHECKPOINT,
        "utf8",
      );

    return JSON.parse(
      raw,
    ) as Checkpoint;
  } catch {
    console.warn(
      "Warning: checkpoint could not be read. Starting fresh.",
    );

    return null;
  }
}

function saveCheckpoint(
  checkpoint: Checkpoint,
): void {
  fs.mkdirSync(
    path.dirname(
      CHECKPOINT,
    ),
    {
      recursive: true,
    },
  );

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
// BUILD DETERMINISTIC SAMPLE
// ============================================================

function choosePilotPlaces(
  places: PlaceRow[],
  previousIds: Set<string>,
): PlaceRow[] {
  const eligible =
    places.filter(
      (place) =>
        !previousIds.has(
          place.id,
        ),
    );

  eligible.sort(
    (a, b) =>
      hashScore(a.id).localeCompare(
        hashScore(b.id),
      ),
  );

  return eligible.slice(
    0,
    PILOT_SIZE,
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
    "CityVerse — Mapillary Pilot 2",
  );
  console.log(
    "====================================================",
  );
  console.log("");

  console.log(
    "This script:",
  );

  console.log(
    "  ✓ reads Places",
  );

  console.log(
    "  ✓ excludes Pilot 1",
  );

  console.log(
    "  ✓ queries Mapillary",
  );

  console.log(
    "  ✓ scores candidates",
  );

  console.log(
    "  ✓ writes audit/report only",
  );

  console.log(
    "  ✗ does NOT write PlaceImage",
  );

  console.log("");

  // ----------------------------------------------------------
  // Previous sample
  // ----------------------------------------------------------

  const previousIds =
    loadPreviousIds();

  console.log(
    `Previous pilot places: ${previousIds.size}`,
  );

  // ----------------------------------------------------------
  // Database
  // ----------------------------------------------------------

  console.log(
    "Loading production Places...",
  );

  const places =
    (await prisma.place.findMany({
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
    `Production Places: ${places.length}`,
  );

  // ----------------------------------------------------------
  // Select second sample
  // ----------------------------------------------------------

  const sample =
    choosePilotPlaces(
      places,
      previousIds,
    );

  if (
    sample.length <
    PILOT_SIZE
  ) {
    throw new Error(
      `Only ${sample.length} eligible Places remain.`,
    );
  }

  console.log(
    `Pilot 2 sample: ${sample.length}`,
  );

  console.log(
    `Overlap with Pilot 1: ${
      sample.filter((place) =>
        previousIds.has(
          place.id,
        ),
      ).length
    }`,
  );

  console.log("");

  // ----------------------------------------------------------
  // MAPILLARY PREFLIGHT
  // ----------------------------------------------------------
  console.log(
    "Running Mapillary preflight test...",
  );
  const preflightPlace = sample[0];
  try {
    const preflightImages =
      await fetchMapillary(
        preflightPlace,
      );

    console.log(
      `✓ Mapillary preflight OK — ${preflightImages.length} images returned`,
    );

    if (preflightImages.length > 0) {
      const nearest =
        Math.min(
          ...preflightImages.map(
            (image) =>
              image.distanceMeters,
          ),
        );

      console.log(
        `  Nearest image: ${nearest.toFixed(2)}m`,
      );
    }

    console.log("");
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    throw new Error(
      `Mapillary preflight FAILED.\n${message}\n\nPilot 2 was NOT started.`,
    );
  }

  // ----------------------------------------------------------
  // Checkpoint
  // ----------------------------------------------------------

  let checkpoint =
    loadCheckpoint();

  if (
    !checkpoint ||
    checkpoint.samplePlaceIds.join(
      ",",
    ) !==
      sample
        .map(
          (place) =>
            place.id,
        )
        .join(",")
  ) {
    checkpoint = {
      generatedAt:
        new Date().toISOString(),

      samplePlaceIds:
        sample.map(
          (place) =>
            place.id,
        ),

      completed: [],

      results: [],
    };

    saveCheckpoint(
      checkpoint,
    );

    console.log(
      "Created new checkpoint.",
    );
  } else {
    console.log(
      `Resuming checkpoint: ${checkpoint.completed.length}/${sample.length}`,
    );
  }

  // ----------------------------------------------------------
  // Lookup map
  // ----------------------------------------------------------

  const completedIds =
    new Set(
      checkpoint.completed,
    );

  const resultsByPlace =
    new Map<string, PilotResult>();

  for (
    const result of
      checkpoint.results
  ) {
    resultsByPlace.set(
      result.placeId,
      result,
    );
  }

  // ----------------------------------------------------------
  // API loop
  // ----------------------------------------------------------

  let processed =
    completedIds.size;

  for (
    const place of sample
  ) {
    if (
      completedIds.has(
        place.id,
      )
    ) {
      continue;
    }

    processed++;

    console.log(
      `[${processed}/${sample.length}] ${place.city} — ${place.name}`,
    );

    try {
      const images =
        await fetchMapillary(
          place,
        );

      const result =
        buildResult(
          place,
          images,
        );

      resultsByPlace.set(
        place.id,
        result,
      );

      checkpoint.completed.push(
        place.id,
      );

      checkpoint.results =
        [...resultsByPlace.values()];

      saveCheckpoint(
        checkpoint,
      );

      console.log(
        `    Images: ${images.length}`,
      );

      if (images.length) {
        const nearest =
          Math.min(
            ...images.map(
              (image) =>
                image.distanceMeters,
            ),
          );

        console.log(
          `    Nearest: ${nearest.toFixed(2)}m`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.log(
        `    ERROR: ${message}`,
      );

      const errorResult: PilotResult =
        {
          placeId:
            place.id,

          name:
            place.name,

          city:
            place.city.name,

          latitude:
            place.latitude,

          longitude:
            place.longitude,

          status:
            "error",

          imageCount: 0,

          nearestDistanceMeters:
            null,

          within10m: 0,
          within25m: 0,
          within50m: 0,
          within100m: 0,

          uniqueImages: 0,

          bestQuality:
            null,

          averageQuality:
            null,

          images: [],

          error:
            message,
        };

      resultsByPlace.set(
        place.id,
        errorResult,
      );

      checkpoint.results =
        [...resultsByPlace.values()];

      saveCheckpoint(
        checkpoint,
      );
    }

    await sleep(
      REQUEST_DELAY_MS,
    );
  }

  // ----------------------------------------------------------
  // Final raw audit
  // ----------------------------------------------------------

  const finalResults =
    sample
      .map(
        (place) =>
          resultsByPlace.get(
            place.id,
          ),
      )
      .filter(
        (
          result,
        ): result is PilotResult =>
          Boolean(result),
      );

  const successful =
    finalResults.filter(
      (result) =>
        result.status !==
        "error",
    );

  const withImages =
    finalResults.filter(
      (result) =>
        result.status ===
        "images",
    );

  const noImages =
    finalResults.filter(
      (result) =>
        result.status ===
        "no_images",
    );

  const errors =
    finalResults.filter(
      (result) =>
        result.status ===
        "error",
    );

  const within10 =
    successful.filter(
      (result) =>
        result.within10m > 0,
    ).length;

  const within25 =
    successful.filter(
      (result) =>
        result.within25m > 0,
    ).length;

  const within50 =
    successful.filter(
      (result) =>
        result.within50m > 0,
    ).length;

  const within100 =
    successful.filter(
      (result) =>
        result.within100m > 0,
    ).length;

  const allImageIds =
    new Set<string>();

  for (
    const result of
      finalResults
  ) {
    for (
      const image of
        result.images
    ) {
      allImageIds.add(
        image.id,
      );
    }
  }

  const rawAudit = {
    generatedAt:
      new Date().toISOString(),

    sampleSize:
      sample.length,

    completed:
      finalResults.length,

    summary: {
      tested:
        finalResults.length,

      successful:
        successful.length,

      errors:
        errors.length,

      withImages:
        withImages.length,

      noImages:
        noImages.length,

      coveragePercent:
        round(
          successful.length >
            0
            ? (
                withImages.length /
                successful.length
              ) * 100
            : 0,
          2,
        ),

      within10m:
        within10,

      within25m:
        within25,

      within50m:
        within50,

      within100m:
        within100,

      uniqueImageIds:
        allImageIds.size,
    },

    results:
      finalResults,
  };

  fs.writeFileSync(
    OUTPUT_AUDIT,
    JSON.stringify(
      rawAudit,
      null,
      2,
    ),
    "utf8",
  );

  // ----------------------------------------------------------
  // SCORING
  // ----------------------------------------------------------

  const selections =
    finalResults.map(
      selectBestImage,
    );

  const selected =
    selections.filter(
      (result) =>
        result.selected !== null,
    );

  const rejected =
    selections.filter(
      (result) =>
        result.selected === null,
    );

  const selectedDistances =
    selected.map(
      (result) =>
        result.selected!
          .distanceMeters,
    );

  const selectedQualities =
    selected.map(
      (result) =>
        result.selected!
          .qualityScoreNormalized,
    );

  const uniqueSelectedImages =
    new Set(
      selected.map(
        (result) =>
          result.selected!.id,
      ),
    );

  const imageUsage =
    new Map<
      string,
      string[]
    >();

  for (
    const result of selected
  ) {
    const imageId =
      result.selected!.id;

    const placesUsing =
      imageUsage.get(
        imageId,
      ) ?? [];

    placesUsing.push(
      result.placeId,
    );

    imageUsage.set(
      imageId,
      placesUsing,
    );
  }

  const sharedImages =
    [...imageUsage.entries()]
      .filter(
        ([, placeIds]) =>
          placeIds.length > 1,
      );

  // ----------------------------------------------------------
  // City scoring
  // ----------------------------------------------------------

  type CityStat = {
    places: number;
    selected: number;
    rejected: number;
    distanceSum: number;
    qualitySum: number;
  };

  const cityStats =
    new Map<
      string,
      CityStat
    >();

  for (
    const result of selections
  ) {
    const current =
      cityStats.get(
        result.city,
      ) ?? {
        places: 0,
        selected: 0,
        rejected: 0,
        distanceSum: 0,
        qualitySum: 0,
      };

    current.places++;

    if (
      result.selected
    ) {
      current.selected++;

      current.distanceSum +=
        result.selected
          .distanceMeters;

      current.qualitySum +=
        result.selected
          .qualityScoreNormalized;
    } else {
      current.rejected++;
    }

    cityStats.set(
      result.city,
      current,
    );
  }

  // ----------------------------------------------------------
  // Rejection reasons
  // ----------------------------------------------------------

  const rejectionReasons =
    new Map<
      string,
      number
    >();

  for (
    const result of rejected
  ) {
    const reason =
      result.rejectedReason ??
      "unknown";

    rejectionReasons.set(
      reason,
      (
        rejectionReasons.get(
          reason,
        ) ?? 0
      ) + 1,
    );
  }

  // ----------------------------------------------------------
  // Projection
  // ----------------------------------------------------------

  const selectionRate =
    sample.length > 0
      ? selected.length /
        sample.length
      : 0;

  const projected40k =
    Math.round(
      selectionRate * 40000,
    );

  // ----------------------------------------------------------
  // Scoring report
  // ----------------------------------------------------------

  const scoringReport = {
    generatedAt:
      new Date().toISOString(),

    pilot: {
      sampleSize:
        sample.length,

      previousPilotExcluded:
        previousIds.size,

      overlapWithPreviousPilot:
        sample.filter(
          (place) =>
            previousIds.has(
              place.id,
            ),
        ).length,
    },

    configuration: {
      maxDistanceMeters:
        MAX_DISTANCE_METERS,

      minQuality:
        MIN_QUALITY,

      qualityWeight:
        QUALITY_WEIGHT,

      distanceWeight:
        DISTANCE_WEIGHT,
    },

    summary: {
      placesTested:
        sample.length,

      placesWithSelectedImage:
        selected.length,

      placesWithoutSelectedImage:
        rejected.length,

      selectionRatePercent:
        round(
          selectionRate * 100,
          2,
        ),

      uniqueSelectedImages:
        uniqueSelectedImages.size,

      sharedSelectedImages:
        sharedImages.length,

      averageSelectedDistanceMeters:
        round(
          average(
            selectedDistances,
          ),
          2,
        ),

      averageSelectedQuality:
        round(
          average(
            selectedQualities,
          ),
          4,
        ),

      projected40kSelectedPlaces:
        projected40k,
    },

    rejectionReasons:
      Object.fromEntries(
        rejectionReasons,
      ),

    cities:
      Object.fromEntries(
        [...cityStats.entries()]
          .sort(
            ([a], [b]) =>
              a.localeCompare(b),
          )
          .map(
            ([city, stats]) => [
              city,
              {
                places:
                  stats.places,

                selected:
                  stats.selected,

                rejected:
                  stats.rejected,

                selectionRatePercent:
                  round(
                    stats.places >
                      0
                      ? (
                          stats.selected /
                          stats.places
                        ) *
                        100
                      : 0,
                    2,
                  ),

                averageDistanceMeters:
                  round(
                    stats.selected >
                      0
                      ? stats.distanceSum /
                          stats.selected
                      : 0,
                    2,
                  ),

                averageQuality:
                  round(
                    stats.selected >
                      0
                      ? stats.qualitySum /
                          stats.selected
                      : 0,
                    4,
                  ),
              },
            ],
          ),
      ),

    selections:
      selections.map(
        (result) => ({
          placeId:
            result.placeId,

          city:
            result.city,

          placeName:
            result.placeName,

          candidatesConsidered:
            result.candidatesConsidered,

          eligibleCandidates:
            result.eligibleCandidates,

          rejectedReason:
            result.rejectedReason,

          selected:
            result.selected
              ? {
                  imageId:
                    result.selected
                      .id,

                  distanceMeters:
                    round(
                      result.selected
                        .distanceMeters,
                      2,
                    ),

                  qualityScore:
                    result.selected
                      .qualityScore,

                  score:
                    round(
                      result.selected
                        .score,
                      4,
                    ),

                  distanceScore:
                    round(
                      result.selected
                        .distanceScore,
                      4,
                    ),

                  qualityScoreNormalized:
                    round(
                      result.selected
                        .qualityScoreNormalized,
                      4,
                    ),

                  recencyScore:
                    round(
                      result.selected
                        .recencyScore,
                      4,
                    ),

                  capturedAt:
                    result.selected
                      .capturedAt,

                  capturedAtISO:
                    result.selected
                        .capturedAt !==
                      null
                      ? new Date(
                          result.selected
                            .capturedAt,
                        ).toISOString()
                      : null,
                }
              : null,
        }),
      ),
  };

  fs.writeFileSync(
    OUTPUT_SCORING,
    JSON.stringify(
      scoringReport,
      null,
      2,
    ),
    "utf8",
  );

  // ----------------------------------------------------------
  // CONSOLE
  // ----------------------------------------------------------

  console.log("");
  console.log(
    "====================================================",
  );
  console.log(
    "PILOT 2 RAW RESULT",
  );
  console.log(
    "====================================================",
  );

  console.log(
    `Places tested:   ${finalResults.length}`,
  );

  console.log(
    `Successful:      ${successful.length}`,
  );

  console.log(
    `Errors:           ${errors.length}`,
  );

  console.log(
    `With images:     ${withImages.length}`,
  );

  console.log(
    `No images:       ${noImages.length}`,
  );

  console.log(
    `Coverage:        ${
      successful.length
        ? (
            (withImages.length /
              successful.length) *
            100
          ).toFixed(2)
        : "0.00"
    }%`,
  );

  console.log(
    `Within 10m:      ${within10}`,
  );

  console.log(
    `Within 25m:      ${within25}`,
  );

  console.log(
    `Within 50m:      ${within50}`,
  );

  console.log(
    `Within 100m:     ${within100}`,
  );

  console.log(
    `Unique images:   ${allImageIds.size}`,
  );

  console.log("");

  console.log(
    "====================================================",
  );
  console.log(
    "PILOT 2 SCORING RESULT",
  );
  console.log(
    "====================================================",
  );

  console.log(
    `Selected:        ${selected.length}`,
  );

  console.log(
    `Rejected:        ${rejected.length}`,
  );

  console.log(
    `Selection rate:  ${(selectionRate * 100).toFixed(2)}%`,
  );

  console.log(
    `Unique selected: ${uniqueSelectedImages.size}`,
  );

  console.log(
    `Shared images:   ${sharedImages.length}`,
  );

  console.log(
    `Avg distance:    ${average(selectedDistances).toFixed(2)}m`,
  );

  console.log(
    `Avg quality:     ${average(selectedQualities).toFixed(3)}`,
  );

  console.log(
    `Projected 40K:   ${projected40k}`,
  );

  console.log("");

  console.log(
    "CITY BREAKDOWN",
  );

  console.log(
    "----------------------------------------------------",
  );

  for (
    const [city, stats] of
      [...cityStats.entries()]
        .sort(
          ([a], [b]) =>
            a.localeCompare(b),
        )
  ) {
    const rate =
      stats.places > 0
        ? (
            stats.selected /
            stats.places
          ) * 100
        : 0;

    const avgDistance =
      stats.selected > 0
        ? stats.distanceSum /
          stats.selected
        : 0;

    const avgQuality =
      stats.selected > 0
        ? stats.qualitySum /
          stats.selected
        : 0;

    console.log(
      `${city.padEnd(10)} ` +
        `${stats.selected}/${stats.places} ` +
        `(${rate.toFixed(2)}%) ` +
        `avgDist=${avgDistance.toFixed(1)}m ` +
        `avgQ=${avgQuality.toFixed(3)}`,
    );
  }

  console.log("");

  console.log(
    "REJECTION REASONS",
  );

  console.log(
    "----------------------------------------------------",
  );

  for (
    const [
      reason,
      count,
    ] of rejectionReasons
  ) {
    console.log(
      `${reason}: ${count}`,
    );
  }

  console.log("");

  console.log(
    "FILES",
  );

  console.log(
    `Audit:   ${OUTPUT_AUDIT}`,
  );

  console.log(
    `Scoring: ${OUTPUT_SCORING}`,
  );

  console.log(
    `Checkpoint: ${CHECKPOINT}`,
  );

  console.log("");

  console.log(
    "====================================================",
  );

  console.log(
    "NO DATABASE WRITES.",
  );

  console.log(
    "PlaceImage was NOT modified.",
  );

  console.log(
    "====================================================",
  );

  await prisma.$disconnect();
}

main().catch(
  async (error) => {
    console.error("");
    console.error(
      "PILOT 2 FAILED",
    );
    console.error(
      error,
    );

    try {
      await prisma.$disconnect();
    } catch {
      // Ignore disconnect errors.
    }

    process.exit(1);
  },
);