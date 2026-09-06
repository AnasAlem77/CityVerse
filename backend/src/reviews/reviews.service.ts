import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}
  async createReview(userId: string, data: CreateReviewDto) {
    const place = await this.prisma.place.findUnique({
      where: { id: data.placeId },
      select: { id: true },
    });
    if (!place) throw new NotFoundException('Place not found');
    return this.prisma.review.upsert({
      where: { userId_placeId: { userId, placeId: data.placeId } },
      update: { rating: data.rating, comment: data.comment.trim() },
      create: {
        rating: data.rating,
        comment: data.comment.trim(),
        userId,
        placeId: data.placeId,
      },
    });
  }
  async updateReview(
    userId: string,
    id: string,
    data: Pick<CreateReviewDto, 'rating' | 'comment'>,
  ) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId)
      throw new ForbiddenException('You can only edit your own review');
    return this.prisma.review.update({
      where: { id },
      data: { rating: data.rating, comment: data.comment.trim() },
    });
  }
  async deleteReview(userId: string, id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId)
      throw new ForbiddenException('You can only delete your own review');
    await this.prisma.review.delete({ where: { id } });
    return { deleted: true };
  }
  async getPlaceReviews(placeId: string) {
    return this.prisma.review.findMany({
      where: { placeId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
