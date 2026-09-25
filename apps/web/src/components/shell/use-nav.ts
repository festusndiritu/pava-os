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

  // Longest-href match wins — the same rule moduleForPath() uses for route
  // guarding — so a nested page like /products/setup lights up only
  // "Catalogue setup" and not "Products" too, since "/products" is also a
  // prefix of that path.
  const hrefs = sections.flatMap((section) => section.items.map((item) => item.href));
  const current = hrefs.filter((href) => pathname === href || pathname.startsWith(`${href}/`)).sort((a, b) => b.length - a.length)[0];

  const isActive = (href: string) => href === current;

  return { sections, isActive, pathname };
}
