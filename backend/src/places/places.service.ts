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
    });

  }


  async getPlaces() {

    const places = await this.prisma.place.findMany({
      orderBy: {
        name: 'asc',
      },

      include: {
        city: true,

        images: true,

        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });


    return places.map((place) => {

      const reviewsCount = place.reviews.length;


      const averageRating =
        reviewsCount === 0
          ? 0
          :
          place.reviews.reduce(
            (sum, review) => sum + review.rating,
            0,
          ) / reviewsCount;


      return {
        ...place,

        reviewsCount,

        averageRating:
          Number(averageRating.toFixed(1)),
      };

    });

  }



  async getPlaceById(id: string) {

    const place = await this.prisma.place.findUnique({

      where: {
        id,
      },


      include: {

        city: true,

        images: true,

        reviews: {

          include: {

            user: {

              select: {

                name: true,

              },

            },

          },

        },

      },

    });



    if (!place) {
      return null;
    }



    const reviewsCount = place.reviews.length;



    const averageRating =
      reviewsCount === 0
        ? 0
        :
        place.reviews.reduce(
          (sum, review) => sum + review.rating,
          0,
        ) / reviewsCount;



    return {

      ...place,

      reviewsCount,

      averageRating:
        Number(averageRating.toFixed(1)),

    };

  }

}
