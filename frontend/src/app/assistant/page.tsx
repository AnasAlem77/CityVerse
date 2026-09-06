"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { askAssistant, AssistantResponse } from "@/lib/api";

type ChatMessage = { role: "user" | "assistant"; content: string; response?: AssistantResponse };
const suggestions = ["Find restaurants in Paris", "Show me nearby places", "What is the weather?"];

export default function AssistantPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationContext, setConversationContext] = useState<{ cityId?: string; placeId?: string }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const conversationId = useRef<string | null>(null);
  const endOfChat = useRef<HTMLDivElement | null>(null);

  useEffect(() => { endOfChat.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text || loading) return;
    if (!conversationId.current) conversationId.current = crypto.randomUUID();
    const priorMessages = messages.map(({ role, content }) => ({ role, content })).slice(-6);
    setMessages((current) => [...current, { role: "user", content: text }]);
    setLoading(true); setError(""); setMessage("");
    try {
      const needsLocation = /near me|nearby|close to me/i.test(text);
      let location: { latitude: number; longitude: number } | undefined;
      if (needsLocation && navigator.geolocation) location = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition((position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }), reject, { maximumAge: 300000, timeout: 8000 }));
      const referencesPlace = /tell me more|about (it|the first|this place)|details/i.test(text);
      const next = await askAssistant({ message: text, conversationId: conversationId.current, ...(location ?? {}), ...(conversationContext.cityId ? { cityId: conversationContext.cityId } : {}), ...(referencesPlace && conversationContext.placeId ? { placeId: conversationContext.placeId } : {}), history: priorMessages });
      setConversationContext({ cityId: next.cityId ?? conversationContext.cityId, placeId: next.places[0]?.placeId ?? conversationContext.placeId });
      setMessages((current) => [...current, { role: "assistant", content: next.message, response: next }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Assistant unavailable"); }
    finally { setLoading(false); }
  }

  function responseDetails(response: AssistantResponse) {
    return <>{response.details && <div className="mt-5 rounded-2xl border border-[var(--border)] p-4 text-sm text-[var(--muted)]"><p className="font-bold text-[var(--foreground)]">{response.details.name}</p><p>{response.details.category}{response.details.subtype ? ` · ${response.details.subtype}` : ""}</p>{response.details.address && <p>{response.details.address}</p>}{typeof response.details.cityVerseScore === "number" && <p>CityVerse Score: {response.details.cityVerseScore.toFixed(1)}</p>}{typeof response.details.averageRating === "number" && <p>User rating: {response.details.averageRating.toFixed(1)} ({response.details.reviewCount ?? 0} reviews)</p>}</div>}{response.weather?.available && response.weather.current && <div className="mt-5 rounded-2xl border border-[var(--border)] p-4"><p className="text-sm font-bold text-[var(--foreground)]">Weather</p><p className="mt-1 text-sm text-[var(--muted)]">{response.weather.current.temperatureC}°C, {response.weather.current.condition}</p></div>}{response.alertsAvailable === false && <div className="mt-5 rounded-2xl border border-[var(--border)] p-4 text-sm text-[var(--muted)]">Alerts are currently unavailable for this location{response.alertsReason ? `: ${response.alertsReason}` : ""}.</div>}{response.alerts.length > 0 && <div className="mt-5 rounded-2xl border border-amber-300/50 p-4"><p className="text-sm font-bold text-[var(--foreground)]">Alerts</p>{response.alerts.map((alert, index) => <p key={`${alert.title}-${index}`} className="mt-1 text-sm text-[var(--muted)]">{alert.title ?? "Alert"}{alert.description ? `: ${alert.description}` : ""}</p>)}</div>}{response.route && <div className="mt-5 rounded-2xl border border-[var(--border)] p-4 text-sm text-[var(--muted)]">Route: {Math.round((response.route as { distanceMeters: number }).distanceMeters / 1000)} km</div>}{response.places.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2">{response.places.map((place) => <Link key={place.placeId} href={`/places/${place.placeId}`} className="rounded-2xl border border-[var(--border)] p-4 hover:border-[var(--primary)]"><p className="text-sm font-bold text-[var(--foreground)]">{place.name ?? "Verified CityVerse place"}</p><p className="mt-1 text-xs capitalize text-[var(--muted)]">{place.category ?? "place"}{place.subtype ? ` · ${place.subtype}` : ""}</p>{typeof place.cityVerseScore === "number" && <p className="mt-2 text-xs font-semibold text-[var(--primary)]">CityVerse Score: {place.cityVerseScore.toFixed(1)}</p>}<span className="mt-3 block text-sm font-semibold text-[var(--primary)]">View details →</span></Link>)}</div>}</>;
  }

  return <main className="min-h-screen bg-[var(--background)] px-4 pb-20 pt-24 sm:px-6 sm:pt-32"><section className="mx-auto max-w-4xl"><p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--primary)]">City intelligence</p><h1 className="mt-3 text-4xl font-black text-[var(--foreground)]">Ask CityVerse</h1><p className="mt-4 max-w-2xl text-[var(--muted)]">Ask about places, recommendations, weather, routes, and available city alerts. Answers use verified CityVerse data.</p><div className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm sm:p-5"><div className="max-h-[34rem] min-h-36 space-y-5 overflow-y-auto rounded-2xl bg-[var(--background)] p-3 sm:p-5">{messages.length === 0 && <p className="text-sm text-[var(--muted)]">Start with a question below.</p>}{messages.map((item, index) => <div key={`${item.role}-${index}`} className={item.role === "user" ? "ml-auto max-w-[92%] rounded-2xl bg-[var(--primary)] px-4 py-3 text-white sm:max-w-[85%]" : "max-w-[98%] sm:max-w-[95%]"}><p className={item.role === "assistant" ? "text-base leading-7 text-[var(--foreground)] sm:text-lg sm:leading-8" : "text-sm leading-6"}>{item.content}</p>{item.response && responseDetails(item.response)}</div>)}{loading && <p className="text-sm text-[var(--muted)]">Thinking...</p>}<div ref={endOfChat} /></div><form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:mt-5 sm:flex-row"><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What would you like to discover?" className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 outline-none focus:border-[var(--primary)]" disabled={loading} /><button type="submit" className="rounded-2xl bg-[var(--primary)] px-5 py-3 font-bold text-white disabled:opacity-50 sm:shrink-0" disabled={loading}>{loading ? "Thinking..." : "Ask"}</button></form>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<div className="mt-5 flex flex-wrap gap-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setMessage(suggestion)} className="rounded-full border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]">{suggestion}</button>)}</div></div></section></main>;
}
