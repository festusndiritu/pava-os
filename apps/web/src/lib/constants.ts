// Mirrors apps/api/prisma/schema.prisma's `Module` enum.
export const MODULES = [
  'DASHBOARD',
  'POS',
  'PRODUCTS',
  'INVENTORY',
  'CUSTOMERS',
  'QUOTES',
  'INVOICES',
  'CONTACTS',
  'LEADS',
  'MARKETING',
  'HR',
  'PAYROLL',
  'EXPENSES',
  'REPORTS',
  'ANALYTICS',
  'AUDIT',
  'USERS',
  'SETTINGS',
] as const;

export type ModuleKey = (typeof MODULES)[number];

export const ADMIN_ONLY_MODULES: ModuleKey[] = ['USERS', 'AUDIT'];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  DASHBOARD: 'Dashboard',
  POS: 'POS',
  PRODUCTS: 'Products',
  INVENTORY: 'Inventory',
  CUSTOMERS: 'Customers',
  QUOTES: 'Quotes',
  INVOICES: 'Invoices',
  CONTACTS: 'Contacts',
  LEADS: 'Leads',
  MARKETING: 'Marketing',
  HR: 'HR',
  PAYROLL: 'Payroll',
  EXPENSES: 'Expenses',
  REPORTS: 'Reports',
  ANALYTICS: 'Analytics',
  AUDIT: 'Audit Trail',
  USERS: 'Users & Access',
  SETTINGS: 'Settings',
};

export const MODULE_GROUPS: { label: string; modules: ModuleKey[] }[] = [
  { label: 'Overview', modules: ['DASHBOARD'] },
  { label: 'Sell', modules: ['POS', 'QUOTES', 'INVOICES', 'CUSTOMERS'] },
  { label: 'Catalogue', modules: ['PRODUCTS', 'INVENTORY'] },
  { label: 'Relationships', modules: ['LEADS', 'CONTACTS', 'MARKETING'] },
  { label: 'Operations', modules: ['HR', 'PAYROLL', 'EXPENSES'] },
  { label: 'Insights', modules: ['ANALYTICS', 'REPORTS'] },
  { label: 'Administration', modules: ['AUDIT', 'USERS', 'SETTINGS'] },
];

export const NAV_SECTIONS: { label: string; pinned?: boolean; items: { module: ModuleKey; label: string; href: string }[] }[] = [
  { label: 'Overview', pinned: true, items: [{ module: 'DASHBOARD', label: 'Dashboard', href: '/dashboard' }] },
  {
    label: 'Sell',
    pinned: true,
    items: [
      { module: 'POS', label: 'POS', href: '/pos' },
      { module: 'QUOTES', label: 'Quotes', href: '/quotes' },
      { module: 'INVOICES', label: 'Invoices', href: '/invoices' },
      { module: 'CUSTOMERS', label: 'Customers', href: '/customers' },
    ],
  },
  {
    label: 'Catalogue',
    pinned: true,
    items: [
      { module: 'PRODUCTS', label: 'Products', href: '/products' },
      { module: 'PRODUCTS', label: 'Catalogue setup', href: '/products/setup' },
      { module: 'INVENTORY', label: 'Inventory', href: '/inventory' },
    ],
  },
  {
    label: 'Relationships',
    items: [
      { module: 'LEADS', label: 'Leads', href: '/leads' },
      { module: 'CONTACTS', label: 'Contacts', href: '/contacts' },
      { module: 'MARKETING', label: 'Marketing', href: '/marketing' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { module: 'HR', label: 'HR', href: '/hr' },
      { module: 'PAYROLL', label: 'Payroll', href: '/payroll' },
      { module: 'EXPENSES', label: 'Expenses', href: '/expenses' },
    ],
  },
  {
    label: 'Insights',
    pinned: true,
    items: [
      { module: 'ANALYTICS', label: 'Analytics', href: '/analytics' },
      { module: 'REPORTS', label: 'Reports', href: '/reports' },
    ],
  },
  {
    label: 'Administration',
    pinned: true,
    items: [
      { module: 'USERS', label: 'Users & Access', href: '/users' },
      { module: 'AUDIT', label: 'Audit Trail', href: '/audit' },
      { module: 'SETTINGS', label: 'Settings', href: '/settings' },
    ],
  },
];

export function moduleForPath(pathname: string): ModuleKey | null {
  const items = NAV_SECTIONS.flatMap((section) => section.items);
  const match = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match ? match.module : null;
}

/** The avatar choices. A user's `avatar` is one of these keys. */
export const AVATAR_COLORS = [
  { key: 'slate', bg: '#475467', fg: '#FFFFFF' },
  { key: 'blue', bg: '#0559C9', fg: '#FFFFFF' },
  { key: 'teal', bg: '#0E8F6A', fg: '#FFFFFF' },
  { key: 'amber', bg: '#B76E00', fg: '#FFFFFF' },
  { key: 'rose', bg: '#C0362C', fg: '#FFFFFF' },
  { key: 'violet', bg: '#6D3FC9', fg: '#FFFFFF' },
] as const;

export const DEFAULT_AVATAR: string = AVATAR_COLORS[0].key;

/** Anything that isn't a known key falls back to the first colour. */
export function avatarColor(key?: string | null) {
  return AVATAR_COLORS.find((c) => c.key === key) ?? AVATAR_COLORS[0];
}

export function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}