import { Module } from '@nestjs/common';
import { SavedPlacesService } from './saved-places.service';
import { SavedPlacesController } from './saved-places.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
  ],
  providers: [
    SavedPlacesService,
  ],
  controllers: [
    SavedPlacesController,
  ],
})
export class SavedPlacesModule {}
