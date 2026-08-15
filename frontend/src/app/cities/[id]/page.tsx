import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  ArrowRight,
} from "lucide-react";

const API_URL = "http://localhost:3001";

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
  country: string;
  latitude: string;
  longitude: string;
  places?: Place[];
};

async function getCity(id: string): Promise<City> {
  const response = await fetch(`${API_URL}/cities/${id}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch city");
  }

  return response.json();
}

export default async function CityDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const city = await getCity(id);

  const places = city.places ?? [];

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">

        {/* Back */}
        <Link
          href="/cities"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
        >
          <ArrowLeft size={17} />
          Back to cities
        </Link>


        {/* City Header */}
        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

          <div className="flex min-h-72 items-center justify-center bg-gradient-to-br from-blue-100 via-slate-100 to-cyan-100 dark:from-blue-950 dark:via-slate-900 dark:to-cyan-950">
            <span className="text-8xl">🌍</span>
          </div>


          <div className="p-6 sm:p-8">

            <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
              <MapPin size={16} />
              {city.country}
            </div>


            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              {city.name}
            </h1>


            <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
              Discover amazing places and experiences in {city.name}.
            </p>


            <div className="mt-6 grid gap-4 sm:grid-cols-2">

              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Latitude
                </p>

                <p className="mt-1 font-medium text-slate-900 dark:text-white">
                  {city.latitude}
                </p>
              </div>


              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Longitude
                </p>

                <p className="mt-1 font-medium text-slate-900 dark:text-white">
                  {city.longitude}
                </p>
              </div>

            </div>

          </div>

        </section>


        {/* Places */}
        <section className="mt-12">

          <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Explore
              </p>

              <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                Places in {city.name}
              </h2>

              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Discover interesting places around the city.
              </p>
            </div>


            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {places.length}{" "}
              {places.length === 1 ? "place" : "places"}
            </span>

          </div>


          {places.length > 0 ? (

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

              {places.map((place) => (

                <article
                  key={place.id}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
                >

                  <div className="flex h-48 items-center justify-center bg-gradient-to-br from-slate-100 to-blue-100 text-6xl dark:from-slate-800 dark:to-blue-950">
                    📍
                  </div>


                  <div className="p-6">

                    <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {place.category}
                    </p>


                    <h3 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                      {place.name}
                    </h3>


                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                      {place.description}
                    </p>


                    <Link
                      href={`/places/${place.id}`}
                      className="mt-5 inline-flex items-center gap-2 font-semibold text-blue-600 transition group-hover:gap-3 dark:text-blue-400"
                    >
                      View Details
                      <ArrowRight size={17} />
                    </Link>

                  </div>

                </article>

              ))}

            </div>

          ) : (

            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">

              <div className="text-5xl">
                📍
              </div>

              <h3 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
                No places yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                There are currently no places registered for this city.
              </p>

            </div>

          )}

        </section>

      </div>
    </main>
  );
}
