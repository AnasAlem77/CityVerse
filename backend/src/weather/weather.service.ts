import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenMeteoProvider } from './open-meteo.provider';
import { WeatherSnapshot } from './weather.types';

@Injectable()
export class WeatherService {
  private readonly cache = new Map<string, { expires: number; value: WeatherSnapshot }>();
  private readonly ttlMs = 10 * 60 * 1000;
  constructor(private readonly prisma: PrismaService, private readonly provider: OpenMeteoProvider) {}
  async getWeather(cityId: string) {
    const cached = this.cache.get(cityId); if (cached && cached.expires > Date.now()) return cached.value;
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { id: true, latitude: true, longitude: true } });
    if (!city) throw new NotFoundException('City not found');
    try { const value = { cityId, ...(await this.provider.getWeather(Number(city.latitude), Number(city.longitude))) }; this.cache.set(cityId, { expires: Date.now() + this.ttlMs, value }); return value; }
    catch (error) { return { cityId, provider: 'Open-Meteo', available: false, fetchedAt: new Date().toISOString(), reason: error instanceof Error ? error.message : 'Weather unavailable' }; }
  }
  clearCache() { this.cache.clear(); }
}
