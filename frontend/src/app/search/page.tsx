import Link from "next/link";
import { MapPin, Compass, Star, ArrowLeft } from "lucide-react";
import { getCities, getPlaces } from "@/lib/api";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function SearchPage({
  searchParams,
}: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  const [cities, placesResult] = await Promise.all([
    getCities(1, 100),
    getPlaces(1, 24, { search: query }),
  ]);
  const places = placesResult.data;

  const normalizedQuery = query.toLowerCase();

  const matchingCities = query
    ? cities.data.filter((city) => {
        const text = [
          city.name,
          city.country,
          city.description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(normalizedQuery);
      })
    : [];

  const matchingPlaces = query
    ? places.filter((place: any) => {
        const text = [
          place.name,
          place.category,
          place.description,
          place.city?.name,
          place.city?.country,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(normalizedQuery);
      })
    : [];

  const totalResults =
    matchingCities.length + matchingPlaces.length;

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-16">
      <div className="mx-auto max-w-7xl">

        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)] transition hover:gap-3"
        >
          <ArrowLeft size={17} />
          Back to home
        </Link>

        <div className="mb-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-500">
            Search
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--foreground)] sm:text-5xl">
            Search results
          </h1>

          {query ? (
            <p className="mt-4 text-lg text-[var(--muted)]">
              Results for{" "}
              <span className="font-bold text-[var(--foreground)]">
                "{query}"
              </span>
            </p>
          ) : (
            <p className="mt-4 text-lg text-[var(--muted)]">
              Search for a city, place, or experience.
            </p>
          )}
        </div>

        {!query ? (
          <div className="glass rounded-3xl border p-10 text-center">
            <Compass
              size={48}
              className="mx-auto text-teal-500"
            />

            <h2 className="mt-5 text-2xl font-bold text-[var(--foreground)]">
              What are you looking for?
            </h2>

            <p className="mt-2 text-[var(--muted)]">
              Try searching for Jakarta, Bali, restaurants,
              museums, beaches, or another destination.
            </p>
          </div>
        ) : totalResults === 0 ? (
          <div className="glass rounded-3xl border p-10 text-center">
            <MapPin
              size={48}
              className="mx-auto text-teal-500"
            />

            <h2 className="mt-5 text-2xl font-bold text-[var(--foreground)]">
              No results found
            </h2>

            <p className="mt-2 text-[var(--muted)]">
              We couldn't find anything matching "{query}".
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex rounded-2xl bg-[var(--primary)] px-6 py-3 font-bold text-white transition hover:-translate-y-1"
            >
              Try another search
            </Link>
          </div>
        ) : (
          <div className="space-y-14">

            {matchingCities.length > 0 && (
              <section>
                <div className="mb-6 flex items-end justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wider text-teal-500">
                      Cities
                    </p>

                    <h2 className="mt-1 text-2xl font-black text-[var(--foreground)]">
                      Cities matching your search
                    </h2>
                  </div>

                  <span className="text-sm text-[var(--muted)]">
                    {matchingCities.length} result
                    {matchingCities.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {matchingCities.map((city: any) => (
                    <Link
                      key={city.id}
                      href={`/cities/${city.id}`}
                      className="glass group rounded-3xl border p-6 transition duration-500 hover:-translate-y-2 hover:shadow-2xl"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-500 transition duration-500 group-hover:scale-110">
                        <Compass size={27} />
                      </div>

                      <p className="mt-6 text-sm font-bold text-teal-500">
                        {city.country}
                      </p>

                      <h3 className="mt-2 text-2xl font-black text-[var(--foreground)]">
                        {city.name}
                      </h3>

                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
                        {city.description ??
                          "Discover amazing places and experiences in this city."}
                      </p>

                      <div className="mt-6 flex items-center gap-2 font-bold text-[var(--primary)]">
                        Explore city
                        <span className="transition group-hover:translate-x-1">
                          →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {matchingPlaces.length > 0 && (
              <section>
                <div className="mb-6 flex items-end justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wider text-purple-500">
                      Places
                    </p>

                    <h2 className="mt-1 text-2xl font-black text-[var(--foreground)]">
                      Places matching your search
                    </h2>
                  </div>

                  <span className="text-sm text-[var(--muted)]">
                    {matchingPlaces.length} result
                    {matchingPlaces.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {matchingPlaces.map((place: any) => (
                    <Link
                      key={place.id}
                      href={`/places/${place.id}`}
                      className="glass group rounded-3xl border p-6 transition duration-500 hover:-translate-y-2 hover:shadow-2xl"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-500 transition duration-500 group-hover:scale-110">
                          <MapPin size={27} />
                        </div>

                        {place.averageRating != null && (
                          <div className="flex items-center gap-1 rounded-full bg-amber-400/10 px-3 py-1 text-sm font-bold text-amber-500">
                            <Star
                              size={14}
                              className="fill-current"
                            />
                            {Number(
                              place.averageRating
                            ).toFixed(1)}
                          </div>
                        )}
                      </div>

                      <p className="mt-6 text-sm font-bold text-purple-500">
                        {place.category ?? "Place"}
                      </p>

                      <h3 className="mt-2 text-2xl font-black text-[var(--foreground)]">
                        {place.name}
                      </h3>

                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
                        {place.description ??
                          "Discover this amazing place."}
                      </p>

                      <div className="mt-6 font-bold text-[var(--primary)]">
                        View place →
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

          </div>
        )}

      </div>
    </main>
  );
}
