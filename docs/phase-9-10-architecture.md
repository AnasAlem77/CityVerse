# Phase 9-10 Architecture

## Phase 9: Predictive Intelligence

The prediction boundary is exposed by `PredictionService` and `PredictionProvider`. A prediction carries its city, type, target, horizon, generated time, model/version, features with provenance, status, value, and reason. Supported statuses include `AVAILABLE`, `PREDICTION_UNAVAILABLE`, `INSUFFICIENT_DATA`, and `DEGRADED`.

The current production schema has no historical traffic, activity, mobility, event, or incident observation store and no validated model. Consequently traffic, activity, hotspot, demand, and incident predictions return `PREDICTION_UNAVAILABLE` with `value: null`, empty features, and an explicit reason. No synthetic history, confidence, forecast, chart, or prediction is returned. The Digital Twin displays prediction status separately from current weather/incidents.

The feature contract is ready for temporal, spatial, environmental, mobility, event, and incident features once real observations exist. Model evaluation metadata such as train/test boundaries, MAE/RMSE/classification metrics, model version, and validation time must be populated only by a future validated training pipeline.

## Phase 10: Production Foundation

The existing application already uses bounded Prisma queries, relevant city/category/subtype/coordinate indexes, provider timeouts, weather caching, DTO validation, JWT/admin guards, and grounded provider boundaries. This pass adds a 60-second in-process Digital Twin cache with in-flight request deduplication, so concurrent requests for one city share one aggregation. Cache loss falls back to underlying services.

`GET /health` checks application readiness and the database independently. A database failure returns `status: degraded` rather than hiding the failure or claiming the application is fully healthy. External provider failure remains a capability-level degradation.

The repository's existing test/build commands form the CI foundation: backend tests/build, frontend TypeScript/production build, and Prisma validation. No queue, worker, Redis, distributed cache, auto-deployment, or paid observability service was added. Rate limiting and full structured request metrics remain deployment-level follow-up work; adding an unreviewed global limiter would risk breaking existing public flows.

## Security and Operations

JWT and admin guards remain unchanged. Inputs continue through DTO validation, Prisma queries remain parameterized, and no secrets are exposed in frontend code. The existing backup `.cityverse-backups/cityverse-before-curated-swap-20260905.dump` is preserved. Operators should take verified database backups before migrations, retain environment configuration separately, restore to an isolated database first, and roll back application code if health checks fail. No RTO/RPO is claimed.

## Providers

Open-Meteo is used for current weather/environment data, without an API key, subject to provider availability and freshness. The US National Weather Service provider is used for public alerts/incidents, without an API key, and is geographically limited. OSRM remains the existing routing provider and is not used as traffic intelligence. No Google or paid provider is used.

## Deferred Work

Historical signal storage, validated model training/evaluation, traffic/transit/event/air-quality/mobility providers, rate limiting, richer metrics, background queues, distributed caching, deployment automation, and disaster-recovery automation require real operational requirements and/or data. They remain deferred rather than represented as working functionality. Photos/media and all post-Phase-10 roadmap work are out of scope.
