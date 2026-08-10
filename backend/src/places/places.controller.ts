import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { PlacesService } from './places.service';
import { JwtGuard } from '../auth/jwt.guard';
import { CreatePlaceDto } from './dto/create-place.dto';


@Controller('places')
export class PlacesController {


  constructor(
    private readonly placesService: PlacesService,
  ) {}



  @UseGuards(JwtGuard)
  @Post()
  createPlace(
    @Body() data: CreatePlaceDto,
  ) {

    return this.placesService.createPlace(data);

  }



  @UseGuards(JwtGuard)
  @Get()
  getPlaces() {

    return this.placesService.getPlaces();

  }



  @UseGuards(JwtGuard)
  @Get(':id')
  getPlaceById(
    @Param('id') id: string,
  ) {

    return this.placesService.getPlaceById(id);

  }

}
