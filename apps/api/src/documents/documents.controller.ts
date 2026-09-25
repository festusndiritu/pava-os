import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DocumentStatus, DocumentType } from '../../generated/prisma/client.js';
import { DocumentsService } from './documents.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { Module } from '../../generated/prisma/client.js';
import { CreatePosSaleDto, SuspendOrderDto } from './dto/pos-sale.dto.js';
import { CreateDocumentDto, ConvertToInvoiceDto, MarkPaidDto, CreateDeliveryNoteDto } from './dto/document.dto.js';
import { CreateReturnDto } from './dto/return.dto.js';
import { ReturnsService } from './returns.service.js';
import { parsePaging } from '../common/paging.js';

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private documents: DocumentsService,
    private returns: ReturnsService,
  ) {}

  // Listing/detail were previously ungated — any authenticated user, even
  // one with none of these modules, could read every quote/invoice/receipt/
  // delivery note in the business. Gated to the same OR-set already used on
  // create/convert/cancel below, since that's what actually consumes it
  // (Quotes, Invoices and POS pages/returns all read through here).
  // REPORTS is in the set because the Reports page is a read-only register
  // of exactly this data — granting it without one of the selling modules
  // would otherwise show an empty page behind a nav link the person can see.
  @UseGuards(PermissionsGuard)
  @Permissions(Module.QUOTES, Module.INVOICES, Module.POS, Module.REPORTS)
  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('type') type?: DocumentType,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // `status=INVOICED,PAID` — a list screen that shows several statuses
    // together can page through them in one ordered sequence.
    const valid = new Set<string>(Object.values(DocumentStatus));
    const statuses = status ? status.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const bad = statuses.find((s) => !valid.has(s));
    if (bad) throw new BadRequestException(`Unknown status "${bad}"`);
    return this.documents.findAll({ statuses: statuses as DocumentStatus[], type, from, to, search, ...parsePaging(limit, offset) });
  }

  // Same reasoning as findAll above — a sales aggregate shouldn't be
  // readable by someone with none of the selling modules.
  @UseGuards(PermissionsGuard)
  @Permissions(Module.QUOTES, Module.INVOICES, Module.POS, Module.REPORTS)
  @Get('reports/sales-summary')
  salesSummary(@Query('days') days?: string) {
    return this.documents.salesSummary(days ? parseInt(days) : 30);
  }

  // Registered before :id so "suspended" isn't swallowed as a document id.
  @UseGuards(PermissionsGuard)
  @Permissions(Module.POS)
  @Get('suspended')
  listSuspended() {
    return this.documents.listSuspended();
  }

  // POS raises returns; Reports only reads the log of them.
  @UseGuards(PermissionsGuard)
  @Permissions(Module.POS, Module.REPORTS)
  @Get('returns/recent')
  listReturns(@Query('limit') limit?: string) {
    return this.returns.list(limit ? parseInt(limit) : 50);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.QUOTES, Module.INVOICES, Module.POS)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documents.findOne(id);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.POS)
  @Get(':id/returnable')
  returnable(@Param('id') id: string) {
    return this.returns.returnable(id);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.POS)
  @Post(':id/returns')
  createReturn(@Param('id') id: string, @Req() req: any, @Body() body: CreateReturnDto) {
    return this.returns.create(id, req.user.sub, body);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.POS)
  @Post('suspend')
  suspend(@Req() req: any, @Body() body: SuspendOrderDto) {
    return this.documents.suspendOrder(req.user.sub, body);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.POS)
  @Post('suspended/:id/discard')
  discardSuspended(@Param('id') id: string, @Req() req: any) {
    return this.documents.discardSuspended(id, req.user.sub);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.QUOTES, Module.INVOICES)
  @Post()
  create(@Req() req: any, @Body() body: CreateDocumentDto) {
    return this.documents.create(req.user.sub, req.user.role, body);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.POS)
  @Post('pos-sale')
  posSale(@Req() req: any, @Body() body: CreatePosSaleDto) {
    return this.documents.posSale(req.user.sub, req.user.role, body);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.QUOTES, Module.INVOICES)
  @Post(':id/convert-to-invoice')
  convertToInvoice(@Param('id') id: string, @Req() req: any, @Body() body: ConvertToInvoiceDto) {
    return this.documents.convertToInvoice(id, req.user.sub, body?.allowNegativeStock);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.INVOICES)
  @Post(':id/mark-paid')
  markPaid(@Param('id') id: string, @Req() req: any, @Body() body: MarkPaidDto) {
    return this.documents.markPaid(id, req.user.sub, body?.paymentMethod);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.QUOTES, Module.INVOICES)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.documents.cancel(id, req.user.sub);
  }

  @UseGuards(PermissionsGuard)
  // POS is included: a cash sale at the till often needs a delivery note,
  // and the till operator may not hold QUOTES/INVOICES access.
  @Permissions(Module.QUOTES, Module.INVOICES, Module.POS)
  @Post(':id/delivery-note')
  createDeliveryNote(@Param('id') id: string, @Req() req: any, @Body() body: CreateDeliveryNoteDto) {
    return this.documents.createDeliveryNote(id, req.user.sub, body?.deliveryLocation, body?.deliveryPhone);
  }
}