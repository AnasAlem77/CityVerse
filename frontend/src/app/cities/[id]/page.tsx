import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Star,
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
  description?: string;
  image?: string;
  latitude: string;
  longitude: string;
  _count?: {
    places: number;
  };
};

type PlacesResponse = {
  city: {
    id: string;
    name: string;
  };
  data: Place[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
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

async function getCityPlaces(id: string): Promise<PlacesResponse> {
  const response = await fetch(
    `${API_URL}/cities/${id}/places?limit=12&offset=0`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch city places");
  }

  return response.json();
}

export default async function CityDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [city, placesResponse] = await Promise.all([
    getCity(id),
    getCityPlaces(id),
  ]);

  const places = placesResponse.data;
  const totalPlaces = placesResponse.pagination.total;

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">

        {/* Back */}
        <Link
          href="/cities"
          className="
            inline-flex
            items-center
            gap-2
            text-sm
            font-semibold
            text-[var(--muted)]
            transition-all
            duration-300
            hover:gap-3
            hover:text-orange-500
          "
        >
          <ArrowLeft size={17} />
          Back to cities
        </Link>

        {/* City Hero */}
        <section
          className="
            mt-8
            overflow-hidden
            rounded-3xl
            border
            border-black/5
            bg-[var(--card)]
            shadow-sm
            dark:border-white/10
          "
        >
          {/* Visual */}
          <div
            className="
              relative
              flex
              min-h-80
              items-center
              justify-center
              overflow-hidden
              bg-gradient-to-br
              from-orange-100
              via-emerald-100
              to-slate-100
              dark:from-orange-950
              dark:via-emerald-950
              dark:to-slate-950
            "
          >
            <div
              className="
                absolute
                -left-20
                -top-20
                h-64
                w-64
                rounded-full
                bg-orange-400/20
                blur-3xl
              "
            />

            <div
              className="
                absolute
                -bottom-20
                -right-20
                h-64
                w-64
                rounded-full
                bg-emerald-400/20
                blur-3xl
              "
            />

            <div
              className="
                relative
                flex
                h-28
                w-28
                items-center
                justify-center
                rounded-[2rem]
                border
                border-white/40
                bg-white/60
                text-orange-500
                shadow-2xl
                backdrop-blur-xl
                dark:border-white/10
                dark:bg-black/30
              "
            >
              <MapPin size={52} strokeWidth={1.5} />
            </div>
          </div>

          {/* Information */}
          <div className="p-7 sm:p-9">
            <div className="flex items-center gap-2 text-sm font-bold text-orange-500">
              <MapPin size={16} />
              {city.country}
            </div>

            <h1
              className="
                mt-3
                text-4xl
                font-black
                tracking-tight
                text-[var(--foreground)]
                sm:text-5xl
              "
            >
              {city.name}
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
              {city.description ??
                `Discover amazing places and experiences in ${city.name}.`}
            </p>

            {/* Stats */}
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <div
                className="
                  rounded-2xl
                  border
                  border-black/5
                  bg-[var(--background)]
                  p-5
                  dark:border-white/10
                "
              >
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--muted)]">
                  Places
                </p>

                <p className="mt-2 text-2xl font-black text-[var(--foreground)]">
                  {totalPlaces}
                </p>
              </div>

              <div
                className="
                  rounded-2xl
                  border
                  border-black/5
                  bg-[var(--background)]
                  p-5
                  dark:border-white/10
                "
              >
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--muted)]">
                  Latitude
                </p>

                <p className="mt-2 text-lg font-bold text-[var(--foreground)]">
                  {city.latitude}
                </p>
              </div>

              <div
                className="
                  rounded-2xl
                  border
                  border-black/5
                  bg-[var(--background)]
                  p-5
                  dark:border-white/10
                "
              >
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--muted)]">
                  Longitude
                </p>

                <p className="mt-2 text-lg font-bold text-[var(--foreground)]">
                  {city.longitude}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Places */}
        <section className="mt-14">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-500">
                Explore
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--foreground)]">
                Places in {city.name}
              </h2>

              <p className="mt-3 text-[var(--muted)]">
                Discover interesting places around the city.
              </p>
            </div>

            <span className="text-sm font-semibold text-[var(--muted)]">
              Showing {places.length} of {totalPlaces}
            </span>
          </div>

          {places.length > 0 ? (
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {places.map((place) => (
                <Link
                  key={place.id}
                  href={`/places/${place.id}`}
                  className="
                    group
                    overflow-hidden
                    rounded-3xl
                    border
                    border-black/5
                    bg-[var(--card)]
                    shadow-sm
                    transition-all
                    duration-500
                    hover:-translate-y-2
                    hover:shadow-2xl
                    dark:border-white/10
                  "
                >
                  {/* Place visual */}
                  <div
                    className="
                      relative
                      flex
                      h-48
                      items-center
                      justify-center
                      overflow-hidden
                      bg-gradient-to-br
                      from-orange-100
                      via-emerald-100
                      to-slate-100
                      dark:from-orange-950
                      dark:via-emerald-950
                      dark:to-slate-950
                    "
                  >
                    <div
                      className="
                        absolute
                        -right-8
                        -top-8
                        h-28
                        w-28
                        rounded-full
                        bg-orange-400/20
                        blur-3xl
                        transition-transform
                        duration-700
                        group-hover:scale-150
                      "
                    />

                    <div
                      className="
                        absolute
                        -bottom-8
                        -left-8
                        h-28
                        w-28
                        rounded-full
                        bg-emerald-400/20
                        blur-3xl
                        transition-transform
                        duration-700
                        group-hover:scale-150
                      "
                    />

                    <div
                      className="
                        relative
                        flex
                        h-16
                        w-16
                        items-center
                        justify-center
                        rounded-2xl
                        border
                        border-white/40
                        bg-white/60
                        text-orange-500
                        shadow-xl
                        backdrop-blur-xl
                        transition-all
                        duration-500
                        group-hover:scale-110
                        group-hover:rotate-3
                        dark:border-white/10
                        dark:bg-black/30
                      "
                    >
                      <MapPin size={32} strokeWidth={1.7} />
                    </div>

                    {/* Category */}
                    <span
                      className="
                        absolute
                        bottom-4
                        left-4
                        rounded-full
                        border
                        border-white/40
                        bg-white/80
                        px-3
                        py-1.5
                        text-xs
                        font-bold
                        uppercase
                        tracking-wider
                        text-slate-800
                        shadow-lg
                        backdrop-blur-md
                        dark:border-white/10
                        dark:bg-black/40
                        dark:text-white
                      "
                    >
                      {place.category || "Place"}
                    </span>

                    {/* Rating */}
                    {place.averageRating != null &&
                      place.averageRating > 0 && (
                        <span
                          className="
                            absolute
                            right-4
                            top-4
                            flex
                            items-center
                            gap-1
                            rounded-full
                            bg-black/70
                            px-3
                            py-1.5
                            text-xs
                            font-bold
                            text-white
                            backdrop-blur-md
                          "
                        >
                          <Star
                            size={13}
                            className="fill-yellow-400 text-yellow-400"
                          />
                          {Number(place.averageRating).toFixed(1)}
                        </span>
                      )}
                  </div>

                  {/* Place information */}
                  <div className="p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-orange-500">
                      {place.category || "Destination"}
                    </p>

                    <h3
                      className="
                        mt-2
                        text-xl
                        font-black
                        tracking-tight
                        text-[var(--foreground)]
                        transition-colors
                        duration-300
                        group-hover:text-orange-500
                      "
                    >
                      {place.name}
                    </h3>

                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
                      {place.description}
                    </p>

                    <div className="mt-6 flex items-center justify-between">
                      <span className="text-sm font-bold text-[var(--foreground)]">
                        View place
                      </span>

                      <span
                        className="
                          flex
                          h-9
                          w-9
                          items-center
                          justify-center
                          rounded-full
                          bg-orange-500/10
                          text-orange-500
                          transition-all
                          duration-500
                          group-hover:translate-x-1
                          group-hover:bg-orange-500
                          group-hover:text-white
                        "
                      >
                        <ArrowRight size={17} />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div
              className="
                rounded-3xl
                border
                border-dashed
                border-black/10
                bg-[var(--card)]
                p-12
                text-center
                dark:border-white/10
              "
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
                <MapPin size={30} />
              </div>

              <h3 className="mt-5 text-xl font-black text-[var(--foreground)]">
                No places yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                There are currently no places registered for this city.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
