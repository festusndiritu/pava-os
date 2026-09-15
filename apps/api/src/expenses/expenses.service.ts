import { Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseStatus, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto.js';

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  categories() {
    return this.prisma.expenseCategory.findMany({ orderBy: { name: 'asc' } });
  }

  findAll(params: { from?: string; to?: string; categoryId?: string; status?: ExpenseStatus }) {
    const { from, to, categoryId, status } = params;
    const where: Prisma.ExpenseWhereInput = {
      categoryId,
      status,
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };
    return this.prisma.expense.findMany({
      where,
      include: { category: true, createdBy: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });
  }

  private async resolveCategoryId(dto: CreateExpenseDto | UpdateExpenseDto) {
    if (dto.categoryId) return dto.categoryId;
    const name = (dto as CreateExpenseDto).categoryName?.trim();
    if (!name) return undefined;
    const category = await this.prisma.expenseCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    return category.id;
  }

  async create(createdById: string, dto: CreateExpenseDto) {
    const categoryId = await this.resolveCategoryId(dto);
    const expense = await this.prisma.expense.create({
      data: {
        categoryId,
        amount: dto.amount,
        date: dto.date ? new Date(dto.date) : undefined,
        description: dto.description,
        vendor: dto.vendor,
        paymentMethod: dto.paymentMethod,
        reference: dto.reference,
        status: dto.status,
        notes: dto.notes,
        createdById,
      },
      include: { category: true },
    });
    await this.audit.log({ actorId: createdById, action: 'expenses.created', entityType: 'Expense', entityId: expense.id, metadata: { amount: expense.amount, category: expense.category?.name } });
    return expense;
  }

  async update(id: string, actorId: string, dto: UpdateExpenseDto) {
    const existing = await this.prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Expense not found');
    const categoryId = dto.categoryId ?? existing.categoryId ?? undefined;
    const expense = await this.prisma.expense.update({
      where: { id },
      data: {
        categoryId,
        amount: dto.amount,
        date: dto.date ? new Date(dto.date) : undefined,
        description: dto.description,
        vendor: dto.vendor,
        paymentMethod: dto.paymentMethod,
        reference: dto.reference,
        status: dto.status,
        notes: dto.notes,
      },
      include: { category: true },
    });
    await this.audit.log({ actorId, action: 'expenses.updated', entityType: 'Expense', entityId: id, metadata: { amount: expense.amount, status: expense.status } });
    return expense;
  }
}