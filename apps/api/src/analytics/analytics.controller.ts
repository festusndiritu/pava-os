import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { Module as ModuleEnum } from '../../generated/prisma/client.js';
import { AnalyticsService, type Range } from './analytics.service.js';

// Shared by Reports too — a bare date "to" means "through the end of that
// day", not midnight at its start, or the day itself would show nothing.
export function parseRange(from?: string, to?: string): Range {
  if (!from || !to) throw new BadRequestException('from and to are required (YYYY-MM-DD)');
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BadRequestException('Invalid date');
  end.setHours(23, 59, 59, 999);
  if (end < start) throw new BadRequestException('to must be on or after from');
  return { from: start, to: new Date(end.getTime() + 1) };
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(ModuleEnum.ANALYTICS)
@Controller('analytics')
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('overview')
  overview(@Query('from') from?: string, @Query('to') to?: string, @Query('compare') compare?: string) {
    return this.analytics.overview(parseRange(from, to), compare !== 'false');
  }

  @Get('sales-by-category')
  salesByCategory(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.salesByCategory(parseRange(from, to));
  }

  @Get('payment-mix')
  paymentMix(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.paymentMix(parseRange(from, to));
  }

  @Get('top-products')
  topProducts(@Query('from') from?: string, @Query('to') to?: string, @Query('limit') limit?: string) {
    return this.analytics.topProducts(parseRange(from, to), limit ? parseInt(limit, 10) : 10);
  }

  @Get('top-customers')
  topCustomers(@Query('from') from?: string, @Query('to') to?: string, @Query('limit') limit?: string) {
    return this.analytics.topCustomers(parseRange(from, to), limit ? parseInt(limit, 10) : 10);
  }

  @Get('staff-performance')
  staffPerformance(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.staffPerformance(parseRange(from, to));
  }

  @Get('inventory-snapshot')
  inventorySnapshot() {
    return this.analytics.inventorySnapshot();
  }
}