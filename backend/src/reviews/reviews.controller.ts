import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { ReviewsService } from './reviews.service';

import { JwtGuard } from '../auth/jwt.guard';

import { CreateReviewDto } from './dto/create-review.dto';



@Controller('reviews')
export class ReviewsController {


  constructor(
    private readonly reviewsService: ReviewsService,
  ) {}



  @UseGuards(JwtGuard)
  @Post()
  createReview(
    @Req() req,
    @Body() data: CreateReviewDto,
  ) {

    return this.reviewsService.createReview(
      req.user.id,
      data,
    );

  }



  @Get(':placeId')
  getReviews(
    @Param('placeId') placeId: string,
  ) {

    return this.reviewsService.getPlaceReviews(placeId);

  }

}
