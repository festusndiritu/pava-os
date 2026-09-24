'use client';

import { useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';

/**
 * The app's numeric and phone inputs.
 *
 * Why not <input type="number">: it accepts "e", "+", "-" and "." in fields
 * that are whole shillings or whole pieces, changes its value when the mouse
 * wheel scrolls over a focused field, and fights controlled state (clearing
 * the box and typing again leaves a stuck "0"). These inputs are plain text
 * inputs that only ever let valid characters in, keep the value as a string
 * while it's being edited (so the field can be emptied), and open the numeric
 * keypad on phones. Parse with toNumber() when submitting.
 */

type NativeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'inputMode' | 'min' | 'max' | 'step' | 'pattern'
>;

export interface NumericOptions {
  /** Allow a leading minus (adjustments, deductions). Default: no. */
  allowNegative?: boolean;
  /** Allow a decimal point (millimetres, percentages). Default: whole numbers only. */
  allowDecimal?: boolean;
  /** Digits kept after the decimal point. Default 2. */
  maxDecimals?: number;
}

/** Strips anything that isn't a valid character for the field. Never throws. */
export function sanitizeNumeric(raw: string, opts: NumericOptions = {}): string {
  const { allowNegative = false, allowDecimal = false, maxDecimals = 2 } = opts;
  const negative = allowNegative && raw.trimStart().startsWith('-');

  // Thousands separators and spaces from a paste ("1,500") just disappear.
  let s = raw.replace(/[,\s]/g, '');

  if (allowDecimal) {
    s = s.replace(/[^\d.]/g, '');
    const dot = s.indexOf('.');
    if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '').slice(0, maxDecimals);
  } else {
    // A pasted "1500.50" into a whole-number field keeps the whole part.
    s = s.split('.')[0].replace(/\D/g, '');
  }

  s = s.replace(/^0+(?=\d)/, '');
  return negative ? `-${s}` : s;
}

/** null for empty or half-typed input ("", "-", "."). */
export function toNumber(s: string): number | null {
  if (s === '' || s === '-' || s === '.' || s === '-.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function patternFor(opts: NumericOptions): string {
  const sign = opts.allowNegative ? '-?' : '';
  return opts.allowDecimal ? `${sign}\\d*\\.?\\d+` : `${sign}\\d+`;
}

function inputModeFor(opts: NumericOptions): 'numeric' | 'decimal' | 'text' {
  // Phone keypads for "numeric"/"decimal" have no minus key.
  if (opts.allowNegative) return 'text';
  return opts.allowDecimal ? 'decimal' : 'numeric';
}

function clean(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/**
 * String-valued numeric input for forms. `value` is what's in the box;
 * `onChange` receives the sanitized string. Pass it through toNumber() on
 * submit. Min/max clamp: max while typing, min when the field loses focus.
 */
export function NumericInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  allowNegative,
  allowDecimal,
  maxDecimals,
  onFocus,
  onBlur,
  onKeyDown,
  ...rest
}: NativeProps &
  NumericOptions & {
    value: string;
    onChange: (next: string) => void;
    min?: number;
    max?: number;
    step?: number;
  }) {
  const opts = { allowNegative, allowDecimal, maxDecimals };

  function handleChange(raw: string) {
    let next = sanitizeNumeric(raw, opts);
    const n = toNumber(next);
    if (max !== undefined && n !== null && n > max) next = String(max);
    onChange(next);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const current = toNumber(value) ?? (min ?? 0);
    let next = current + (e.key === 'ArrowUp' ? step : -step);
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    onChange(clean(next));
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode={inputModeFor(opts)}
      pattern={patternFor(opts)}
      autoComplete="off"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={(e) => {
        e.currentTarget.select();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        const n = toNumber(value);
        if (min !== undefined && n !== null && n < min) onChange(clean(min));
        onBlur?.(e);
      }}
    />
  );
}

/**
 * Number-valued input for places where the surrounding state is a number
 * (the POS cart). While the field is focused the person edits a private
 * draft string, so it can be emptied and retyped; a valid value is committed
 * as they type, and an empty or out-of-range draft simply reverts to the last
 * committed value on blur instead of snapping to 1 or 0 mid-edit.
 */
export function CommittedNumberInput({
  value,
  onCommit,
  min = 0,
  max,
  onFocus,
  onBlur,
  onKeyDown,
  ...rest
}: NativeProps & {
  value: number;
  onCommit: (next: number) => void;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === 'Enter') {
      e.currentTarget.blur();
      return;
    }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    let next = value + (e.key === 'ArrowUp' ? 1 : -1);
    next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    setDraft(String(next));
    onCommit(next);
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      pattern="\d+"
      autoComplete="off"
      value={draft ?? String(value)}
      onChange={(e) => {
        const next = sanitizeNumeric(e.target.value);
        setDraft(next);
        const n = toNumber(next);
        if (n !== null && n >= min && (max === undefined || n <= max)) onCommit(n);
      }}
      onKeyDown={handleKeyDown}
      onFocus={(e) => {
        setDraft(String(value));
        e.currentTarget.select();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setDraft(null);
        onBlur?.(e);
      }}
    />
  );
}

/**
 * Turns whatever was typed or pasted into the local 07xx/01xx form the API
 * stores — the client-side twin of normalizeKenyanPhone() on the backend. A
 * pasted "+254 712 345 678" becomes "0712345678" instead of being blocked by
 * a length cap, and letters can't get in at all.
 */
export function normalizePhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('254')) digits = `0${digits.slice(3)}`;
  return digits.slice(0, 10);
}

/** Kenyan mobile number field. Emits the normalized string. */
export function PhoneInput({
  value,
  onChange,
  ...rest
}: NativeProps & { value: string; onChange: (next: string) => void }) {
  return (
    <input
      placeholder="07XX XXX XXX"
      {...rest}
      type="tel"
      inputMode="tel"
      autoComplete="off"
      pattern="(07|01)\d{8}"
      title="10 digits, starting 07 or 01"
      value={value}
      onChange={(e) => onChange(normalizePhoneInput(e.target.value))}
    />
  );
}
