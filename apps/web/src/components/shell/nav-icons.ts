import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Receipt,
  Users,
  Package,
  Boxes,
  Target,
  Contact,
  Megaphone,
  UserSquare2,
  Wallet,
  ReceiptText,
  BarChart3,
  FileBarChart,
  History,
  UsersRound,
  Settings,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleKey } from '../../lib/constants';

export const MODULE_ICONS: Record<ModuleKey, LucideIcon> = {
  DASHBOARD: LayoutDashboard,
  POS: ShoppingCart,
  PRODUCTS: Package,
  INVENTORY: Boxes,
  CUSTOMERS: Users,
  QUOTES: FileText,
  INVOICES: Receipt,
  CONTACTS: Contact,
  LEADS: Target,
  MARKETING: Megaphone,
  HR: UserSquare2,
  PAYROLL: Wallet,
  EXPENSES: ReceiptText,
  REPORTS: FileBarChart,
  ANALYTICS: BarChart3,
  AUDIT: History,
  USERS: UsersRound,
  SETTINGS: Settings,
};

export const NAV_ICON_OVERRIDES: Partial<Record<string, LucideIcon>> = {
  '/products/setup': SlidersHorizontal,
};

export function iconFor(item: { module: ModuleKey; href: string }): LucideIcon {
  return NAV_ICON_OVERRIDES[item.href] ?? MODULE_ICONS[item.module];
}