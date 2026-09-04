import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { UnitsService } from './units.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@UseGuards(JwtAuthGuard)
@Controller('units')
export class UnitsController {
  constructor(private units: UnitsService) {}

  @Get()
  findAll() {
    return this.units.findAll();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() body: { name: string; symbol: string }) {
    return this.units.create(body);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/sub-units')
  addSubUnit(@Param('id') id: string, @Body() body: { name: string; factor: number }) {
    return this.units.addSubUnit(id, body);
  }
}
