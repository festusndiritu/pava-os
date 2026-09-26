'use client';

import { Check } from 'lucide-react';

/**
 * A checkbox styled to match the rest of the app instead of the browser's
 * native chrome. The real <input> stays in the DOM — driving keyboard
 * access, checked state, and the focus-visible ring via
 * `.pava-checkbox-input` in globals.css — while the visible square is built
 * from our own design tokens.
 */
export function Checkbox({
  checked,
  onChange,
  ariaLabel,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel}
        className="pava-checkbox-input"
      />
      <span
        aria-hidden
        className="pointer-events-none flex h-4 w-4 items-center justify-center rounded border transition-colors"
        style={{
          borderColor: checked ? 'var(--color-accent)' : 'var(--color-border)',
          backgroundColor: checked ? 'var(--color-accent)' : 'var(--color-surface)',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {checked && <Check size={11} strokeWidth={3} color="#fff" />}
      </span>
    </span>
  );
}
