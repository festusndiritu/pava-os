import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  imports: [AuthModule, SettingsModule, InventoryModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}