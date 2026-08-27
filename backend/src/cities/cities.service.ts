import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';


@Injectable()
export class CitiesService {

  constructor(
    private readonly prisma: PrismaService,
  ) {}


  async createCity(data: CreateCityDto) {
    return this.prisma.city.create({
      data: {
        name: data.name,
        country: data.country,

        description: data.description,
        image: data.image,

        featured: data.featured ?? false,
        featuredOrder: data.featuredOrder,

        latitude: data.latitude,
        longitude: data.longitude,
      },
    });
  }


  async getCities() {
    return this.prisma.city.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }


  // Cities displayed in Hero slider
  async getFeaturedCities() {
    return this.prisma.city.findMany({
      where: {
        featured: true,
      },

      orderBy: {
        featuredOrder: 'asc',
      },
    });
  }


  async getCityById(id: string) {
    return this.prisma.city.findUnique({
      where: {
        id,
      },
    });
  }


  async updateCity(
    id: string,
    data: UpdateCityDto,
  ) {
    return this.prisma.city.update({
      where: {
        id,
      },

      data,
    });
  }


  async deleteCity(id: string) {
    return this.prisma.city.delete({
      where: {
        id,
      },
    });
  }

}
