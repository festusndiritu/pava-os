import { Module } from '@nestjs/common';

import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  providers: [ProductsService],
  controllers: [ProductsController],
})
export class ProductsModule {}