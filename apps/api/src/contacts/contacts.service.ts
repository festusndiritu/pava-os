import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

interface ContactInput {
  name: string;
  company?: string;
  role?: string;
  phone?: string;
  altPhone?: string;
  notes?: string;
  tags?: string[];
  followUpAt?: string;
}

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  findAll(search?: string) {
    return this.prisma.contact.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { company: { contains: search, mode: 'insensitive' } },
              { role: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  create(createdById: string, data: ContactInput) {
    const { followUpAt, ...rest } = data;
    return this.prisma.contact.create({
      data: { ...rest, followUpAt: followUpAt ? new Date(followUpAt) : undefined, createdById },
    });
  }

  update(id: string, data: Partial<ContactInput>) {
    const { followUpAt, ...rest } = data;
    return this.prisma.contact.update({
      where: { id },
      data: { ...rest, ...(followUpAt ? { followUpAt: new Date(followUpAt) } : {}) },
    });
  }
}