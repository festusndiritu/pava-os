import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private customers: CustomersService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.customers.findAll(search);
  }

  @Post()
  create(@Body() body: { name: string; phone?: string; isCredit?: boolean }) {
    return this.customers.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.customers.update(id, body);
  }
}
