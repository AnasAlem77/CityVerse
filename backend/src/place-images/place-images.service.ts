import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlaceImagesService {

  constructor(
    private readonly prisma: PrismaService,
  ) {}


  async addImage(
    placeId: string,
    url: string,
  ) {

    return this.prisma.placeImage.create({
      data: {
        url,
        placeId,
      },
    });

  }


  async getImages(
    placeId: string,
  ) {

    return this.prisma.placeImage.findMany({
      where: {
        placeId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

  }

}
