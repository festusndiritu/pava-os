import { Module } from '@nestjs/common';

import { CategoriesService } from './categories.service.js';
import { CategoriesController } from './categories.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  providers: [CategoriesService],
  controllers: [CategoriesController],
})
export class CategoriesModule {}