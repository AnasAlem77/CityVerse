import { Controller, Get, Param, Query } from '@nestjs/common';
import { PredictionService } from './prediction.service';

@Controller('predictions')
export class PredictionController {
  constructor(private readonly predictions: PredictionService) {}
  @Get('capabilities') capabilities() { return this.predictions.capabilities(); }
  @Get('cities/:cityId/:type') prediction(@Param('cityId') cityId: string, @Param('type') type: string, @Query('horizon') horizon?: string) { return this.predictions.predict(cityId, type, horizon); }
}
