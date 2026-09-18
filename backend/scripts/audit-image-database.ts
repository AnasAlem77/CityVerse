import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const EXPECTED_CITIES = [
  "Bali",
  "Jakarta",
  "Paris",
  "Dubai",
  "Tokyo",
];

function percentage(value: number, total: number) {
  if (total === 0) return "0.00";
  return ((value / total) * 100).toFixed(2);
}

async function main() {
  console.log("");
  console.log("====================================================");
  console.log("CITYVERSE IMAGE DATABASE AUDIT");
  console.log("====================================================");
  console.log("READ-ONLY AUDIT — NO DATABASE CHANGES");
  console.log("");

  const [
    totalPlaces,
    totalCities,
    totalPlaceImages,
    places,
    placeImages,
  ] = await Promise.all([
    prisma.place.count(),
    prisma.city.count(),
    prisma.placeImage.count(),
    prisma.place.findMany({
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        osmId: true,
        cityId: true,
        city: {
          select: {
            id: true,
            name: true,
          },
        },
        images: {
          select: {
            id: true,
            source: true,
            url: true,
            sourceUrl: true,
            license: true,
            author: true,
            attribution: true,
            width: true,
            height: true,
          },
        },
      },
    }),
    prisma.placeImage.findMany({
      select: {
        id: true,
        placeId: true,
        source: true,
        url: true,
        sourceUrl: true,
        license: true,
        author: true,
        attribution: true,
        width: true,
        height: true,
      },
    }),
  ]);

  console.log("DATABASE OVERVIEW");
  console.log("----------------------------------------------------");
  console.log(`Cities:          ${totalCities}`);
  console.log(`Places:          ${totalPlaces}`);
  console.log(`PlaceImage rows: ${totalPlaceImages}`);
  console.log("");

  console.log("CITY IMAGE COVERAGE");
  console.log("----------------------------------------------------");

  let totalCoveredPlaces = 0;
  let totalUncoveredPlaces = 0;

  for (const cityName of EXPECTED_CITIES) {
    const cityPlaces = places.filter(
      (place) => place.city?.name === cityName,
    );

    const covered = cityPlaces.filter(
      (place) => place.images.length > 0,
    );

    const uncovered = cityPlaces.filter(
      (place) => place.images.length === 0,
    );

    totalCoveredPlaces += covered.length;
    totalUncoveredPlaces += uncovered.length;

    console.log(
      `${cityName.padEnd(10)} | ` +
        `Places: ${String(cityPlaces.length).padStart(5)} | ` +
        `With image: ${String(covered.length).padStart(5)} | ` +
        `Without: ${String(uncovered.length).padStart(5)} | ` +
        `Coverage: ${percentage(covered.length, cityPlaces.length)}%`,
    );
  }

  console.log("");
  console.log(
    `TOTAL      | Places: ${String(totalPlaces).padStart(5)} | ` +
      `With image: ${String(totalCoveredPlaces).padStart(5)} | ` +
      `Without: ${String(totalUncoveredPlaces).padStart(5)} | ` +
      `Coverage: ${percentage(totalCoveredPlaces, totalPlaces)}%`,
  );

  console.log("");
  console.log("IMAGES BY SOURCE");
  console.log("----------------------------------------------------");

  const sourceCounts = new Map<string, number>();

  for (const image of placeImages) {
    const source = image.source || "NULL";

    sourceCounts.set(
      source,
      (sourceCounts.get(source) ?? 0) + 1,
    );
  }

  const sortedSources = [...sourceCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  );

  for (const [source, count] of sortedSources) {
    console.log(
      `${source.padEnd(15)} | ${String(count).padStart(6)}`,
    );
  }

  console.log("");
  console.log("SOURCE COVERAGE BY CITY");
  console.log("----------------------------------------------------");

  for (const cityName of EXPECTED_CITIES) {
    const cityPlaces = places.filter(
      (place) => place.city?.name === cityName,
    );

    const sourcePlaceCounts = new Map<string, Set<string>>();

    for (const place of cityPlaces) {
      for (const image of place.images) {
        const source = image.source || "NULL";

        if (!sourcePlaceCounts.has(source)) {
          sourcePlaceCounts.set(source, new Set());
        }

        sourcePlaceCounts.get(source)!.add(place.id);
      }
    }

    console.log("");
    console.log(`${cityName}:`);

    for (const [source, placeIds] of [...sourcePlaceCounts.entries()].sort(
      (a, b) => b[1].size - a[1].size,
    )) {
      console.log(
        `  ${source.padEnd(15)} | Places covered: ${placeIds.size}`,
      );
    }
  }

  console.log("");
  console.log("DATABASE INTEGRITY");
  console.log("----------------------------------------------------");

  const placesWithoutCity = places.filter(
    (place) => !place.city,
  );

  const placesWithoutName = places.filter(
    (place) => !place.name || !place.name.trim(),
  );

  const placesWithoutOsmId = places.filter(
    (place) => !place.osmId,
  );

  const placesWithInvalidCoordinates = places.filter(
    (place) =>
      typeof place.latitude !== "number" ||
      typeof place.longitude !== "number" ||
      !Number.isFinite(place.latitude) ||
      !Number.isFinite(place.longitude) ||
      place.latitude < -90 ||
      place.latitude > 90 ||
      place.longitude < -180 ||
      place.longitude > 180,
  );

  console.log(
    `Places without City:              ${placesWithoutCity.length}`,
  );

  console.log(
    `Places without name:              ${placesWithoutName.length}`,
  );

  console.log(
    `Places without OSM ID:            ${placesWithoutOsmId.length}`,
  );

  console.log(
    `Places with invalid coordinates:  ${placesWithInvalidCoordinates.length}`,
  );

  const placeIds = new Set(places.map((place) => place.id));

  const orphanImages = placeImages.filter(
    (image) => !placeIds.has(image.placeId),
  );

  console.log(
    `Orphan PlaceImages:               ${orphanImages.length}`,
  );

  const imagesWithoutUrl = placeImages.filter(
    (image) => !image.url || !image.url.trim(),
  );

  const imagesWithoutSource = placeImages.filter(
    (image) => !image.source || !image.source.trim(),
  );

  console.log(
    `PlaceImages without URL:          ${imagesWithoutUrl.length}`,
  );

  console.log(
    `PlaceImages without source:       ${imagesWithoutSource.length}`,
  );

  console.log("");
  console.log("DUPLICATE CHECKS");
  console.log("----------------------------------------------------");

  const urlGroups = new Map<string, string[]>();

  for (const image of placeImages) {
    if (!image.url) continue;

    const ids = urlGroups.get(image.url) ?? [];
    ids.push(image.id);
    urlGroups.set(image.url, ids);
  }

  const duplicateUrls = [...urlGroups.entries()].filter(
    ([, ids]) => ids.length > 1,
  );

  console.log(
    `Duplicate image URLs:             ${duplicateUrls.length}`,
  );

  const sourceUrlGroups = new Map<string, string[]>();

  for (const image of placeImages) {
    if (!image.sourceUrl) continue;

    const ids = sourceUrlGroups.get(image.sourceUrl) ?? [];
    ids.push(image.id);
    sourceUrlGroups.set(image.sourceUrl, ids);
  }

  const duplicateSourceUrls = [...sourceUrlGroups.entries()].filter(
    ([, ids]) => ids.length > 1,
  );

  console.log(
    `Duplicate source URLs:            ${duplicateSourceUrls.length}`,
  );

  console.log("");
  console.log("IMAGE METADATA CHECK");
  console.log("----------------------------------------------------");

  const missingWidth = placeImages.filter(
    (image) => image.width === null || image.width === undefined,
  );

  const missingAttribution = placeImages.filter(
    (image) =>
      image.attribution === null ||
      image.attribution === undefined ||
      !image.attribution.trim(),
  );

  console.log(
    `Images without width:             ${missingWidth.length}`,
  );

  console.log(
    `Images without attribution:       ${missingAttribution.length}`,
  );

  console.log("");
  console.log("CITY DISTRIBUTION");
  console.log("----------------------------------------------------");

  const cityCounts = new Map<string, number>();

  for (const place of places) {
    const cityName = place.city?.name ?? "NULL";

    cityCounts.set(
      cityName,
      (cityCounts.get(cityName) ?? 0) + 1,
    );
  }

  for (const [cityName, count] of [...cityCounts.entries()].sort(
    (a, b) => a[0].localeCompare(b[0]),
  )) {
    console.log(
      `${cityName.padEnd(15)} | ${String(count).padStart(6)}`,
    );
  }

  console.log("");
  console.log("EXPECTED CITY CHECK");
  console.log("----------------------------------------------------");

  const expectedCityNames = new Set(EXPECTED_CITIES);

  const unexpectedCities = [...cityCounts.keys()].filter(
    (cityName) =>
      cityName !== "NULL" &&
      !expectedCityNames.has(cityName),
  );

  const missingExpectedCities = EXPECTED_CITIES.filter(
    (cityName) => !cityCounts.has(cityName),
  );

  console.log(
    `Unexpected cities:                ${unexpectedCities.length}`,
  );

  if (unexpectedCities.length > 0) {
    for (const city of unexpectedCities) {
      console.log(`  - ${city}`);
    }
  }

  console.log(
    `Missing expected cities:          ${missingExpectedCities.length}`,
  );

  if (missingExpectedCities.length > 0) {
    for (const city of missingExpectedCities) {
      console.log(`  - ${city}`);
    }
  }

  console.log("");
  console.log("====================================================");
  console.log("AUDIT COMPLETE");
  console.log("NO DATABASE CHANGES WERE MADE");
  console.log("====================================================");
  console.log("");

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("");
  console.error("AUDIT FAILED");
  console.error(error);
  console.error("");

  await prisma.$disconnect();
  process.exit(1);
});
