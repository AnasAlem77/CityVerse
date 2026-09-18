import { Module } from '@nestjs/common';

import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { CurationService } from './curation.service';
import { PlaceImageService } from '../images/place-image.service';

@Module({
  controllers: [PlacesController],
  providers: [
    PlacesService,
    CurationService,
    PlaceImageService,
  ],
})
export class PlacesModule {}