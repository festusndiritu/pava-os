import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { CategoriesService } from './categories.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private categories: CategoriesService) {}

  @Get()
  findAll() {
    return this.categories.findAll();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() body: { name: string }) {
    return this.categories.create(body.name);
  }
}
