import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { DocumentStatus, DocumentType, EditRequestStatus, Role } from '../../generated/prisma/client.js';
import { DocumentsService } from './documents.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { Module } from '../../generated/prisma/client.js';
import { CreatePosSaleDto, SuspendOrderDto } from './dto/pos-sale.dto.js';
import { CreateDocumentDto, UpdateDocumentDto, ConvertToInvoiceDto, MarkPaidDto, CreateDeliveryNoteDto } from './dto/document.dto.js';
import { CreateReturnDto } from './dto/return.dto.js';
import { ReturnsService } from './returns.service.js';
import { DocumentEditsService } from './document-edits.service.js';
import { CreateEditRequestDto, DecideEditRequestDto } from './dto/edit-request.dto.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { parsePaging, sendTotal } from '../common/paging.js';

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private documents: DocumentsService,
    private returns: ReturnsService,
    private edits: DocumentEditsService,
  ) {}

  // Listing/detail were previously ungated — any authenticated user, even one with none of these
  // modules, could read every quote/invoice/receipt/ delivery note in the business.
  @UseGuards(PermissionsGuard)
  @Permissions(Module.QUOTES, Module.INVOICES, Module.POS, Module.REPORTS)
  @Get()
  async findAll(
    @Res({ passthrough: true }) res: { setHeader(name: string, value: string | number): unknown },
    @Query('status') status?: string,
    @Query('type') type?: DocumentType,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const valid = new Set<string>(Object.values(DocumentStatus));
    const statuses = status ? status.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const bad = statuses.find((s) => !valid.has(s));
    if (bad) throw new BadRequestException(`Unknown status "${bad}"`);
    const { rows, total } = await this.documents.findPage({ statuses: statuses as DocumentStatus[], type, from, to, search, sort, ...parsePaging(limit, offset) });
    sendTotal(res, total);
    return rows;
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.QUOTES, Module.INVOICES, Module.POS, Module.REPORTS)
  @Get('reports/sales-summary')
  salesSummary(@Query('days') days?: string) {
    return this.documents.salesSummary(days ? parseInt(days) : 30);
  }

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

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('edit-requests')
  listEditRequests(@Query('status') status?: string) {
    const valid = new Set<string>(Object.values(EditRequestStatus));
    if (status && !valid.has(status)) throw new BadRequestException(`Unknown status "${status}"`);
    return this.edits.list({ status: status as EditRequestStatus | undefined });
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('edit-requests/:requestId/approve')
  approveEdit(@Param('requestId') requestId: string, @Req() req: any, @Body() body: DecideEditRequestDto) {
    return this.edits.approve(requestId, req.user.sub, req.user.role, body ?? {});
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('edit-requests/:requestId/reject')
  rejectEdit(@Param('requestId') requestId: string, @Req() req: any, @Body() body: DecideEditRequestDto) {
    return this.edits.reject(requestId, req.user.sub, body ?? {});
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.QUOTES, Module.INVOICES, Module.POS)
  @Get(':id/edit-requests')
  documentEditRequests(@Param('id') id: string) {
    return this.edits.list({ documentId: id });
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.QUOTES, Module.INVOICES, Module.POS)
  @Post(':id/edit-requests')
  requestEdit(@Param('id') id: string, @Req() req: any, @Body() body: CreateEditRequestDto) {
    return this.edits.request(id, req.user.sub, req.user.role, body);
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

  // Edits a quote in place (same id, same quote number).
  @UseGuards(PermissionsGuard)
  @Permissions(Module.QUOTES, Module.INVOICES)
  @Patch(':id')
  update(@Param('id') id: string, @Req() req: any, @Body() body: UpdateDocumentDto) {
    return this.documents.update(id, req.user.sub, req.user.role, body);
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
    return this.documents.convertToInvoice(id, req.user.sub, body?.allowNegativeStock, body?.fulfilment);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.INVOICES)
  @Post(':id/mark-paid')
  markPaid(@Param('id') id: string, @Req() req: any, @Body() body: MarkPaidDto) {
    return this.documents.markPaid(id, req.user.sub, body ?? {});
  }

  // Only a cancelled quote that never became an invoice can be removed.
  @UseGuards(PermissionsGuard)
  @Permissions(Module.QUOTES)
  @Delete(':id')
  deleteCancelledQuote(@Param('id') id: string, @Req() req: any) {
    return this.documents.deleteCancelledQuote(id, req.user.sub);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Module.QUOTES, Module.INVOICES)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.documents.cancel(id, req.user.sub);
  }

  @UseGuards(PermissionsGuard)
  // POS is included: a cash sale at the till often needs a delivery note, and the till operator may
  // not hold QUOTES/INVOICES access.
  @Permissions(Module.QUOTES, Module.INVOICES, Module.POS)
  @Post(':id/delivery-note')
  createDeliveryNote(@Param('id') id: string, @Req() req: any, @Body() body: CreateDeliveryNoteDto) {
    return this.documents.createDeliveryNote(id, req.user.sub, body?.deliveryLocation, body?.deliveryPhone);
  }
}