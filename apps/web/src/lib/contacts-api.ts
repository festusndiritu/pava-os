import { api } from './api';

export interface Contact {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  phone: string | null;
  altPhone: string | null;
  notes: string | null;
  tags: string[];
  followUpAt: string | null;
  active: boolean;
  createdAt: string;
}

export interface ContactInput {
  name: string;
  company?: string;
  role?: string;
  phone?: string;
  altPhone?: string;
  notes?: string;
  tags?: string[];
  followUpAt?: string;
}

function query(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const contactsApi = {
  list: (search?: string, status?: 'active' | 'archived' | 'all', page?: { offset: number; limit: number }) =>
    api.get<Contact[]>(`/contacts${query({ search, status, limit: page ? String(page.limit) : undefined, offset: page?.offset ? String(page.offset) : undefined })}`),
  get: (id: string) => api.get<Contact>(`/contacts/${id}`),
  create: (data: ContactInput) => api.post<Contact>('/contacts', data),
  update: (id: string, data: Partial<ContactInput>) => api.patch<Contact>(`/contacts/${id}`, data),
  archive: (id: string) => api.delete<Contact>(`/contacts/${id}`),
  restore: (id: string) => api.post<Contact>(`/contacts/${id}/restore`),
  // Only succeeds on an already-archived contact — the backend enforces
  // this; this just surfaces the result.
  hardDelete: (id: string) => api.delete<{ deleted: true }>(`/contacts/${id}/permanent`),
};
