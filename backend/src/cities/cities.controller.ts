import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CitiesService } from './cities.service';
import { JwtGuard } from '../auth/jwt.guard';
import { CreateCityDto } from './dto/create-city.dto';

@Controller('cities')
export class CitiesController {

  constructor(
    private readonly citiesService: CitiesService,
  ) {}

  @UseGuards(JwtGuard)
  @Post()
  createCity(
    @Body() data: CreateCityDto,
  ) {
    return this.citiesService.createCity(data);
  }

  @UseGuards(JwtGuard)
  @Get(':id')
  getCityById(
    @Param('id') id: string,
  ) {
    return this.citiesService.getCityById(id);
  }

  @UseGuards(JwtGuard)
  @Get()
  getCities() {
    return this.citiesService.getCities();
  }
}
