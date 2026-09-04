import { Module } from '@nestjs/common';

import { BrandsService } from './brands.service.js';
import { BrandsController } from './brands.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  providers: [BrandsService],
  controllers: [BrandsController],
})
export class BrandsModule {}