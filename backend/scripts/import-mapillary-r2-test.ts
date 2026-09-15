import "dotenv/config";
import { readFile } from "node:fs/promises";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const R2_PUBLIC_URL =
  "https://pub-6c6c275352674497b9e8bac301be5f88.r2.dev";

const CHECKPOINT =
  "logs/mapillary-production/paris-checkpoint.json";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

type Result = {
  placeId: string;
  placeName: string;
  status: string;
  selected?: {
    id: string;
    thumbnailUrl: string;
    distanceMeters: number;
    qualityScore: number;
    width?: number;
    height?: number;
    creatorUsername?: string | null;
  };
};

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "CityVerse/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.startsWith("image/")) {
    throw new Error(`Not an image: ${contentType}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  if (!process.env.R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is missing from .env");
  }

  const checkpoint = JSON.parse(
    await readFile(CHECKPOINT, "utf8")
  ) as {
    results: Result[];
  };

  const selected = checkpoint.results
    .filter(
      (r) =>
        r.status === "selected" &&
        r.selected?.thumbnailUrl
    )
    .slice(0, 10);

  console.log("====================================================");
  console.log("CITYVERSE — FIRST 10 MAPILLARY IMAGES");
  console.log("====================================================");
  console.log(`Selected: ${selected.length}`);
  console.log(`Bucket: ${process.env.R2_BUCKET_NAME}`);
  console.log(`R2 URL: ${R2_PUBLIC_URL}`);
  console.log("");

  let uploaded = 0;
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    const image = item.selected!;

    console.log(
      `[${i + 1}/10] ${item.placeName}`
    );

    try {
      const existing = await prisma.placeImage.findFirst({
        where: {
          placeId: item.placeId,
        },
      });

      if (existing) {
        console.log("  → SKIP: PlaceImage already exists");
        skipped++;
        continue;
      }

      console.log("  → Downloading...");

      const original = await downloadImage(
        image.thumbnailUrl
      );

      console.log("  → Optimizing WebP...");

      const optimized = await sharp(original)
        .rotate()
        .resize({
          width: 1280,
          height: 1280,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({
          quality: 82,
        })
        .toBuffer();

      const metadata = await sharp(optimized).metadata();

      const key =
        `places/${item.placeId}/${image.id}.webp`;

      console.log("  → Uploading to R2...");

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: key,
          Body: optimized,
          ContentType: "image/webp",
          CacheControl:
            "public, max-age=31536000, immutable",
        })
      );

      uploaded++;

      const publicUrl =
        `${R2_PUBLIC_URL}/${key}`;

      console.log("  → Creating PlaceImage...");

      await prisma.placeImage.create({
        data: {
          placeId: item.placeId,
          url: publicUrl,
          source: "mapillary",
          sourceUrl:
            `https://www.mapillary.com/app/?pKey=${image.id}`,
          license: "CC BY-SA",
          author: image.creatorUsername ?? null,
          attribution: image.creatorUsername
            ? `© ${image.creatorUsername} / Mapillary`
            : "© Mapillary contributors",
          width: metadata.width ?? null,
          height: metadata.height ?? null,
        },
      });

      created++;

      console.log("  ✓ SUCCESS");
      console.log(
        `  Distance: ${image.distanceMeters.toFixed(1)}m`
      );
      console.log(
        `  Quality: ${image.qualityScore.toFixed(3)}`
      );
      console.log(
        `  URL: ${publicUrl}`
      );
      console.log("");
    } catch (error) {
      failed++;

      console.error(
        `  ✗ FAILED: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );

      console.log("");
    }
  }

  console.log("====================================================");
  console.log("RESULT");
  console.log("====================================================");
  console.log(`Selected: ${selected.length}`);
  console.log(`Uploaded: ${uploaded}`);
  console.log(`PlaceImage created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log("====================================================");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
