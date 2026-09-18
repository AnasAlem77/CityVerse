import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const ROOT = path.resolve(__dirname, "..");

const CITY_NAME =
  process.argv
    .find((arg) => arg.startsWith("--city="))
    ?.split("=")[1] ?? "Paris";

const MAX_DISTANCE_METERS = 60;

const REQUEST_DELAY_MS = 150;

const MAX_RETRIES = 3;

const IMAGE_WIDTH = 1280;

const WEBP_QUALITY = 82;

const CITY_SLUG = CITY_NAME.toLowerCase().replace(/\s+/g, "-");

const CHECKPOINT = path.join(
  ROOT,
  "logs",
  "panoramax-production",
  `${CITY_SLUG}-checkpoint.json`,
);

const REPORT = path.join(
  ROOT,
  "logs",
  "panoramax-production",
  `${CITY_SLUG}-report.json`,
);

const WRITE_MODE = process.argv.includes(
  "--write",
);

const RESET_CHECKPOINT = process.argv.includes(
  "--reset",
);

const DATABASE_URL =
  process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing from .env",
  );
}

const R2_ENDPOINT =
  process.env.R2_ENDPOINT;

const R2_ACCESS_KEY_ID =
  process.env.R2_ACCESS_KEY_ID;

const R2_SECRET_ACCESS_KEY =
  process.env.R2_SECRET_ACCESS_KEY;

const R2_BUCKET_NAME =
  process.env.R2_BUCKET_NAME;

if (
  !R2_ENDPOINT ||
  !R2_ACCESS_KEY_ID ||
  !R2_SECRET_ACCESS_KEY ||
  !R2_BUCKET_NAME
) {
  throw new Error(
    "R2 configuration is missing from .env",
  );
}

const adapter = new PrismaPg({
  connectionString: DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

type PlaceRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  city: {
    name: string;
  };
};

type PanoramaxCandidate = {
  id: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
};

type PanoramaxMetadata = {
  id?: string;
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: Record<
    string,
    unknown
  >;
  assets?: Record<
    string,
    {
      href?: string;
      type?: string;
      title?: string;
    }
  >;
};

type PanoramaxSearchResponse = {
  features?: PanoramaxMetadata[];
};

type ResultStatus =
  | "selected"
  | "no_candidate"
  | "error"
  | "imported"
  | "skipped";

type ProductionResult = {
  placeId: string;
  placeName: string;
  city: string;
  status: ResultStatus;
  distanceMeters: number | null;
  panoramaxId: string | null;
  imageUrl: string | null;
  r2Key: string | null;
  error?: string;
};

type Checkpoint = {
  city: string;
  generatedAt: string;
  completed: string[];
  results: ProductionResult[];
};

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
  decimals = 2,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(value * factor) /
    factor
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
    ((lat2 - lat1) * Math.PI) /
    180;

  const dLon =
    ((lon2 - lon1) * Math.PI) /
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

function ensureDirectory(
  filePath: string,
) {
  fs.mkdirSync(
    path.dirname(filePath),
    {
      recursive: true,
    },
  );
}

function saveCheckpoint(
  checkpoint: Checkpoint,
) {
  ensureDirectory(CHECKPOINT);

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
      "Checkpoint could not be read. Starting fresh.",
    );

    return null;
  }
}

async function fetchJson(
  url: string,
): Promise<any> {
  let lastError: Error | null =
    null;

  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      const response =
        await fetch(url, {
          headers: {
            Accept:
              "application/geo+json, application/json",
            "User-Agent":
              "CityVerse/1.0 Panoramax image acquisition",
          },
        });

      if (!response.ok) {
        const body =
          await response.text();

        throw new Error(
          `HTTP ${response.status}: ${body.slice(
            0,
            500,
          )}`,
        );
      }

      return await response.json();
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(
              String(error),
            );

      if (
        attempt < MAX_RETRIES
      ) {
        await sleep(
          attempt * 1500,
        );
      }
    }
  }

  throw (
    lastError ??
    new Error(
      "Unknown Panoramax API error",
    )
  );
}

async function findNearestPanoramaxImage(
  place: PlaceRow,
): Promise<PanoramaxCandidate | null> {
  const params =
    new URLSearchParams({
      place_position: `${place.longitude},${place.latitude}`,
      place_distance: `0-${MAX_DISTANCE_METERS}`,
    });

  const url =
    `https://api.panoramax.xyz/api/search?${params.toString()}`;

  const data =
    (await fetchJson(
      url,
    )) as PanoramaxSearchResponse;

  const features =
    Array.isArray(data.features)
      ? data.features
      : [];

  let best:
    | PanoramaxCandidate
    | null = null;

  for (const feature of features) {
    if (!feature.id) {
      continue;
    }

    const coordinates =
      feature.geometry
        ?.coordinates;

    if (
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
      !Number.isFinite(
        imageLatitude,
      ) ||
      !Number.isFinite(
        imageLongitude,
      )
    ) {
      continue;
    }

    const distance =
      distanceMeters(
        place.latitude,
        place.longitude,
        imageLatitude,
        imageLongitude,
      );

    if (
      distance >
      MAX_DISTANCE_METERS
    ) {
      continue;
    }

    if (
      !best ||
      distance <
        best.distanceMeters
    ) {
      best = {
        id: feature.id,
        latitude:
          imageLatitude,
        longitude:
          imageLongitude,
        distanceMeters:
          distance,
      };
    }
  }

  return best;
}

async function getPanoramaxMetadata(
  imageId: string,
): Promise<PanoramaxMetadata> {
  const url =
    `https://api.panoramax.xyz/api/search?ids=${encodeURIComponent(
      imageId,
    )}`;

  const data =
    (await fetchJson(
      url,
    )) as PanoramaxSearchResponse;

  const feature =
    data.features?.find(
      (item) =>
        item.id === imageId,
    );

  if (!feature) {
    throw new Error(
      `Panoramax metadata not found for ${imageId}`,
    );
  }

  return feature;
}

function getImageUrl(
  metadata: PanoramaxMetadata,
  imageId: string,
): string {
  const sd =
    metadata.assets?.sd?.href;

  if (sd) {
    return sd;
  }

  return `https://api.panoramax.xyz/api/pictures/${encodeURIComponent(
    imageId,
  )}/sd.jpg`;
}

async function downloadImage(
  url: string,
): Promise<Buffer> {
  let lastError: Error | null =
    null;

  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      const response =
        await fetch(url, {
          headers: {
            Accept:
              "image/jpeg,image/*",
            "User-Agent":
              "CityVerse/1.0 Panoramax image acquisition",
          },
        });

      if (!response.ok) {
        throw new Error(
          `Image HTTP ${response.status}`,
        );
      }

      const arrayBuffer =
        await response.arrayBuffer();

      const buffer =
        Buffer.from(arrayBuffer);

      if (!buffer.length) {
        throw new Error(
          "Downloaded image is empty",
        );
      }

      return buffer;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(
              String(error),
            );

      if (
        attempt < MAX_RETRIES
      ) {
        await sleep(
          attempt * 1500,
        );
      }
    }
  }

  throw (
    lastError ??
    new Error(
      "Image download failed",
    )
  );
}

async function optimizeImage(
  input: Buffer,
) {
  return sharp(input)
    .rotate()
    .resize({
      width: IMAGE_WIDTH,
      withoutEnlargement: true,
    })
    .webp({
      quality: WEBP_QUALITY,
    })
    .toBuffer({
      resolveWithObject: true,
    });
}

async function uploadToR2(
  key: string,
  buffer: Buffer,
) {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType:
        "image/webp",
      CacheControl:
        "public, max-age=31536000, immutable",
    }),
  );
}

async function processPlace(
  place: PlaceRow,
): Promise<ProductionResult> {
  const existing =
    await prisma.placeImage.findFirst(
      {
        where: {
          placeId: place.id,
        },
        select: {
          id: true,
        },
      },
    );

  if (existing) {
    return {
      placeId: place.id,
      placeName: place.name,
      city: place.city.name,
      status: "skipped",
      distanceMeters: null,
      panoramaxId: null,
      imageUrl: null,
      r2Key: null,
    };
  }

  const candidate =
    await findNearestPanoramaxImage(
      place,
    );

  if (!candidate) {
    return {
      placeId: place.id,
      placeName: place.name,
      city: place.city.name,
      status: "no_candidate",
      distanceMeters: null,
      panoramaxId: null,
      imageUrl: null,
      r2Key: null,
    };
  }

  const metadata =
    await getPanoramaxMetadata(
      candidate.id,
    );

  const imageUrl =
    getImageUrl(
      metadata,
      candidate.id,
    );

  if (!WRITE_MODE) {
    return {
      placeId: place.id,
      placeName: place.name,
      city: place.city.name,
      status: "selected",
      distanceMeters: round(
        candidate.distanceMeters,
      ),
      panoramaxId:
        candidate.id,
      imageUrl,
      r2Key: null,
    };
  }

  const verifyExisting =
    await prisma.placeImage.findFirst(
      {
        where: {
          placeId: place.id,
        },
        select: {
          id: true,
        },
      },
    );

  if (verifyExisting) {
    return {
      placeId: place.id,
      placeName: place.name,
      city: place.city.name,
      status: "skipped",
      distanceMeters: null,
      panoramaxId: null,
      imageUrl: null,
      r2Key: null,
    };
  }

  const original =
    await downloadImage(
      imageUrl,
    );

  const optimized =
    await optimizeImage(
      original,
    );

  const r2Key =
    `places/${place.id}/${candidate.id}.webp`;

  await uploadToR2(
    r2Key,
    optimized.data,
  );

  const properties =
    metadata.properties ?? {};

  const producer =
    typeof properties[
      "geovisio:producer"
    ] === "string"
      ? properties[
          "geovisio:producer"
        ]
      : null;

  const license =
    typeof properties.license ===
    "string"
      ? properties.license
      : null;

  const attribution =
    producer
      ? `${producer} / Panoramax`
      : "Panoramax";

  await prisma.placeImage.create({
    data: {
      placeId: place.id,
      url: `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${r2Key}`,
      source: "panoramax",
      sourceUrl: `https://api.panoramax.xyz/#focus=pic&pic=${candidate.id}`,
      license,
      author: producer,
      attribution,
      width:
        optimized.info.width,
      height:
        optimized.info.height,
    },
  });

  return {
    placeId: place.id,
    placeName: place.name,
    city: place.city.name,
    status: "imported",
    distanceMeters: round(
      candidate.distanceMeters,
    ),
    panoramaxId:
      candidate.id,
    imageUrl,
    r2Key,
  };
}

async function main() {
  console.log("");
  console.log(
    "====================================================",
  );
  console.log(
    "CityVerse — Panoramax Production",
  );
  console.log(
    "====================================================",
  );
  console.log("");

  console.log(
    `City: ${CITY_NAME}`,
  );

  console.log(
    `Maximum distance: ≤${MAX_DISTANCE_METERS}m`,
  );

  console.log(
    `Mode: ${
      WRITE_MODE
        ? "WRITE"
        : "DRY RUN"
    }`,
  );

  console.log("");

  if (
    WRITE_MODE
  ) {
    console.log(
      "WARNING: images will be downloaded, uploaded to R2, and written to PlaceImage.",
    );

    console.log("");
  }

  const places =
    (await prisma.place.findMany(
      {
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
      },
    )) as unknown as PlaceRow[];

  console.log(
    `Places without images: ${places.length}`,
  );

  console.log("");

  let checkpoint =
    loadCheckpoint();

  if (
    !checkpoint ||
    checkpoint.city !== CITY_NAME
  ) {
    checkpoint = {
      city: CITY_NAME,
      generatedAt:
        new Date().toISOString(),
      completed: [],
      results: [],
    };

    saveCheckpoint(
      checkpoint,
    );
  }

  const completed =
    new Set(
      checkpoint.completed,
    );

  const results = new Map<
    string,
    ProductionResult
  >();

  for (const result of checkpoint.results) {
    results.set(
      result.placeId,
      result,
    );
  }

  let processed = 0;

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

    try {
      const result =
        await processPlace(
          place,
        );

      results.set(
        place.id,
        result,
      );

      completed.add(
        place.id,
      );

      checkpoint.completed =
        [...completed];

      checkpoint.results =
        [...results.values()];

      saveCheckpoint(
        checkpoint,
      );

      if (
        result.status ===
        "imported"
      ) {
        console.log(
          `    ✓ Imported | ${result.distanceMeters}m | ${result.panoramaxId}`,
        );
      } else if (
        result.status ===
        "selected"
      ) {
        console.log(
          `    ✓ Selected | ${result.distanceMeters}m | ${result.panoramaxId}`,
        );
      } else if (
        result.status ===
        "skipped"
      ) {
        console.log(
          "    Existing PlaceImage — skipped",
        );
      } else {
        console.log(
          "    No valid candidate",
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      const result: ProductionResult =
        {
          placeId: place.id,
          placeName: place.name,
          city: place.city.name,
          status: "error",
          distanceMeters: null,
          panoramaxId: null,
          imageUrl: null,
          r2Key: null,
          error: message,
        };

      results.set(
        place.id,
        result,
      );

      completed.add(
        place.id,
      );

      checkpoint.completed =
        [...completed];

      checkpoint.results =
        [...results.values()];

      saveCheckpoint(
        checkpoint,
      );

      console.log(
        `    ERROR: ${message}`,
      );
    }

    await sleep(
      REQUEST_DELAY_MS,
    );
  }

  const finalResults =
    [...results.values()];

  const selected =
    finalResults.filter(
      (result) =>
        result.status ===
          "selected" ||
        result.status ===
          "imported",
    );

  const imported =
    finalResults.filter(
      (result) =>
        result.status ===
        "imported",
    );

  const skipped =
    finalResults.filter(
      (result) =>
        result.status ===
        "skipped",
    );

  const noCandidate =
    finalResults.filter(
      (result) =>
        result.status ===
        "no_candidate",
    );

  const errors =
    finalResults.filter(
      (result) =>
        result.status ===
        "error",
    );

  const uniqueImages =
    new Set(
      selected
        .map(
          (result) =>
            result.panoramaxId,
        )
        .filter(
          (
            value,
          ): value is string =>
            Boolean(value),
        ),
    );

  const report = {
    city: CITY_NAME,
    mode: WRITE_MODE
      ? "write"
      : "dry-run",
    generatedAt:
      new Date().toISOString(),
    placesTested:
      finalResults.length,
    selected:
      selected.length,
    imported:
      imported.length,
    skipped:
      skipped.length,
    noCandidate:
      noCandidate.length,
    errors:
      errors.length,
    uniqueSelectedImages:
      uniqueImages.size,
    averageDistanceMeters:
      selected.length
        ? round(
            selected.reduce(
              (sum, result) =>
                sum +
                (result.distanceMeters ??
                  0),
              0,
            ) /
              selected.length,
          )
        : null,
  };

  ensureDirectory(
    REPORT,
  );

  fs.writeFileSync(
    REPORT,
    JSON.stringify(
      {
        summary: report,
        results: finalResults,
      },
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
    "PANORAMAX RESULT",
  );
  console.log(
    "====================================================",
  );
  console.log(
    `Places tested:       ${finalResults.length}`,
  );
  console.log(
    `Selected:            ${selected.length}`,
  );
  console.log(
    `Imported:            ${imported.length}`,
  );
  console.log(
    `Skipped:             ${skipped.length}`,
  );
  console.log(
    `No candidate:        ${noCandidate.length}`,
  );
  console.log(
    `Errors:              ${errors.length}`,
  );
  console.log(
    `Unique images:       ${uniqueImages.size}`,
  );
  console.log(
    `Average distance:    ${
      report.averageDistanceMeters ??
      "N/A"
    }m`,
  );
  console.log("");
  console.log(
    `Checkpoint: ${CHECKPOINT}`,
  );
  console.log(
    `Report:     ${REPORT}`,
  );
  console.log(
    "====================================================",
  );
}

main()
  .catch((error) => {
    console.error("");
    console.error(
      "Fatal error:",
    );
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
