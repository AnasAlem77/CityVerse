# Phase 2 City Intelligence

## Providers

- Map: Leaflet with OpenStreetMap tiles. Place markers are loaded from CityVerse by viewport bounds, capped at 500 records, and grouped into coordinate-grid clusters in the browser.
- Routing: OSRM public router through `RoutingProvider`; driving and cycling are supported. Walking is reported as unavailable because the public OSRM profile is not enabled here.
- Weather: Open-Meteo, using the city's stored latitude/longitude. Responses are cached in the backend for 10 minutes and failures return `available: false`.
- Public data: US National Weather Service active alerts. It is a real source with provenance, but coverage is limited to supported US coordinates; unsupported cities return an unavailable state rather than fabricated incidents.

## APIs

- `GET /cities/:cityId/map/places?north=&south=&east=&west=&category=`
- `GET /routing/capabilities`
- `POST /routing/route`
- `GET /cities/:cityId/weather`
- `GET /cities/:cityId/weather/forecast`
- `GET /cities/:cityId/alerts`
- `GET /cities/:cityId/incidents`

Cities supply coordinates and timezone in the database, so adding a city does not require feature-specific code. Future intelligence layers should follow the provider-and-normalized-model pattern used by routing, weather, and public data.

No Google Places or Google Maps billing APIs are used.

## Verification Checkpoint

- OSRM live verification passed for driving and cycling, including distance, duration, and LineString geometry. Walking remains explicitly unavailable.
- Open-Meteo live verification passed for Jakarta, Paris, and Tokyo with current conditions and five forecast days. City coordinates were read from the database.
- NWS live verification returned a valid empty alert collection for a supported US coordinate. Requests for the current CityVerse cities return an unavailable state where NWS does not support the region; no alerts are fabricated.
- The map API was exercised for Jakarta, Bali, Paris, Dubai, and Tokyo with bounded responses and valid coordinates. The category filter is validated and viewport-driven.
- Backend tests, backend build, frontend TypeScript, frontend production webpack build, Prisma validation, and migration status all passed.
- The frontend provider checks use explicit loading, empty, unavailable, and error states. External live provider calls are subject to public-service availability and rate limits.
