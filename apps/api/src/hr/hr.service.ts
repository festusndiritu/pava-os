import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto.js';

@Injectable()
export class HrService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll(params: { search?: string; status?: EmploymentStatus }) {
    const { search, status } = params;
    const where: Prisma.EmployeeWhereInput = {
      ...(status ? { employmentStatus: status } : {}),
      ...(search
        ? {
            OR: [
              { displayName: { contains: search, mode: 'insensitive' } },
              { jobTitle: { contains: search, mode: 'insensitive' } },
              { department: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.employee.findMany({
      where,
      orderBy: [{ employmentStatus: 'asc' }, { displayName: 'asc' }],
    });
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        advances: { orderBy: { createdAt: 'desc' }, include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async create(createdById: string, dto: CreateEmployeeDto) {
    const employee = await this.prisma.employee.create({
      data: {
        displayName: dto.displayName,
        avatar: dto.avatar,
        phone: dto.phone,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        jobTitle: dto.jobTitle,
        department: dto.department,
        employmentStartDate: dto.employmentStartDate ? new Date(dto.employmentStartDate) : undefined,
        employmentStatus: dto.employmentStatus as EmploymentStatus | undefined,
        baseSalary: dto.baseSalary,
        notes: dto.notes,
        createdById,
      },
    });
    await this.audit.log({ actorId: createdById, action: 'hr.employee_created', entityType: 'Employee', entityId: employee.id, metadata: { displayName: employee.displayName } });
    return employee;
  }

  async update(id: string, actorId: string, dto: UpdateEmployeeDto) {
    const existing = await this.findOne(id);
    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        displayName: dto.displayName,
        avatar: dto.avatar,
        phone: dto.phone,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        jobTitle: dto.jobTitle,
        department: dto.department,
        employmentStartDate: dto.employmentStartDate ? new Date(dto.employmentStartDate) : undefined,
        employmentStatus: dto.employmentStatus as EmploymentStatus | undefined,
        baseSalary: dto.baseSalary,
        notes: dto.notes,
      },
    });
    await this.audit.log({
      actorId,
      action: 'hr.employee_updated',
      entityType: 'Employee',
      entityId: employee.id,
      metadata: { before: { baseSalary: existing.baseSalary, employmentStatus: existing.employmentStatus }, after: { baseSalary: employee.baseSalary, employmentStatus: employee.employmentStatus } },
    });
    return employee;
  }

  // Employee doesn't get a separate active flag like Customer/Product/Lead
  // /Contact — TERMINATED already is the "this person is gone" state
  // (set via the ordinary update above), so it doubles as the archived
  // state a hard delete requires. Permanent only once nothing real would
  // be lost: any advance ever given, or any payroll item ever run for
  // them. Both are pay history; an employee with neither was added and
  // terminated before a single payroll touched them.
  async hardDelete(id: string, actorId: string) {
    const employee = await this.findOne(id);
    if (employee.employmentStatus !== 'TERMINATED') {
      throw new BadRequestException('Set this employee to Terminated before deleting them permanently');
    }
    const [advanceCount, payrollItemCount] = await Promise.all([
      this.prisma.employeeAdvance.count({ where: { employeeId: id } }),
      this.prisma.payrollItem.count({ where: { employeeId: id } }),
    ]);
    if (advanceCount > 0 || payrollItemCount > 0) {
      throw new BadRequestException('This employee has advance or payroll history and cannot be permanently deleted');
    }
    await this.prisma.employee.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'hr.employee_deleted_permanently',
      entityType: 'Employee',
      entityId: id,
      metadata: { displayName: employee.displayName },
    });
    return { deleted: true };
  }
}