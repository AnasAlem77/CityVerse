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
import { RatingsModule } from './ratings/ratings.module';
import { MapModule } from './map/map.module';
import { RoutingModule } from './routing/routing.module';
import { WeatherModule } from './weather/weather.module';
import { PublicDataModule } from './public-data/public-data.module';

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
    RatingsModule,
    MapModule,
    RoutingModule,
    WeatherModule,
    PublicDataModule,
  ],
})
export class AppModule {}
