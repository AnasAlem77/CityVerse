import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const CITY_NAME = "Paris";
const TARGET_COUNT = 2500;
const MAX_DISTANCE_METERS = 60;
const REQUEST_DELAY_MS = 150;

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

type PanoramaxFeature = {
  id?: string;
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    distance?: number;
  };
};

type PanoramaxResponse = {
  features?: PanoramaxFeature[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value: unknown): number | null {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const earthRadius = 6371000;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  const c =
    2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    );

  return earthRadius * c;
}

async function findPanoramaxCandidate(
  latitude: number,
  longitude: number,
) {
  const params = new URLSearchParams({
    place_position: `${longitude},${latitude}`,
    place_distance: `0-${MAX_DISTANCE_METERS}`,
  });

  const response = await fetch(
    `https://api.panoramax.xyz/api/search?${params.toString()}`,
    {
      headers: {
        "User-Agent":
          "CityVerse/1.0 Panoramax audit",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data =
    (await response.json()) as PanoramaxResponse;

  const features = data.features ?? [];

  let best: {
    id: string;
    distance: number;
  } | null = null;

  for (const feature of features) {
    if (!feature.id) {
      continue;
    }

    const coordinates =
      feature.geometry?.coordinates;

    if (
      !coordinates ||
      coordinates.length < 2
    ) {
      continue;
    }

    const longitudeValue =
      toNumber(coordinates[0]);

    const latitudeValue =
      toNumber(coordinates[1]);

    if (
      latitudeValue === null ||
      longitudeValue === null
    ) {
      continue;
    }

    const distance =
      haversineDistanceMeters(
        latitude,
        longitude,
        latitudeValue,
        longitudeValue,
      );

    if (
      distance > MAX_DISTANCE_METERS
    ) {
      continue;
    }

    if (
      !best ||
      distance < best.distance
    ) {
      best = {
        id: feature.id,
        distance,
      };
    }
  }

  return best;
}

async function main() {
  console.log("");
  console.log("=== Panoramax Paris Audit ===");
  console.log("");

  const places = await prisma.place.findMany({
    where: {
      city: {
        name: CITY_NAME,
      },
      images: {
        none: {},
      },
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
    },
    orderBy: {
      id: "asc",
    },
    take: TARGET_COUNT,
  });

  console.log(
    `Target Places: ${places.length}`,
  );

  console.log(
    `Search Radius: ≤${MAX_DISTANCE_METERS}m`,
  );

  console.log("");

  let matched = 0;
  let errors = 0;

  const uniqueImages = new Set<string>();

  for (const place of places) {
    const latitude = toNumber(
      place.latitude,
    );

    const longitude = toNumber(
      place.longitude,
    );

    if (
      latitude === null ||
      longitude === null
    ) {
      errors++;
      continue;
    }

    try {
      const candidate =
        await findPanoramaxCandidate(
          latitude,
          longitude,
        );

      if (candidate) {
        matched++;
        uniqueImages.add(candidate.id);
      }
    } catch {
      errors++;
    }

    await sleep(REQUEST_DELAY_MS);
  }

  const coverage =
    places.length > 0
      ? (matched / places.length) * 100
      : 0;

  console.log("");
  console.log("=== RESULT ===");
  console.log("");

  console.log(
    `Target Places: ${places.length}`,
  );

  console.log(
    `Matched ≤60m: ${matched}`,
  );

  console.log(
    `Coverage: ${coverage.toFixed(2)}%`,
  );

  console.log(
    `Unique images: ${uniqueImages.size}`,
  );

  console.log(`Errors: ${errors}`);

  console.log("");
  console.log("=== END ===");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });