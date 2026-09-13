import fs from "node:fs";

const INPUT = "logs/mapillary-audit-1000.json";

type Image = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
  qualityScore: number | null;
  capturedAt: number | null;
};

type PlaceResult = {
  placeId: string;
  name: string;
  city: string;
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
  images: Image[];
};

type AuditFile = {
  results: PlaceResult[];
};

const raw = fs.readFileSync(INPUT, "utf8");
const data: AuditFile = JSON.parse(raw);

const results = data.results.filter(
  (r) => r.status !== "error",
);

const cities = [...new Set(results.map((r) => r.city))].sort();

const distanceThresholds = [10, 25, 50, 75, 100];
const qualityThresholds = [0.3, 0.5, 0.6, 0.7];

function imagesWithin(
  place: PlaceResult,
  distance: number,
  quality: number | null = null,
) {
  return place.images.filter((image) => {
    if (image.distanceMeters === null) return false;

    if (image.distanceMeters > distance) return false;

    if (
      quality !== null &&
      (image.qualityScore === null ||
        image.qualityScore < quality)
    ) {
      return false;
    }

    return true;
  });
}

function placesMatching(
  subset: PlaceResult[],
  distance: number,
  quality: number | null = null,
) {
  return subset.filter(
    (place) =>
      imagesWithin(place, distance, quality).length > 0,
  );
}

function pct(value: number, total: number) {
  if (total === 0) return "0.00%";

  return `${((value / total) * 100).toFixed(2)}%`;
}

function projected(value: number, total: number) {
  return Math.round((value / total) * 40000);
}

function printTable(
  subset: PlaceResult[],
  label: string,
) {
  console.log("");
  console.log(`--- ${label} ---`);

  console.log(
    "Distance".padEnd(12) +
      "Places".padEnd(10) +
      "Percent".padEnd(12) +
      "Projected 40K",
  );

  console.log("-".repeat(55));

  for (const distance of distanceThresholds) {
    const count = placesMatching(subset, distance);

    console.log(
      `≤${distance}m`.padEnd(12) +
        String(count.length).padEnd(10) +
        pct(count.length, subset.length).padEnd(12) +
        String(projected(count.length, subset.length)),
    );
  }
}

function printQualityDistanceTable(
  subset: PlaceResult[],
) {
  console.log("");
  console.log("--- Distance + Quality ---");

  console.log(
    "Distance".padEnd(12) +
      "Quality".padEnd(12) +
      "Places".padEnd(10) +
      "Percent".padEnd(12) +
      "Projected 40K",
  );

  console.log("-".repeat(70));

  for (const distance of distanceThresholds) {
    for (const quality of qualityThresholds) {
      const count = placesMatching(
        subset,
        distance,
        quality,
      );

      console.log(
        `≤${distance}m`.padEnd(12) +
          `≥${quality}`.padEnd(12) +
          String(count.length).padEnd(10) +
          pct(count.length, subset.length).padEnd(12) +
          String(projected(count.length, subset.length)),
      );
    }

    console.log("");
  }
}

function printCityBreakdown() {
  console.log("");
  console.log("==========================================");
  console.log("CITY BREAKDOWN");
  console.log("==========================================");

  for (const city of cities) {
    const cityResults = results.filter(
      (r) => r.city === city,
    );

    console.log("");
    console.log(`${city} (${cityResults.length} tested)`);
    console.log("-".repeat(60));

    const rows = [
      {
        label: "Any image",
        count: placesMatching(cityResults, 1000),
      },
      ...distanceThresholds.map((distance) => ({
        label: `≤${distance}m`,
        count: placesMatching(cityResults, distance),
      })),
      ...qualityThresholds.map((quality) => ({
        label: `≤50m + Q≥${quality}`,
        count: placesMatching(
          cityResults,
          50,
          quality,
        ),
      })),
    ];

    for (const row of rows) {
      console.log(
        row.label.padEnd(20) +
          String(row.count.length).padEnd(10) +
          pct(row.count.length, cityResults.length),
      );
    }
  }
}

function printQualityDistribution() {
  console.log("");
  console.log("==========================================");
  console.log("QUALITY DISTRIBUTION");
  console.log("==========================================");

  const allImages = results.flatMap((r) => r.images);

  const qualityValues = allImages
    .map((image) => image.qualityScore)
    .filter(
      (value): value is number =>
        typeof value === "number",
    );

  console.log(`Images analyzed: ${allImages.length}`);
  console.log(`Images with quality score: ${qualityValues.length}`);

  if (qualityValues.length === 0) {
    return;
  }

  const buckets = [
    { label: "0.00 - 0.19", min: 0, max: 0.2 },
    { label: "0.20 - 0.39", min: 0.2, max: 0.4 },
    { label: "0.40 - 0.59", min: 0.4, max: 0.6 },
    { label: "0.60 - 0.69", min: 0.6, max: 0.7 },
    { label: "0.70 - 0.79", min: 0.7, max: 0.8 },
    { label: "0.80 - 0.89", min: 0.8, max: 0.9 },
    { label: "0.90 - 1.00", min: 0.9, max: 1.01 },
  ];

  for (const bucket of buckets) {
    const count = qualityValues.filter(
      (value) =>
        value >= bucket.min &&
        value < bucket.max,
    ).length;

    console.log(
      bucket.label.padEnd(15) +
        String(count).padEnd(10) +
        pct(count, qualityValues.length),
    );
  }

  const average =
    qualityValues.reduce(
      (sum, value) => sum + value,
      0,
    ) / qualityValues.length;

  console.log("");
  console.log(
    `Average quality: ${average.toFixed(3)}`,
  );
  console.log(
    `Best quality: ${Math.max(...qualityValues).toFixed(3)}`,
  );
  console.log(
    `Worst quality: ${Math.min(...qualityValues).toFixed(3)}`,
  );
}

function printUniqueImageAnalysis() {
  console.log("");
  console.log("==========================================");
  console.log("IMAGE UNIQUENESS");
  console.log("==========================================");

  const imageToPlaces = new Map<string, Set<string>>();

  for (const place of results) {
    for (const image of place.images) {
      if (!imageToPlaces.has(image.id)) {
        imageToPlaces.set(
          image.id,
          new Set<string>(),
        );
      }

      imageToPlaces
        .get(image.id)!
        .add(place.placeId);
    }
  }

  const uniqueImages = imageToPlaces.size;

  const sharedImages = [...imageToPlaces.values()].filter(
    (places) => places.size > 1,
  );

  const imagesUsedOnce = [...imageToPlaces.values()].filter(
    (places) => places.size === 1,
  );

  console.log(
    `Unique images: ${uniqueImages}`,
  );

  console.log(
    `Images used by exactly 1 Place: ${imagesUsedOnce.length}`,
  );

  console.log(
    `Images shared by 2+ Places: ${sharedImages.length}`,
  );

  if (sharedImages.length > 0) {
    const maxSharing = Math.max(
      ...sharedImages.map(
        (places) => places.size,
      ),
    );

    console.log(
      `Most-shared single image: ${maxSharing} Places`,
    );
  }
}

function printCandidateScenarios() {
  console.log("");
  console.log("==========================================");
  console.log("RECOMMENDED CANDIDATE SCENARIOS");
  console.log("==========================================");

  const scenarios = [
    {
      name: "Strict",
      distance: 25,
      quality: 0.7,
    },
    {
      name: "High Quality",
      distance: 50,
      quality: 0.7,
    },
    {
      name: "Balanced",
      distance: 50,
      quality: 0.6,
    },
    {
      name: "Coverage",
      distance: 50,
      quality: 0.5,
    },
    {
      name: "Wide Coverage",
      distance: 100,
      quality: 0.5,
    },
    {
      name: "Maximum",
      distance: 100,
      quality: 0.3,
    },
  ];

  console.log(
    "Scenario".padEnd(18) +
      "Distance".padEnd(12) +
      "Quality".padEnd(12) +
      "Places".padEnd(10) +
      "Percent".padEnd(12) +
      "Projected 40K",
  );

  console.log("-".repeat(85));

  for (const scenario of scenarios) {
    const matched = placesMatching(
      results,
      scenario.distance,
      scenario.quality,
    );

    console.log(
      scenario.name.padEnd(18) +
        `≤${scenario.distance}m`.padEnd(12) +
        `≥${scenario.quality}`.padEnd(12) +
        String(matched.length).padEnd(10) +
        pct(matched.length, results.length).padEnd(12) +
        String(projected(matched.length, results.length)),
    );
  }
}

function printBestImageStats() {
  console.log("");
  console.log("==========================================");
  console.log("BEST CANDIDATE PER PLACE");
  console.log("==========================================");

  const scenarios = [
    { distance: 25, quality: 0.5 },
    { distance: 50, quality: 0.5 },
    { distance: 50, quality: 0.6 },
    { distance: 50, quality: 0.7 },
    { distance: 100, quality: 0.5 },
  ];

  for (const scenario of scenarios) {
    const placesWithCandidate = results.filter(
      (place) =>
        imagesWithin(
          place,
          scenario.distance,
          scenario.quality,
        ).length > 0,
    );

    const selectedImages = placesWithCandidate.map(
      (place) => {
        const candidates = imagesWithin(
          place,
          scenario.distance,
          scenario.quality,
        );

        candidates.sort((a, b) => {
          const qualityA = a.qualityScore ?? 0;
          const qualityB = b.qualityScore ?? 0;

          if (qualityB !== qualityA) {
            return qualityB - qualityA;
          }

          return (
            (a.distanceMeters ?? Infinity) -
            (b.distanceMeters ?? Infinity)
          );
        });

        return candidates[0];
      },
    );

    const uniqueIds = new Set(
      selectedImages.map((image) => image.id),
    );

    console.log(
      `≤${scenario.distance}m + Q≥${scenario.quality}: ` +
        `${placesWithCandidate.length} Places → ` +
        `${uniqueIds.size} unique selected images`,
    );
  }
}

console.log("==========================================");
console.log("MAPILLARY 1000-PLACE ANALYZER");
console.log("==========================================");
console.log(`Input: ${INPUT}`);
console.log(`Successful Places: ${results.length}`);
console.log(`Cities: ${cities.join(", ")}`);
console.log("Database modified: NO");
console.log("Mapillary API requests: NO");
console.log("");

printTable(results, "DISTANCE ONLY");

printQualityDistanceTable(results);

printQualityDistribution();

printUniqueImageAnalysis();

printBestImageStats();

printCandidateScenarios();

printCityBreakdown();

console.log("");
console.log("==========================================");
console.log("ANALYSIS COMPLETE");
console.log("==========================================");
