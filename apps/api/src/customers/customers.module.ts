import { Module } from '@nestjs/common';

import { CustomersService } from './customers.service.js';
import { CustomersController } from './customers.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  providers: [CustomersService],
  controllers: [CustomersController],
})
export class CustomersModule {}