import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { Module, Role } from '../../generated/prisma/client.js';
import { AdjustBalanceDto, CreateCustomerDto, RecordPaymentDto, UpdateCustomerDto } from './dto/customer.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private customers: CustomersService) {}

  // Was ungated — any authenticated user could list/search the full
  // customer directory. Kept broad (not just CUSTOMERS) because POS and the
  // quote/invoice form both need to look a customer up mid-sale.
  @UseGuards(PermissionsGuard)
  @Permissions(Module.CUSTOMERS, Module.POS, Module.QUOTES, Module.INVOICES)
  @Get()
  findAll(@Query('search') search?: string, @Query('status') status?: 'active' | 'archived' | 'all') {
    return this.customers.findAll({ search, status });
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.CUSTOMERS, Module.POS, Module.QUOTES, Module.INVOICES)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  // Narrower than findOne above — the credit ledger is only ever opened
  // from the Customers page itself, not from POS/quotes mid-sale.
  @UseGuards(PermissionsGuard)
  @Permissions(Module.CUSTOMERS)
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

  @UseGuards(PermissionsGuard)
  @Permissions(Module.CUSTOMERS)
  @Delete(':id')
  archive(@Param('id') id: string, @Req() req: any) {
    return this.customers.archive(id, req.user.sub);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.CUSTOMERS)
  @Post(':id/restore')
  restore(@Param('id') id: string, @Req() req: any) {
    return this.customers.restore(id, req.user.sub);
  }

  // Permanent deletion is admin-only, same as every other hard-delete
  // route in the system — archiving (above) is what everyone else uses.
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id/permanent')
  hardDelete(@Param('id') id: string, @Req() req: any) {
    return this.customers.hardDelete(id, req.user.sub);
  }
}