import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const ROOT = path.resolve(__dirname, "..");

const CITY_NAME =
  process.argv
    .find((arg) => arg.startsWith("--city="))
    ?.split("=")[1] ?? "Bali";

const CITY_SLUG = CITY_NAME.toLowerCase().replace(/\s+/g, "-");

const MAX_DISTANCE_METERS = 60;
const SEARCH_ZOOM = 18;
const REQUEST_DELAY_MS = 500;
const MAX_RETRIES = 3;
const DOWNLOAD_TIMEOUT_MS = 20000;
const IMAGE_WIDTH = 1280;
const WEBP_QUALITY = 82;

const CHECKPOINT_DIR = path.join(
  ROOT,
  "logs",
  "kartaview-production",
);

const CHECKPOINT_PATH = path.join(
  CHECKPOINT_DIR,
  `${CITY_SLUG}-checkpoint.json`,
);

const REPORT_PATH = path.join(
  CHECKPOINT_DIR,
  `${CITY_SLUG}-report.json`,
);

type Candidate = {
  id: string;
  sequenceId: string | null;
  lat: number;
  lng: number;
  distance: number;
  fileUrl: string;
  imageProcUrl?: string | null;
  imageLthUrl?: string | null;
  imageThUrl?: string | null;
  fileUrlProc?: string | null;
  fileUrlLTh?: string | null;
  fileUrlTh?: string | null;
  width?: number | null;
  qualityLevel?: number | null;
  shotDate?: string | null;
};

type Result = {
  placeId: string;
  placeName: string;
  status:
    | "selected"
    | "no_candidate"
    | "error"
    | "imported";
  candidateId?: string;
  sequenceId?: string | null;
  distance?: number;
  error?: string;
};

type Checkpoint = {
  city: string;
  completed: string[];
  results: Result[];
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

const r2 = new S3Client({
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

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const R = 6371000;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLng =
    ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return (
    2 *
    R *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    )
  );
}

async function fetchJson(
  url: string,
  options?: RequestInit,
) {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(
          DOWNLOAD_TIMEOUT_MS,
        ),
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${await response.text()}`,
        );
      }

      return await response.json();
    } catch (error) {
      lastError = error;

      if (attempt < MAX_RETRIES) {
        await sleep(
          1000 * attempt,
        );
      }
    }
  }

  throw lastError;
}

async function downloadBuffer(
  url: string,
) {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(
          DOWNLOAD_TIMEOUT_MS,
        ),
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`,
        );
      }

      return Buffer.from(
        await response.arrayBuffer(),
      );
    } catch (error) {
      lastError = error;

      if (attempt < MAX_RETRIES) {
        await sleep(
          1000 * attempt,
        );
      }
    }
  }

  throw lastError;
}

function loadCheckpoint(): Checkpoint {
  if (!fs.existsSync(CHECKPOINT_PATH)) {
    return {
      city: CITY_NAME,
      completed: [],
      results: [],
    };
  }

  return JSON.parse(
    fs.readFileSync(
      CHECKPOINT_PATH,
      "utf8",
    ),
  );
}

function saveCheckpoint(
  checkpoint: Checkpoint,
) {
  fs.mkdirSync(
    CHECKPOINT_DIR,
    { recursive: true },
  );

  fs.writeFileSync(
    CHECKPOINT_PATH,
    JSON.stringify(
      checkpoint,
      null,
      2,
    ),
  );
}

function saveReport(
  results: Result[],
) {
  fs.mkdirSync(
    CHECKPOINT_DIR,
    { recursive: true },
  );

  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify(
      {
        city: CITY_NAME,
        maxDistanceMeters:
          MAX_DISTANCE_METERS,
        results,
      },
      null,
      2,
    ),
  );
}

function getDownloadUrl(
  photo: any,
): string | null {
  const candidates = [
    photo.imageProcUrl,
    photo.imageLthUrl,
    photo.imageThUrl,
    photo.fileurlProc,
    photo.fileUrlProc,
    photo.fileurlLTh,
    photo.fileUrlLTh,
    photo.fileurlTh,
    photo.fileUrlTh,
    photo.fileurl,
    photo.fileUrl,
  ];

  for (const url of candidates) {
    if (
      typeof url === "string" &&
      url.length > 0
    ) {
      return url;
    }
  }

  return null;
}

async function findCandidate(
  latitude: number,
  longitude: number,
): Promise<Candidate | null> {
  const url = new URL(
    "https://api.openstreetcam.org/2.0/photo/",
  );

  url.searchParams.set(
    "lat",
    String(latitude),
  );

  url.searchParams.set(
    "lng",
    String(longitude),
  );

  url.searchParams.set(
    "zoomLevel",
    String(SEARCH_ZOOM),
  );

  url.searchParams.set(
    "join",
    "sequence",
  );

  url.searchParams.set(
    "orderBy",
    "id",
  );

  url.searchParams.set(
    "orderDirection",
    "desc",
  );

  const data = await fetchJson(
    url.toString(),
  );

  const photos =
    data?.result?.data;

  if (!Array.isArray(photos)) {
    return null;
  }

  const candidates: Candidate[] = [];

  for (const photo of photos) {
    const lat = Number(
      photo.lat,
    );

    const lng = Number(
      photo.lng,
    );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      continue;
    }

    const distance =
      haversineMeters(
        latitude,
        longitude,
        lat,
        lng,
      );

    if (
      distance >
      MAX_DISTANCE_METERS
    ) {
      continue;
    }

    const downloadUrl =
      getDownloadUrl(photo);

    if (!downloadUrl) {
      continue;
    }

    candidates.push({
      id: String(
        photo.id,
      ),
      sequenceId:
        photo.sequenceId ??
        photo.sequence?.id ??
        null,
      lat,
      lng,
      distance,
      fileUrl:
        typeof photo.fileurl ===
        "string"
          ? photo.fileurl
          : downloadUrl,
      imageProcUrl:
        photo.imageProcUrl ??
        null,
      imageLthUrl:
        photo.imageLthUrl ??
        null,
      imageThUrl:
        photo.imageThUrl ??
        null,
      fileUrlProc:
        photo.fileurlProc ??
        photo.fileUrlProc ??
        null,
      fileUrlLTh:
        photo.fileurlLTh ??
        photo.fileUrlLTh ??
        null,
      fileUrlTh:
        photo.fileurlTh ??
        photo.fileUrlTh ??
        null,
      width:
        photo.width
          ? Number(photo.width)
          : null,
      qualityLevel:
        photo.qualityLevel
          ? Number(
              photo.qualityLevel,
            )
          : null,
      shotDate:
        photo.shotDate ??
        null,
    });
  }

  candidates.sort(
    (a, b) => {
      if (
        a.distance !==
        b.distance
      ) {
        return (
          a.distance -
          b.distance
        );
      }

      return (
        (b.qualityLevel ?? 0) -
        (a.qualityLevel ?? 0)
      );
    },
  );

  return (
    candidates[0] ??
    null
  );
}

async function importCandidate(
  place: {
    id: string;
    name: string;
  },
  candidate: Candidate,
) {
  const sourceUrl =
    `https://kartaview.org/details/${candidate.sequenceId ?? ""}/${candidate.id}/track-info`;

  const existing =
    await prisma.placeImage.findFirst({
      where: {
        placeId: place.id,
      },
    });

  if (existing) {
    return false;
  }

  const downloadUrl =
    candidate.imageProcUrl ??
    candidate.imageLthUrl ??
    candidate.imageThUrl ??
    candidate.fileUrlProc ??
    candidate.fileUrlLTh ??
    candidate.fileUrlTh ??
    candidate.fileUrl;

  console.log(
    `    Download: ${downloadUrl}`,
  );

  const originalBuffer =
    await downloadBuffer(
      downloadUrl,
    );

  const optimized =
    await sharp(
      originalBuffer,
    )
      .rotate()
      .resize({
        width: IMAGE_WIDTH,
        withoutEnlargement: true,
      })
      .webp({
        quality: WEBP_QUALITY,
      })
      .toBuffer();

  const key =
    `places/${place.id}/kartaview-${candidate.id}.webp`;

  await r2.send(
    new PutObjectCommand({
      Bucket:
        process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: optimized,
      ContentType:
        "image/webp",
    }),
  );

  const r2Url =
    `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}/${key}`;

  await prisma.placeImage.create({
    data: {
      placeId: place.id,
      url: r2Url,
      source: "kartaview",
      sourceUrl,
      license: null,
      author: null,
      attribution:
        "KartaView",
      width: IMAGE_WIDTH,
      height: null,
    },
  });

  return true;
}

function getExistingResult(
  results: Result[],
  placeId: string,
) {
  return results.find(
    (result) =>
      result.placeId === placeId,
  );
}

async function main() {
  console.log(
    "====================================================",
  );
  console.log(
    "CityVerse — KartaView Production",
  );
  console.log(
    "====================================================",
  );
  console.log();
  console.log(
    `City: ${CITY_NAME}`,
  );
  console.log(
    `Maximum distance: ≤${MAX_DISTANCE_METERS}m`,
  );
  console.log(
    "Mode: LIVE IMPORT",
  );
  console.log();

  const checkpoint =
    loadCheckpoint();

  const completed =
    new Set(
      checkpoint.completed,
    );

  const results = [
    ...checkpoint.results,
  ];

  const places =
    await prisma.place.findMany({
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
      },
      orderBy: {
        id: "asc",
      },
    });

  console.log(
    `Places without images: ${places.length}`,
  );
  console.log();

  let selected = 0;
  let imported = 0;
  let noCandidate = 0;
  let errors = 0;

  for (
    let index = 0;
    index < places.length;
    index++
  ) {
    const place =
      places[index];

    const existingResult =
      getExistingResult(
        results,
        place.id,
      );

    const shouldRetry =
      existingResult?.status ===
      "error";

    if (
      completed.has(
        place.id,
      ) &&
      !shouldRetry
    ) {
      continue;
    }

    if (shouldRetry) {
      const resultIndex =
        results.findIndex(
          (result) =>
            result.placeId ===
            place.id,
        );

      if (resultIndex !== -1) {
        results.splice(
          resultIndex,
          1,
        );
      }

      completed.delete(
        place.id,
      );
    }

    console.log(
      `[${index + 1}/${places.length}] ${place.name}`,
    );

    try {
      const candidate =
        await findCandidate(
          Number(
            place.latitude,
          ),
          Number(
            place.longitude,
          ),
        );

      if (!candidate) {
        console.log(
          "    No valid candidate",
        );

        results.push({
          placeId:
            place.id,
          placeName:
            place.name,
          status:
            "no_candidate",
        });

        noCandidate++;
      } else {
        selected++;

        console.log(
          `    ✓ ${candidate.distance.toFixed(1)}m | ${candidate.id}`,
        );

        const wasImported =
          await importCandidate(
            place,
            candidate,
          );

        if (wasImported) {
          imported++;

          console.log(
            "    ✓ PlaceImage created",
          );

          results.push({
            placeId:
              place.id,
            placeName:
              place.name,
            status:
              "imported",
            candidateId:
              candidate.id,
            sequenceId:
              candidate.sequenceId,
            distance:
              candidate.distance,
          });
        } else {
          console.log(
            "    → Skipped | Place already has an image",
          );

          results.push({
            placeId:
              place.id,
            placeName:
              place.name,
            status:
              "imported",
            candidateId:
              candidate.id,
            sequenceId:
              candidate.sequenceId,
            distance:
              candidate.distance,
          });
        }
      }

      completed.add(
        place.id,
      );
    } catch (error) {
      errors++;

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.log(
        `    ERROR: ${message}`,
      );

      results.push({
        placeId:
          place.id,
        placeName:
          place.name,
        status:
          "error",
        error:
          message,
      });

      completed.delete(
        place.id,
      );
    }

    checkpoint.completed =
      [...completed];

    checkpoint.results =
      results;

    saveCheckpoint(
      checkpoint,
    );

    saveReport(
      results,
    );

    await sleep(
      REQUEST_DELAY_MS,
    );
  }

  console.log();
  console.log(
    "====================================================",
  );
  console.log(
    "KARTAVIEW IMPORT RESULT",
  );
  console.log(
    "====================================================",
  );
  console.log(
    `City:             ${CITY_NAME}`,
  );
  console.log(
    `Selected:         ${selected}`,
  );
  console.log(
    `Imported:         ${imported}`,
  );
  console.log(
    `No candidate:     ${noCandidate}`,
  );
  console.log(
    `Errors:           ${errors}`,
  );
  console.log();
  console.log(
    `Checkpoint: ${CHECKPOINT_PATH}`,
  );
  console.log(
    `Report: ${REPORT_PATH}`,
  );
  console.log(
    "====================================================",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });