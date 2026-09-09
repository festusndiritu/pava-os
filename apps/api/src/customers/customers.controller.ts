import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { Module } from '../../generated/prisma/client.js';
import { AdjustBalanceDto, CreateCustomerDto, RecordPaymentDto, UpdateCustomerDto } from './dto/customer.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private customers: CustomersService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.customers.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Get(':id/ledger')
  ledger(@Param('id') id: string) {
    return this.customers.ledger(id);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.CUSTOMERS)
  @Post()
  create(@Body() body: CreateCustomerDto) {
    return this.customers.create(body);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.CUSTOMERS)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateCustomerDto) {
    return this.customers.update(id, body);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.CUSTOMERS)
  @Post(':id/payments')
  recordPayment(@Param('id') id: string, @Body() body: RecordPaymentDto, @Req() req: any) {
    return this.customers.recordPayment(id, body.amount, body.note, req.user.sub);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.CUSTOMERS)
  @Post(':id/adjustments')
  adjustBalance(@Param('id') id: string, @Body() body: AdjustBalanceDto, @Req() req: any) {
    return this.customers.adjustBalance(id, body.amount, body.type, body.note, req.user.sub);
  }
}