import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SavedPlacesService {

  constructor(
    private readonly prisma: PrismaService,
  ) {}


  async savePlace(
    userId: string,
    placeId: string,
  ) {

    return this.prisma.savedPlace.create({
      data: {
        userId,
        placeId,
      },
      include: {
        place: true,
      },
    });

  }


  async removeSavedPlace(
    userId: string,
    placeId: string,
  ) {

    return this.prisma.savedPlace.delete({
      where: {
        userId_placeId: {
          userId,
          placeId,
        },
      },
    });

  }


  async getSavedPlaces(
    userId: string,
  ) {

    return this.prisma.savedPlace.findMany({
      where: {
        userId,
      },

      include: {
        place: {
          include: {
            city: true,
            images: true,
          },
        },
      },
    });

  }

}
