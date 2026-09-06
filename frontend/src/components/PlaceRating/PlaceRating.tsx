"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { getRatingSummary, ratePlace, RatingSummary } from "@/lib/api";

export default function PlaceRating({ placeId }: { placeId: string }) {
  const [summary, setSummary] = useState<RatingSummary>({ average: 0, count: 0 });
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState("");
  useEffect(() => { getRatingSummary(placeId).then(setSummary).catch(() => undefined); }, [placeId]);
  async function submit(value: number) {
    setSelected(value);
    try { setSummary(await ratePlace(placeId, value)); setMessage("Rating saved."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Please login to rate this place."); }
  }
  return <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold">Community rating</p><p className="text-xs text-[var(--muted)]">{summary.average.toFixed(1)} / 5 from {summary.count} ratings</p></div><div className="flex items-center gap-1" aria-label="Rate this place">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => submit(value)} aria-label={`Rate ${value} stars`} className="rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"><Star size={20} className={value <= selected ? "fill-amber-400 text-amber-400" : "text-[var(--border-strong)]"} /></button>)}</div></div>{message && <p className="mt-2 text-xs text-[var(--muted)]">{message}</p>}</div>;
}
