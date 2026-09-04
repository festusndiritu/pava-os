import { Module } from '@nestjs/common';

import { ContactsService } from './contacts.service.js';
import { ContactsController } from './contacts.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  providers: [ContactsService],
  controllers: [ContactsController],
})
export class ContactsModule {}
