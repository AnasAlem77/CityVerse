"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import Link from "next/link";
import { getMapPlaces, MapPlace } from "@/lib/api";

type Props = { cityId: string; latitude: number; longitude: number; category?: string };

function ViewportLoader({ cityId, category, onPlaces, onState }: { cityId: string; category?: string; onPlaces: (places: MapPlace[]) => void; onState: (state: string) => void }) {
  const map = useMap();
  useMapEvents({ moveend() { load(); }, zoomend() { load(); } });
  async function load() {
    onState("loading");
    const bounds = map.getBounds();
    try { const result = await getMapPlaces(cityId, { north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest(), category }); onPlaces(result.data); onState(result.truncated ? "truncated" : result.data.length ? "ready" : "empty"); }
    catch { onState("error"); }
  }
  useEffect(() => { void load(); }, [cityId, category]);
  return null;
}

function clustered(places: MapPlace[]) {
  const groups = new Map<string, MapPlace[]>();
  for (const place of places) { const key = `${Number(place.latitude).toFixed(3)}:${Number(place.longitude).toFixed(3)}`; groups.set(key, [...(groups.get(key) ?? []), place]); }
  return [...groups.values()].map((group) => group[0]);
}

export default function CityMap({ cityId, latitude, longitude, category }: Props) {
  const [places, setPlaces] = useState<MapPlace[]>([]); const [state, setState] = useState("loading");
  return <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
    <div className="relative h-[300px] sm:h-[360px] lg:h-[420px]">
      <MapContainer center={[latitude, longitude]} zoom={12} scrollWheelZoom className="h-full w-full">
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ViewportLoader cityId={cityId} category={category} onPlaces={setPlaces} onState={setState} />
        {clustered(places).map((place) => <CircleMarker key={place.id} center={[Number(place.latitude), Number(place.longitude)]} radius={7} pathOptions={{ color: "#0f766e", fillColor: "#14b8a6", fillOpacity: 0.85 }}><Popup><Link href={`/places/${place.id}`} className="font-semibold text-teal-700 hover:underline">{place.name}</Link><div className="text-xs capitalize">{place.category}{place.subtype ? ` · ${place.subtype}` : ""}</div></Popup></CircleMarker>)}
      </MapContainer>
      {state === "loading" && <div className="absolute left-4 top-4 z-[1000] rounded-full bg-white/90 px-3 py-2 text-xs font-semibold shadow">Loading places...</div>}
      {state === "error" && <div className="absolute left-4 top-4 z-[1000] rounded-full bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 shadow">Map places unavailable</div>}
      {state === "empty" && <div className="absolute left-4 top-4 z-[1000] rounded-full bg-white/90 px-3 py-2 text-xs font-semibold shadow">No places in this view</div>}
    </div>
    <p className="px-4 py-3 text-xs text-[var(--muted)]">OpenStreetMap base map. Pan or zoom to load places in the visible area.</p>
  </div>;
}
