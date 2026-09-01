import { Module } from '@nestjs/common';

import { OsmController } from './osm.controller';
import { OsmService } from './osm.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
  ],

  controllers: [
    OsmController,
  ],

  providers: [
    OsmService,
  ],
})
export class OsmModule {}
