import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';


@Injectable()
export class ReviewsService {

  constructor(
    private readonly prisma: PrismaService,
  ) {}


  async createReview(
    userId: string,
    data: CreateReviewDto,
  ) {

    return this.prisma.review.create({

      data: {

        rating: data.rating,

        comment: data.comment,

        userId,

        placeId: data.placeId,

      },

    });

  }



  async getPlaceReviews(placeId: string) {

    return this.prisma.review.findMany({

      where: {

        placeId,

      },

      include: {

        user: {

          select: {

            id: true,

            name: true,

          },

        },

      },

      orderBy: {

        createdAt: 'desc',

      },

    });

  }

}
