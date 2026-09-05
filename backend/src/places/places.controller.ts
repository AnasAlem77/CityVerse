import {
  Body,
  Controller,
  Get,
  Param,
  Query,
  Post,
  UseGuards,
} from '@nestjs/common';

import { GetPlacesOptions, PlacesService } from './places.service';
import { CurationService } from './curation.service';
import { JwtGuard } from '../auth/jwt.guard';
import { CreatePlaceDto } from './dto/create-place.dto';

@Controller('places')
export class PlacesController {
  private readonly defaultLimit = 24;
  private readonly maxLimit = 100;

  constructor(
    private readonly placesService: PlacesService,
    private readonly curationService: CurationService,
  ) {}

  // Admin / authenticated
  @UseGuards(JwtGuard)
  @Post()
  createPlace(
    @Body() data: CreatePlaceDto,
  ) {
    return this.placesService.createPlace(data);
  }

  // Public
  @Get('curation/preview')
  getCurationPreview(
    @Query('city') city?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number.parseInt(limit ?? '100', 10);

    return this.curationService.preview(
      city ?? '',
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100,
    );
  }

  // Public
  @Get('filters')
  getPlaceFilters(@Query('city') city?: string) {
    return this.placesService.getPlaceFilters(city);
  }

  // Public
  @Get()
  getPlaces(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('city') city?: string,
    @Query('category') category?: string,
    @Query('subtype') subtype?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    const parsedPage = Number.parseInt(page ?? '1', 10);
    const parsedLimit = Number.parseInt(
      limit ?? String(this.defaultLimit),
      10,
    );

    const safePage = Number.isFinite(parsedPage) && parsedPage > 0
      ? parsedPage
      : 1;

    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, this.maxLimit)
      : this.defaultLimit;

    const options: GetPlacesOptions = {
      page: safePage,
      limit: safeLimit,
      city,
      category,
      subtype,
      search,
      sort,
    };

    return this.placesService.getPlaces(options);
  }

  // Public
  @Get(':id')
  getPlaceById(
    @Param('id') id: string,
  ) {
    return this.placesService.getPlaceById(id);
  }
}
