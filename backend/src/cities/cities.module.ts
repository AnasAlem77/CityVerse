import { Module } from '@nestjs/common';

import { CitiesController } from './cities.controller';
import { CitiesService } from './cities.service';
import { PlaceImageService } from '../images/place-image.service';

@Module({
  controllers: [CitiesController],
  providers: [
    CitiesService,
    PlaceImageService,
  ],
})
export class CitiesModule {}