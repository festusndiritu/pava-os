import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards, Delete } from '@nestjs/common';
import { Role, Module } from '../../generated/prisma/client.js';
import { ProductsService } from './products.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { CreateProductDto, UpdateProductDto, CreateProductFamilyDto, UpdateProductFamilyDto } from './dto/product.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('brandId') brandId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('familyId') familyId?: string,
    @Query('status') status?: 'active' | 'archived' | 'all',
  ) {
    const canViewCost = req.user.role === Role.ADMIN || !!req.user.canViewCost;
    return this.products.findAll({ search, brandId, categoryId, familyId, canViewCost, status });
  }

  @Get('families')
  families() {
    return this.products.families();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('families')
  createFamily(@Body() body: CreateProductFamilyDto) {
    return this.products.createFamily(body);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('families/:id')
  updateFamily(@Param('id') id: string, @Body() body: UpdateProductFamilyDto) {
    return this.products.updateFamily(id, body);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const canViewCost = req.user.role === Role.ADMIN || !!req.user.canViewCost;
    return this.products.findOne(id, canViewCost);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() body: CreateProductDto, @Req() req: any) {
    return this.products.create(body, req.user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Req() req: any, @Body() body: UpdateProductDto) {
    return this.products.update(id, req.user.sub, body);
  }

  // Was ungated — only read from ProductDetailDrawer (Products or
  // Inventory pages), same reasoning as inventory batches/movements above.
  // findAll/findOne/families stay open deliberately: POS, quote/invoice
  // building, the marketing pricelist, and inventory all need to browse
  // the catalog regardless of which single module they hold, and cost is
  // already a separate, correctly-gated dimension (canViewCost) — so an
  // OR-list here would end up covering nearly every module anyway.
  @UseGuards(PermissionsGuard)
  @Permissions(Module.PRODUCTS, Module.INVENTORY)
  @Get(':id/price-history')
  priceHistory(@Param('id') id: string) {
    return this.products.priceHistory(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.products.remove(id, req.user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/restore')
  restore(@Param('id') id: string, @Req() req: any) {
    return this.products.restore(id, req.user.sub);
  }

  // Permanent deletion is admin-only, same as archive/restore above —
  // the service enforces that it's already archived and has no history.
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id/permanent')
  hardDelete(@Param('id') id: string, @Req() req: any) {
    return this.products.hardDelete(id, req.user.sub);
  }
}