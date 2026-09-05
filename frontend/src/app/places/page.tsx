import Link from "next/link";
import PlaceCard from "@/components/PlaceCard/PlaceCard";
import { getCities, getPlaceFilters, getPlaces } from "@/lib/api";

type PlacesPageProps = {
  searchParams: Promise<{
    page?: string;
    city?: string;
    category?: string;
    subtype?: string;
    search?: string;
    sort?: string;
  }>;
};

function getPageLink(page: number, params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  if (page > 1) searchParams.set("page", String(page));

  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });

  const query = searchParams.toString();
  return query ? `/places?${query}` : "/places";
}

function displayLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function PlacesPage({
  searchParams,
}: PlacesPageProps) {
  const params = await searchParams;
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const filters = {
    city: params.city,
    category: params.category,
    subtype: params.subtype,
    search: params.search,
    sort: params.sort,
  };
  const [result, citiesResult, placeFilters] = await Promise.all([
    getPlaces(page, 24, filters),
    getCities(1, 100),
    getPlaceFilters(params.city),
  ]);
  const places = result.data;
  const { totalPages } = result;
  const availableSubtypes = placeFilters.subtypes.filter(
    (item) => !params.category || item.category === params.category,
  );

  const pageNumbers = Array.from(
    {
      length: Math.min(totalPages, 5),
    },
    (_, index) => {
      if (totalPages <= 5) {
        return index + 1;
      }

      if (page <= 3) {
        return index + 1;
      }

      if (page >= totalPages - 2) {
        return totalPages - 4 + index;
      }

      return page - 2 + index;
    },
  );

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--primary)]">
            Explore
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--foreground)] sm:text-5xl">
            Popular Places
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            Discover amazing places, local experiences, and hidden
            destinations around the world.
          </p>
        </div>

        <form
          action="/places"
          method="get"
          className="mb-12 grid gap-4 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm md:grid-cols-2 lg:grid-cols-5"
        >
          <input
            name="search"
            defaultValue={params.search}
            placeholder="Search places"
            className="rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm outline-none focus:border-[var(--primary)]"
          />

          <select
            name="city"
            defaultValue={params.city ?? ""}
            className="rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="">All cities</option>
            {citiesResult.data.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>

          <select
            name="category"
            defaultValue={params.category ?? ""}
            className="rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm capitalize outline-none focus:border-[var(--primary)]"
          >
            <option value="">All categories</option>
            {placeFilters.categories.map((category) => (
              <option key={category} value={category}>
                {displayLabel(category)}
              </option>
            ))}
          </select>

          <select
            name="subtype"
            defaultValue={params.subtype ?? ""}
            className="rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm capitalize outline-none focus:border-[var(--primary)]"
          >
            <option value="">All types</option>
            {availableSubtypes.map((item) => (
              <option key={`${item.category}-${item.value}`} value={item.value}>
                {displayLabel(item.value)}
              </option>
            ))}
          </select>

          <div className="flex gap-3">
            <select
              name="sort"
              defaultValue={params.sort ?? "name_asc"}
              className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-transparent px-3 py-3 text-sm outline-none focus:border-[var(--primary)]"
            >
              <option value="name_asc">A-Z</option>
              <option value="name_desc">Z-A</option>
              <option value="newest">Newest</option>
              <option value="most_reviewed">Most reviewed</option>
            </select>
            <button
              type="submit"
              className="rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
            >
              Apply
            </button>
          </div>
        </form>

        {/* Places */}
        {places.length === 0 ? (
          <div className="glass rounded-3xl border p-12 text-center">
            <div className="text-5xl">📍</div>

            <h2 className="mt-5 text-2xl font-black text-[var(--foreground)]">
              No places available
            </h2>

            <p className="mt-3 text-[var(--muted)]">
              There are no places to display right now.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {places.map((place) => (
                <PlaceCard
                  key={place.id}
                  id={place.id}
                  name={place.name}
                  description={place.description}
                  address={place.address}
                  category={place.category}
                  subtype={place.subtype}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-12 flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                  <Link
                    href={getPageLink(Math.max(1, page - 1), filters)}
                    aria-disabled={page <= 1}
                    className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                      page <= 1
                        ? "pointer-events-none border-black/10 text-[var(--muted)] opacity-50"
                        : "border-black/10 text-[var(--foreground)] hover:-translate-y-0.5 hover:border-[var(--primary)] hover:text-[var(--primary)]"
                    }`}
                  >
                    Previous
                  </Link>

                  <div className="flex items-center gap-2">
                    {pageNumbers.map((pageNumber) => (
                      <Link
                        key={pageNumber}
                        href={getPageLink(pageNumber, filters)}
                        aria-current={pageNumber === page ? "page" : undefined}
                        className={`min-w-11 rounded-full border px-4 py-2 text-center text-sm font-bold transition ${
                          pageNumber === page
                            ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                            : "border-black/10 text-[var(--foreground)] hover:-translate-y-0.5 hover:border-[var(--primary)] hover:text-[var(--primary)]"
                        }`}
                      >
                        {pageNumber}
                      </Link>
                    ))}
                  </div>

                  <Link
                    href={getPageLink(Math.min(totalPages, page + 1), filters)}
                    aria-disabled={page >= totalPages}
                    className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                      page >= totalPages
                        ? "pointer-events-none border-black/10 text-[var(--muted)] opacity-50"
                        : "border-black/10 text-[var(--foreground)] hover:-translate-y-0.5 hover:border-[var(--primary)] hover:text-[var(--primary)]"
                    }`}
                  >
                    Next
                  </Link>
                </div>

                <p className="text-sm text-[var(--muted)]">
                  Page {page} of {totalPages} · {result.total} places
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
