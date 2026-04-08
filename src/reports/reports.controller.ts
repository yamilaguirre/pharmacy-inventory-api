import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.PHARMACIST, Role.INVENTORY_MANAGER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** GET /api/reports/low-stock */
  @Get('low-stock')
  lowStock() {
    return this.reportsService.lowStock();
  }

  /** GET /api/reports/expiring-soon?days=30 */
  @Get('expiring-soon')
  expiringSoon(@Query('days') days?: string) {
    return this.reportsService.expiringSoon(days ? Number(days) : 30);
  }
}
