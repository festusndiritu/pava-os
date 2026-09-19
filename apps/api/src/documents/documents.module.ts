import { Module } from '@nestjs/common';

import { DocumentsService } from './documents.service.js';
import { ReturnsService } from './returns.service.js';
import { DocumentsController } from './documents.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { SettingsModule } from '../settings/settings.module.js';

@Module({
  imports: [AuthModule, InventoryModule, SettingsModule],
  providers: [DocumentsService, ReturnsService],
  controllers: [DocumentsController],
})
export class DocumentsModule {}
