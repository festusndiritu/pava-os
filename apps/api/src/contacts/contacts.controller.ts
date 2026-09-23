import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ContactsService } from './contacts.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { Module, Role } from '../../generated/prisma/client.js';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private contacts: ContactsService) {}

  // Was ungated — any authenticated user could read the full contacts
  // directory regardless of module access. Only the Contacts page reads
  // these, so this matches create/update below exactly.
  @UseGuards(PermissionsGuard)
  @Permissions(Module.CONTACTS)
  @Get()
  findAll(@Query('search') search?: string, @Query('status') status?: 'active' | 'archived' | 'all') {
    return this.contacts.findAll(search, status);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.CONTACTS)
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

  @UseGuards(PermissionsGuard)
  @Permissions(Module.CONTACTS)
  @Delete(':id')
  archive(@Param('id') id: string, @Req() req: any) {
    return this.contacts.archive(id, req.user.sub);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.CONTACTS)
  @Post(':id/restore')
  restore(@Param('id') id: string, @Req() req: any) {
    return this.contacts.restore(id, req.user.sub);
  }

  // Permanent deletion is admin-only, same as every other hard-delete
  // route in the system — archiving (above) is what everyone else uses.
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id/permanent')
  hardDelete(@Param('id') id: string, @Req() req: any) {
    return this.contacts.hardDelete(id, req.user.sub);
  }
}
