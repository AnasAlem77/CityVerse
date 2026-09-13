
import fs from "fs";

type Image = {
  id: string;
  distanceMeters: number;
  qualityScore: number | null;
  capturedAt: number | null;
};

type Result = {
  placeId: string;
  name: string;
  city: string;
  status: string;
  images: Image[];
};

type AuditFile = {
  results: Result[];
};

const FILES = [
  "logs/mapillary-audit-1000.json",
  "logs/mapillary-pilot-2-audit-1000.json",
];

const THRESHOLDS = [
  { distance: 50, quality: 0.60 },
  { distance: 50, quality: 0.55 },
  { distance: 50, quality: 0.50 },
  { distance: 60, quality: 0.60 },
  { distance: 60, quality: 0.55 },
  { distance: 75, quality: 0.60 },
  { distance: 75, quality: 0.55 },
];

const PRODUCTION_PLACES = 40000;

const results: Result[] = [];

for (const file of FILES) {
  const data = JSON.parse(
    fs.readFileSync(file, "utf8"),
  ) as AuditFile;

  results.push(...data.results);
}

if (results.length !== 2000) {
  throw new Error(
    "Expected 2000 results, found " + results.length,
  );
}

function scoreImage(image: Image, maxDistance: number): number {
  const distanceScore = Math.max(
    0,
    1 - image.distanceMeters / maxDistance,
  );

  const qualityScore =
    typeof image.qualityScore === "number"
      ? image.qualityScore
      : 0;

  return (
    distanceScore * 0.4 +
    qualityScore * 0.6
  );
}

console.log("");
console.log("=".repeat(78));
console.log("CityVerse — Mapillary Threshold Analysis");
console.log("=".repeat(78));
console.log("Places analyzed: " + results.length);
console.log("API requests: 0");
console.log("Database writes: 0");
console.log("");

for (const threshold of THRESHOLDS) {
  const selected: Array<{
    place: Result;
    image: Image;
    score: number;
  }> = [];

  let noImages = 0;
  let noDistance = 0;
  let noQuality = 0;

  for (const place of results) {
    if (
      !Array.isArray(place.images) ||
      place.images.length === 0
    ) {
      noImages++;
      continue;
    }

    const distanceCandidates =
      place.images.filter(
        (image) =>
          Number.isFinite(image.distanceMeters) &&
          image.distanceMeters <= threshold.distance,
      );

    if (distanceCandidates.length === 0) {
      noDistance++;
      continue;
    }

    const eligible =
      distanceCandidates.filter(
        (image) =>
          typeof image.qualityScore === "number" &&
          image.qualityScore >= threshold.quality,
      );

    if (eligible.length === 0) {
      noQuality++;
      continue;
    }

    const ranked = eligible
      .map((image) => ({
        image,
        score: scoreImage(image, threshold.distance),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return (
          a.image.distanceMeters -
          b.image.distanceMeters
        );
      });

    selected.push({
      place,
      image: ranked[0].image,
      score: ranked[0].score,
    });
  }

  const rate =
    (selected.length / results.length) * 100;

  const projected = Math.round(
    (selected.length / results.length) *
      PRODUCTION_PLACES,
  );

  const avgDistance =
    selected.length > 0
      ? selected.reduce(
          (sum, item) =>
            sum + item.image.distanceMeters,
          0,
        ) / selected.length
      : 0;

  const avgQuality =
    selected.length > 0
      ? selected.reduce(
          (sum, item) =>
            sum + (item.image.qualityScore ?? 0),
          0,
        ) / selected.length
      : 0;

  const uniqueImages = new Set(
    selected.map(
      (item) => item.image.id,
    ),
  );

  const cityStats = new Map<
    string,
    {
      selected: number;
      total: number;
      distance: number;
      quality: number;
    }
  >();

  for (const result of results) {
    if (!cityStats.has(result.city)) {
      cityStats.set(result.city, {
        selected: 0,
        total: 0,
        distance: 0,
        quality: 0,
      });
    }

    cityStats.get(result.city)!.total++;
  }

  for (const item of selected) {
    const stats =
      cityStats.get(item.place.city)!;

    stats.selected++;
    stats.distance +=
      item.image.distanceMeters;
    stats.quality +=
      item.image.qualityScore ?? 0;
  }

  console.log("-".repeat(78));
  console.log(
    "DISTANCE <= " +
      threshold.distance +
      "m | QUALITY >= " +
      threshold.quality.toFixed(2),
  );
  console.log("-".repeat(78));

  console.log(
    "Selected:              " +
      selected.length +
      "/" +
      results.length,
  );

  console.log(
    "Selection rate:        " +
      rate.toFixed(2) +
      "%",
  );

  console.log(
    "Projected 40K:         " +
      projected,
  );

  console.log(
    "Avg selected distance: " +
      avgDistance.toFixed(2) +
      "m",
  );

  console.log(
    "Avg selected quality:  " +
      avgQuality.toFixed(3),
  );

  console.log(
    "Unique selected:       " +
      uniqueImages.size,
  );

  console.log(
    "Duplicate selected:    " +
      (selected.length - uniqueImages.size),
  );

  console.log(
    "No images:             " +
      noImages,
  );

  console.log(
    "No image in distance:  " +
      noDistance,
  );

  console.log(
    "No image meets quality:" +
      noQuality,
  );

  console.log("");
  console.log("CITY");

  for (const city of [
    "Bali",
    "Dubai",
    "Jakarta",
    "Paris",
    "Tokyo",
  ]) {
    const stats = cityStats.get(city);

    if (!stats) continue;

    const cityRate =
      stats.total > 0
        ? (stats.selected / stats.total) * 100
        : 0;

    const cityAvgDistance =
      stats.selected > 0
        ? stats.distance / stats.selected
        : 0;

    const cityAvgQuality =
      stats.selected > 0
        ? stats.quality / stats.selected
        : 0;

    console.log(
      "  " +
        city.padEnd(8) +
        " " +
        stats.selected +
        "/" +
        stats.total +
        " (" +
        cityRate.toFixed(2) +
        "%) " +
        "avgDist=" +
        cityAvgDistance.toFixed(1) +
        "m " +
        "avgQ=" +
        cityAvgQuality.toFixed(3),
    );
  }

  console.log("");
}

console.log("=".repeat(78));
console.log("Analysis complete.");
console.log("No API requests were made.");
console.log("No database writes were made.");
console.log("=".repeat(78));
