import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

interface LeadInput {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  location?: string;
  source?: string;
  stage?: string;
  expectedValue?: number;
  notes?: string;
  followUpAt?: string;
  assignedToId?: string;
}

@Injectable()
export class LeadsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll(params: { stage?: string; assignedToId?: string } = {}) {
    return this.prisma.lead.findMany({
      where: {
        ...(params.stage ? { stage: params.stage as any } : {}),
        ...(params.assignedToId ? { assignedToId: params.assignedToId } : {}),
      },
      orderBy: [{ followUpAt: 'asc' }, { createdAt: 'desc' }],
      include: { createdBy: { select: { name: true } }, assignedTo: { select: { id: true, name: true } } },
    });
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: { createdBy: { select: { name: true } }, assignedTo: { select: { id: true, name: true } }, convertedCustomer: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  create(createdById: string, data: LeadInput) {
    const { followUpAt, ...rest } = data;
    return this.prisma.lead.create({
      data: { ...rest, followUpAt: followUpAt ? new Date(followUpAt) : undefined, createdById } as any,
    });
  }

  update(id: string, data: Partial<LeadInput>) {
    const { followUpAt, ...rest } = data;
    return this.prisma.lead.update({
      where: { id },
      data: { ...rest, ...(followUpAt ? { followUpAt: new Date(followUpAt) } : {}) } as any,
    });
  }

  // Closes the loop brief §31 describes: Lead -> Quote -> Customer -> Sale.
  // Creates a real Customer from the lead's contact details, links it back,
  // and marks the lead WON. Does not touch quotes/documents — associating a
  // specific quote with the new customer is a manual follow-up step for now.
  async convertToCustomer(id: string, actorId: string) {
    const lead = await this.findOne(id);
    if (lead.convertedCustomerId) {
      throw new BadRequestException('This lead has already been converted');
    }

    const customer = await this.prisma.customer.create({
      data: { name: lead.company || lead.name, businessName: lead.company ? lead.name : undefined, phone: lead.phone, location: lead.location },
    });

    const updated = await this.prisma.lead.update({
      where: { id },
      data: { stage: 'WON', convertedCustomerId: customer.id },
    });

    await this.audit.log({ actorId, action: 'lead.converted', entityType: 'Lead', entityId: id, metadata: { customerId: customer.id } });

    return { lead: updated, customer };
  }
}