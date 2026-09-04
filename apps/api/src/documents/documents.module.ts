import { Module } from '@nestjs/common';

import { DocumentsService } from './documents.service.js';
import { DocumentsController } from './documents.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  providers: [DocumentsService],
  controllers: [DocumentsController],
})
export class DocumentsModule {}
