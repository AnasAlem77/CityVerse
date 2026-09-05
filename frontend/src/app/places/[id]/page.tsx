"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  MapPin,
  Phone,
  Star,
} from "lucide-react";

import PlaceReviews from "@/components/PlaceReviews/PlaceReviews";

type City = {
  id: string;
  name: string;
};

type PlaceImage = {
  id: string;
  url?: string;
  imageUrl?: string;
};

type Review = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  user?: {
    id?: string;
    name: string;
  };
};

type Place = {
  id: string;
  osmId?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  subtype?: string | null;
  address?: string | null;
  website?: string | null;
  phone?: string | null;
  openingHours?: string | null;
  cuisine?: string | null;
  wheelchair?: boolean | null;
  internetAccess?: string | null;
  latitude: string;
  longitude: string;
  cityId: string;
  createdAt: string;
  updatedAt: string;
  city?: City | null;
  images?: PlaceImage[];
  reviews: Review[];
  reviewsCount: number;
  averageRating: number;
};

function isArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="mt-0.5 shrink-0 text-[var(--primary)]">{icon}</div>

      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
          {label}
        </p>

        <div className="mt-1 text-sm leading-6 text-[var(--foreground)]">
          {children}
        </div>
      </div>
    </div>
  );
}

function Rating({
  rating,
  reviewsCount,
}: {
  rating: number;
  reviewsCount: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            className={
              index < Math.round(rating)
                ? "h-5 w-5 fill-amber-400 text-amber-400"
                : "h-5 w-5 text-[var(--border-strong)]"
            }
          />
        ))}
      </div>

      <span className="font-bold text-[var(--foreground)]">
        {rating.toFixed(1)}
      </span>

      <span className="text-sm text-[var(--muted)]">
        ({reviewsCount} {reviewsCount === 1 ? "review" : "reviews"})
      </span>
    </div>
  );
}

export default function PlacePage() {
  const params = useParams();
  const id = params.id as string;

  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    async function loadPlace() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `http://localhost:3001/places/${id}`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error("Failed to load place");
        }

        const result: Place = await response.json();

        setPlace(result);
      } catch (err) {
        console.error(err);
        setError("Unable to load this place.");
      } finally {
        setLoading(false);
      }
    }

    loadPlace();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <section className="mx-auto max-w-7xl px-6 pb-16 pt-32 lg:px-8">
          <div className="animate-pulse space-y-8">
            <div className="h-5 w-32 rounded bg-[var(--secondary)]/10" />

            <div className="aspect-[16/7] rounded-3xl bg-[var(--secondary)]/10" />

            <div className="space-y-4">
              <div className="h-10 w-2/3 rounded bg-[var(--secondary)]/10" />
              <div className="h-5 w-1/3 rounded bg-[var(--secondary)]/10" />
              <div className="h-24 w-full rounded bg-[var(--secondary)]/10" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (error || !place) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <section className="mx-auto max-w-3xl px-6 pb-16 pt-32 text-center lg:px-8">
          <Link
            href="/places"
            className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to places
          </Link>

          <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-10">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              Place not found
            </h1>

            <p className="mt-2 text-sm text-[var(--muted)]">
              {error || "We could not find this place."}
            </p>
          </div>
        </section>
      </div>
    );
  }

  const placeIsArabic = isArabic(place.name);

  const primaryImage =
    place.images?.[0]?.url ?? place.images?.[0]?.imageUrl ?? null;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="mx-auto max-w-7xl px-6 pb-20 pt-32 lg:px-8">
        <Link
          href={
            place.city?.id
              ? `/cities/${place.city.id}`
              : "/places"
          }
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          {place.city?.name
            ? `Back to ${place.city.name}`
            : "Back to places"}
        </Link>

        {/* Hero */}
        <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
          <div className="relative aspect-[16/7] overflow-hidden bg-[var(--secondary)]/10">
            {primaryImage ? (
              <img
                src={primaryImage}
                alt={place.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <MapPin className="h-16 w-16 text-[var(--secondary)]/30" />
              </div>
            )}

            {place.category && (
              <div className="absolute left-6 top-6">
                <span className="rounded-full bg-[var(--card)]/90 px-4 py-2 text-sm font-bold capitalize text-[var(--secondary)] shadow-sm backdrop-blur-sm">
                  {place.subtype
                    ? `${place.category} · ${place.subtype.replaceAll("_", " ")}`
                    : place.category}
                </span>
              </div>
            )}
          </div>

          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <h1
                  dir={placeIsArabic ? "rtl" : "ltr"}
                  className={`text-4xl tracking-tight text-[var(--foreground)] md:text-5xl ${
                    placeIsArabic
                      ? "font-arabic font-bold"
                      : "font-black"
                  }`}
                >
                  {place.name}
                </h1>

                {place.city && (
                  <Link
                    href={`/cities/${place.city.id}`}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline"
                  >
                    <MapPin className="h-4 w-4" />
                    {place.city.name}
                  </Link>
                )}
              </div>

              <div className="shrink-0">
                <Rating
                  rating={place.averageRating}
                  reviewsCount={place.reviewsCount}
                />
              </div>
            </div>

            {place.description && (
              <p className="mt-7 max-w-4xl text-base leading-8 text-[var(--muted)]">
                {place.description}
              </p>
            )}
          </div>
        </section>

        {/* Information */}
        <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 md:p-8">
            <h2 className="text-2xl font-black text-[var(--foreground)]">
              Information
            </h2>

            <div className="mt-7 space-y-6">
              {place.address && (
                <InfoRow
                  icon={<MapPin className="h-5 w-5" />}
                  label="Address"
                >
                  {place.address}
                </InfoRow>
              )}

              {place.phone && (
                <InfoRow
                  icon={<Phone className="h-5 w-5" />}
                  label="Phone"
                >
                  <a
                    href={`tel:${place.phone}`}
                    className="font-semibold hover:text-[var(--primary)]"
                  >
                    {place.phone}
                  </a>
                </InfoRow>
              )}

              {place.website && (
                <InfoRow
                  icon={<Globe className="h-5 w-5" />}
                  label="Website"
                >
                  <a
                    href={place.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[var(--primary)] hover:underline"
                  >
                    Visit website
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </InfoRow>
              )}

              {place.openingHours && (
                <InfoRow
                  icon={<span className="text-lg">🕐</span>}
                  label="Opening hours"
                >
                  {place.openingHours}
                </InfoRow>
              )}

              {place.cuisine && (
                <InfoRow
                  icon={<span className="text-lg">🍽️</span>}
                  label="Cuisine"
                >
                  {place.cuisine}
                </InfoRow>
              )}

              {place.internetAccess && (
                <InfoRow
                  icon={<span className="text-lg">📶</span>}
                  label="Internet"
                >
                  {place.internetAccess}
                </InfoRow>
              )}

              {place.wheelchair !== null &&
                place.wheelchair !== undefined && (
                  <InfoRow
                    icon={<span className="text-lg">♿</span>}
                    label="Accessibility"
                  >
                    {place.wheelchair
                      ? "Wheelchair accessible"
                      : "Not listed as wheelchair accessible"}
                  </InfoRow>
                )}
            </div>
          </div>

          {/* Map */}
          <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
            <div className="border-b border-[var(--border)] p-6">
              <h2 className="text-2xl font-black text-[var(--foreground)]">
                Location
              </h2>

              <p className="mt-1 text-sm text-[var(--muted)]">
                {place.latitude}, {place.longitude}
              </p>
            </div>

            <div className="flex min-h-[320px] items-center justify-center bg-[var(--secondary)]/5 p-8">
              <div className="text-center">
                <MapPin className="mx-auto h-12 w-12 text-[var(--primary)]" />

                <p className="mt-4 font-bold text-[var(--foreground)]">
                  {place.city?.name ?? "Location"}
                </p>

                <p className="mt-1 text-sm text-[var(--muted)]">
                  Coordinates available
                </p>

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                >
                  Open in Google Maps
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Reviews */}
        <section className="mt-16">
          <PlaceReviews
            placeId={place.id}
            initialReviews={place.reviews ?? []}
          />
        </section>
      </main>
    </div>
  );
}
