import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { RatePlaceDto } from './dto/rate-place.dto';
import { RatingsService } from './ratings.service';

@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}
  @UseGuards(JwtGuard)
  @Post()
  rate(@Req() req: { user: { id: string } }, @Body() data: RatePlaceDto) {
    return this.ratings.rate(req.user.id, data);
  }
  @Get(':placeId')
  summary(@Param('placeId') placeId: string) {
    return this.ratings.summary(placeId);
  }
}
