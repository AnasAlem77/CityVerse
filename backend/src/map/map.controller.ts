import { Controller, Get, Param, Query } from '@nestjs/common';
import { MapBoundsDto } from './dto/map-bounds.dto';
import { MapService } from './map.service';

@Controller('cities/:cityId/map')
export class MapController {
  constructor(private readonly mapService: MapService) {}
  @Get('places') getPlaces(@Param('cityId') cityId: string, @Query() bounds: MapBoundsDto) {
    return this.mapService.getCityPlaces(cityId, bounds);
  }
}
