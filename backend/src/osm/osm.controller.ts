import {
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';

import { OsmService } from './osm.service';

@Controller('osm')
export class OsmController {
  constructor(
    private readonly osmService: OsmService,
  ) {}

  @Get('nearby')
  searchNearbyPlaces(
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('radius') radius?: string,
  ) {
    return this.osmService.searchNearbyPlaces(
      Number(latitude),
      Number(longitude),
      radius
        ? Number(radius)
        : 5000,
    );
  }

  // Read-only wide-coverage candidate report. Persistence is intentionally
  // not exposed through this endpoint.
  @Get('coverage/preview')
  previewCoverage(
    @Query('cityId') cityId: string,
  ) {
    return this.osmService.collectRawPlacesForCity(cityId, false);
  }

  @Post('import')
  importNearbyPlaces(
    @Query('cityId') cityId: string,
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('radius') radius?: string,
  ) {
    return this.osmService.importNearbyPlaces(
      cityId,
      Number(latitude),
      Number(longitude),
      radius
        ? Number(radius)
        : 5000,
    );
  }

  @Post('update-existing')
  updateExistingPlaces(
    @Query('cityId') cityId: string,
  ) {
    return this.osmService.updateExistingPlacesFromOsm(
      cityId,
    );
  }
}
