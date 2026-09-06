import { Controller, Get, Param } from '@nestjs/common';
import { WeatherService } from './weather.service';
@Controller('cities/:cityId/weather')
export class WeatherController { constructor(private readonly weather: WeatherService) {} @Get() current(@Param('cityId') cityId: string) { return this.weather.getWeather(cityId); } @Get('forecast') forecast(@Param('cityId') cityId: string) { return this.weather.getWeather(cityId); } }
