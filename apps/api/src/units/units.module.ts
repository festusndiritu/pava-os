import { Module } from '@nestjs/common';

import { UnitsService } from './units.service.js';
import { UnitsController } from './units.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  providers: [UnitsService],
  controllers: [UnitsController],
})
export class UnitsModule {}