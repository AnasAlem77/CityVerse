import { Module } from '@nestjs/common';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { CurationService } from './curation.service';

@Module({
  controllers: [PlacesController],
  providers: [PlacesService, CurationService]
})
export class PlacesModule {}
