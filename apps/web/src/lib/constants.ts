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

// USERS and AUDIT are never grantable to a STAFF account, no matter what the
// permission editor shows — the backend controllers for both hard-require
// Role.ADMIN (@Roles(Role.ADMIN)), not a granted module, so a STAFF user can
// never pass their guard regardless of what's in user.permissions. Keeping
// this list here lets the permission editor, hasPermission(), and the route
// guard all agree with that backend reality instead of each having to know
// it separately.
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

// `pinned` sections stay expanded in the sidebar all the time — no header
// click needed to reach them. Everything else behaves as a true accordion
// (see Sidebar.tsx): opening one closes whichever was open before, which is
// what keeps the sidebar short. Pin only the handful of destinations someone
// reaches for constantly; pinning too many defeats the point of collapsing
// the rest.
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
    items: [
      { module: 'PRODUCTS', label: 'Products', href: '/products' },
      // Shares the PRODUCTS permission — brands, categories, units and
      // families are all product metadata, not a separately gated module.
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

// The single source of truth for "which module gates this route" — used by
// AppLayout to block direct navigation to a page the user's nav doesn't
// show them a link for (typed URL, stale bookmark, browser back/forward).
// Matches the most specific (longest) href so a page nested under a section
// root still resolves to the right module. Returns null for routes with no
// module of their own (e.g. /profile) — those are always allowed.
export function moduleForPath(pathname: string): ModuleKey | null {
  const items = NAV_SECTIONS.flatMap((section) => section.items);
  const match = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match ? match.module : null;
}

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