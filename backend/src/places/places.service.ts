import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlaceDto } from './dto/create-place.dto';

@Injectable()
export class PlacesService {

  constructor(
    private readonly prisma: PrismaService,
  ) {}


  async createPlace(data: CreatePlaceDto) {

    return this.prisma.place.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,

        latitude: data.latitude,
        longitude: data.longitude,

        cityId: data.cityId,
      },

      include: {
        city: true,
        images: true,
      },
    });

  }


  async getPlaces() {

    return this.prisma.place.findMany({
      orderBy: {
        name: 'asc',
      },

      include: {
        city: true,
        images: true,
      },
    });

  }


  async getPlaceById(id: string) {

    return this.prisma.place.findUnique({
      where: {
        id,
      },

      include: {
        city: true,
        images: true,
      },
    });

  }

}
