import "dotenv/config";
import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const CITY = (
  process.argv
    .find((arg) => arg.startsWith("--city="))
    ?.split("=")[1] ?? "Paris"
).trim();

const RESET = process.argv.includes("--reset");

const CITY_SLUG = CITY.toLowerCase().replace(/\s+/g, "-");

const CHECKPOINT_PATH = path.join(
  process.cwd(),
  "logs",
  "mapillary-production",
  `${CITY_SLUG}-checkpoint.json`,
);

const IMPORT_CHECKPOINT_PATH = path.join(
  process.cwd(),
  "logs",
  "mapillary-production",
  `${CITY_SLUG}-import-checkpoint.json`,
);

const REPORT_PATH = path.join(
  process.cwd(),
  "logs",
  "mapillary-production",
  `${CITY_SLUG}-import-report.json`,
);

const IMAGE_WIDTH = 1280;
const WEBP_QUALITY = 82;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const REQUEST_DELAY_MS = 250;
const MAX_RETRIES = 3;

type SelectedRecord = {
  placeId: string;
  placeName: string;
  city: string;
  status: string;
  selected?: {
    id: string;
    latitude: number;
    longitude: number;
    distanceMeters: number;
    qualityScore: number;
    capturedAt: number;
    thumbnailUrl: string;
    width?: number;
    height?: number;
    creatorUsername?: string;
  };
};

type ImportStatus =
  | "imported"
  | "skipped_existing"
  | "error";

type ImportRecord = {
  placeId: string;
  placeName: string;
  mapillaryId: string;
  status: ImportStatus;
  r2Key?: string;
  error?: string;
};

type ImportCheckpoint = {
  city: string;
  generatedAt: string;
  results: ImportRecord[];
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadMapillaryCheckpoint(): SelectedRecord[] {
  if (!fs.existsSync(CHECKPOINT_PATH)) {
    throw new Error(
      `Mapillary checkpoint not found: ${CHECKPOINT_PATH}`,
    );
  }

  const checkpoint = JSON.parse(
    fs.readFileSync(CHECKPOINT_PATH, "utf8"),
  ) as {
    city?: string;
    results?: SelectedRecord[];
  };

  if (!Array.isArray(checkpoint.results)) {
    throw new Error(
      "Invalid Mapillary checkpoint: results[] not found.",
    );
  }

  return checkpoint.results.filter(
    (result) =>
      result.status === "selected" &&
      result.selected?.id &&
      result.selected.thumbnailUrl,
  );
}

function loadImportCheckpoint(): ImportCheckpoint {
  if (
    RESET ||
    !fs.existsSync(IMPORT_CHECKPOINT_PATH)
  ) {
    return {
      city: CITY,
      generatedAt: new Date().toISOString(),
      results: [],
    };
  }

  return JSON.parse(
    fs.readFileSync(
      IMPORT_CHECKPOINT_PATH,
      "utf8",
    ),
  ) as ImportCheckpoint;
}

function saveImportCheckpoint(
  checkpoint: ImportCheckpoint,
) {
  fs.writeFileSync(
    IMPORT_CHECKPOINT_PATH,
    JSON.stringify(checkpoint, null, 2),
  );
}

async function downloadImage(
  url: string,
): Promise<Buffer> {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      const controller = new AbortController();

      const timeout = setTimeout(
        () => controller.abort(),
        DOWNLOAD_TIMEOUT_MS,
      );

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: "image/avif,image/webp,image/jpeg,image/png,*/*",
            "User-Agent": "CityVerse/1.0",
          },
        });

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status} ${response.statusText}`,
          );
        }

        const arrayBuffer =
          await response.arrayBuffer();

        if (arrayBuffer.byteLength === 0) {
          throw new Error(
            "Downloaded image is empty.",
          );
        }

        return Buffer.from(arrayBuffer);
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      lastError = error;

      if (attempt < MAX_RETRIES) {
        await sleep(1000 * attempt);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Image download failed.");
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

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing.",
    );
  }

  if (
    !process.env.R2_ENDPOINT ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY ||
    !process.env.R2_BUCKET_NAME
  ) {
    throw new Error(
      "R2 environment variables are missing.",
    );
  }

  fs.mkdirSync(
    path.dirname(IMPORT_CHECKPOINT_PATH),
    { recursive: true },
  );

  const selected =
    loadMapillaryCheckpoint();

  const checkpoint =
    loadImportCheckpoint();

  const existingResults = new Map(
    checkpoint.results.map(
      (result) => [result.placeId, result],
    ),
  );

  let imported = 0;
  let skippedExisting = 0;
  let errors = 0;

  console.log("");
  console.log(
    "====================================================",
  );
  console.log("MAPILLARY PRODUCTION IMPORT");
  console.log(
    "====================================================",
  );
  console.log(`City:              ${CITY}`);
  console.log(
    `Selected records:  ${selected.length}`,
  );
  console.log(
    `Existing import checkpoint: ${checkpoint.results.length}`,
  );
  console.log(
    `Mode:              WRITE`,
  );
  console.log(
    "====================================================",
  );
  console.log("");

  for (
    let index = 0;
    index < selected.length;
    index++
  ) {
    const item = selected[index];

    const previous =
      existingResults.get(item.placeId);

    if (
      previous?.status === "imported" ||
      previous?.status === "skipped_existing"
    ) {
      continue;
    }

    const selectedImage = item.selected!;

    console.log(
      `[${index + 1}/${selected.length}] ${item.placeName}`,
    );

    try {
      const place =
        await prisma.place.findUnique({
          where: {
            id: item.placeId,
          },
          select: {
            id: true,
            name: true,
            images: {
              select: {
                id: true,
              },
              take: 1,
            },
          },
        });

      if (!place) {
        throw new Error(
          `Place not found: ${item.placeId}`,
        );
      }

      if (place.images.length > 0) {
        skippedExisting++;

        const record: ImportRecord = {
          placeId: item.placeId,
          placeName: item.placeName,
          mapillaryId: selectedImage.id,
          status: "skipped_existing",
        };

        existingResults.set(
          item.placeId,
          record,
        );

        checkpoint.results = [
          ...existingResults.values(),
        ];

        saveImportCheckpoint(checkpoint);

        console.log(
          "  → Skipped | Place already has an image",
        );

        continue;
      }

      const originalImage =
        await downloadImage(
          selectedImage.thumbnailUrl,
        );

      const optimized =
        await optimizeImage(originalImage);

      const r2Key =
        `places/${item.placeId}/${selectedImage.id}.webp`;

      await r2Client.send(
        new PutObjectCommand({
          Bucket:
            process.env.R2_BUCKET_NAME!,
          Key: r2Key,
          Body: optimized.data,
          ContentType: "image/webp",
          CacheControl:
            "public,max-age=31536000,immutable",
        }),
      );

      const r2Url =
        `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}/${r2Key}`;

      const creator =
        selectedImage.creatorUsername?.trim() ||
        null;

      const attribution =
        creator
          ? `© ${creator} / Mapillary`
          : "© Mapillary";

      await prisma.placeImage.create({
        data: {
          placeId: item.placeId,
          url: r2Url,
          source: "mapillary",
          sourceUrl:
            `https://www.mapillary.com/app/?pKey=${selectedImage.id}`,
          license: "CC BY-SA",
          author: creator,
          attribution,
          width: optimized.info.width,
          height: optimized.info.height,
        },
      });

      imported++;

      const record: ImportRecord = {
        placeId: item.placeId,
        placeName: item.placeName,
        mapillaryId: selectedImage.id,
        status: "imported",
        r2Key,
      };

      existingResults.set(
        item.placeId,
        record,
      );

      checkpoint.results = [
        ...existingResults.values(),
      ];

      saveImportCheckpoint(checkpoint);

      console.log(
        `  ✓ Imported | ${selectedImage.distanceMeters.toFixed(2)}m | Q ${selectedImage.qualityScore.toFixed(3)}`,
      );
    } catch (error) {
      errors++;

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      const record: ImportRecord = {
        placeId: item.placeId,
        placeName: item.placeName,
        mapillaryId: selectedImage.id,
        status: "error",
        error: message,
      };

      existingResults.set(
        item.placeId,
        record,
      );

      checkpoint.results = [
        ...existingResults.values(),
      ];

      saveImportCheckpoint(checkpoint);

      console.log(
        `  ✗ Error | ${message}`,
      );
    }

    await sleep(REQUEST_DELAY_MS);
  }

  const finalResults = [
    ...existingResults.values(),
  ];

  const report = {
    city: CITY,
    generatedAt:
      new Date().toISOString(),
    selected: selected.length,
    imported,
    skippedExisting,
    errors,
    checkpoint:
      IMPORT_CHECKPOINT_PATH,
    results: finalResults,
  };

  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify(report, null, 2),
  );

  console.log("");
  console.log(
    "====================================================",
  );
  console.log("MAPILLARY IMPORT RESULT");
  console.log(
    "====================================================",
  );
  console.log(`City:             ${CITY}`);
  console.log(
    `Selected:         ${selected.length}`,
  );
  console.log(
    `Imported:         ${imported}`,
  );
  console.log(
    `Skipped existing: ${skippedExisting}`,
  );
  console.log(
    `Errors:           ${errors}`,
  );
  console.log("");
  console.log(
    `Checkpoint: ${IMPORT_CHECKPOINT_PATH}`,
  );
  console.log(
    `Report:     ${REPORT_PATH}`,
  );
  console.log(
    "====================================================",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
