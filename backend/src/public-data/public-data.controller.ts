import { Controller, Get, Param } from '@nestjs/common';
import { PublicDataService } from './public-data.service';
@Controller('cities/:cityId')
export class PublicDataController { constructor(private readonly data: PublicDataService) {} @Get('alerts') alerts(@Param('cityId') cityId: string) { return this.data.getAlerts(cityId); } @Get('incidents') incidents(@Param('cityId') cityId: string) { return this.data.getAlerts(cityId); } }
