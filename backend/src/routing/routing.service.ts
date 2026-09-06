import { Injectable } from '@nestjs/common';
import { RouteRequestDto } from './dto/route-request.dto';
import { OsrmProvider } from './osrm.provider';

@Injectable()
export class RoutingService {
  constructor(private readonly provider: OsrmProvider) {}
  route(request: RouteRequestDto) { return this.provider.route(request); }
  capabilities() { return { provider: 'OSRM', modes: this.provider.supportedModes() }; }
}
