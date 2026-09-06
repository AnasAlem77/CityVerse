import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [PrismaModule],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
