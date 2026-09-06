import { Module } from '@nestjs/common';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { WeatherModule } from '../weather/weather.module';
import { PublicDataModule } from '../public-data/public-data.module';
import { RoutingModule } from '../routing/routing.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantContextService } from './context.service';
import { IntentService } from './intent.service';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';
@Module({ imports: [RecommendationsModule, WeatherModule, PublicDataModule, RoutingModule], controllers: [AssistantController], providers: [AssistantService, AssistantContextService, IntentService, OpenAiCompatibleProvider] })
export class AssistantModule {}
