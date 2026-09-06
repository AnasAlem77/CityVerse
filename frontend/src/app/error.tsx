"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-16">
      <section className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--primary)]">CityVerse</p>
        <h1 className="mt-3 text-2xl font-black text-[var(--foreground)]">This page could not load</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Please try again, or return to the places directory.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white">Try again</button>
          <Link href="/places" className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-bold text-[var(--foreground)]">Browse places</Link>
        </div>
      </section>
    </main>
  );
}
