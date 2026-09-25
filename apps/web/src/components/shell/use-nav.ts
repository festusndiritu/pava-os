'use client';

import { usePathname } from 'next/navigation';
import { NAV_SECTIONS } from '../../lib/constants';
import { useAuth } from '../../lib/auth-context';

/** Navigation sections filtered to what this user's permissions allow. */
export function useNav() {
  const pathname = usePathname() ?? '';
  const { hasPermission } = useAuth();

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasPermission(item.module)),
  })).filter((section) => section.items.length > 0);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return { sections, isActive, pathname };
}
