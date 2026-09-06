import { Body, Controller, Get, Post } from '@nestjs/common';
import { RouteRequestDto } from './dto/route-request.dto';
import { RoutingService } from './routing.service';
@Controller('routing')
export class RoutingController {
  constructor(private readonly routing: RoutingService) {}
  @Get('capabilities') capabilities() { return this.routing.capabilities(); }
  @Post('route') route(@Body() request: RouteRequestDto) { return this.routing.route(request); }
}
