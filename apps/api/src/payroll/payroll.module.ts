import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller.js';
import { PayrollService } from './payroll.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}