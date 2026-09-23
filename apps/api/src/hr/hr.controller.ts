import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { EmploymentStatus, Module, Role } from '../../generated/prisma/client.js';
import { HrService } from './hr.service.js';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto.js';

// Salary is sensitive (brief §36) — every route here is HR-gated, unlike
// Customers/Contacts which stay readable to any logged-in user.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(Module.HR)
@Controller('employees')
export class HrController {
  constructor(private hr: HrService) {}

  @Get()
  findAll(@Query('search') search?: string, @Query('status') status?: EmploymentStatus) {
    return this.hr.findAll({ search, status });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hr.findOne(id);
  }

  @Post()
  create(@Body() body: CreateEmployeeDto, @Req() req: any) {
    return this.hr.create(req.user.sub, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateEmployeeDto, @Req() req: any) {
    return this.hr.update(id, req.user.sub, body);
  }

  // Permanent deletion is admin-only, same as every other hard-delete
  // route in the system. The service enforces the employee is already
  // Terminated and has no advance/payroll history.
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id/permanent')
  hardDelete(@Param('id') id: string, @Req() req: any) {
    return this.hr.hardDelete(id, req.user.sub);
  }
}
