# Phase 5 and Phase 6 Architecture

## Dashboard and analytics

The dashboard is read-only and uses the existing `City`, `Place`, `CityVerseScore`, `PlaceRating`, `Review`, `SavedPlace`, `PlaceImage`, and `RawPlace` data architecture. `GET /dashboard/overview` and `GET /dashboard/cities/:cityId` are protected by the existing JWT and admin guards because they expose aggregate operational data.

Analytics use database counts, `groupBy`, aggregates, and a parameterized PostgreSQL query for score average, median, and distribution buckets. The score query does not load all scores into Node memory. City analytics includes category/subtype distributions, data-quality percentages, rating/review totals, geographic coordinate bounds/averages, top CityVerse Score places, and provider-independent capability metadata.

The frontend provides `/dashboard` and `/dashboard/cities/[cityId]`. It renders aggregate summary cards, category distribution, city coverage, score metrics, quality percentages, and top places. Missing user-rating data is shown as `Not available`; CityVerse Score is never labeled as a user rating.

## Multi-city platform

The existing `City` row remains the source of truth for name, country, coordinates, and timezone. `GET /cities/:id/capabilities` exposes city-scoped capabilities without a city-name branch. Places, maps, recommendations, assistant, analytics, weather, and routing are available from the existing architecture; alerts are explicitly reported as provider-dependent.

No lifecycle enum or migration was added because the current schema has no onboarding workflow that needs those states. Future cities can be represented by adding validated City configuration/data and using the same ID-based services. Existing coverage definitions remain unchanged and no collection pipeline is run by dashboard code.

## Security and performance

Dashboard APIs require an authenticated admin. Invalid city IDs return `404`; existing global validation handles request DTOs. Aggregations are bounded at the database, top-place responses are limited, and no raw/staging records are copied into production. No secrets, provider keys, or precise user locations are included.

## Limitations

- Dashboard UI requires an admin token stored by the existing authentication flow.
- City lifecycle management is not implemented because it would require a separate onboarding workflow.
- Neighborhood boundaries and density polygons are not invented; geographic analytics currently reports coordinate bounds and averages.
- Alerts remain provider-dependent, as in Phase 2.
