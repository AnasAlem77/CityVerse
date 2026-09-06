const API_URL = "http://localhost:3001";
export type RouteResult = { distanceMeters: number; durationSeconds: number; geometry: { coordinates: number[][] }; provider: string };
export async function requestRoute(data: { origin: { latitude: number; longitude: number }; destination: { latitude: number; longitude: number }; mode: string }): Promise<RouteResult> {
  const response = await fetch(`${API_URL}/routing/route`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || "Route unavailable");
  return response.json();
}
