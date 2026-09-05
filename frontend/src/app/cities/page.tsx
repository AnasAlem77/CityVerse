import Link from "next/link";
import { getCities } from "@/lib/api";
import CityCard from "@/components/CityCard/CityCard";

type CitiesPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function CitiesPage({ searchParams }: CitiesPageProps) {
  const params = await searchParams;
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const result = await getCities(page, 12);
  const cities = result.data;

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--primary)]">
            Explore
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--foreground)] sm:text-5xl">
            Cities
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            Discover amazing cities around the world and explore
            the places, experiences, and stories that make them unique.
          </p>
        </div>

        {/* Cities */}
        {cities.length === 0 ? (
          <div className="glass rounded-3xl border p-12 text-center">
            <div className="text-5xl">🌍</div>

            <h2 className="mt-5 text-2xl font-black text-[var(--foreground)]">
              No cities available
            </h2>

            <p className="mt-3 text-[var(--muted)]">
              There are no cities to display right now.
            </p>
          </div>
        ) : (
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((city) => (
              <CityCard
                key={city.id}
                id={city.id}
                name={city.name}
                country={city.country}
                description={city.description ?? undefined}
                image={city.image ?? ""}
              />
            ))}
          </div>
        )}

        {result.totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-3">
            <Link
              href={page > 2 ? `/cities?page=${page - 1}` : "/cities"}
              aria-disabled={page <= 1}
              className={`rounded-full border px-4 py-2 text-sm font-bold ${page <= 1 ? "pointer-events-none opacity-40" : "hover:border-[var(--primary)]"}`}
            >
              Previous
            </Link>
            <span className="px-3 text-sm font-semibold text-[var(--muted)]">
              Page {page} of {result.totalPages}
            </span>
            <Link
              href={`/cities?page=${Math.min(result.totalPages, page + 1)}`}
              aria-disabled={page >= result.totalPages}
              className={`rounded-full border px-4 py-2 text-sm font-bold ${page >= result.totalPages ? "pointer-events-none opacity-40" : "hover:border-[var(--primary)]"}`}
            >
              Next
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
