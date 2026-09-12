import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ContactsService } from './contacts.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { Module } from '../../generated/prisma/client.js';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private contacts: ContactsService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.contacts.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contacts.findOne(id);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.CONTACTS)
  @Post()
  create(@Req() req: any, @Body() body: CreateContactDto) {
    return this.contacts.create(req.user.sub, body);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.CONTACTS)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateContactDto) {
    return this.contacts.update(id, body);
  }
}