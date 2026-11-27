import { Module } from '@nestjs/common';

import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  imports: [AuthModule, SettingsModule, InventoryModule],
  providers: [ProductsService],
  controllers: [ProductsController],
})
export class ProductsModule {}