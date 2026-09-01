import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './prisma/prisma.module';
import { CitiesModule } from './cities/cities.module';
import { AuthModule } from './auth/auth.module';
import { PlacesModule } from './places/places.module';
import { PlaceImagesModule } from './place-images/place-images.module';
import { SavedPlacesModule } from './saved-places/saved-places.module';
import { ReviewsModule } from './reviews/reviews.module';
import { OsmModule } from './osm/osm.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,
    AuthModule,
    CitiesModule,
    PlacesModule,
    OsmModule,
    PlaceImagesModule,
    SavedPlacesModule,
    ReviewsModule,
  ],
})
export class AppModule {}
