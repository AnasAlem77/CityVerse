"use client";

import { useEffect, useState } from "react";

type Weather = { available: boolean; current?: { temperatureC: number; feelsLikeC?: number; condition: string; humidity?: number; windSpeedKph?: number }; forecast?: Array<{ date: string; minC?: number; maxC?: number; condition: string }> };

export default function CityWeather({ cityId }: { cityId: string }) {
  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => { fetch(`http://localhost:3001/cities/${cityId}/weather`, { cache: "no-store" }).then((res) => res.ok ? res.json() : null).then(setWeather).catch(() => setWeather({ available: false })); }, [cityId]);
  if (!weather) return <div className="h-24 animate-pulse rounded-2xl bg-[var(--secondary)]/10" />;
  if (!weather.available || !weather.current) return <div className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">Weather data is currently unavailable.</div>;
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[var(--primary)]">Current weather</p><p className="mt-1 text-3xl font-black">{Math.round(weather.current.temperatureC)}°C</p><p className="text-sm text-[var(--muted)]">{weather.current.condition} · feels like {Math.round(weather.current.feelsLikeC ?? weather.current.temperatureC)}°C</p></div><div className="text-right text-xs text-[var(--muted)]"><p>Humidity {weather.current.humidity ?? "-"}%</p><p>Wind {weather.current.windSpeedKph ?? "-"} km/h</p></div></div>{weather.forecast && <div className="mt-4 grid grid-cols-5 gap-2 border-t border-[var(--border)] pt-4">{weather.forecast.map((day) => <div key={day.date} className="text-center text-xs"><p className="font-semibold">{new Date(`${day.date}T12:00:00`).toLocaleDateString("en", { weekday: "short" })}</p><p className="mt-1 text-[var(--muted)]">{Math.round(day.maxC ?? 0)}° / {Math.round(day.minC ?? 0)}°</p></div>)}</div>}</div>;
}
