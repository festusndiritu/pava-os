import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ReorderService } from './reorder.service.js';
import { ReorderAlertService } from './reorder-alert.service.js';

@Module({
    imports: [AuthModule, SettingsModule, NotificationsModule],
    controllers: [InventoryController],
    providers: [InventoryService, ReorderService, ReorderAlertService],
    exports: [InventoryService, ReorderService],
})
export class InventoryModule {}