import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { UnitsService } from './units.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CreateSubUnitDto, CreateUnitDto, UpdateSubUnitDto, UpdateUnitDto } from './dto/unit.dto.js';

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
  create(@Body() dto: CreateUnitDto, @Req() req: any) {
    return this.units.create(dto, req.user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto, @Req() req: any) {
    return this.units.update(id, dto, req.user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.units.remove(id, req.user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/sub-units')
  addSubUnit(@Param('id') id: string, @Body() dto: CreateSubUnitDto, @Req() req: any) {
    return this.units.addSubUnit(id, dto, req.user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/sub-units/:subId')
  updateSubUnit(@Param('id') id: string, @Param('subId') subId: string, @Body() dto: UpdateSubUnitDto, @Req() req: any) {
    return this.units.updateSubUnit(id, subId, dto, req.user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id/sub-units/:subId')
  removeSubUnit(@Param('id') id: string, @Param('subId') subId: string, @Req() req: any) {
    return this.units.removeSubUnit(id, subId, req.user.sub);
  }
}
