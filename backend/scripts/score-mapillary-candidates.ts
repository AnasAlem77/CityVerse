import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

type MapillaryImage = {
  id: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  qualityScore: number | null;
  capturedAt: number | null;
};

type AuditResult = {
  placeId: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  status: string;
  imageCount: number;
  nearestDistanceMeters: number | null;
  uniqueImages: number;
  uniqueSequences: number;
  bestQuality: number | null;
  averageQuality: number | null;
  images: MapillaryImage[];
};

type AuditFile = {
  generatedAt: string;
  sampleSize: number;
  completed: number;
  summary: Record<string, unknown>;
  results: AuditResult[];
};

type ScoredCandidate = MapillaryImage & {
  score: number;
  distanceScore: number;
  qualityScoreNormalized: number;
  recencyScore: number;
};

type SelectedPlace = {
  placeId: string;
  city: string;
  placeName: string;
  selected: ScoredCandidate | null;
  candidatesConsidered: number;
  eligibleCandidates: number;
  rejectedReason?: string;
};

const ROOT = path.resolve(__dirname, "..");

const INPUT = path.join(
  ROOT,
  "logs",
  "mapillary-audit-1000.json",
);

const OUTPUT = path.join(
  ROOT,
  "logs",
  "mapillary-scoring-1000.json",
);

// ==================================================
// SCORING CONFIGURATION
// ==================================================

const MAX_DISTANCE_METERS = 50;
const MIN_QUALITY = 0.6;

const QUALITY_WEIGHT = 0.6;
const DISTANCE_WEIGHT = 0.4;

// Recency is only used when two candidates have
// almost identical main scores.
const RECENCY_TIE_THRESHOLD = 0.015;

// ==================================================
// HELPERS
// ==================================================

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(min, Math.min(max, value));
}

function round(
  value: number,
  decimals = 4,
): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) => sum + value,
      0,
    ) / values.length
  );
}

// --------------------------------------------------
// Distance score
// --------------------------------------------------

function calculateDistanceScore(
  distanceMeters: number,
): number {
  if (
    !Number.isFinite(distanceMeters) ||
    distanceMeters >= MAX_DISTANCE_METERS
  ) {
    return 0;
  }

  return clamp(
    1 - distanceMeters / MAX_DISTANCE_METERS,
    0,
    1,
  );
}

// --------------------------------------------------
// Quality score
// --------------------------------------------------

function calculateQualityScore(
  quality: number | null,
): number {
  if (
    quality === null ||
    !Number.isFinite(quality)
  ) {
    return 0;
  }

  return clamp(quality, 0, 1);
}

// --------------------------------------------------
// Capture recency
// --------------------------------------------------

function calculateRecencyScore(
  capturedAt: number | null,
): number {
  if (
    capturedAt === null ||
    !Number.isFinite(capturedAt)
  ) {
    return 0;
  }

  const capturedTime = capturedAt;

  const now = Date.now();

  const ageMs = now - capturedTime;

  if (ageMs < 0) {
    return 0;
  }

  const ageDays =
    ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 180) return 1;
  if (ageDays <= 365) return 0.8;
  if (ageDays <= 730) return 0.6;
  if (ageDays <= 1095) return 0.4;
  if (ageDays <= 1825) return 0.2;

  return 0;
}

// --------------------------------------------------
// Main candidate score
// --------------------------------------------------

function scoreCandidate(
  image: MapillaryImage,
): ScoredCandidate {
  const distanceScore =
    calculateDistanceScore(
      image.distanceMeters,
    );

  const qualityScoreNormalized =
    calculateQualityScore(
      image.qualityScore,
    );

  const recencyScore =
    calculateRecencyScore(
      image.capturedAt,
    );

  const score =
    QUALITY_WEIGHT *
      qualityScoreNormalized +
    DISTANCE_WEIGHT *
      distanceScore;

  return {
    ...image,
    score,
    distanceScore,
    qualityScoreNormalized,
    recencyScore,
  };
}

// --------------------------------------------------
// Candidate ranking
// --------------------------------------------------

function compareCandidates(
  a: ScoredCandidate,
  b: ScoredCandidate,
): number {
  const scoreDifference =
    b.score - a.score;

  if (
    Math.abs(scoreDifference) >
    RECENCY_TIE_THRESHOLD
  ) {
    return scoreDifference;
  }

  // Similar overall score:
  // prefer higher quality.
  const qualityDifference =
    b.qualityScoreNormalized -
    a.qualityScoreNormalized;

  if (
    Math.abs(qualityDifference) > 0.02
  ) {
    return qualityDifference;
  }

  // Then prefer closer image.
  const distanceDifference =
    a.distanceMeters -
    b.distanceMeters;

  if (
    Math.abs(distanceDifference) > 2
  ) {
    return distanceDifference;
  }

  // Then prefer newer imagery.
  const recencyDifference =
    b.recencyScore -
    a.recencyScore;

  if (
    Math.abs(recencyDifference) > 0.05
  ) {
    return recencyDifference;
  }

  // Stable deterministic ordering.
  return a.id.localeCompare(b.id);
}

// ==================================================
// LOAD AUDIT
// ==================================================

if (!fs.existsSync(INPUT)) {
  throw new Error(
    `Input file not found:\n${INPUT}`,
  );
}

const raw =
  fs.readFileSync(
    INPUT,
    "utf8",
  );

const audit =
  JSON.parse(raw) as AuditFile;

if (!Array.isArray(audit.results)) {
  throw new Error(
    "Invalid audit file: expected results[]",
  );
}

console.log("");
console.log("==========================================");
console.log("Mapillary Candidate Scoring");
console.log("==========================================");

console.log(
  `Input: ${INPUT}`,
);

console.log(
  `Places: ${audit.results.length}`,
);

console.log("");

console.log("Configuration:");
console.log(
  `  Max distance:   ${MAX_DISTANCE_METERS}m`,
);

console.log(
  `  Min quality:    ${MIN_QUALITY}`,
);

console.log(
  `  Quality weight: ${QUALITY_WEIGHT}`,
);

console.log(
  `  Distance weight:${DISTANCE_WEIGHT}`,
);

console.log("");

// ==================================================
// SCORE ALL PLACES
// ==================================================

const results: SelectedPlace[] = [];

const usedImageIds =
  new Map<string, string[]>();

const usedSequences =
  new Map<string, string[]>();

let placesWithSelectedImage = 0;
let placesWithoutSelectedImage = 0;

let totalCandidates = 0;
let eligibleCandidates = 0;

const rejectionReasons =
  new Map<string, number>();

for (const place of audit.results) {
  const images =
    Array.isArray(place.images)
      ? place.images
      : [];

  totalCandidates += images.length;

  // ----------------------------------------------
  // Filter
  // ----------------------------------------------

  const eligible =
    images
      .filter((image) => {
        if (
          !Number.isFinite(
            image.distanceMeters,
          )
        ) {
          return false;
        }

        if (
          image.distanceMeters >
          MAX_DISTANCE_METERS
        ) {
          return false;
        }

        if (
          image.qualityScore === null ||
          !Number.isFinite(
            image.qualityScore,
          )
        ) {
          return false;
        }

        if (
          image.qualityScore <
          MIN_QUALITY
        ) {
          return false;
        }

        return true;
      })
      .map(scoreCandidate)
      .sort(compareCandidates);

  eligibleCandidates +=
    eligible.length;

  // ----------------------------------------------
  // No candidate
  // ----------------------------------------------

  if (!eligible.length) {
    placesWithoutSelectedImage++;

    let reason =
      "no_eligible_candidate";

    if (!images.length) {
      reason =
        "no_mapillary_images";
    } else {
      const hasCloseImage =
        images.some(
          (image) =>
            Number.isFinite(
              image.distanceMeters,
            ) &&
            image.distanceMeters <=
              MAX_DISTANCE_METERS,
        );

      const hasQualityImage =
        images.some(
          (image) =>
            image.qualityScore !== null &&
            Number.isFinite(
              image.qualityScore,
            ) &&
            image.qualityScore >=
              MIN_QUALITY,
        );

      if (!hasCloseImage) {
        reason =
          "no_image_within_distance";
      } else if (!hasQualityImage) {
        reason =
          "no_image_meets_quality";
      }
    }

    rejectionReasons.set(
      reason,
      (rejectionReasons.get(reason) ?? 0) + 1,
    );

    results.push({
      placeId: place.placeId,
      city: place.city,
      placeName: place.name,
      selected: null,
      candidatesConsidered:
        images.length,
      eligibleCandidates: 0,
      rejectedReason: reason,
    });

    continue;
  }

  // ----------------------------------------------
  // Select best candidate
  // ----------------------------------------------

  const selected =
    eligible[0];

  placesWithSelectedImage++;

  // Track image reuse.
  const imagePlaces =
    usedImageIds.get(
      selected.id,
    ) ?? [];

  imagePlaces.push(
    place.placeId,
  );

  usedImageIds.set(
    selected.id,
    imagePlaces,
  );

  results.push({
    placeId: place.placeId,
    city: place.city,
    placeName: place.name,
    selected,
    candidatesConsidered:
      images.length,
    eligibleCandidates:
      eligible.length,
  });
}

// ==================================================
// STATISTICS
// ==================================================

const selectedPlaces =
  results.filter(
    (result) =>
      result.selected !== null,
  );

const selectedDistances =
  selectedPlaces.map(
    (result) =>
      result.selected!.distanceMeters,
  );

const selectedQualities =
  selectedPlaces.map(
    (result) =>
      result.selected!
        .qualityScoreNormalized,
  );

const uniqueSelectedImages =
  new Set(
    selectedPlaces.map(
      (result) =>
        result.selected!.id,
    ),
  );

const sharedImages =
  [...usedImageIds.entries()]
    .filter(
      ([, placeIds]) =>
        placeIds.length > 1,
    );

// ==================================================
// CITY STATS
// ==================================================

type CityStats = {
  places: number;
  selected: number;
  rejected: number;
  distanceSum: number;
  qualitySum: number;
};

const cityStats =
  new Map<string, CityStats>();

for (const result of results) {
  const stats =
    cityStats.get(
      result.city,
    ) ?? {
      places: 0,
      selected: 0,
      rejected: 0,
      distanceSum: 0,
      qualitySum: 0,
    };

  stats.places++;

  if (result.selected) {
    stats.selected++;

    stats.distanceSum +=
      result.selected
        .distanceMeters;

    stats.qualitySum +=
      result.selected
        .qualityScoreNormalized;
  } else {
    stats.rejected++;
  }

  cityStats.set(
    result.city,
    stats,
  );
}

// ==================================================
// PROJECTION
// ==================================================

const totalPlaces =
  audit.results.length;

const selectionRate =
  totalPlaces > 0
    ? placesWithSelectedImage /
      totalPlaces
    : 0;

const projected40k =
  Math.round(
    selectionRate * 40000,
  );

// ==================================================
// OUTPUT
// ==================================================

const output = {
  generatedAt:
    new Date().toISOString(),

  inputAudit: {
    generatedAt:
      audit.generatedAt,

    sampleSize:
      audit.sampleSize,

    completed:
      audit.completed,
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

    recencyUsedAsTieBreaker:
      true,
  },

  summary: {
    placesTested:
      totalPlaces,

    placesWithSelectedImage:
      placesWithSelectedImage,

    placesWithoutSelectedImage:
      placesWithoutSelectedImage,

    selectionRatePercent:
      round(
        selectionRate * 100,
        2,
      ),

    totalCandidates:
      totalCandidates,

    eligibleCandidates:
      eligibleCandidates,

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
                  stats.places > 0
                    ? (
                        stats.selected /
                        stats.places
                      ) * 100
                    : 0,
                  2,
                ),

              averageDistanceMeters:
                round(
                  stats.selected > 0
                    ? stats.distanceSum /
                        stats.selected
                    : 0,
                  2,
                ),

              averageQuality:
                round(
                  stats.selected > 0
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
    results.map(
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
          result.rejectedReason ??
          null,

        selected:
          result.selected
            ? {
                imageId:
                  result.selected.id,

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
                    .capturedAt !== null
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

// ==================================================
// WRITE REPORT
// ==================================================

fs.mkdirSync(
  path.dirname(OUTPUT),
  {
    recursive: true,
  },
);

fs.writeFileSync(
  OUTPUT,
  JSON.stringify(
    output,
    null,
    2,
  ),
  "utf8",
);

// ==================================================
// CONSOLE REPORT
// ==================================================

console.log("");
console.log("==========================================");
console.log("RESULT");
console.log("==========================================");

console.log(
  `Places tested:       ${totalPlaces}`,
);

console.log(
  `Selected:            ${placesWithSelectedImage}`,
);

console.log(
  `Rejected:            ${placesWithoutSelectedImage}`,
);

console.log(
  `Selection rate:      ${(selectionRate * 100).toFixed(2)}%`,
);

console.log(
  `Total candidates:    ${totalCandidates}`,
);

console.log(
  `Eligible candidates: ${eligibleCandidates}`,
);

console.log(
  `Unique images:       ${uniqueSelectedImages.size}`,
);

console.log(
  `Shared images:       ${sharedImages.length}`,
);

console.log(
  `Avg distance:        ${average(selectedDistances).toFixed(2)}m`,
);

console.log(
  `Avg quality:         ${average(selectedQualities).toFixed(3)}`,
);

console.log(
  `Projected 40K:       ${projected40k}`,
);

console.log("");
console.log("CITY BREAKDOWN");
console.log("------------------------------------------");

for (
  const [city, stats] of [
    ...cityStats.entries(),
  ].sort(
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
console.log("REJECTION REASONS");
console.log("------------------------------------------");

for (
  const [reason, count] of
    rejectionReasons
) {
  console.log(
    `${reason}: ${count}`,
  );
}

console.log("");
console.log("==========================================");
console.log("REPORT");
console.log("==========================================");

console.log(OUTPUT);

console.log("");
console.log("NO DATABASE CHANGES.");
console.log("NO MAPILLARY API REQUESTS.");
console.log("");