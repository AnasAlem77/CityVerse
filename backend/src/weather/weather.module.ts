import { Module } from '@nestjs/common';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';
import { OpenMeteoProvider } from './open-meteo.provider';
@Module({ controllers: [WeatherController], providers: [WeatherService, OpenMeteoProvider] })
export class WeatherModule {}
