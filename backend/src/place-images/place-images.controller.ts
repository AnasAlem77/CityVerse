import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtGuard } from '../auth/jwt.guard';
import { PlaceImagesService } from './place-images.service';


@Controller('places')
export class PlaceImagesController {


  constructor(
    private readonly placeImagesService: PlaceImagesService,
  ) {}


  @UseGuards(JwtGuard)
  @Post(':placeId/images')
  addImage(
    @Param('placeId') placeId: string,
    @Body() body: any,
  ) {

    return this.placeImagesService.addImage(
      placeId,
      body.url,
    );

  }



  @UseGuards(JwtGuard)
  @Get(':placeId/images')
  getImages(
    @Param('placeId') placeId: string,
  ) {

    return this.placeImagesService.getImages(
      placeId,
    );

  }

}
