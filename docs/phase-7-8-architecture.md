# Phase 7-8 Architecture

## Intelligence Layer

Phase 7 adds a city-agnostic, read-only intelligence boundary at `/cities/:cityId/intelligence`. It normalizes signals as `{ type, availability, value, location, observedAt, source, freshness, reason }`. The Digital Twin endpoint `/cities/:cityId/digital-twin` returns the city snapshot, capabilities, normalized signals, and layer metadata.

The service currently reuses Open-Meteo through `WeatherService` for environmental conditions and the existing public-safety provider for incident/alert signals. Traffic, transit, events, air quality, and mobility have no configured reliable free provider in this deployment and are explicitly `unavailable`. Temporal support is limited to provider timestamps and snapshot generation; no history or prediction is fabricated.

## Digital Twin

The Phase 8 page at `/cities/:id/digital-twin` combines the existing Leaflet place map with signal and capability cards. It is linked from the existing city page and does not replace the Phase 2 map implementation. Each layer displays available, limited, or unavailable status and retains source/freshness information.

## Capabilities and City Agnosticism

Capabilities are returned through the existing city capability endpoint and the intelligence snapshot. They are based on provider/service support, not city-name conditionals. A future city uses the same city ID, coordinates, providers, normalized signals, and UI without inserting fixture data into production.

## Degradation and Safety

Each provider is isolated behind an existing service boundary. Weather or public-safety failure produces a limited signal while other layers remain visible. Unsupported layers have `value: null` and a reason. No traffic, events, transit, air-quality, mobility, timestamps, scores, or incidents are invented. No intelligence data is persisted, so no migration or cache infrastructure is required for this foundation.

## Deferred Work

Phase 9 prediction, historical trend storage, real transit/GTFS ingestion, event feeds, air-quality providers, mobility datasets, and Phase 10 queues/workers/distributed caching are intentionally deferred until reliable sources and product requirements exist. Photo/media work remains out of scope.
