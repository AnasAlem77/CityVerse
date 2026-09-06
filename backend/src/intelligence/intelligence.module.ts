import { Module } from '@nestjs/common';
import { PublicDataModule } from '../public-data/public-data.module';
import { WeatherModule } from '../weather/weather.module';
import { PredictionModule } from '../predictions/prediction.module';
import { IntelligenceController } from './intelligence.controller';
import { IntelligenceService } from './intelligence.service';

@Module({ imports: [WeatherModule, PublicDataModule, PredictionModule], controllers: [IntelligenceController], providers: [IntelligenceService], exports: [IntelligenceService] })
export class IntelligenceModule {}
