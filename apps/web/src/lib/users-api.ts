import { api } from './api';
import type { ModuleKey } from './constants';

export interface StaffUser {
  id: string;
  name: string;
  role: 'ADMIN' | 'STAFF';
  email: string | null;
  avatar: string | null;
  phone: string | null;
  permissions: ModuleKey[];
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string } | null;
}

export interface CreateStaffInput {
  name: string;
  pin: string;
  avatar?: string;
  phone?: string;
  permissions: ModuleKey[];
}

export interface UpdateStaffInput {
  name?: string;
  avatar?: string;
  phone?: string;
  permissions?: ModuleKey[];
  active?: boolean;
}

export const usersApi = {
  list: () => api.get<StaffUser[]>('/users'),
  get: (id: string) => api.get<StaffUser>(`/users/${id}`),
  create: (data: CreateStaffInput) => api.post<StaffUser>('/users', data),
  update: (id: string, data: UpdateStaffInput) => api.patch<StaffUser>(`/users/${id}`, data),
  resetPin: (id: string, newPin: string) => api.post(`/users/${id}/reset-pin`, { newPin }),
};