import { Module } from '@nestjs/common';
import { PublicDataController } from './public-data.controller';
import { PublicDataService } from './public-data.service';
import { NwsProvider } from './nws.provider';
@Module({ controllers: [PublicDataController], providers: [PublicDataService, NwsProvider], exports: [PublicDataService] })
export class PublicDataModule {}
