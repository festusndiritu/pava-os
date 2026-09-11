import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Global()
@Module({
  imports: [AuthModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
