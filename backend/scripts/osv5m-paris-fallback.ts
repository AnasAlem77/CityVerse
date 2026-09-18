import "dotenv/config";
import fs from "fs";
import path from "path";
import readline from "readline";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const MAX_DISTANCE_METERS = 60;
const GRID_SIZE_DEGREES = 0.001;
const CITY_NAME = "Paris";

const METADATA_PATH = path.resolve(
  "logs/osv5m-audit/metadata/train.csv",
);

const OUTPUT_DIR = path.resolve(
  "logs/osv5m-fallback",
);

const OUTPUT_PATH = path.join(
  OUTPUT_DIR,
  "paris-candidates.json",
);

type TargetPlace = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

type OsvImage = {
  id: string;
  latitude: number;
  longitude: number;
  thumbOriginalUrl: string;
  capturedAt: string | null;
  city: string | null;
  country: string | null;
  sequence: string | null;
  creatorUsername: string | null;
};

type Candidate = {
  placeId: string;
  placeName: string;
  osvId: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  thumbOriginalUrl: string;
  capturedAt: string | null;
  city: string | null;
  country: string | null;
  sequence: string | null;
  creatorUsername: string | null;
};

type Grid = Map<string, TargetPlace[]>;

function getGridKey(
  latitude: number,
  longitude: number,
) {
  const latCell = Math.floor(
    latitude / GRID_SIZE_DEGREES,
  );

  const lonCell = Math.floor(
    longitude / GRID_SIZE_DEGREES,
  );

  return `${latCell}:${lonCell}`;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (
        inQuotes &&
        line[i + 1] === '"'
      ) {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);

  return fields;
}

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const earthRadius = 6371000;

  const toRadians = (value: number) =>
    (value * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    );

  return earthRadius * c;
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim();
}

function createHeaderIndex(
  header: string[],
) {
  const index = new Map<string, number>();

  header.forEach((value, position) => {
    index.set(
      normalizeHeader(value),
      position,
    );
  });

  return index;
}

function getField(
  row: string[],
  header: Map<string, number>,
  name: string,
) {
  const position = header.get(name);

  if (position === undefined) {
    return "";
  }

  return row[position] ?? "";
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing.",
    );
  }

  if (!fs.existsSync(METADATA_PATH)) {
    throw new Error(
      `OSV-5M metadata not found: ${METADATA_PATH}`,
    );
  }

  fs.mkdirSync(OUTPUT_DIR, {
    recursive: true,
  });

  const adapter = new PrismaPg({
    connectionString:
      process.env.DATABASE_URL,
  });

  const prisma = new PrismaClient({
    adapter,
  });

  console.log("");
  console.log(
    "=== CityVerse OSV-5M Paris Fallback ===",
  );
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
      name: true,
      latitude: true,
      longitude: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  await prisma.$disconnect();

  const targets: TargetPlace[] = places
    .map((place) => ({
      id: place.id,
      name: place.name,
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
    }))
    .filter(
      (place) =>
        Number.isFinite(place.latitude) &&
        Number.isFinite(place.longitude),
    );

  console.log(
    `Uncovered Paris Places: ${targets.length}`,
  );

  if (targets.length === 0) {
    console.log(
      "No uncovered Paris Places found.",
    );
    return;
  }

  const grid: Grid = new Map();

  for (const target of targets) {
    const key = getGridKey(
      target.latitude,
      target.longitude,
    );

    const bucket = grid.get(key);

    if (bucket) {
      bucket.push(target);
    } else {
      grid.set(key, [target]);
    }
  }

  const bestCandidates =
    new Map<string, Candidate>();

  let scannedRows = 0;
  let parsedRows = 0;
  let franceRows = 0;
  let parisRows = 0;
  let nearbyCandidates = 0;

  const input = fs.createReadStream(
    METADATA_PATH,
    {
      encoding: "utf8",
    },
  );

  const reader =
    readline.createInterface({
      input,
      crlfDelay: Infinity,
    });

  let headerIndex:
    | Map<string, number>
    | null = null;

  const startedAt = Date.now();

  for await (const line of reader) {
    scannedRows += 1;

    if (!line.trim()) {
      continue;
    }

    const row = parseCsvLine(line);

    if (!headerIndex) {
      headerIndex =
        createHeaderIndex(row);

      continue;
    }

    parsedRows += 1;

    const id = getField(
      row,
      headerIndex,
      "id",
    );

    const latitude = Number(
      getField(
        row,
        headerIndex,
        "latitude",
      ),
    );

    const longitude = Number(
      getField(
        row,
        headerIndex,
        "longitude",
      ),
    );

    if (
      !id ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }

    const country = getField(
      row,
      headerIndex,
      "country",
    );

    if (
      country &&
      country !== "FR"
    ) {
      continue;
    }

    franceRows += 1;

    const city = getField(
      row,
      headerIndex,
      "city",
    );

    if (
      city &&
      !city
        .toLowerCase()
        .includes("paris")
    ) {
      continue;
    }

    parisRows += 1;

    const latCell = Math.floor(
      latitude / GRID_SIZE_DEGREES,
    );

    const lonCell = Math.floor(
      longitude / GRID_SIZE_DEGREES,
    );

    for (
      let latOffset = -1;
      latOffset <= 1;
      latOffset += 1
    ) {
      for (
        let lonOffset = -1;
        lonOffset <= 1;
        lonOffset += 1
      ) {
        const key = `${latCell + latOffset}:${lonCell + lonOffset}`;

        const bucket = grid.get(key);

        if (!bucket) {
          continue;
        }

        for (const place of bucket) {
          const distanceMeters =
            haversineDistanceMeters(
              place.latitude,
              place.longitude,
              latitude,
              longitude,
            );

          if (
            distanceMeters >
            MAX_DISTANCE_METERS
          ) {
            continue;
          }

          nearbyCandidates += 1;

          const thumbOriginalUrl =
            getField(
              row,
              headerIndex,
              "thumb_original_url",
            );

          if (!thumbOriginalUrl) {
            continue;
          }

          const candidate: Candidate =
            {
              placeId: place.id,
              placeName: place.name,
              osvId: id,
              latitude,
              longitude,
              distanceMeters,
              thumbOriginalUrl,
              capturedAt:
                getField(
                  row,
                  headerIndex,
                  "captured_at",
                ) || null,
              city:
                city || null,
              country:
                country || null,
              sequence:
                getField(
                  row,
                  headerIndex,
                  "sequence",
                ) || null,
              creatorUsername:
                getField(
                  row,
                  headerIndex,
                  "creator_username",
                ) || null,
            };

          const existing =
            bestCandidates.get(
              place.id,
            );

          if (
            !existing ||
            candidate.distanceMeters <
              existing.distanceMeters
          ) {
            bestCandidates.set(
              place.id,
              candidate,
            );
          }
        }
      }
    }

    if (
      parsedRows % 250000 ===
      0
    ) {
      const elapsed =
        (Date.now() - startedAt) /
        1000;

      console.log(
        `Scanned ${parsedRows.toLocaleString()} rows | ` +
          `Paris rows ${parisRows.toLocaleString()} | ` +
          `matched Places ${bestCandidates.size.toLocaleString()} | ` +
          `elapsed ${elapsed.toFixed(0)}s`,
      );
    }
  }

  const candidates = [
    ...bestCandidates.values(),
  ].sort(
    (a, b) =>
      a.distanceMeters -
      b.distanceMeters,
  );

  const uncoveredAfterScan =
    targets.filter(
      (place) =>
        !bestCandidates.has(
          place.id,
        ),
    );

  const report = {
    city: CITY_NAME,
    generatedAt:
      new Date().toISOString(),
    metadataPath:
      METADATA_PATH,
    maxDistanceMeters:
      MAX_DISTANCE_METERS,
    targetPlaces:
      targets.length,
    matchedPlaces:
      candidates.length,
    unmatchedPlaces:
      uncoveredAfterScan.length,
    coveragePercent:
      targets.length === 0
        ? 0
        : Number(
            (
              (candidates.length /
                targets.length) *
              100
            ).toFixed(2),
          ),
    scannedRows:
      parsedRows,
    franceRows,
    parisRows,
    nearbyCandidates,
    candidates,
    unmatchedPlaceIds:
      uncoveredAfterScan.map(
        (place) => place.id,
      ),
  };

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      report,
      null,
      2,
    ),
    "utf8",
  );

  console.log("");
  console.log(
    "=== OSV-5M Paris Fallback Result ===",
  );
  console.log(
    `Target Places: ${targets.length}`,
  );
  console.log(
    `Matched ≤ ${MAX_DISTANCE_METERS}m: ${candidates.length}`,
  );
  console.log(
    `Still unmatched: ${uncoveredAfterScan.length}`,
  );
  console.log(
    `Coverage: ${report.coveragePercent}%`,
  );
  console.log(
    `Nearby candidates checked: ${nearbyCandidates}`,
  );
  console.log("");
  console.log(
    `Report: ${OUTPUT_PATH}`,
  );
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error(
    "OSV-5M Paris fallback failed:",
  );
  console.error(error);
  process.exit(1);
});
