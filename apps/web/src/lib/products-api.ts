import { api } from './api';

export interface Brand {
  id: string;
  name: string;
}
export interface Category {
  id: string;
  name: string;
}
export interface Unit {
  id: string;
  name: string;
  symbol: string;
}
export interface ProductAlias {
  id: string;
  term: string;
}
export interface ProductFamily {
  id: string;
  name: string;
}

export type StockStatus = 'IN_STOCK' | 'SUPPLIER_ONLY' | 'OUT_OF_STOCK';

export interface Product {
  id: string;
  name: string;
  displayName: string | null;
  spec: string | null;
  imageUrl: string | null;
  brandId: string | null;
  brand: Brand | null;
  categoryId: string | null;
  category: Category | null;
  unitId: string;
  unit: Unit;
  basePrice: number;
  stockStatus: StockStatus;
  active: boolean;
  stockQuantity: number;
  lastCost: number | null;
  shape: string | null;
  nominalSize: string | null;
  widthMm: number | null;
  heightMm: number | null;
  thicknessMm: number | null;
  gauge: number | null;
  material: string | null;
  familyId: string | null;
  family: ProductFamily | null;
  aliases: ProductAlias[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductPriceHistoryEntry {
  id: string;
  oldPrice: number;
  newPrice: number;
  changedAt: string;
  changedBy: { name: string };
}

export interface InventoryBatch {
  id: string;
  quantityReceived: number;
  remainingQuantity: number;
  unitCost: number;
  createdAt: string;
  receipt: { supplier: string; reference: string | null; receivedAt: string };
}

export interface InventoryMovement {
  id: string;
  type: string;
  quantity: number;
  unitCost: number | null;
  note: string | null;
  createdAt: string;
  createdBy: { name: string };
}

export interface InventoryReceipt {
  id: string;
  supplier: string;
  reference: string | null;
  notes: string | null;
  receivedAt: string;
  receivedBy: { name: string };
  batches: { id: string; quantityReceived: number; unitCost: number; product: { id: string; name: string; displayName: string | null } }[];
}

export interface ReceiveLineResult {
  productId: string;
  productName: string;
  batchId: string;
  suggestedPrice: number;
  currentPrice: number;
}

export const productsApi = {
  list: (params: { search?: string; brandId?: string; categoryId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.brandId) qs.set('brandId', params.brandId);
    if (params.categoryId) qs.set('categoryId', params.categoryId);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<Product[]>(`/products${suffix}`);
  },
  get: (id: string) => api.get<Product>(`/products/${id}`),
  create: (data: Partial<Omit<Product, 'aliases'>> & { aliases?: string[] }) => api.post<Product>('/products', data),
  update: (id: string, data: Partial<Omit<Product, 'aliases'>> & { aliases?: string[] }) => api.patch<Product>(`/products/${id}`, data),
  priceHistory: (id: string) => api.get<ProductPriceHistoryEntry[]>(`/products/${id}/price-history`),
  brands: () => api.get<Brand[]>('/brands'),
  createBrand: (name: string) => api.post<Brand>('/brands', { name }),
  categories: () => api.get<Category[]>('/categories'),
  createCategory: (name: string) => api.post<Category>('/categories', { name }),
  units: () => api.get<Unit[]>('/units'),
};

export const inventoryApi = {
  receipts: () => api.get<InventoryReceipt[]>('/inventory/receipts'),
  receiptDetail: (id: string) => api.get<InventoryReceipt>(`/inventory/receipts/${id}`),
  receive: (data: { supplier: string; reference?: string; notes?: string; lines: { productId: string; quantity: number; unitCost: number }[] }) =>
    api.post<{ receipt: InventoryReceipt; lines: ReceiveLineResult[] }>('/inventory/receipts', data),
  adjust: (data: { productId: string; quantity: number; type: 'ADJUSTMENT' | 'CORRECTION' | 'RETURN'; note?: string; allowNegative?: boolean }) =>
    api.post('/inventory/adjustments', data),
  batches: (productId: string) => api.get<InventoryBatch[]>(`/inventory/batches?productId=${productId}`),
  movements: (productId: string) => api.get<InventoryMovement[]>(`/inventory/movements?productId=${productId}`),
};