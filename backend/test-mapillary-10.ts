import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const places = await prisma.place.findMany({
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      city: { select: { name: true } },
    },
  });

  const selected = [...places]
    .sort(() => Math.random() - 0.5)
    .slice(0, 10);

  const token = process.env.MAPILLARY_ACCESS_TOKEN;

  if (!token) throw new Error("MAPILLARY_ACCESS_TOKEN is not set");

  console.log(`Production Places found: ${places.length}`);
  console.log(`Testing ${selected.length} random Places...\n`);

  let found = 0;

  for (let i = 0; i < selected.length; i++) {
    const place = selected[i];
    const delta = 0.0006;

    const bbox = [
      Number(place.longitude) - delta,
      Number(place.latitude) - delta,
      Number(place.longitude) + delta,
      Number(place.latitude) + delta,
    ].join(",");

    const url = new URL("https://graph.mapillary.com/images");
    url.searchParams.set(
      "fields",
      "id,computed_geometry,quality_score,captured_at"
    );
    url.searchParams.set("bbox", bbox);
    url.searchParams.set("limit", "5");

    try {
      const response = await fetch(url, {
        headers: { Authorization: `OAuth ${token}` },
      });

      const json = await response.json();

      if (!response.ok) {
        console.log(
          `${i + 1}. ${place.name} (${place.city.name}) → API ERROR ${response.status}`
        );
        console.log(JSON.stringify(json));
        continue;
      }

      const images = json.data ?? [];

      if (images.length) {
        found++;
        console.log(
          `${i + 1}. ${place.name} (${place.city.name}) → ✅ ${images.length} image(s)`
        );

        for (const image of images) {
          console.log(
            `   ID: ${image.id} | quality: ${image.quality_score ?? "N/A"} | captured: ${image.captured_at ?? "N/A"}`
          );
        }
      } else {
        console.log(
          `${i + 1}. ${place.name} (${place.city.name}) → ❌ no images`
        );
      }
    } catch (error) {
      console.log(
        `${i + 1}. ${place.name} (${place.city.name}) → REQUEST ERROR: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("\n==============================");
  console.log(`Production Places: ${places.length}`);
  console.log(`Places tested: ${selected.length}`);
  console.log(`Places with Mapillary images: ${found}`);
  console.log(
    `Sample coverage: ${((found / selected.length) * 100).toFixed(1)}%`
  );
  console.log("Database modified: NO");
  console.log("==============================");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
