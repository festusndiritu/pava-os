import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { ExpenseStatus, Module } from '../../generated/prisma/client.js';
import { ExpensesService } from './expenses.service.js';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(Module.EXPENSES)
@Controller('expenses')
export class ExpensesController {
  constructor(private expenses: ExpensesService) {}

  @Get('categories')
  categories() {
    return this.expenses.categories();
  }

  @Get()
  findAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: ExpenseStatus,
  ) {
    return this.expenses.findAll({ from, to, categoryId, status });
  }

  @Post()
  create(@Body() body: CreateExpenseDto, @Req() req: any) {
    return this.expenses.create(req.user.sub, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateExpenseDto, @Req() req: any) {
    return this.expenses.update(id, req.user.sub, body);
  }
}