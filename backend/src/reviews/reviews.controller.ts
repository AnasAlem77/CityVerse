import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}
  @UseGuards(JwtGuard)
  @Post()
  createReview(@Req() req, @Body() data: CreateReviewDto) {
    return this.reviewsService.createReview(req.user.id, data);
  }
  @Get(':placeId')
  getReviews(@Param('placeId') placeId: string) {
    return this.reviewsService.getPlaceReviews(placeId);
  }
  @UseGuards(JwtGuard)
  @Patch(':id')
  updateReview(
    @Req() req,
    @Param('id') id: string,
    @Body() data: CreateReviewDto,
  ) {
    return this.reviewsService.updateReview(req.user.id, id, data);
  }
  @UseGuards(JwtGuard)
  @Delete(':id')
  deleteReview(@Req() req, @Param('id') id: string) {
    return this.reviewsService.deleteReview(req.user.id, id);
  }
}
