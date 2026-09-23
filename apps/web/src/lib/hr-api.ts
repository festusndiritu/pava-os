import { api } from './api';

export type EmploymentStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
export type AdvanceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SETTLED';

export interface EmployeeAdvance {
  id: string;
  amount: number;
  date: string;
  reason: string | null;
  status: AdvanceStatus;
  notes: string | null;
  createdAt: string;
  createdBy: { name: string };
  approvedBy: { name: string } | null;
}

export interface Employee {
  id: string;
  displayName: string;
  avatar: string | null;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  jobTitle: string | null;
  department: string | null;
  employmentStartDate: string | null;
  employmentStatus: EmploymentStatus;
  baseSalary: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  advances?: EmployeeAdvance[];
}

export const hrApi = {
  list: (search?: string, status?: EmploymentStatus) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    const qs = params.toString();
    return api.get<Employee[]>(`/employees${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api.get<Employee>(`/employees/${id}`),
  create: (data: Partial<Employee>) => api.post<Employee>('/employees', data),
  update: (id: string, data: Partial<Employee>) => api.patch<Employee>(`/employees/${id}`, data),
  // Only succeeds when the employee is already Terminated and has no
  // advance/payroll history — the backend enforces both; this just
  // surfaces the result.
  hardDelete: (id: string) => api.delete<{ deleted: true }>(`/employees/${id}/permanent`),
};