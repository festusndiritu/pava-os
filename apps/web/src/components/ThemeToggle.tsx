'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme-context';
import type { ThemePreference } from '../lib/theme-context';

const OPTIONS: { value: ThemePreference; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center rounded-md border p-0.5"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className="flex h-7 w-7 items-center justify-center rounded transition-colors"
            style={{
              backgroundColor: active ? 'var(--color-bg)' : 'transparent',
              color: active ? 'var(--color-ink-900)' : 'var(--color-ink-600)',
            }}
          >
            <Icon size={14} strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}