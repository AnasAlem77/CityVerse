import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CitiesService } from './cities.service';
import { JwtGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

import { CreateCityDto } from './dto/create-city.dto';

@Controller('cities')
export class CitiesController {
  constructor(
    private readonly citiesService: CitiesService,
  ) {}

  // Public
  @Get()
  getCities() {
    return this.citiesService.getCities();
  }


  // Public - Featured cities for Hero slider
  @Get('featured')
  getFeaturedCities() {
    return this.citiesService.getFeaturedCities();
  }


  // Public
  @Get(':id')
  getCityById(
    @Param('id') id: string,
  ) {
    return this.citiesService.getCityById(id);
  }


  // Admin only
  @UseGuards(JwtGuard, AdminGuard)
  @Post()
  createCity(
    @Body() data: CreateCityDto,
  ) {
    return this.citiesService.createCity(data);
  }


  // Admin only
  @UseGuards(JwtGuard, AdminGuard)
  @Patch(':id')
  updateCity(
    @Param('id') id: string,
    @Body() data: CreateCityDto,
  ) {
    return this.citiesService.updateCity(id, data);
  }


  // Admin only
  @UseGuards(JwtGuard, AdminGuard)
  @Delete(':id')
  deleteCity(
    @Param('id') id: string,
  ) {
    return this.citiesService.deleteCity(id);
  }
}
