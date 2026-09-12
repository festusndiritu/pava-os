import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ContactsController } from './contacts.controller.js';
import { ContactsService } from './contacts.service.js';

@Module({
    imports: [AuthModule, AuditModule],
    controllers: [ContactsController],
    providers: [ContactsService],
})
export class ContactsModule {}