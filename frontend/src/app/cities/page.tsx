import { getCities } from "@/lib/api";
import CityCard from "@/components/CityCard/CityCard";

export default async function CitiesPage() {
  const cities = await getCities();

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
            {cities.map((city: any) => (
              <CityCard
                key={city.id}
                id={city.id}
                name={city.name}
                country={city.country}
                description={city.description}
                image={city.image}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}