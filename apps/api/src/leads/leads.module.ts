import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller.js';
import { LeadsService } from './leads.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
    imports: [AuthModule, AuditModule],
    controllers: [LeadsController],
    providers: [LeadsService],
})
export class LeadsModule {}