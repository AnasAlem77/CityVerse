import { BadGatewayException, Injectable, RequestTimeoutException } from '@nestjs/common';
import { WeatherProvider } from './weather.types';

@Injectable()
export class OpenMeteoProvider implements WeatherProvider {
  async getWeather(latitude: number, longitude: number) {
    const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m', daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset', forecast_days: '5', timezone: 'auto' });
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal, headers: { 'User-Agent': 'CityVerse/2.0 weather' } });
      if (!response.ok) throw new BadGatewayException('Weather provider unavailable');
      const data = await response.json() as any;
      const condition = weatherCode(data.current?.weather_code);
      return { provider: 'Open-Meteo', available: true, fetchedAt: new Date().toISOString(), current: { temperatureC: data.current.temperature_2m, feelsLikeC: data.current.apparent_temperature, condition, humidity: data.current.relative_humidity_2m, windSpeedKph: data.current.wind_speed_10m, precipitationMm: data.current.precipitation, sunrise: data.daily?.sunrise?.[0], sunset: data.daily?.sunset?.[0] }, forecast: (data.daily?.time ?? []).map((date: string, index: number) => ({ date, minC: data.daily.temperature_2m_min[index], maxC: data.daily.temperature_2m_max[index], condition: weatherCode(data.daily.weather_code[index]), precipitationProbability: data.daily.precipitation_probability_max[index] })) };
    } catch (error) { if (error instanceof BadGatewayException) throw error; if ((error as Error).name === 'AbortError') throw new RequestTimeoutException('Weather provider timed out'); throw new BadGatewayException('Weather provider unavailable'); }
    finally { clearTimeout(timeout); }
  }
}
function weatherCode(code: number) { const values: Record<number, string> = { 0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 61: 'Rain', 71: 'Snow', 80: 'Rain showers', 95: 'Thunderstorm' }; return values[code] ?? 'Unknown'; }
