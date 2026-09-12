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

export const contactsApi = {
  list: (search?: string) => api.get<Contact[]>(`/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  get: (id: string) => api.get<Contact>(`/contacts/${id}`),
  create: (data: ContactInput) => api.post<Contact>('/contacts', data),
  update: (id: string, data: Partial<ContactInput>) => api.patch<Contact>(`/contacts/${id}`, data),
};