import Link from "next/link";
import { ArrowLeft, MapPin, Star } from "lucide-react";

import { getCityPlaces, PlacesQuery, PlaceSummary } from "@/lib/api";

const PAGE_SIZE = 24;

function isArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

function buildQuery(id: string, page: number, query: PlacesQuery) {
  const params = new URLSearchParams({ page: String(page) });
  Object.entries(query).forEach(([key, value]) => {
    if (value?.trim()) params.set(key, value.trim());
  });
  return `/cities/${id}?${params.toString()}`;
}

function PlaceCard({ place }: { place: PlaceSummary }) {
  const arabicName = isArabic(place.name);

  return (
    <Link href={`/places/${place.id}`} className="group block">
      <article className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
        <div className="relative aspect-[16/10] overflow-hidden bg-[var(--secondary)]/10">
          <div className="flex h-full items-center justify-center"><MapPin className="h-10 w-10 text-[var(--secondary)]/40" /></div>
          <div className="absolute left-4 top-4"><span className="rounded-full bg-[var(--card)]/90 px-3 py-1.5 text-xs font-semibold capitalize text-[var(--secondary)] shadow-sm backdrop-blur-sm">{label(place.category)}{place.subtype ? ` · ${label(place.subtype)}` : ""}</span></div>
        </div>
        <div className="p-5">
          <h3 dir={arabicName ? "rtl" : "ltr"} className={`line-clamp-1 text-xl text-[var(--foreground)] ${arabicName ? "font-arabic font-bold" : "font-black"}`}>{place.name}</h3>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm text-[var(--muted)]"><Star className="h-4 w-4 text-[var(--accent)]" /><span>No reviews yet</span></div>
            <span className="text-sm font-semibold text-[var(--primary)] transition-colors group-hover:text-[var(--primary-hover)]">Explore</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function Pagination({ id, page, totalPages, query }: { id: string; page: number; totalPages: number; query: PlacesQuery }) {
  if (totalPages <= 1) return null;
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);

  return (
    <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="City places pagination">
      {page > 1 && <Link href={buildQuery(id, page - 1, query)} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]">Previous</Link>}
      {pages.map((pageNumber) => <Link key={pageNumber} href={buildQuery(id, pageNumber, query)} aria-current={pageNumber === page ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${pageNumber === page ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]"}`}>{pageNumber}</Link>)}
      {page < totalPages && <Link href={buildQuery(id, page + 1, query)} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]">Next</Link>}
    </nav>
  );
}

export default async function CityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const value = (key: string) => {
    const item = rawSearchParams[key];
    return Array.isArray(item) ? item[0] : item;
  };
  const pageValue = Number.parseInt(value("page") ?? "1", 10);
  const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
  const query: PlacesQuery = { category: value("category"), subtype: value("subtype"), search: value("search"), sort: value("sort") };
  const result = await getCityPlaces(id, page, PAGE_SIZE, query);
  const cityIsArabic = isArabic(result.city.name);
  const subtypes = result.subtypes.filter((item) => !query.category || item.category === query.category).map((item) => item.value);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-32 lg:px-8">
        <div className="mb-8">
          <Link href="/cities" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--primary)]"><ArrowLeft className="h-4 w-4" />Back to cities</Link>
          <h1 dir={cityIsArabic ? "rtl" : "ltr"} className={`text-4xl tracking-tight text-[var(--foreground)] md:text-5xl ${cityIsArabic ? "font-arabic font-bold" : "font-black"}`}>{result.city.name}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">Explore places, restaurants, attractions and other points of interest in this city.</p>
        </div>

        <form className="mb-10 grid gap-3 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 md:grid-cols-4" method="get">
          <input name="search" defaultValue={query.search} placeholder="Search this city" className="rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm outline-none focus:border-[var(--primary)]" />
          <select name="category" defaultValue={query.category ?? ""} className="rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm capitalize outline-none focus:border-[var(--primary)]"><option value="">All categories</option>{result.categories.map((category) => <option key={category} value={category}>{label(category)}</option>)}</select>
          <select name="subtype" defaultValue={query.subtype ?? ""} className="rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm capitalize outline-none focus:border-[var(--primary)]"><option value="">All types</option>{Array.from(new Set(subtypes)).map((subtype) => <option key={subtype} value={subtype}>{label(subtype)}</option>)}</select>
          <div className="flex gap-3"><select name="sort" defaultValue={query.sort ?? "name_asc"} className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm outline-none focus:border-[var(--primary)]"><option value="name_asc">A-Z</option><option value="name_desc">Z-A</option><option value="newest">Newest</option><option value="most_reviewed">Most reviewed</option></select><button type="submit" className="rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-hover)]">Apply</button></div>
        </form>

        {result.data.length === 0 ? <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-10 text-center"><MapPin className="mx-auto mb-4 h-10 w-10 text-[var(--muted)]" /><h2 className="text-xl font-bold text-[var(--foreground)]">No places found</h2><p className="mt-2 text-sm text-[var(--muted)]">Try another category or search term.</p></div> : <><div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{result.data.map((place) => <PlaceCard key={place.id} place={place} />)}</div><Pagination id={id} page={result.pagination.currentPage} totalPages={result.pagination.totalPages} query={query} /></>}
      </section>
    </div>
  );
}
