import { BadGatewayException, BadRequestException, Injectable, RequestTimeoutException } from '@nestjs/common';
import { RouteRequest, NormalizedRoute, RoutingProvider, TravelMode } from './routing.types';

@Injectable()
export class OsrmProvider implements RoutingProvider {
  private readonly baseUrl = process.env.ROUTING_PROVIDER_URL ?? 'https://router.project-osrm.org';
  supportedModes(): TravelMode[] { return ['driving', 'cycling']; }
  async route(request: RouteRequest): Promise<NormalizedRoute> {
    if (!this.supportedModes().includes(request.mode)) throw new BadRequestException(`Routing mode ${request.mode} is unavailable`);
    const profile = request.mode;
    const url = `${this.baseUrl}/route/v1/${profile}/${request.origin.longitude},${request.origin.latitude};${request.destination.longitude},${request.destination.latitude}?overview=full&geometries=geojson&steps=true`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'CityVerse/2.0 routing' } });
      if (!response.ok) throw new BadGatewayException('Routing provider unavailable');
      const data = await response.json() as any;
      const route = data.routes?.[0];
      if (!route) throw new BadGatewayException('No route available');
      return { distanceMeters: route.distance, durationSeconds: route.duration, geometry: route.geometry, steps: (route.legs ?? []).flatMap((leg: any) => leg.steps ?? []).map((step: any) => ({ instruction: step.maneuver?.instruction ?? step.name ?? 'Continue', distanceMeters: step.distance, durationSeconds: step.duration })), provider: 'OSRM' };
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if ((error as Error).name === 'AbortError') throw new RequestTimeoutException('Routing provider timed out');
      throw new BadGatewayException('Routing provider unavailable');
    } finally { clearTimeout(timeout); }
  }
}
