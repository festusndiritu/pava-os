import { api } from './api';
import type { AdvanceStatus } from './hr-api';

export type PayrollStatus = 'DRAFT' | 'FINALIZED' | 'PAID';
export type PayrollItemStatus = 'PENDING' | 'PAID';

export interface Advance {
  id: string;
  employeeId: string;
  amount: number;
  date: string;
  reason: string | null;
  status: AdvanceStatus;
  notes: string | null;
  createdAt: string;
  employee: { displayName: string };
  createdBy: { name: string };
  approvedBy: { name: string } | null;
}

export interface PayrollItem {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employee: { id: string; displayName: string; jobTitle: string | null };
  baseSalary: number;
  advancesDeducted: number;
  otherDeductions: number;
  adjustments: number;
  grossPay: number;
  netPay: number;
  paymentStatus: PayrollItemStatus;
  paymentDate: string | null;
  notes: string | null;
}

export interface PayrollRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: PayrollStatus;
  notes: string | null;
  finalizedAt: string | null;
  createdAt: string;
  createdBy: { name: string };
  items: PayrollItem[];
}

export const payrollApi = {
  listAdvances: (params?: { employeeId?: string; status?: AdvanceStatus }) => {
    const q = new URLSearchParams();
    if (params?.employeeId) q.set('employeeId', params.employeeId);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return api.get<Advance[]>(`/payroll/advances${qs ? `?${qs}` : ''}`);
  },
  createAdvance: (data: { employeeId: string; amount: number; reason?: string; notes?: string }) =>
    api.post<Advance>('/payroll/advances', data),
  decideAdvance: (id: string, status: 'APPROVED' | 'REJECTED') => api.patch<Advance>(`/payroll/advances/${id}`, { status }),

  listRuns: () => api.get<PayrollRun[]>('/payroll/runs'),
  getRun: (id: string) => api.get<PayrollRun>(`/payroll/runs/${id}`),
  createRun: (data: { periodStart: string; periodEnd: string; employeeIds: string[]; notes?: string }) =>
    api.post<PayrollRun>('/payroll/runs', data),
  updateItem: (runId: string, itemId: string, data: { otherDeductions?: number; adjustments?: number; notes?: string }) =>
    api.patch<PayrollItem>(`/payroll/runs/${runId}/items/${itemId}`, data),
  finalizeRun: (id: string) => api.post<PayrollRun>(`/payroll/runs/${id}/finalize`),
  payItem: (runId: string, itemId: string) => api.post<PayrollRun>(`/payroll/runs/${runId}/items/${itemId}/pay`),
};