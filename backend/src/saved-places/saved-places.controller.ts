import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';

import { SavedPlacesService } from './saved-places.service';
import { JwtGuard } from '../auth/jwt.guard';


@Controller('saved-places')
export class SavedPlacesController {


  constructor(
    private readonly savedPlacesService: SavedPlacesService,
  ) {}



  @UseGuards(JwtGuard)
  @Post(':placeId')
  savePlace(
    @Param('placeId') placeId: string,
    @Req() req: any,
  ) {

    return this.savedPlacesService.savePlace(
      req.user.id,
      placeId,
    );

  }



  @UseGuards(JwtGuard)
  @Delete(':placeId')
  removeSavedPlace(
    @Param('placeId') placeId: string,
    @Req() req: any,
  ) {

    return this.savedPlacesService.removeSavedPlace(
      req.user.id,
      placeId,
    );

  }



  @UseGuards(JwtGuard)
  @Get()
  getSavedPlaces(
    @Req() req: any,
  ) {

    return this.savedPlacesService.getSavedPlaces(
      req.user.id,
    );

  }

}
