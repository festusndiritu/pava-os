'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_SECTIONS } from '../../lib/constants';
import { useAuth } from '../../lib/auth-context';
import { MODULE_ICONS } from './nav-icons';
import { BrandMark } from '../BrandMark';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { hasPermission } = useAuth();

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasPermission(item.module)),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <BrandMark size={28} />
        <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
          Pava Steel
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {sections.map((section) => (
          <div key={section.label} className="mb-5">
            <p
              className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase"
              style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}
            >
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const Icon = MODULE_ICONS[item.module];
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--color-accent-soft)' : 'transparent',
                      color: active ? 'var(--color-accent)' : 'var(--color-ink-600)',
                    }}
                  >
                    <Icon size={16} strokeWidth={2} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}