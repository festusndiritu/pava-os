import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  findAll(search?: string) {
    return this.prisma.customer.findMany({
      where: search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] }
        : undefined,
      orderBy: { name: 'asc' },
    });
  }

  create(data: { name: string; phone?: string; isCredit?: boolean }) {
    return this.prisma.customer.create({ data });
  }

  update(id: string, data: Partial<{ name: string; phone: string; isCredit: boolean; creditBalance: number }>) {
    return this.prisma.customer.update({ where: { id }, data });
  }
}
