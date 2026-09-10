import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DocumentStatus } from '../../generated/prisma/client.js';
import { DocumentsService } from './documents.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { Module } from '../../generated/prisma/client.js';
import { CreatePosSaleDto } from './dto/pos-sale.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private documents: DocumentsService) {}

  @Get()
  findAll(
    @Query('status') status?: DocumentStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.documents.findAll({ status, from, to });
  }

  @Get('reports/sales-summary')
  salesSummary(@Query('days') days?: string) {
    return this.documents.salesSummary(days ? parseInt(days) : 30);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documents.findOne(id);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.documents.create(req.user.sub, body);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.POS)
  @Post('pos-sale')
  posSale(@Req() req: any, @Body() body: CreatePosSaleDto) {
    return this.documents.posSale(req.user.sub, req.user.role, body);
  }

  @Post(':id/convert-to-invoice')
  convertToInvoice(@Param('id') id: string, @Req() req: any) {
    return this.documents.convertToInvoice(id, req.user.sub);
  }

  @Post(':id/mark-paid')
  markPaid(@Param('id') id: string, @Req() req: any) {
    return this.documents.markPaid(id, req.user.sub);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.documents.cancel(id);
  }
}
