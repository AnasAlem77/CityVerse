# CityVerse Curation Pipeline

## Data layers

- `Place` is the protected production dataset used by the application.
- `RawPlace` preserves wide-area OSM candidates and the original `rawTags` JSON.
- `CuratedPlace` stores the deterministic, versioned selection from `RawPlace`.

Phase 1 never promotes curated records into `Place`.

## Rebuild commands

Run from `backend` with `DATABASE_URL` loaded from `.env`:

```bash
npx tsx scripts/curate-raw-osm.ts
npx tsx scripts/report-curation.ts
```

The curation script is safe to rerun. It transactionally rebuilds only the
selected city's `CuratedPlace` rows. It never deletes, updates, or replaces
`Place` or `RawPlace` records.

## Selection rules

The deterministic score combines:

- quality: name, coordinates, category, subtype, and metadata
- importance: real OSM tourism, landmark, historic, Wikipedia/Wikidata, and
  institution signals
- completeness: address, website, phone, hours, cuisine, and accessibility
- relevance: category-specific CityVerse usefulness
- geographic coverage: one strong leader per grid cell before ranked fill
- subtype diversity: explicit subtype caps, with unknown subtype retained

Scores are explainable and stored as component fields on `CuratedPlace`.
Tier 1 is must-have evidence, Tier 2 is strong, Tier 3 is legitimate local
coverage, and Tier 4 is rejected. Explicit `vacant` and `yes` subtype noise is
excluded, while legitimate records with incomplete metadata can remain.

City configuration is reusable in `CITY_CURATED_QUOTAS` and
`city-coverage.ts`. Quotas are upper bounds, not fill targets. No city can
exceed the 8,000 hard maximum; current configured upper bounds are below it.

## Safety and rollback

Before any future promotion, create a database backup and validate foreign-key
relationships for reviews, saved places, and images. The current backup is:

`.cityverse-backups/cityverse-before-curated-swap-20260905.dump`

Production promotion is intentionally a separate future phase.
