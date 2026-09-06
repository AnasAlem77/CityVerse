import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtGuard, AdminGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get('overview') overview() { return this.dashboard.overview(); }
  @Get('cities/:cityId') city(@Param('cityId') cityId: string) { return this.dashboard.city(cityId); }
}
