import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { AdvanceStatus, Module } from '../../generated/prisma/client.js';
import { PayrollService } from './payroll.service.js';
import { CreateAdvanceDto, CreatePayrollRunDto, DecideAdvanceDto, UpdatePayrollItemDto } from './dto/payroll.dto.js';

// No dedicated ADVANCES module in the permission enum — advances are
// integrated into payroll (brief §38), so both share the PAYROLL gate.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(Module.PAYROLL)
@Controller('payroll')
export class PayrollController {
  constructor(private payroll: PayrollService) {}

  @Get('advances')
  listAdvances(@Query('employeeId') employeeId?: string, @Query('status') status?: AdvanceStatus) {
    return this.payroll.listAdvances({ employeeId, status });
  }

  @Post('advances')
  createAdvance(@Body() body: CreateAdvanceDto, @Req() req: any) {
    return this.payroll.createAdvance(req.user.sub, body);
  }

  @Patch('advances/:id')
  decideAdvance(@Param('id') id: string, @Body() body: DecideAdvanceDto, @Req() req: any) {
    return this.payroll.decideAdvance(id, req.user.sub, body);
  }

  @Get('runs')
  listRuns() {
    return this.payroll.listRuns();
  }

  @Get('runs/:id')
  getRun(@Param('id') id: string) {
    return this.payroll.getRun(id);
  }

  @Post('runs')
  createRun(@Body() body: CreatePayrollRunDto, @Req() req: any) {
    return this.payroll.createRun(req.user.sub, body);
  }

  @Patch('runs/:runId/items/:itemId')
  updateItem(@Param('runId') runId: string, @Param('itemId') itemId: string, @Body() body: UpdatePayrollItemDto, @Req() req: any) {
    return this.payroll.updateItem(runId, itemId, req.user.sub, body);
  }

  @Post('runs/:id/finalize')
  finalizeRun(@Param('id') id: string, @Req() req: any) {
    return this.payroll.finalizeRun(id, req.user.sub);
  }

  @Post('runs/:runId/items/:itemId/pay')
  payItem(@Param('runId') runId: string, @Param('itemId') itemId: string, @Req() req: any) {
    return this.payroll.payItem(runId, itemId, req.user.sub);
  }
}