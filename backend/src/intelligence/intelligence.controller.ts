import { Controller, Get, Param } from '@nestjs/common';
import { IntelligenceService } from './intelligence.service';

@Controller('cities/:cityId')
export class IntelligenceController {
  constructor(private readonly intelligence: IntelligenceService) {}
  @Get('intelligence') state(@Param('cityId') cityId: string) { return this.intelligence.getState(cityId); }
  @Get('intelligence/:type') signal(@Param('cityId') cityId: string, @Param('type') type: string) { return this.intelligence.getSignal(cityId, type); }
  @Get('digital-twin') digitalTwin(@Param('cityId') cityId: string) { return this.intelligence.getState(cityId); }
}
