import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCityDto } from './dto/create-city.dto';

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
        latitude: data.latitude,
        longitude: data.longitude,
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

  async getCities() {
    return this.prisma.city.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }
}
