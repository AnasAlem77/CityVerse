"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";

type PlaceMapProps = {
  latitude: number;
  longitude: number;
  name: string;
};

function MapResize() {
  const map = useMap();

  useEffect(() => {
    const frame = map.getContainer().parentElement;
    if (!frame) return;

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(frame);
    map.invalidateSize();

    return () => observer.disconnect();
  }, [map]);

  return null;
}

export default function PlaceMap({ latitude, longitude, name }: PlaceMapProps) {
  const validCoordinates = Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;

  if (!validCoordinates) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center bg-[var(--secondary)]/5 p-6 text-center text-sm text-[var(--muted)]">
        A map is unavailable because this place has invalid coordinates.
      </div>
    );
  }

  return (
    <div className="cityverse-map-frame h-[280px] sm:h-[340px]">
      <MapContainer center={[latitude, longitude]} zoom={16} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapResize />
        <CircleMarker
          center={[latitude, longitude]}
          radius={10}
          pathOptions={{ color: "#9a3412", fillColor: "#f97316", fillOpacity: 0.95, weight: 3 }}
        >
          <Popup>{name}</Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
