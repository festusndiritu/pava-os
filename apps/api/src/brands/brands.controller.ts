import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { BrandsService } from './brands.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('brands')
export class BrandsController {
  constructor(private brands: BrandsService) {}

  @Get()
  findAll() {
    return this.brands.findAll();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateBrandDto, @Req() req: any) {
    return this.brands.create(dto.name, req.user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  rename(@Param('id') id: string, @Body() dto: UpdateBrandDto, @Req() req: any) {
    return this.brands.rename(id, dto.name, req.user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.brands.remove(id, req.user.sub);
  }
}
