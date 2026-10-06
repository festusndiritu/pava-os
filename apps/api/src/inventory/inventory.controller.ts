import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { Module } from '../../generated/prisma/client.js';
import { parsePaging, sendTotal } from '../common/paging.js';
import { InventoryService } from './inventory.service.js';
import { AdjustInventoryDto, OpeningBalanceDto, ReceiveInventoryDto } from './dto/inventory.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private inventory: InventoryService) {}

  @UseGuards(PermissionsGuard)
  @Permissions(Module.INVENTORY)
  @Post('receipts')
  receive(@Body() body: ReceiveInventoryDto, @Req() req: any) {
    return this.inventory.receive(body, req.user.sub);
  }

  // Was ungated — the receipts log is only read from the Inventory page
  // itself, so it matches receive/adjust/opening-balance above.
  @UseGuards(PermissionsGuard)
  @Permissions(Module.INVENTORY)
  @Get('receipts')
  async receipts(
    @Req() req: any,
    @Res({ passthrough: true }) res: { setHeader(name: string, value: string | number): unknown },
    @Query('search') search?: string,
    @Query('kind') kind?: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { rows, total } = await this.inventory.receiptsPage(req.user.role === 'ADMIN' || !!req.user.canViewCost, {
      search,
      kind: kind === 'delivery' || kind === 'other' ? kind : undefined,
      sort,
      ...parsePaging(limit, offset),
    });
    sendTotal(res, total);
    return rows;
  }

  // Declared before receipts/:id so "summary" is never read as an id.
  @UseGuards(PermissionsGuard)
  @Permissions(Module.INVENTORY)
  @Get('summary')
  summary(@Req() req: any) {
    return this.inventory.summary(req.user.role === 'ADMIN' || !!req.user.canViewCost);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.INVENTORY)
  @Get('receipts/:id')
  receiptDetail(@Param('id') id: string, @Req() req: any) {
    return this.inventory.receiptDetail(id, req.user.role === 'ADMIN' || !!req.user.canViewCost);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.INVENTORY)
  @Post('adjustments')
  adjust(@Body() body: AdjustInventoryDto, @Req() req: any) {
    // What stock cost is a cost-permission matter: someone who can adjust
    // counts but not see costs can't set one either.
    const canViewCost = req.user.role === 'ADMIN' || !!req.user.canViewCost;
    return this.inventory.adjust(canViewCost ? body : { ...body, unitCost: undefined }, req.user.sub);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.INVENTORY)
  @Post('opening-balance')
  openingBalance(@Body() body: OpeningBalanceDto, @Req() req: any) {
    return this.inventory.openingBalance(body.productId, body.quantity, body.unitCost, req.user.sub);
  }

  // Was ungated — this is per-product batch/movement history (cost data
  // when canViewCost applies), only ever read from ProductDetailDrawer,
  // which opens from both the Products and Inventory pages, so either
  // module is accepted here.
  @UseGuards(PermissionsGuard)
  @Permissions(Module.PRODUCTS, Module.INVENTORY)
  @Get('batches')
  batches(@Query('productId') productId: string, @Req() req: any) {
    return this.inventory.batchesForProduct(productId, req.user.role === 'ADMIN' || !!req.user.canViewCost);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.PRODUCTS, Module.INVENTORY)
  @Get('movements')
  movements(@Query('productId') productId: string, @Req() req: any) {
    return this.inventory.movementsForProduct(productId, req.user.role === 'ADMIN' || !!req.user.canViewCost);
  }
}