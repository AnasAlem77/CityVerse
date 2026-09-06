import type { Metadata } from "next";
import { getPlace } from "@/lib/api";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params;
    const place = await getPlace(id) as { name?: string; description?: string | null; city?: { name?: string } | null };
    const name = place.name ?? "Place";
    const city = place.city?.name;
    return {
      title: city ? `${name}, ${city}` : name,
      description: place.description || `Explore ${name}${city ? ` in ${city}` : ""} on CityVerse.`,
    };
  } catch {
    return { title: "Place" };
  }
}

export default function PlaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
