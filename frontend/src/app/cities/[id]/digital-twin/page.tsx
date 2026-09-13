"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import CityMap from "@/components/CityMap/CityMapLoader";
import { getDigitalTwin, IntelligenceState } from "@/lib/api";

type Weather = { temperatureC: number; condition: string };
type Signal = IntelligenceState["signals"][number];
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const hasData = (value: unknown) => value !== null && value !== undefined && (!Array.isArray(value) || value.length > 0) && (!isRecord(value) || Object.values(value).some(Boolean));
function isWeather(signal: Signal): signal is Signal & { value: Weather } {
  const value = signal.value;
  return signal.type === "environment" && isRecord(value) && typeof value.temperatureC === "number" && Number.isFinite(value.temperatureC) && typeof value.condition === "string" && Boolean(value.condition.trim());
}

export default function DigitalTwinPage({ params }: { params: Promise<{ id: string }> }) {
  const [data, setData] = useState<IntelligenceState | null>(null); const [cityId, setCityId] = useState(""); const [error, setError] = useState("");
  useEffect(() => { params.then(({ id }) => { setCityId(id); return getDigitalTwin(id).then(setData).catch((e) => setError(e instanceof Error ? e.message : "Digital Twin unavailable")); }); }, [params]);
  if (error) return <main className="min-h-screen bg-[var(--background)] px-4 pb-20 pt-8 sm:px-6 sm:pt-12"><p className="mx-auto max-w-7xl text-[var(--muted)]">{error}</p></main>;
  if (!data) return <main className="min-h-screen bg-[var(--background)] px-4 pb-20 pt-8 sm:px-6 sm:pt-12"><p className="mx-auto max-w-7xl text-[var(--muted)]">Loading city intelligence...</p></main>;
  const weather = data.signals.find(isWeather); const incidents = data.signals.find((s) => s.type === "incident" && hasData(s.value));
  return <main className="min-h-screen bg-[var(--background)] px-4 pb-20 pt-8 sm:px-6 sm:pt-12"><section className="mx-auto max-w-7xl"><div className="flex justify-between gap-4"><h1 className="text-4xl font-black text-[var(--foreground)]">{data.city.name} Digital Twin</h1><Link href={`/cities/${cityId}`} className="font-semibold text-[var(--primary)]">Back to city</Link></div><div className={`mt-8 grid gap-6 ${weather || incidents ? "lg:grid-cols-[1.5fr_1fr]" : ""}`}><CityMap cityId={data.city.id} latitude={Number(data.city.latitude)} longitude={Number(data.city.longitude)} />{(weather || incidents) && <div className="space-y-4">{weather && <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6"><h2 className="text-xl font-black">Environment</h2><p className="mt-3 text-2xl font-black">{weather.value.temperatureC}°C</p><p className="text-[var(--muted)]">{weather.value.condition}</p></section>}{incidents && <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6"><h2 className="text-xl font-black">Incidents</h2><p>{Array.isArray(incidents.value) ? `${incidents.value.length} provider-backed alerts` : "Provider-backed incident data"}</p></section>}</div>}</div></section></main>;
}
