import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Star,
  Navigation,
  Compass,
} from "lucide-react";

import { getPlace } from "@/lib/api";
import PlaceReviews from "@/components/PlaceReviews/PlaceReviews";

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
  name: string;
  description: string;
  category: string;
  latitude: string;
  longitude: string;

  city?: {
    id: string;
    name: string;
    country: string;
  };

  images?: {
    id: string;
    url: string;
  }[];

  reviews?: Review[];
  reviewsCount?: number;
  averageRating?: number;
};

function Stars({
  rating,
  size = 18,
}: {
  rating: number;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={size}
          className={
            index < Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-[var(--border-strong)]"
          }
        />
      ))}
    </div>
  );
}

export default async function PlaceDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const place = (await getPlace(id)) as Place;

  const rating = place.averageRating ?? 0;

  const reviewsCount =
    place.reviewsCount ??
    place.reviews?.length ??
    0;

  const image =
    place.images && place.images.length > 0
      ? place.images[0].url
      : null;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">

        {/* Back */}
        <Link
          href="/places"
          className="group inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition-all duration-300 hover:-translate-x-1 hover:text-[var(--primary)]"
        >
          <ArrowLeft
            size={17}
            className="transition-transform duration-300 group-hover:-translate-x-1"
          />

          Back to places
        </Link>

        {/* Hero */}
        <section className="mt-7 overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">

          <div className="relative flex h-72 items-center justify-center overflow-hidden bg-[var(--surface-soft)] sm:h-[420px]">

            {image ? (
              <img
                src={image}
                alt={place.name}
                className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.02]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--surface-soft)]">
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[var(--primary-soft)] text-[var(--primary)]">
                  <MapPin size={44} />
                </div>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/50 to-transparent" />

          </div>

          <div className="p-6 sm:p-8">

            <div className="flex flex-wrap items-center gap-3">

              <span className="rounded-full bg-[var(--primary-soft)] px-4 py-1.5 text-sm font-bold text-[var(--primary)]">
                {place.category}
              </span>

              {place.city && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--muted)]">
                  <MapPin size={15} />
                  {place.city.name}, {place.city.country}
                </span>
              )}

            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
              {place.name}
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)]">
              {place.description}
            </p>

            {/* Rating */}
            <div className="mt-6 flex flex-wrap items-center gap-4">

              <Stars rating={rating} />

              <span className="font-bold">
                {rating.toFixed(1)}
              </span>

              <span className="text-sm text-[var(--muted)]">
                {reviewsCount}{" "}
                {reviewsCount === 1
                  ? "review"
                  : "reviews"}
              </span>

            </div>

          </div>

        </section>

        {/* Information */}
        <section className="mt-8 grid gap-6 md:grid-cols-2">

          {/* Location */}
          <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <MapPin size={20} />
              </div>

              <h2 className="text-lg font-black">
                Location
              </h2>

            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              <div className="rounded-xl bg-[var(--surface-soft)] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                  Latitude
                </p>

                <p className="mt-1 font-semibold">
                  {place.latitude}
                </p>
              </div>

              <div className="rounded-xl bg-[var(--surface-soft)] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                  Longitude
                </p>

                <p className="mt-1 font-semibold">
                  {place.longitude}
                </p>
              </div>

            </div>

            <a
              href={`https://www.google.com/maps?q=${place.latitude},${place.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <Navigation size={16} />
              Open in Google Maps
            </a>

          </div>

          {/* Rating summary */}
          <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10 text-amber-500">
                <Star
                  size={20}
                  className="fill-current"
                />
              </div>

              <h2 className="text-lg font-black">
                Rating overview
              </h2>

            </div>

            <div className="mt-6 flex items-center gap-5">

              <div className="text-5xl font-black">
                {rating.toFixed(1)}
              </div>

              <div>

                <Stars rating={rating} />

                <p className="mt-2 text-sm text-[var(--muted)]">
                  Based on {reviewsCount}{" "}
                  {reviewsCount === 1
                    ? "review"
                    : "reviews"}
                </p>

              </div>

            </div>

          </div>

        </section>

        {/* Reviews */}
        <section className="mt-12">

          <div className="mb-6 flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Compass size={21} />
            </div>

            <div>
              <h2 className="text-2xl font-black">
                Visitor experiences
              </h2>

              <p className="text-sm text-[var(--muted)]">
                See what other visitors think about this place.
              </p>
            </div>

          </div>

          <PlaceReviews
            placeId={place.id}
            initialReviews={place.reviews ?? []}
          />

        </section>

      </div>
    </main>
  );
}
