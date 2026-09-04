import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ContactsService } from './contacts.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private contacts: ContactsService) {}

  @Get()
  findAll(@Query('mine') mine: string, @Req() req: any) {
    return this.contacts.findAll(mine === 'true' ? req.user.sub : undefined);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.contacts.create(req.user.sub, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.contacts.update(id, body);
  }
}
