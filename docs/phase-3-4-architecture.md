# Phase 3 and Phase 4 Architecture

## AI City Assistant

`POST /assistant` accepts a bounded message, optional city/place IDs, validated coordinates, and at most six prior messages. `IntentService` provides provider-independent intent detection for place search, nearby places, recommendations, weather, routing, alerts, city information, place details, and general city queries. City and category/subtype references are resolved against current database values, with safe synonym mapping only for categories that exist in the database.

`AssistantContextService` is the source-of-truth retrieval layer. It uses selective Prisma fields and a maximum of 20 places. CityVerse Score is calculated with the existing deterministic implementation; review counts are read from the actual `Review` relation and are never converted into fake ratings.

`AiProvider` exposes `generateStructured()` and `capabilities()`. `OpenAiCompatibleProvider` is configured only through `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, and `AI_PROVIDER`. The server sends verified context to the provider with strict grounding instructions, validates returned place IDs against retrieved IDs, and returns an explicit unavailable response when no provider is configured or the provider fails. No provider key is exposed to Next.js.

Conversation state is intentionally request-scoped and bounded by the client-provided six-message window; no new persistence table is required for this foundation. Nearby requests use browser geolocation only after permission is granted. Weather and alerts delegate to the existing Phase 2 services. Routing accepts validated origin/destination coordinates and delegates to the existing OSRM-backed `RoutingService`; missing endpoints produce clarification rather than guessed coordinates. Place details require an explicit place ID and return the existing record, score, actual ratings, review count, and images.

## Recommendations

`GET /recommendations/cities/:cityId`, `/category`, `/nearby`, `/similar/:placeId`, and `/personalized` use the independent `RecommendationsService`. Candidate generation is bounded to 100 records and uses database filters, including a coordinate bounding box for nearby queries. Ranking combines the existing CityVerse Score, actual review-count signal, similarity attributes, and distance when available.

Ranking is deterministic with stable tie breakers. Category and subtype diminishing-return penalties reduce repetition without rigid quotas. The internal recommendation score is returned as metadata and is not presented as a star rating. Personalized mode currently provides a truthful non-personalized fallback (`personalized: false`) until preference or interaction data is product-approved, avoiding a fabricated user profile.

## Extension points

- Add another `AiProvider` implementation and select it through configuration without changing assistant orchestration.
- Add richer intent parsing while keeping retrieval bounded and provider-independent.
- Add persisted preferences or interactions later through additive migrations only.
- Add route context by passing validated coordinates into the existing `RoutingService`.

## Environment

Optional backend variables:

```text
AI_PROVIDER=openai-compatible
AI_API_KEY=
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

The assistant remains available as an explicit unavailable state when `AI_API_KEY` is empty. No Google API configuration is used.
