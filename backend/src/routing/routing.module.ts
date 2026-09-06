import { Module } from '@nestjs/common';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { OsrmProvider } from './osrm.provider';
@Module({ controllers: [RoutingController], providers: [RoutingService, OsrmProvider] })
export class RoutingModule {}
