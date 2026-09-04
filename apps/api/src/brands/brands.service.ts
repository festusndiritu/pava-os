import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}
  findAll() {
    return this.prisma.brand.findMany({ orderBy: { name: 'asc' } });
  }
  create(name: string) {
    return this.prisma.brand.create({ data: { name } });
  }
}
