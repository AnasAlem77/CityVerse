import type { Metadata } from "next";
import { getCityPlaces } from "@/lib/api";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params;
    const result = await getCityPlaces(id, 1, 1, {});
    return {
      title: result.city.name,
      description: `Explore real places and experiences in ${result.city.name}.`,
    };
  } catch {
    return { title: "City" };
  }
}

export default function CityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
