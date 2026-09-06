import type { MetadataRoute } from "next";
import { getCities, getPlaces } from "@/lib/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const entries: MetadataRoute.Sitemap = [
    "",
    "/cities",
    "/places",
    "/search",
  ].map((path) => ({ url: `${baseUrl}${path}`, changeFrequency: "daily", priority: path ? 0.7 : 1 }));

  try {
    const [cities, places] = await Promise.all([getCities(1, 100), getPlaces(1, 100)]);
    entries.push(...cities.data.map((city) => ({ url: `${baseUrl}/cities/${city.id}`, changeFrequency: "weekly" as const, priority: 0.8 })));
    entries.push(...places.data.map((place) => ({ url: `${baseUrl}/places/${place.id}`, changeFrequency: "weekly" as const, priority: 0.6 })));
  } catch {
    // Keep the base sitemap available when the API is temporarily offline.
  }

  return entries;
}
