import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { BrandsService } from './brands.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

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
  create(@Body() body: { name: string }) {
    return this.brands.create(body.name);
  }
}
