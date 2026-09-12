import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { LeadsService } from './leads.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { Module } from '../../generated/prisma/client.js';
import { CreateLeadDto, UpdateLeadDto } from './dto/lead.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(private leads: LeadsService) {}

  @Get()
  findAll(@Query('stage') stage?: string, @Query('assignedToId') assignedToId?: string) {
    return this.leads.findAll({ stage, assignedToId });
  }

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
}