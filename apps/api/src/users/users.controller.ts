import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { Role } from '../../generated/prisma/client.js';
import { CreateStaffDto, ResetPinDto, UpdateStaffDto } from './dto/users.dto.js';

// Entire module is admin-only — staff never see this, on the frontend or
// otherwise, since RolesGuard rejects them before UsersService runs.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  findAll() {
    return this.users.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateStaffDto, @Req() req: any) {
    return this.users.createStaff(dto, req.user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto, @Req() req: any) {
    return this.users.update(id, dto, req.user.sub);
  }

  @Post(':id/reset-pin')
  resetPin(@Param('id') id: string, @Body() dto: ResetPinDto, @Req() req: any) {
    return this.users.resetPin(id, dto.newPin, req.user.sub);
  }
}
