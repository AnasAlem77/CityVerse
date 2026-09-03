"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Star } from "lucide-react";

type Place = {
  id: string;
  name: string;
  description: string;
  category: string;
  latitude: string;
  longitude: string;
  averageRating?: number;
  reviewsCount?: number;
};

type City = {
  id: string;
  name: string;
};

type PlacesResponse = {
  city: City;
  data: Place[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

function isArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

function PlaceCard({ place }: { place: Place }) {
  const arabicName = isArabic(place.name);

  return (
    <Link href={`/places/${place.id}`} className="group block">
      <article className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
        {/* Image area - ready for Place images */}
        <div className="relative aspect-[16/10] overflow-hidden bg-[var(--secondary)]/10">
          <div className="flex h-full items-center justify-center">
            <MapPin className="h-10 w-10 text-[var(--secondary)]/40" />
          </div>

          <div className="absolute left-4 top-4">
            <span className="rounded-full bg-[var(--card)]/90 px-3 py-1.5 text-xs font-semibold capitalize text-[var(--secondary)] shadow-sm backdrop-blur-sm">
              {place.category}
            </span>
          </div>
        </div>

        {/* Card content */}
        <div className="p-5">
          <h3
            dir={arabicName ? "rtl" : "ltr"}
            className={`line-clamp-1 text-xl text-[var(--foreground)] ${
              arabicName ? "font-arabic font-bold" : "font-black"
            }`}
          >
            {place.name}
          </h3>

          <div className="mt-3 flex items-center justify-between">
            {place.averageRating !== undefined ? (
              <div className="flex items-center gap-1.5 text-sm">
                <Star className="h-4 w-4 fill-[var(--accent)] text-[var(--accent)]" />
                <span className="font-semibold text-[var(--foreground)]">
                  {place.averageRating.toFixed(1)}
                </span>

                {place.reviewsCount !== undefined && (
                  <span className="text-[var(--muted)]">
                    ({place.reviewsCount})
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-[var(--muted)]">
                No reviews yet
              </span>
            )}

            <span className="text-sm font-semibold text-[var(--primary)] transition-colors group-hover:text-[var(--primary-hover)]">
              Explore
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function CityPage() {
  const params = useParams();
  const id = params.id as string;

  const [city, setCity] = useState<City | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    async function loadCity() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `http://localhost:3001/cities/${id}/places?limit=12&offset=0`,
        );

        if (!response.ok) {
          throw new Error("Failed to load city places");
        }

        const result: PlacesResponse = await response.json();

        setCity(result.city);
        setPlaces(result.data);
      } catch (err) {
        console.error(err);
        setError("Unable to load places for this city.");
      } finally {
        setLoading(false);
      }
    }

    loadCity();
  }, [id]);

  const cityIsArabic = city ? isArabic(city.name) : false;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-32 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to cities
          </Link>

          {city && (
            <h1
              dir={cityIsArabic ? "rtl" : "ltr"}
              className={`text-4xl tracking-tight text-[var(--foreground)] md:text-5xl ${
                cityIsArabic ? "font-arabic font-bold" : "font-black"
              }`}
            >
              {city.name}
            </h1>
          )}

          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Explore places, restaurants, attractions and other points of
            interest in this city.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]"
              >
                <div className="aspect-[16/10] animate-pulse bg-[var(--secondary)]/10" />
                <div className="space-y-3 p-5">
                  <div className="h-6 w-2/3 animate-pulse rounded-lg bg-[var(--secondary)]/10" />
                  <div className="h-4 w-1/3 animate-pulse rounded-lg bg-[var(--secondary)]/10" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && places.length === 0 && (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-10 text-center">
            <MapPin className="mx-auto mb-4 h-10 w-10 text-[var(--muted)]" />

            <h2 className="text-xl font-bold text-[var(--foreground)]">
              No places found
            </h2>

            <p className="mt-2 text-sm text-[var(--muted)]">
              There are no places available for this city yet.
            </p>
          </div>
        )}

        {/* Places */}
        {!loading && !error && places.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {places.map((place) => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}