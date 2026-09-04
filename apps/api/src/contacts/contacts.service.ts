import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  findAll(createdById?: string) {
    return this.prisma.contact.findMany({
      where: createdById ? { createdById } : undefined,
      orderBy: [{ followUpAt: 'asc' }, { createdAt: 'desc' }],
      include: { createdBy: { select: { name: true } } },
    });
  }

  create(createdById: string, data: { name: string; phone?: string; source?: string; notes?: string; followUpAt?: string }) {
    return this.prisma.contact.create({
      data: {
        ...data,
        followUpAt: data.followUpAt ? new Date(data.followUpAt) : undefined,
        createdById,
      },
    });
  }

  update(id: string, data: Partial<{ name: string; phone: string; source: string; notes: string; followUpAt: string }>) {
    const { followUpAt, ...rest } = data;
    return this.prisma.contact.update({
      where: { id },
      data: { ...rest, ...(followUpAt ? { followUpAt: new Date(followUpAt) } : {}) },
    });
  }
}
