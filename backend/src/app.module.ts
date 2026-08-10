import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CitiesModule } from './cities/cities.module';
import { AuthModule } from './auth/auth.module';
import { PlacesModule } from './places/places.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    CitiesModule,
    AuthModule,
    PlacesModule,
  ],
})
export class AppModule {}
