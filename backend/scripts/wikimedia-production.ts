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
const SEARCH_RADIUS_METERS = 60;
const REQUEST_DELAY_MS = 1500;
const MAX_RETRIES = 3;
const IMAGE_WIDTH = 1280;
const WEBP_QUALITY = 82;

const CITY_SLUG = CITY_NAME.toLowerCase().replace(/\s+/g, "-");

const CHECKPOINT = path.join(
  ROOT,
  "logs",
  "wikimedia-production",
  `${CITY_SLUG}-checkpoint.json`,
);

const REPORT = path.join(
  ROOT,
  "logs",
  "wikimedia-production",
  `${CITY_SLUG}-report.json`,
);

const WRITE_MODE = process.argv.includes("--write");
const RESET_CHECKPOINT = process.argv.includes("--reset");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from .env");
}

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (
  !R2_ENDPOINT ||
  !R2_ACCESS_KEY_ID ||
  !R2_SECRET_ACCESS_KEY ||
  !R2_BUCKET_NAME
) {
  throw new Error("R2 configuration is missing from .env");
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

const WIKIMEDIA_API =
  "https://commons.wikimedia.org/w/api.php";

type PlaceRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  city: {
    name: string;
  };
};

type WikimediaCandidate = {
  title: string;
  pageId: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  imageUrl: string;
  pageUrl: string;
  author: string | null;
  license: string | null;
  licenseUrl: string | null;
  attribution: string;
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
  wikimediaTitle: string | null;
  wikimediaPageUrl: string | null;
  imageUrl: string | null;
  r2Key: string | null;
  author: string | null;
  license: string | null;
  licenseUrl: string | null;
  error?: string;
};

type Checkpoint = {
  city: string;
  generatedAt: string;
  completed: string[];
  results: ProductionResult[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
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

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    );

  return earthRadius * c;
}

function ensureDirectory(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true,
  });
}

function saveCheckpoint(checkpoint: Checkpoint) {
  ensureDirectory(CHECKPOINT);

  fs.writeFileSync(
    CHECKPOINT,
    JSON.stringify(checkpoint, null, 2),
    "utf8",
  );
}

function loadCheckpoint(): Checkpoint | null {
  if (
    RESET_CHECKPOINT ||
    !fs.existsSync(CHECKPOINT)
  ) {
    return null;
  }

  try {
    return JSON.parse(
      fs.readFileSync(CHECKPOINT, "utf8"),
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
          "User-Agent":
            "CityVerse/1.0 (Wikimedia image acquisition)",
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get("retry-after");
          const retrySeconds = retryAfter
            ? Number(retryAfter)
            : attempt * 10;

          const waitSeconds = Number.isFinite(retrySeconds)
            ? Math.max(retrySeconds, 10)
            : attempt * 10;

          console.log(
            `    Rate limited by Wikimedia. Waiting ${waitSeconds}s before retry...`,
          );

          if (attempt < MAX_RETRIES) {
            await sleep(waitSeconds * 1000);
            continue;
          }
        }

        const body = await response.text();

        throw new Error(
          `HTTP ${response.status}: ${body.slice(0, 500)}`,
        );
      }

      return await response.json();
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(String(error));

      if (attempt < MAX_RETRIES) {
        await sleep(attempt * 1500);
      }
    }
  }

  throw (
    lastError ??
    new Error("Unknown Wikimedia API error")
  );
}
function cleanMetadataValue(
  value: unknown,
): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const cleaned = value
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .trim();

    return cleaned || null;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "value" in value
  ) {
    const nested = (value as { value?: unknown }).value;

    if (typeof nested === "string") {
      const cleaned = nested
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/gi, " ")
        .trim();

      return cleaned || null;
    }
  }

  return null;
}

function isUsableLicense(
  license: string | null,
  licenseUrl: string | null,
): boolean {
  if (!license && !licenseUrl) {
    return false;
  }

  const combined =
    `${license ?? ""} ${licenseUrl ?? ""}`.toLowerCase();

  const allowedPatterns = [
    "creative commons",
    "cc by",
    "cc-by",
    "cc by-sa",
    "cc-by-sa",
    "public domain",
    "cc0",
    "gfdl",
    "free art license",
    "fal",
  ];

  return allowedPatterns.some((pattern) =>
    combined.includes(pattern),
  );
}

async function findNearestWikimediaImage(
  place: PlaceRow,
): Promise<WikimediaCandidate | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "geosearch",
    ggsprimary: "all",
    ggsnamespace: "6",
    ggsradius: String(SEARCH_RADIUS_METERS),
    ggslimit: "50",
    ggscoord: `${place.latitude}|${place.longitude}`,
    prop: "imageinfo|coordinates",
    iiprop: "url|extmetadata|size",
    iiurlwidth: "1600",
  });

  const url =
    `${WIKIMEDIA_API}?${params.toString()}`;

  const data = await fetchJson(url);

  const pages = data?.query?.pages;

  if (!pages || typeof pages !== "object") {
    return null;
  }

  let best: WikimediaCandidate | null = null;

  for (const page of Object.values<any>(pages)) {
    const coordinates =
      Array.isArray(page.coordinates)
        ? page.coordinates[0]
        : null;

    const imageInfo =
      Array.isArray(page.imageinfo)
        ? page.imageinfo[0]
        : null;

    if (!coordinates || !imageInfo) {
      continue;
    }

    const imageLatitude =
      Number(coordinates.lat);

    const imageLongitude =
      Number(coordinates.lon);

    if (
      !Number.isFinite(imageLatitude) ||
      !Number.isFinite(imageLongitude)
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

    if (distance > MAX_DISTANCE_METERS) {
      continue;
    }

    const imageUrl =
      typeof imageInfo.thumburl === "string"
        ? imageInfo.thumburl
        : typeof imageInfo.url === "string"
          ? imageInfo.url
          : null;

    if (!imageUrl) {
      continue;
    }

    const metadata =
      imageInfo.extmetadata ?? {};

    const author =
      cleanMetadataValue(
        metadata.Artist,
      ) ??
      cleanMetadataValue(
        metadata.Author,
      );

    const license =
      cleanMetadataValue(
        metadata.LicenseShortName,
      ) ??
      cleanMetadataValue(
        metadata.License,
      );

    const licenseUrl =
      cleanMetadataValue(
        metadata.LicenseUrl,
      );

    if (
      !isUsableLicense(
        license,
        licenseUrl,
      )
    ) {
      continue;
    }

    const title =
      typeof page.title === "string"
        ? page.title
        : null;

    if (!title) {
      continue;
    }

    const pageId =
      String(page.pageid ?? "");

    const pageUrl =
      `https://commons.wikimedia.org/wiki/${encodeURIComponent(
        title.replace(/ /g, "_"),
      )}`;

    const attribution =
      author
        ? `${author} / Wikimedia Commons`
        : "Wikimedia Commons";

    const candidate: WikimediaCandidate = {
      title,
      pageId,
      latitude: imageLatitude,
      longitude: imageLongitude,
      distanceMeters: distance,
      imageUrl,
      pageUrl,
      author,
      license,
      licenseUrl,
      attribution,
    };

    if (
      !best ||
      candidate.distanceMeters <
        best.distanceMeters
    ) {
      best = candidate;
    }
  }

  return best;
}

async function downloadImage(
  url: string,
): Promise<Buffer> {
  let lastError: Error | null = null;

  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "image/jpeg,image/png,image/webp,image/*",
          "User-Agent":
            "CityVerse/1.0 (Wikimedia image acquisition)",
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
          : new Error(String(error));

      if (attempt < MAX_RETRIES) {
        await sleep(attempt * 1500);
      }
    }
  }

  throw (
    lastError ??
    new Error("Image download failed")
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
      ContentType: "image/webp",
      CacheControl:
        "public, max-age=31536000, immutable",
    }),
  );
}

async function processPlace(
  place: PlaceRow,
): Promise<ProductionResult> {
  const existing =
    await prisma.placeImage.findFirst({
      where: {
        placeId: place.id,
      },
      select: {
        id: true,
      },
    });

  if (existing) {
    return {
      placeId: place.id,
      placeName: place.name,
      city: place.city.name,
      status: "skipped",
      distanceMeters: null,
      wikimediaTitle: null,
      wikimediaPageUrl: null,
      imageUrl: null,
      r2Key: null,
      author: null,
      license: null,
      licenseUrl: null,
    };
  }

  const candidate =
    await findNearestWikimediaImage(
      place,
    );

  if (!candidate) {
    return {
      placeId: place.id,
      placeName: place.name,
      city: place.city.name,
      status: "no_candidate",
      distanceMeters: null,
      wikimediaTitle: null,
      wikimediaPageUrl: null,
      imageUrl: null,
      r2Key: null,
      author: null,
      license: null,
      licenseUrl: null,
    };
  }

  if (!WRITE_MODE) {
    return {
      placeId: place.id,
      placeName: place.name,
      city: place.city.name,
      status: "selected",
      distanceMeters: round(
        candidate.distanceMeters,
      ),
      wikimediaTitle: candidate.title,
      wikimediaPageUrl: candidate.pageUrl,
      imageUrl: candidate.imageUrl,
      r2Key: null,
      author: candidate.author,
      license: candidate.license,
      licenseUrl: candidate.licenseUrl,
    };
  }

  const verifyExisting =
    await prisma.placeImage.findFirst({
      where: {
        placeId: place.id,
      },
      select: {
        id: true,
      },
    });

  if (verifyExisting) {
    return {
      placeId: place.id,
      placeName: place.name,
      city: place.city.name,
      status: "skipped",
      distanceMeters: null,
      wikimediaTitle: null,
      wikimediaPageUrl: null,
      imageUrl: null,
      r2Key: null,
      author: null,
      license: null,
      licenseUrl: null,
    };
  }

  const original =
    await downloadImage(
      candidate.imageUrl,
    );

  const optimized =
    await optimizeImage(
      original,
    );

  const safePageId =
    candidate.pageId || "unknown";

  const r2Key =
    `places/${place.id}/wikimedia-${safePageId}.webp`;

  await uploadToR2(
    r2Key,
    optimized.data,
  );

  await prisma.placeImage.create({
    data: {
      placeId: place.id,
      url: `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${r2Key}`,
      source: "wikimedia_commons",
      sourceUrl: candidate.pageUrl,
      license: candidate.licenseUrl
        ? `${candidate.license ?? "Wikimedia Commons"} (${candidate.licenseUrl})`
        : candidate.license,
      author: candidate.author,
      attribution: candidate.attribution,
      width: optimized.info.width,
      height: optimized.info.height,
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
    wikimediaTitle: candidate.title,
    wikimediaPageUrl: candidate.pageUrl,
    imageUrl: candidate.imageUrl,
    r2Key,
    author: candidate.author,
    license: candidate.license,
    licenseUrl: candidate.licenseUrl,
  };
}

async function main() {
  console.log("");
  console.log(
    "====================================================",
  );
  console.log(
    "CityVerse — Wikimedia Commons Production",
  );
  console.log(
    "====================================================",
  );
  console.log("");

  console.log(`City: ${CITY_NAME}`);
  console.log(
    `Maximum distance: ≤${MAX_DISTANCE_METERS}m`,
  );
  console.log(
    `Mode: ${WRITE_MODE ? "WRITE" : "DRY RUN"}`,
  );

  console.log("");

  if (WRITE_MODE) {
    console.log(
      "WARNING: images will be downloaded, uploaded to R2, and written to PlaceImage.",
    );
    console.log("");
  }

  const places =
    (await prisma.place.findMany({
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
    })) as unknown as PlaceRow[];

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

    saveCheckpoint(checkpoint);
  }

  const completed =
    new Set(checkpoint.completed);

  const results = new Map<
    string,
    ProductionResult
  >();

  for (const result of checkpoint.results) {
    results.set(result.placeId, result);
  }

  let processed = 0;

  for (const place of places) {
    const existingResult =
      results.get(place.id);

    const shouldRetry =
      existingResult?.status === "error";

    if (
      completed.has(place.id) &&
      !shouldRetry
    ) {
      continue;
    }

    processed++;

    console.log(
      `[${processed}/${places.length}] ${place.name}`,
    );

    try {
      if (shouldRetry) {
        results.delete(place.id);
        completed.delete(place.id);
      }

      const result =
        await processPlace(place);

      results.set(place.id, result);
      completed.add(place.id);

      checkpoint.completed =
        [...completed];

      checkpoint.results =
        [...results.values()];

      saveCheckpoint(checkpoint);

      if (result.status === "imported") {
        console.log(
          `    ✓ Imported | ${result.distanceMeters}m | ${result.wikimediaTitle}`,
        );
      } else if (
        result.status === "selected"
      ) {
        console.log(
          `    ✓ Selected | ${result.distanceMeters}m | ${result.wikimediaTitle}`,
        );
      } else if (
        result.status === "skipped"
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

      const result: ProductionResult = {
        placeId: place.id,
        placeName: place.name,
        city: place.city.name,
        status: "error",
        distanceMeters: null,
        wikimediaTitle: null,
        wikimediaPageUrl: null,
        imageUrl: null,
        r2Key: null,
        author: null,
        license: null,
        licenseUrl: null,
        error: message,
      };

      results.set(place.id, result);

      completed.delete(place.id);

      checkpoint.completed =
        [...completed];

      checkpoint.results =
        [...results.values()];

      saveCheckpoint(checkpoint);

      console.log(
        `    ERROR: ${message}`,
      );
    }

    await sleep(REQUEST_DELAY_MS);
  }

  const finalResults =
    [...results.values()];

  const selected =
    finalResults.filter(
      (result) =>
        result.status === "selected" ||
        result.status === "imported",
    );

  const imported =
    finalResults.filter(
      (result) =>
        result.status === "imported",
    );

  const skipped =
    finalResults.filter(
      (result) =>
        result.status === "skipped",
    );

  const noCandidate =
    finalResults.filter(
      (result) =>
        result.status === "no_candidate",
    );

  const errors =
    finalResults.filter(
      (result) =>
        result.status === "error",
    );

  const uniqueImages =
    new Set(
      selected
        .map(
          (result) =>
            result.wikimediaTitle,
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
                (result.distanceMeters ?? 0),
              0,
            ) / selected.length,
          )
        : null,
  };

  ensureDirectory(REPORT);

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
    "WIKIMEDIA RESULT",
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
      report.averageDistanceMeters ?? "N/A"
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
    console.error("Fatal error:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
