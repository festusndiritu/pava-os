import { api } from './api';

export interface AuditLogEntry {
	  id: string;
	  actorId: string | null;
      action: string;
      entityType: string | null;
      entityId: string | null;
      metadata: Record<string, any> | null;
      createdAt: string;
      actor?: {
        id: string;
        name: string;
        avatar: string | null;
	  } | null;
    }

    export interface AuditQueryResult {
        data: AuditLogEntry[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }

    export const auditApi = {
        list: (params?: {
            page?: number;
            limit?: number;
            entityType?: string;
            entityId?: string;
            action?: string;
            actorId?: string;
         }) => {
            const search = new URLSearchParams();
            if (params?.page) search.set('page', String(params.page));
            if (params?.limit) search.set('limit', String(params.limit));
            if (params?.entityType) search.set('entityType', params.entityType);
            if (params?.entityId) search.set('entityId', params.entityId);
            if (params?.action) search.set('action', params.action);
            if (params?.actorId) search.set('actorId', params.actorId);
            const qs = search.toString();
            return api.get<AuditQueryResult>(`/audit${qs ? `?${qs}` : ''}`);
        },
    };