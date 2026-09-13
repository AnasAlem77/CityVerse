import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT, "logs");
const OUTPUT = path.join(LOG_DIR, "mapillary-bulk-test-jakarta.json");
const CHECKPOINT = path.join(LOG_DIR, "mapillary-bulk-test-jakarta-checkpoint.json");

const TOKEN = process.env.MAPILLARY_ACCESS_TOKEN ?? "";

if (!TOKEN) {
  throw new Error("MAPILLARY_ACCESS_TOKEN is missing");
}

const API_URL = "https://graph.mapillary.com/images";

const INITIAL_TILE_SIZE = 0.02;
const MIN_TILE_SIZE = 0.002;
const MAX_IMAGES_PER_TILE = 90;
const API_LIMIT = 100;

const REQUEST_DELAY_MS = 300;
const MAX_RETRIES = 3;

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

type ImageRecord = {
  id: string;
  latitude: number;
  longitude: number;
  qualityScore: number | null;
  capturedAt: string | null;
  sequence: string | null;
};

type Tile = {
  west: number;
  south: number;
  east: number;
  north: number;
  depth: number;
};

type Checkpoint = {
  completedTiles: string[];
  images: ImageRecord[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tileKey(tile: Tile) {
  return [
    tile.west.toFixed(6),
    tile.south.toFixed(6),
    tile.east.toFixed(6),
    tile.north.toFixed(6),
  ].join(",");
}

function parseImages(data: any): ImageRecord[] {
  if (!Array.isArray(data?.data)) return [];

  return data.data
    .map((item: any) => {
      const lat = Number(item?.computed_geometry?.coordinates?.[1]);
      const lon = Number(item?.computed_geometry?.coordinates?.[0]);

      if (!item?.id || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }

      return {
        id: String(item.id),
        latitude: lat,
        longitude: lon,
        qualityScore:
          item.quality_score == null ? null : Number(item.quality_score),
        capturedAt: item.captured_at
          ? new Date(item.captured_at).toISOString()
          : null,
        sequence: item.sequence ? String(item.sequence) : null,
      };
    })
    .filter(Boolean) as ImageRecord[];
}

async function fetchTile(tile: Tile): Promise<{
  images: ImageRecord[];
  needsSplit: boolean;
  overloaded: boolean;
}> {
  const bbox = [
    tile.west,
    tile.south,
    tile.east,
    tile.north,
  ].map((n) => n.toString());

  const params = new URLSearchParams({
    access_token: TOKEN,
    fields:
      "id,computed_geometry,quality_score,captured_at,sequence",
    bbox: bbox.join(","),
    limit: String(API_LIMIT),
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${API_URL}?${params.toString()}`);

      if (!response.ok) {
        const body = await response.text();

        // Mapillary can reject dense bounding boxes with HTTP 500.
        // Let the caller subdivide the tile instead of killing the run.
        if (
          response.status === 500 &&
          body.includes("reduce the amount of data")
        ) {
          return {
            images: [],
            needsSplit: true,
            overloaded: true,
          };
        }

        if (attempt === MAX_RETRIES) {
          throw new Error(`HTTP ${response.status}: ${body}`);
        }

        await sleep(attempt * 1500);
        continue;
      }

      const json = await response.json();
      const images = parseImages(json);

      /*
       * If we receive a very full response, treat the tile as potentially
       * truncated/dense and subdivide it.
       */
      const needsSplit =
        images.length >= MAX_IMAGES_PER_TILE &&
        tile.east - tile.west > MIN_TILE_SIZE &&
        tile.north - tile.south > MIN_TILE_SIZE;

      return {
        images,
        needsSplit,
        overloaded: false,
      };
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      await sleep(attempt * 1500);
    }
  }

  throw new Error("Unreachable");
}

function splitTile(tile: Tile): Tile[] {
  const midLon = (tile.west + tile.east) / 2;
  const midLat = (tile.south + tile.north) / 2;

  return [
    {
      west: tile.west,
      south: tile.south,
      east: midLon,
      north: midLat,
      depth: tile.depth + 1,
    },
    {
      west: midLon,
      south: tile.south,
      east: tile.east,
      north: midLat,
      depth: tile.depth + 1,
    },
    {
      west: tile.west,
      south: midLat,
      east: midLon,
      north: tile.north,
      depth: tile.depth + 1,
    },
    {
      west: midLon,
      south: midLat,
      east: tile.east,
      north: tile.north,
      depth: tile.depth + 1,
    },
  ];
}

function loadCheckpoint(): Checkpoint {
  if (!fs.existsSync(CHECKPOINT)) {
    return {
      completedTiles: [],
      images: [],
    };
  }

  return JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
}

function saveCheckpoint(checkpoint: Checkpoint) {
  fs.writeFileSync(
    CHECKPOINT,
    JSON.stringify(checkpoint, null, 2)
  );
}

async function main() {
  console.log("=== Mapillary Bulk Test — Jakarta ===");

  /*
   * Get Jakarta production-place bounds.
   * We use the actual CityVerse Places instead of hardcoding Jakarta
   * coordinates, keeping this compatible with future cities.
   */
  const places = await prisma.place.findMany({
    where: {
      city: {
        name: {
          equals: "Jakarta",
          mode: "insensitive",
        },
      },
    },
    select: {
      latitude: true,
      longitude: true,
    },
  });

  if (places.length === 0) {
    throw new Error("No Jakarta Places found");
  }

  const latitudes = places.map((p) => Number(p.latitude));
  const longitudes = places.map((p) => Number(p.longitude));

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);

  console.log(`Jakarta Places: ${places.length}`);
  console.log(
    `Bounds: ${minLon},${minLat} → ${maxLon},${maxLat}`
  );

  const checkpoint = loadCheckpoint();
  const completed = new Set(checkpoint.completedTiles);

  const imagesById = new Map<string, ImageRecord>();

  for (const image of checkpoint.images) {
    imagesById.set(image.id, image);
  }

  const queue: Tile[] = [];

  for (
    let west = minLon;
    west < maxLon;
    west += INITIAL_TILE_SIZE
  ) {
    for (
      let south = minLat;
      south < maxLat;
      south += INITIAL_TILE_SIZE
    ) {
      queue.push({
        west,
        south,
        east: Math.min(west + INITIAL_TILE_SIZE, maxLon),
        north: Math.min(south + INITIAL_TILE_SIZE, maxLat),
        depth: 0,
      });
    }
  }

  console.log(`Initial tiles: ${queue.length}`);
  console.log(`Already completed: ${completed.size}`);
  console.log(`Existing unique images: ${imagesById.size}`);

  let requests = 0;
  let processed = 0;

  while (queue.length > 0) {
    const tile = queue.shift()!;
    const key = tileKey(tile);

    if (completed.has(key)) {
      continue;
    }

    requests++;

    try {
      const result = await fetchTile(tile);

      if (result.overloaded) {
        if (
          tile.east - tile.west <= MIN_TILE_SIZE ||
          tile.north - tile.south <= MIN_TILE_SIZE
        ) {
          console.log(
            `⚠ Overloaded tile at minimum size — skipping: ${key}`
          );

          completed.add(key);
          processed++;
        } else {
          const children = splitTile(tile);

          console.log(
            `↳ Overloaded tile, splitting into ${children.length}`
          );

          queue.push(...children);
        }
      } else if (result.needsSplit) {
        const children = splitTile(tile);

        console.log(
          `↳ Dense tile (${result.images.length} images), splitting into ${children.length}`
        );

        queue.push(...children);
      } else {
        for (const image of result.images) {
          imagesById.set(image.id, image);
        }

        completed.add(key);
        processed++;

        console.log(
          `✓ Tile ${processed} | images=${result.images.length} | unique=${imagesById.size} | queue=${queue.length}`
        );
      }

      saveCheckpoint({
        completedTiles: [...completed],
        images: [...imagesById.values()],
      });

      await sleep(REQUEST_DELAY_MS);
    } catch (error) {
      console.error(`✗ Tile failed: ${key}`);
      console.error(error);
      break;
    }
  }

  const images = [...imagesById.values()];

  const output = {
    generatedAt: new Date().toISOString(),
    city: "Jakarta",
    placeCount: places.length,
    bounds: {
      minLat,
      maxLat,
      minLon,
      maxLon,
    },
    initialTileSize: INITIAL_TILE_SIZE,
    minTileSize: MIN_TILE_SIZE,
    maxImagesPerTile: MAX_IMAGES_PER_TILE,
    requests,
    completedTiles: completed.size,
    uniqueImages: images.length,
    images,
  };

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(output, null, 2)
  );

  console.log("");
  console.log("=== COMPLETE ===");
  console.log(`Requests: ${requests}`);
  console.log(`Completed tiles: ${completed.size}`);
  console.log(`Unique images: ${images.length}`);
  console.log(`Output: ${OUTPUT}`);
  console.log(`Checkpoint: ${CHECKPOINT}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
