import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { LeadsService } from './leads.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { Module, Role } from '../../generated/prisma/client.js';
import { CreateLeadDto, UpdateLeadDto } from './dto/lead.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(private leads: LeadsService) {}

  // Was ungated — matches contacts/customers findings: read access should
  // require the same module as create/update below.
  @UseGuards(PermissionsGuard)
  @Permissions(Module.LEADS)
  @Get()
  findAll(
    @Query('stage') stage?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('status') status?: 'active' | 'archived' | 'all',
  ) {
    return this.leads.findAll({ stage, assignedToId, status });
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.LEADS)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leads.findOne(id);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.LEADS)
  @Post()
  create(@Req() req: any, @Body() body: CreateLeadDto) {
    return this.leads.create(req.user.sub, body);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.LEADS)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateLeadDto) {
    return this.leads.update(id, body);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.LEADS)
  @Post(':id/convert-to-customer')
  convertToCustomer(@Param('id') id: string, @Req() req: any) {
    return this.leads.convertToCustomer(id, req.user.sub);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.LEADS)
  @Delete(':id')
  archive(@Param('id') id: string, @Req() req: any) {
    return this.leads.archive(id, req.user.sub);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.LEADS)
  @Post(':id/restore')
  restore(@Param('id') id: string, @Req() req: any) {
    return this.leads.restore(id, req.user.sub);
  }

  // Permanent deletion is admin-only, same as every other hard-delete
  // route in the system — archiving (above) is what everyone else uses.
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id/permanent')
  hardDelete(@Param('id') id: string, @Req() req: any) {
    return this.leads.hardDelete(id, req.user.sub);
  }
}
