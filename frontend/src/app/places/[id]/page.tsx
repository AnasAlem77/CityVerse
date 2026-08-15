import Link from "next/link";
import { ArrowLeft, MapPin, Star, Navigation } from "lucide-react";

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
              : "text-slate-300 dark:text-slate-700"
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
    <main className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">

        {/* Back */}
        <Link
          href="/places"
          className="group inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
        >
          <ArrowLeft
            size={17}
            className="transition-transform group-hover:-translate-x-1"
          />

          Back to places
        </Link>


        {/* Hero */}
        <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">

          <div className="relative flex h-72 items-center justify-center overflow-hidden bg-gradient-to-br from-blue-100 via-slate-100 to-cyan-100 dark:from-blue-950 dark:via-slate-900 dark:to-cyan-950 sm:h-96">

            {image ? (
              <img
                src={image}
                alt={place.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-8xl">
                📍
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

          </div>


          <div className="p-6 sm:p-8">

            <div className="flex flex-wrap items-center gap-3">

              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                {place.category}
              </span>


              {place.city && (
                <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                  <MapPin size={15} />

                  {place.city.name}, {place.city.country}
                </span>
              )}

            </div>


            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
              {place.name}
            </h1>


            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-400">
              {place.description}
            </p>


            {/* Rating */}
            <div className="mt-6 flex flex-wrap items-center gap-4">

              <Stars rating={rating} />

              <span className="font-semibold">
                {rating.toFixed(1)}
              </span>

              <span className="text-sm text-slate-500 dark:text-slate-400">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">

            <div className="flex items-center gap-3">

              <div className="rounded-xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <MapPin size={20} />
              </div>

              <h2 className="text-lg font-bold">
                Location
              </h2>

            </div>


            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Latitude
                </p>

                <p className="mt-1 text-sm font-medium">
                  {place.latitude}
                </p>
              </div>


              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Longitude
                </p>

                <p className="mt-1 text-sm font-medium">
                  {place.longitude}
                </p>
              </div>

            </div>


            <a
              href={`https://www.google.com/maps?q=${place.latitude},${place.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Navigation size={16} />
              Open in Google Maps
            </a>

          </div>


          {/* Review summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">

            <h2 className="text-lg font-bold">
              Rating overview
            </h2>


            <div className="mt-5 flex items-center gap-5">

              <div className="text-5xl font-bold">
                {rating.toFixed(1)}
              </div>


              <div>

                <Stars rating={rating} />

                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
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

          <PlaceReviews
            placeId={place.id}
            initialReviews={place.reviews ?? []}
          />

        </section>

      </div>

    </main>
  );
}
