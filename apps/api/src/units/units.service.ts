import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}
  findAll() {
    return this.prisma.unit.findMany({
      include: { subUnits: true },
      orderBy: { name: 'asc' },
    });
  }
  create(data: { name: string; symbol: string }) {
    return this.prisma.unit.create({ data });
  }
  addSubUnit(unitId: string, data: { name: string; factor: number }) {
    return this.prisma.subUnit.create({ data: { unitId, ...data } });
  }
}
