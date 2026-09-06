# Assistant Conversational Intelligence

## Architecture

The Assistant keeps the existing `POST /assistant` contract and places a small conversational layer above the existing intent, context, and recommendation services. The frontend creates one `conversationId` per open chat page, keeps an append-only `messages[]` transcript, and sends the identifier plus bounded history on every request. Requests are processed in this order:

1. Load the bounded conversation history.
2. Recognize casual conversation, general questions, supported tools, or a place request.
3. Resolve cities, categories, and subtypes against current database values.
4. Use history to recognize clarification answers and genuine follow-ups.
5. Ask one clarification when a required city or coordinate is missing.
6. Call the existing recommendations, places, weather, alerts, routing, or details service only when needed.
7. Use the configured AI provider only to explain verified results naturally.

Casual messages such as greetings, boredom, status updates, and opinion questions are answered without database retrieval. Follow-ups such as “cheaper”, “another one”, and “near that one” reuse the last user-provided context when it is available. A standalone city answer is treated as a retrieval continuation only when the prior assistant turn asked for a city.

## Context Handling

The frontend sends at most six recent messages. The backend uses only recent user messages for entity resolution and the last assistant question for clarification continuity, so a city and category can survive a short flow without creating permanent conversation storage. The selected place ID is still passed explicitly for place details and similar-place requests. The chat renders all current-session messages and scrolls to the newest turn without replacing earlier responses.

Context is bounded and request-scoped. The conversation ID is an in-memory browser-session identity, not a database key. There are no Conversation tables, migrations, or uncontrolled memory systems.

## Clarification

The Assistant asks only for information required to use a CityVerse capability. For example, an Arabic-food request without a city asks which city the user wants. Nearby requests require browser coordinates, while routing requires validated origin and destination coordinates. The Assistant does not guess missing locations.

## Entity Resolution

Natural aliases are mapped only to classifications present in `Place`. For example, “cafe”, “coffee shop”, and “place for coffee” resolve to the live `shop:coffee` subtype when available. “Gifts” resolves to `shop:gift`, and laundry phrases resolve to the live laundry subtype. If a requested classification is absent, the Assistant says it could not find that place type rather than inventing a category.

## Provider Role and Fallback

The optional AI provider improves natural wording and conversation. It is never the source of place facts. If it is unavailable, greetings and clarifications still work, and supported place, recommendation, nearby, and similar-place requests return verified records from the existing services. The fallback response identifies results as based on CityVerse data without exposing internal implementation terms in normal replies.

## Grounding and Safety

Place IDs returned by a provider are intersected with IDs retrieved from CityVerse. Place names, categories, coordinates, addresses, scores, ratings, review counts, weather, alerts, and routes are rendered only from verified service results. CityVerse Score remains distinct from user ratings. Empty results produce a natural retry suggestion and never fabricated alternatives.

## Examples

`hello bruh` returns a casual greeting without a place query.

`my mother wants Arabic food` asks for a city.

`tokyo bro` resolves Tokyo from the bounded history and retrieves real Tokyo restaurant records.

`I wanna go to a good cafe in Jakarta` resolves the live coffee subtype and returns bounded Jakarta records ranked by the existing deterministic recommendation engine.

`something cheaper` retains the prior city/category context. Because the current schema has no approved price signal, the Assistant does not claim that a result is cheaper; it can continue with the same grounded context or ask for a supported preference.

## Limitations and Extension Points

The current client-side context is intentionally short-lived and limited to six messages. Price, opening-hours, and neighborhood preferences are not inferred unless supported by real stored fields and an approved ranking signal. A future additive change may introduce richer preference handling or another provider implementation, but this pass adds no Phase 7+ features, persistence, or schema changes.
