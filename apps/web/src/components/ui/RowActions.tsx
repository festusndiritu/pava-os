'use client';

import type { LucideIcon } from 'lucide-react';

const TONES = {
  default: 'var(--color-ink-600)',
  danger: 'var(--color-status-bad)',
  accent: 'var(--color-accent)',
  ok: 'var(--color-status-ok)',
} as const;

/**
 * The square icon button used for row actions. 44px on touch screens, where
 * it sits in a card, and 36px in a desktop table row, from the same markup,
 * so a table's actions don't need a second copy for mobile.
 */
export function IconAction({
  label,
  icon: Icon,
  onClick,
  href,
  external,
  tone = 'default',
  disabled,
}: {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  tone?: keyof typeof TONES;
  disabled?: boolean;
}) {
  const className = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition-colors hover:bg-[var(--color-bg)] disabled:opacity-40 md:h-9 md:w-9';
  const style = { borderColor: 'var(--color-border)', color: TONES[tone] };
  if (href) {
    return (
      <a href={href} title={label} aria-label={label} className={className} style={style} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        <Icon size={15} strokeWidth={2} />
      </a>
    );
  }
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={className} style={style}>
      <Icon size={15} strokeWidth={2} />
    </button>
  );
}
