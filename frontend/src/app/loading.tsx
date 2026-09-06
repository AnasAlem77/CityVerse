export default function Loading() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 pb-20 pt-32 sm:px-6">
      <section className="mx-auto max-w-7xl animate-pulse space-y-6">
        <div className="h-4 w-24 rounded-full bg-[var(--secondary)]/15" />
        <div className="h-12 max-w-md rounded-2xl bg-[var(--secondary)]/15" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => <div key={item} className="h-56 rounded-3xl bg-[var(--secondary)]/10" />)}
        </div>
      </section>
    </main>
  );
}
