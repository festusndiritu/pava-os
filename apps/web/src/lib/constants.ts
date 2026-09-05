// Mirrors apps/api/prisma/schema.prisma's `Module` enum. Keep these two in
// sync manually — there's no shared package between api/web in this repo yet.
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

// Used both for the sidebar (Overview/Sell/Catalogue/...) and the grouped
// permission editor on the Users page, so granting access matches what the
// person will actually see in the nav.
export const MODULE_GROUPS: { label: string; modules: ModuleKey[] }[] = [
  { label: 'Overview', modules: ['DASHBOARD'] },
  { label: 'Sell', modules: ['POS', 'QUOTES', 'INVOICES', 'CUSTOMERS'] },
  { label: 'Catalogue', modules: ['PRODUCTS', 'INVENTORY'] },
  { label: 'Relationships', modules: ['LEADS', 'CONTACTS', 'MARKETING'] },
  { label: 'Operations', modules: ['HR', 'PAYROLL', 'EXPENSES'] },
  { label: 'Insights', modules: ['ANALYTICS', 'REPORTS'] },
  { label: 'Administration', modules: ['AUDIT', 'USERS', 'SETTINGS'] },
];

export const NAV_SECTIONS: { label: string; items: { module: ModuleKey; label: string; href: string }[] }[] = [
  { label: 'Overview', items: [{ module: 'DASHBOARD', label: 'Dashboard', href: '/dashboard' }] },
  {
    label: 'Sell',
    items: [
      { module: 'POS', label: 'POS', href: '/pos' },
      { module: 'QUOTES', label: 'Quotes', href: '/quotes' },
      { module: 'INVOICES', label: 'Invoices', href: '/invoices' },
      { module: 'CUSTOMERS', label: 'Customers', href: '/customers' },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { module: 'PRODUCTS', label: 'Products', href: '/products' },
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
    items: [
      { module: 'ANALYTICS', label: 'Analytics', href: '/analytics' },
      { module: 'REPORTS', label: 'Reports', href: '/reports' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { module: 'USERS', label: 'Users & Access', href: '/users' },
      { module: 'AUDIT', label: 'Audit Trail', href: '/audit' },
      { module: 'SETTINGS', label: 'Settings', href: '/settings' },
    ],
  },
];

// Predefined avatar set: a color + up to 2 initials, rendered as CSS (see
// components/Avatar.tsx) rather than image files — keeps things fast and
// avoids needing an asset pipeline for something this simple.
export const AVATAR_COLORS = [
  { key: 'slate', bg: '#E4E7EC', fg: '#101828' },
  { key: 'blue', bg: '#EAF1FD', fg: '#0559C9' },
  { key: 'teal', bg: '#E7F7F1', fg: '#0B9E6F' },
  { key: 'amber', bg: '#FFF4E5', fg: '#B76E00' },
  { key: 'rose', bg: '#FBEAE9', fg: '#C0362C' },
  { key: 'violet', bg: '#F1EAFD', fg: '#6D3FC9' },
] as const;

export const AVATAR_KEYS = AVATAR_COLORS.flatMap((c) => [`${c.key}-01`, `${c.key}-02`, `${c.key}-03`]);

export function avatarColor(key?: string | null) {
  const base = key?.split('-')[0];
  return AVATAR_COLORS.find((c) => c.key === base) ?? AVATAR_COLORS[0];
}

export function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}