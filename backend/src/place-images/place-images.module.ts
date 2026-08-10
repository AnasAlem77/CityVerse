import { Module } from '@nestjs/common';
import { PlaceImagesController } from './place-images.controller';
import { PlaceImagesService } from './place-images.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
  ],
  controllers: [
    PlaceImagesController,
  ],
  providers: [
    PlaceImagesService,
  ],
  exports: [
    PlaceImagesService,
  ],
})
export class PlaceImagesModule {}
