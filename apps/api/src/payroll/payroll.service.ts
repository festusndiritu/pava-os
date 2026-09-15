import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AdvanceStatus, PayrollItemStatus, PayrollStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateAdvanceDto, CreatePayrollRunDto, DecideAdvanceDto, UpdatePayrollItemDto } from './dto/payroll.dto.js';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- Advances

  listAdvances(params: { employeeId?: string; status?: AdvanceStatus }) {
    return this.prisma.employeeAdvance.findMany({
      where: { employeeId: params.employeeId, status: params.status },
      include: { employee: { select: { displayName: true } }, createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAdvance(createdById: string, dto: CreateAdvanceDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
    const advance = await this.prisma.employeeAdvance.create({
      data: {
        employeeId: dto.employeeId,
        amount: dto.amount,
        date: dto.date ? new Date(dto.date) : undefined,
        reason: dto.reason,
        notes: dto.notes,
        createdById,
      },
    });
    await this.audit.log({ actorId: createdById, action: 'payroll.advance_requested', entityType: 'EmployeeAdvance', entityId: advance.id, metadata: { employeeId: dto.employeeId, amount: dto.amount } });
    return advance;
  }

  async decideAdvance(id: string, actorId: string, dto: DecideAdvanceDto) {
    const advance = await this.prisma.employeeAdvance.findUnique({ where: { id } });
    if (!advance) throw new NotFoundException('Advance not found');
    if (advance.status !== AdvanceStatus.PENDING) {
      throw new BadRequestException('Only a pending advance can be approved or rejected');
    }
    const updated = await this.prisma.employeeAdvance.update({
      where: { id },
      data: { status: dto.status as AdvanceStatus, approvedById: actorId },
    });
    await this.audit.log({ actorId, action: `payroll.advance_${dto.status.toLowerCase()}`, entityType: 'EmployeeAdvance', entityId: id, metadata: { amount: advance.amount } });
    return updated;
  }

  // ------------------------------------------------------------------- Runs

  listRuns() {
    return this.prisma.payrollRun.findMany({
      include: { items: true, createdBy: { select: { name: true } } },
      orderBy: { periodStart: 'desc' },
    });
  }

  async getRun(id: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
        items: {
          include: { employee: true, settledAdvances: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  // Draft only selects employees and snapshots their current base salary —
  // advances are swept in and totals locked at finalize() (brief §37/§38),
  // so approving an advance after a draft is created still gets caught.
  async createRun(createdById: string, dto: CreatePayrollRunDto) {
    const employees = await this.prisma.employee.findMany({ where: { id: { in: dto.employeeIds } } });
    if (employees.length !== dto.employeeIds.length) throw new BadRequestException('One or more employees not found');

    const run = await this.prisma.payrollRun.create({
      data: {
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        notes: dto.notes,
        createdById,
        items: {
          create: employees.map((e) => ({
            employeeId: e.id,
            baseSalary: e.baseSalary,
            grossPay: e.baseSalary,
            netPay: e.baseSalary,
          })),
        },
      },
      include: { items: { include: { employee: true } } },
    });
    await this.audit.log({ actorId: createdById, action: 'payroll.run_created', entityType: 'PayrollRun', entityId: run.id, metadata: { employeeCount: employees.length } });
    return run;
  }

  async updateItem(runId: string, itemId: string, actorId: string, dto: UpdatePayrollItemDto) {
    const run = await this.getRun(runId);
    if (run.status !== PayrollStatus.DRAFT) throw new BadRequestException('Only a draft run can be edited');
    const item = run.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Payroll item not found');

    const otherDeductions = dto.otherDeductions ?? item.otherDeductions;
    const adjustments = dto.adjustments ?? item.adjustments;
    const grossPay = item.baseSalary + adjustments;
    const netPay = grossPay - item.advancesDeducted - otherDeductions;

    return this.prisma.payrollItem.update({
      where: { id: itemId },
      data: { otherDeductions, adjustments, grossPay, netPay, notes: dto.notes },
    });
  }

  // Locks the run: sweeps every APPROVED, unsettled advance for each
  // employee into that employee's item, marks those advances SETTLED, and
  // recomputes gross/net one final time. Nothing here is reversible —
  // correcting a finalized run means a new run/adjustment, never editing
  // this one (brief §76 applied to payroll).
  async finalizeRun(runId: string, actorId: string) {
    const run = await this.getRun(runId);
    if (run.status !== PayrollStatus.DRAFT) throw new BadRequestException('Only a draft run can be finalized');

    await this.prisma.$transaction(async (tx) => {
      for (const item of run.items) {
        const unsettled = await tx.employeeAdvance.findMany({
          where: { employeeId: item.employeeId, status: AdvanceStatus.APPROVED, payrollItemId: null },
        });
        const advancesDeducted = unsettled.reduce((s, a) => s + a.amount, 0);
        const grossPay = item.baseSalary + item.adjustments;
        const netPay = grossPay - advancesDeducted - item.otherDeductions;

        await tx.payrollItem.update({
          where: { id: item.id },
          data: { advancesDeducted, grossPay, netPay },
        });

        if (unsettled.length > 0) {
          await tx.employeeAdvance.updateMany({
            where: { id: { in: unsettled.map((a) => a.id) } },
            data: { status: AdvanceStatus.SETTLED, payrollItemId: item.id },
          });
        }
      }

      await tx.payrollRun.update({ where: { id: runId }, data: { status: PayrollStatus.FINALIZED, finalizedAt: new Date() } });
    });

    await this.audit.log({ actorId, action: 'payroll.run_finalized', entityType: 'PayrollRun', entityId: runId });
    return this.getRun(runId);
  }

  async payItem(runId: string, itemId: string, actorId: string) {
    const run = await this.getRun(runId);
    if (run.status === PayrollStatus.DRAFT) throw new BadRequestException('Finalize the run before recording payment');
    const item = run.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Payroll item not found');
    if (item.paymentStatus === PayrollItemStatus.PAID) throw new BadRequestException('This item is already paid');

    await this.prisma.payrollItem.update({ where: { id: itemId }, data: { paymentStatus: PayrollItemStatus.PAID, paymentDate: new Date() } });

    const refreshed = await this.getRun(runId);
    const allPaid = refreshed.items.every((i) => i.paymentStatus === PayrollItemStatus.PAID);
    if (allPaid) {
      await this.prisma.payrollRun.update({ where: { id: runId }, data: { status: PayrollStatus.PAID } });
    }

    await this.audit.log({ actorId, action: 'payroll.item_paid', entityType: 'PayrollItem', entityId: itemId, metadata: { employeeId: item.employeeId, netPay: item.netPay } });
    return this.getRun(runId);
  }
}