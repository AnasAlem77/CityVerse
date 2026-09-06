export type TravelMode = 'driving' | 'cycling' | 'walking';
export type RouteRequest = { origin: { latitude: number; longitude: number }; destination: { latitude: number; longitude: number }; mode: TravelMode };
export type NormalizedRoute = { distanceMeters: number; durationSeconds: number; geometry: { type: 'LineString'; coordinates: number[][] }; steps: Array<{ instruction: string; distanceMeters: number; durationSeconds: number }>; provider: string };
export interface RoutingProvider { supportedModes(): TravelMode[]; route(request: RouteRequest): Promise<NormalizedRoute>; }
