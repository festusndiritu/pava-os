import { api } from './api';

export type LeadStage = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'QUOTE_REQUIRED' | 'QUOTE_SENT' | 'NEGOTIATING' | 'WON' | 'LOST';

export interface Lead {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  source: string | null;
  stage: LeadStage;
  expectedValue: number | null;
  notes: string | null;
  followUpAt: string | null;
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  convertedCustomerId: string | null;
  createdBy: { name: string };
  createdAt: string;
  updatedAt: string;
}

export interface LeadInput {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  location?: string;
  source?: string;
  stage?: LeadStage;
  expectedValue?: number;
  notes?: string;
  followUpAt?: string;
  assignedToId?: string;
}

export const leadsApi = {
  list: () => api.get<Lead[]>('/leads'),
  get: (id: string) => api.get<Lead>(`/leads/${id}`),
  create: (data: LeadInput) => api.post<Lead>('/leads', data),
  update: (id: string, data: Partial<LeadInput>) => api.patch<Lead>(`/leads/${id}`, data),
  convertToCustomer: (id: string) => api.post<{ lead: Lead; customer: { id: string; name: string } }>(`/leads/${id}/convert-to-customer`),
};