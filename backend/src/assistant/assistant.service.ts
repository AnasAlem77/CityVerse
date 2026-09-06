import { Injectable } from '@nestjs/common';
import { AlertsUnavailableError } from './errors';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { WeatherService } from '../weather/weather.service';
import { PublicDataService } from '../public-data/public-data.service';
import { AssistantContextService } from './context.service';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';
import { IntentService } from './intent.service';
import { AssistantRequest, AssistantResponse } from './assistant.types';
import { RoutingService } from '../routing/routing.service';

@Injectable()
export class AssistantService {
  constructor(private readonly intents: IntentService, private readonly context: AssistantContextService, private readonly provider: OpenAiCompatibleProvider, private readonly recommendations: RecommendationsService, private readonly weather: WeatherService, private readonly alerts: PublicDataService, private readonly routing: RoutingService) {}
  async ask(request: AssistantRequest): Promise<AssistantResponse> {
    const parsed = this.intents.detect(request.message);
    if (this.intents.isCasual?.(request.message)) return { ...this.base('GENERAL_CITY_QUERY'), conversationId: request.conversationId, message: this.casualReply(request.message) };
    if (this.intents.isGeneralQuestion?.(request.message)) return this.generate(request, 'GENERAL_CITY_QUERY', { places: [], city: null, emptyMessage: "That's a good one 😅 I can give you a general take, or help you compare real CityVerse places if you want." });
    const lastAssistantMessage = [...(request.history ?? [])].reverse().find((item) => item.role === 'assistant')?.content ?? '';
    if (parsed.intent === 'GENERAL_CITY_QUERY' && /city|where are you|what are you in the mood for|get out somewhere/.test(lastAssistantMessage.toLowerCase()) && /^(yeah|yes|yep|sure|okay|ok|alright)$/i.test(request.message.trim())) {
      return { ...this.base('GENERAL_CITY_QUERY'), conversationId: request.conversationId, message: 'Say less 😎 What city are you in?' };
    }
    const resolved = await this.context.resolve(request.message, request.history ?? []);
    const cityId = request.cityId ?? resolved.cityId;
    const category = parsed.category ?? resolved.category;
    const hasHistory = (request.history ?? []).some((item) => item.role === 'user');
    const clarificationAnswer = parsed.intent === 'GENERAL_CITY_QUERY' && /city|where are you/.test(lastAssistantMessage.toLowerCase()) && Boolean(cityId);
    const followUp = this.intents.isFollowUp?.(request.message) || clarificationAnswer;
    const effectiveIntent = followUp && !['WEATHER', 'ALERTS', 'ROUTING', 'PLACE_DETAILS'].includes(parsed.intent) ? 'RECOMMENDATION' : parsed.intent;
    if (effectiveIntent === 'GENERAL_CITY_QUERY') return this.generate(request, effectiveIntent, { places: [], city: null, emptyMessage: "I can chat, compare cities, or help you find something real in CityVerse. What's on your mind?" });
    if (resolved.unsupportedTerm) return { ...this.base(effectiveIntent), message: `I couldn't find a matching ${resolved.unsupportedTerm} place type in the current CityVerse data. Want to try another category?` };
    if (['PLACE_SEARCH', 'RECOMMENDATION', 'CITY_INFORMATION'].includes(effectiveIntent) && !cityId) return { ...this.base(effectiveIntent), message: category ? `I can help you find ${category} options. Which city are you looking in?` : 'Yeah, I got you. Which city are you looking in?', clarification: 'Choose a city so I can find real CityVerse options.' };
    if (effectiveIntent === 'NEARBY_PLACES' && (request.latitude === undefined || request.longitude === undefined)) return { ...this.base(effectiveIntent), message: 'I can look around you, but I need your location first.', clarification: 'Allow location access or choose a city.' };
    if (effectiveIntent === 'PLACE_DETAILS') {
      if (!request.placeId) return { ...this.base(parsed.intent), message: 'Which place do you mean?', clarification: 'Select a place or provide its place ID.' };
      const details = await this.context.details(request.placeId);
      if (!details) return { ...this.base(parsed.intent), message: 'That place could not be found.', clarification: 'Please select another CityVerse place.' };
      return this.generate(request, effectiveIntent, { city: await this.context.city(details.cityId), places: [details], details });
    }
    if (effectiveIntent === 'ROUTING') {
      if (!request.origin || !request.destination) return { ...this.base(effectiveIntent), message: 'I need both a starting point and a destination to calculate a route.', clarification: 'Provide origin and destination coordinates, or allow location for your starting point.' };
      try { return { ...this.base(effectiveIntent), message: 'Here is the route from the verified coordinates.', route: await this.routing.route({ origin: request.origin, destination: request.destination, mode: 'driving' }) }; } catch { return { ...this.base(effectiveIntent), message: 'Routing is currently unavailable. Please try again later.' }; }
    }
    const subtype = resolved.subtype ?? undefined;
    const recommendationIds = effectiveIntent === 'RECOMMENDATION' ? (await this.recommendations.recommend({ mode: request.placeId ? 'similar' : 'city', cityId, category, subtype, search: resolved.search, placeId: request.placeId, limit: 10 })).recommendations.map((item) => item.placeId) : undefined;
    const places = await this.context.places({ cityId, category, subtype, search: resolved.search, latitude: effectiveIntent === 'NEARBY_PLACES' ? request.latitude : undefined, longitude: effectiveIntent === 'NEARBY_PLACES' ? request.longitude : undefined, placeIds: recommendationIds });
    const city = cityId ? await this.context.city(cityId) : null;
    let weather: unknown = null; let alerts: unknown[] = []; let alertsAvailable: boolean | undefined; let alertsReason: string | undefined;
    if (effectiveIntent === 'WEATHER' && cityId) weather = await this.weather.getWeather(cityId);
    if (effectiveIntent === 'ALERTS' && cityId) { const result = await this.alerts.getAlerts(cityId); alerts = result.alerts; alertsAvailable = result.available; alertsReason = result.reason; }
    const emptyMessage = places.length ? undefined : `Hmm, I couldn't find a matching place in ${city?.name ?? 'the selected city'} right now. Want to try another category?`;
    return this.generate(request, effectiveIntent, { city, places, weather, alerts, alertsAvailable, alertsReason, emptyMessage });
  }
  private async generate(request: AssistantRequest, intent: AssistantResponse['intent'], context: Record<string, unknown>): Promise<AssistantResponse> {
    try {
      const availablePlaces = Array.isArray(context.places) ? context.places as Array<{ placeId: string; name?: string; category?: string; subtype?: string | null; cityVerseScore?: number; reviewCount?: number }> : [];
      const generated = await this.provider.generateStructured({ system: 'You are CityVerse Assistant. Use only verified context. Never invent places, ratings, review counts, weather, routes, alerts, addresses, opening hours, or distances. CityVerse Score is not a user rating. Return JSON with message, suggestions, and placeIds only.', user: request.message, context: { ...context, history: (request.history ?? []).slice(-6) } }) as { message?: string; suggestions?: string[]; placeIds?: string[] };
      const allowed = new Set(availablePlaces.map((place) => place.placeId));
      return { ...this.base(intent), conversationId: request.conversationId, cityId: ((context.city as { id?: string } | null)?.id), message: generated.message ?? 'Here is the verified CityVerse information available.', places: (generated.placeIds ?? []).filter((id) => allowed.has(id)).map((placeId) => { const place = availablePlaces.find((item) => item.placeId === placeId); return { ...place, placeId, reason: 'Selected from verified CityVerse context.' }; }), details: context.details, weather: context.weather ?? null, alerts: Array.isArray(context.alerts) ? context.alerts : [], alertsAvailable: context.alertsAvailable as boolean | undefined, alertsReason: context.alertsReason as string | undefined, suggestions: generated.suggestions ?? [] };
    } catch {
      const verifiedPlaces = Array.isArray(context.places) ? context.places as Array<{ placeId: string; name?: string; category?: string; subtype?: string | null; cityVerseScore?: number; reviewCount?: number }> : [];
      const fallbackSupported = ['PLACE_SEARCH', 'NEARBY_PLACES', 'RECOMMENDATION'].includes(intent);
      const city = context.city as { name?: string } | null | undefined;
      const cityLabel = city?.name ? ` in ${city.name}` : '';
      const deterministicMessage = verifiedPlaces.length > 0 ? intent === 'RECOMMENDATION' ? `I found a few options${cityLabel} based on CityVerse data and available quality signals.` : intent === 'NEARBY_PLACES' ? 'Here are some verified options near you, ranked using CityVerse data and available signals.' : `I found these verified options${cityLabel} using CityVerse data and available signals.` : context.emptyMessage as string | undefined;
      const conversationalMessage = deterministicMessage ?? (intent === 'GENERAL_CITY_QUERY' ? 'I can help you discover real places, weather, routes, and more. What are you in the mood for?' : 'I could not complete that request with the available CityVerse data.');
      return { ...this.base(intent), conversationId: request.conversationId, cityId: ((context.city as { id?: string } | null)?.id), message: conversationalMessage, unavailable: fallbackSupported && verifiedPlaces.length > 0 ? true : undefined, details: context.details, places: fallbackSupported ? verifiedPlaces.map((place) => ({ ...place, reason: 'Verified CityVerse result ranked without generative AI.' })) : [], weather: context.weather ?? null, alerts: Array.isArray(context.alerts) ? context.alerts : [], alertsAvailable: context.alertsAvailable as boolean | undefined, alertsReason: context.alertsReason as string | undefined };
    }
  }
  private casualReply(message: string) {
    return /bored/i.test(message) ? 'Lmaoo 😂 That is dangerous. Wanna get out somewhere or just chill?' : /tired/i.test(message) ? 'I feel you 😅 Want to keep it low-key or find somewhere to unwind?' : /how are you/i.test(message) ? "I'm good 😎 What are you looking for today?" : /thank/i.test(message) ? 'Anytime! 👋' : /yo|sup/i.test(message) ? 'Yo 😂 What are we looking for today?' : "Hey! 👋 What's up?";
  }
  private base(intent: AssistantResponse['intent']): AssistantResponse { return { intent, message: '', places: [], weather: null, route: null, alerts: [], suggestions: ['Find restaurants in this city', 'Show me nearby places', 'What is the weather?'] }; }
}
