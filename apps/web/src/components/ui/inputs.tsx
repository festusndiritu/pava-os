'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useMediaQuery } from '../../lib/use-media-query';

/**
 * The app's form inputs: numeric and phone fields, and the Select dropdown
 * (at the bottom of the file).
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

/* ------------------------------------------------------------------ */
/* Select                                                              */
/* ------------------------------------------------------------------ */

export interface SelectOption {
  value: string;
  label: string;
  /** A second, smaller line under the label. */
  hint?: string;
  disabled?: boolean;
}

const SELECT_BASE =
  'flex items-center justify-between gap-2 rounded-md border text-left text-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60';
const SELECT_SIZES = { md: 'px-3 py-2', sm: 'min-h-10 px-2.5 py-1 md:min-h-9' } as const;

interface SelectPosition {
  left: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

/**
 * The app's dropdown. It replaces the browser's <select>, whose list is drawn
 * by the operating system and can't be styled to match anything else here.
 *
 * It looks like the text fields around it (pass the same `style` you give
 * them). On a desktop the list is a popover under the button, flipped above
 * when there's no room; on a phone it is a sheet from the bottom with
 * thumb-sized rows. Lists longer than eight get a search box. Arrow keys,
 * Home/End and typing a letter move through the options, Enter or Space picks,
 * and Escape closes the list only — not the drawer or dialog behind it.
 *
 * `value` and `onChange` are plain strings, like a native select. An option
 * with value "" is a normal option (e.g. "All categories") and is shown muted;
 * with no matching option the `placeholder` is shown instead. `required` blocks
 * form submission while nothing is chosen, as the native one did.
 *
 * The list is drawn in a portal at the end of the page: drawers and tables
 * scroll and clip, and a list drawn inside would be cut off.
 */
export function Select({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  'aria-label': ariaLabel,
  required,
  disabled,
  inline,
  size = 'md',
  searchable,
  className = '',
  style,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  options: SelectOption[];
  placeholder?: string;
  'aria-label'?: string;
  required?: boolean;
  disabled?: boolean;
  /** Size to the content instead of filling the row. */
  inline?: boolean;
  size?: 'md' | 'sm';
  /** Force the search box on or off. Default: on when there are more than 8 options. */
  searchable?: boolean;
  /** Extra classes for the button (a fixed width, extra padding). */
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<SelectPosition | null>(null);
  const [minWidth, setMinWidth] = useState(0);
  const [title, setTitle] = useState('');
  // Phone only: how far the on-screen keyboard covers the page (iOS overlays it
  // instead of resizing), so the sheet can sit above it.
  const [vv, setVv] = useState<{ inset: number; height: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const sheet = useMediaQuery('(max-width: 767px)');

  const selected = options.find((o) => o.value === value);
  const showSearch = searchable ?? options.length > 8;
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setPos(null);
    setQuery('');
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const optionEls = () => Array.from(popRef.current?.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])') ?? []);

  function openList() {
    if (disabled || open) return;
    setMinWidth(triggerRef.current?.offsetWidth ?? 0);
    // The phone sheet is titled with the field's label.
    const label = (id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null) ?? triggerRef.current?.closest('label') ?? null;
    const text = label ? Array.from(label.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(' ') || label.textContent : null;
    setTitle((text ?? ariaLabel ?? placeholder ?? '').replace(/\s+/g, ' ').trim());
    setOpen(true);
  }

  // Place the popover under the button; when it doesn't fit there and there is
  // more room above, anchor it above instead.
  useLayoutEffect(() => {
    if (!open || sheet || !triggerRef.current || !popRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const m = popRef.current.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    const below = window.innerHeight - t.bottom - gap - margin;
    const above = t.top - gap - margin;
    const flip = m.height > below && above > below;
    const left = Math.max(margin, Math.min(t.left, window.innerWidth - m.width - margin));
    setPos({
      left,
      ...(flip ? { bottom: window.innerHeight - t.top + gap } : { top: t.bottom + gap }),
      maxHeight: Math.min(320, flip ? above : below),
    });
  }, [open, sheet, shown.length]);

  // Move focus into the list once it is on screen: the search box with a mouse,
  // otherwise the chosen option (a phone keyboard over the list is worse than a tap).
  useEffect(() => {
    if (!open || (!sheet && !pos)) return;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (showSearch && !coarse) {
      searchRef.current?.focus();
      return;
    }
    const els = optionEls();
    (els.find((el) => el.getAttribute('aria-selected') === 'true') ?? els[0])?.focus();
  }, [open, pos === null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !sheet || !window.visualViewport) return;
    const v = window.visualViewport;
    const update = () => setVv({ inset: Math.max(0, window.innerHeight - v.height - v.offsetTop), height: v.height });
    update();
    v.addEventListener('resize', update);
    v.addEventListener('scroll', update);
    return () => {
      v.removeEventListener('resize', update);
      v.removeEventListener('scroll', update);
      setVv(null);
    };
  }, [open, sheet]);

  // Anything that moves the button out from under an open popover closes it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onScroll = (e: Event) => {
      if (popRef.current?.contains(e.target as Node)) return; // the list's own scrolling
      if (!sheet) close(false);
    };
    // A phone keyboard opening for the search box resizes the window; that must not close the sheet.
    const onResize = () => {
      if (!sheet) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, sheet, close]);

  // Escape closes this list only, not the drawer or dialog the field sits in.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      close(true);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, close]);

  function choose(o: SelectOption) {
    if (o.disabled) return;
    close(true);
    if (o.value !== value) onChange(o.value);
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openList();
    }
  }

  function onListKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const inSearch = e.target === searchRef.current;
    const list = optionEls();
    const i = list.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      list[(n + list.length) % list.length]?.focus();
    };
    if (e.key === 'ArrowDown') {
      if (inSearch) {
        e.preventDefault();
        list[0]?.focus();
      } else go(i + 1);
    } else if (e.key === 'ArrowUp') {
      if (inSearch) e.preventDefault();
      else if (i <= 0 && showSearch) {
        e.preventDefault();
        searchRef.current?.focus();
      } else go(i <= 0 ? list.length - 1 : i - 1);
    } else if (e.key === 'Home' && !inSearch) go(0);
    else if (e.key === 'End' && !inSearch) go(list.length - 1);
    else if (e.key === 'Tab') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Enter' && inSearch) {
      e.preventDefault();
      list[0]?.click(); // pick the first match
    } else if (!inSearch && e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (showSearch) {
        searchRef.current?.focus(); // the letter lands in the search box
        return;
      }
      // Typeahead: the next option whose label starts with the typed letter.
      const ch = e.key.toLowerCase();
      const ordered = [...list.slice(i + 1), ...list.slice(0, i + 1)];
      const hit = ordered.find((el) => el.textContent?.trim().toLowerCase().startsWith(ch));
      if (hit) {
        e.preventDefault();
        hit.focus();
      }
    }
  }

  const borderColor = 'var(--color-border)';
  const muted = !selected || selected.value === '';

  const list = (
    <div
      ref={popRef}
      onKeyDown={onListKeyDown}
      className={
        sheet
          ? 'pava-rise fixed inset-x-0 z-[71] flex flex-col rounded-t-2xl border-t pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl'
          : 'fixed z-[71] flex max-w-[22rem] flex-col overflow-hidden rounded-lg border shadow-lg'
      }
      style={{
        borderColor,
        backgroundColor: 'var(--color-surface-raised)',
        ...(sheet
          ? { bottom: vv?.inset ?? 0, maxHeight: vv ? `min(80dvh, ${Math.max(200, vv.height - 16)}px)` : '80dvh' }
          : { minWidth, left: pos?.left ?? 0, top: pos?.top, bottom: pos?.bottom, maxHeight: pos?.maxHeight ?? 320, visibility: pos ? 'visible' : 'hidden' }),
      }}
    >
      {sheet && (
        <>
          <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-border)' }} />
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3">
            <h2 className="min-w-0 truncate text-base font-semibold" style={{ color: 'var(--color-ink-900)' }}>
              {title}
            </h2>
            <button type="button" aria-label="Close" onClick={() => close(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-600)' }}>
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </>
      )}
      {showSearch && (
        <div className={`relative shrink-0 ${sheet ? 'px-4 pb-3' : 'border-b p-2'}`} style={sheet ? undefined : { borderColor }}>
          <Search size={sheet ? 17 : 14} strokeWidth={2} aria-hidden className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${sheet ? 'left-7' : 'left-4'}`} style={{ color: 'var(--color-ink-400)' }} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search options"
            autoComplete="off"
            enterKeyHint="search"
            className={`w-full border outline-none ${sheet ? 'h-11 rounded-xl pl-10 pr-10 text-base' : 'rounded-md py-1.5 pl-8 pr-2 text-sm'}`}
            style={{ borderColor, backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              className={`absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full ${sheet ? 'right-5' : 'right-3'}`}
              style={{ color: 'var(--color-ink-600)' }}
            >
              <X size={14} strokeWidth={2} aria-hidden />
            </button>
          )}
        </div>
      )}
      <div id={listId} role="listbox" aria-label={ariaLabel ?? placeholder} className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${sheet ? 'px-2 pb-1' : 'py-1'}`}>
        {shown.length === 0 && (
          <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--color-ink-600)' }}>
            No matches
          </p>
        )}
        {shown.map((o) => {
          const isSelected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={isSelected}
              aria-disabled={o.disabled || undefined}
              onClick={() => choose(o)}
              className={`flex w-full items-center gap-3 text-left outline-none transition-colors hover:bg-[var(--color-bg)] focus:bg-[var(--color-bg)] aria-disabled:cursor-not-allowed aria-disabled:opacity-45 ${
                sheet ? 'min-h-[3.25rem] rounded-xl px-3.5 text-base' : 'min-h-9 px-3 text-sm'
              } ${o.hint ? 'py-1.5' : ''}`}
              style={{
                color: isSelected ? 'var(--color-accent)' : 'var(--color-ink-900)',
                fontWeight: isSelected ? 500 : undefined,
                backgroundColor: isSelected && sheet ? 'var(--color-accent-soft)' : undefined,
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.label}</span>
                {o.hint && (
                  <span className="block truncate text-xs font-normal" style={{ color: 'var(--color-ink-600)' }}>
                    {o.hint}
                  </span>
                )}
              </span>
              {isSelected && <Check size={sheet ? 18 : 15} strokeWidth={2.25} aria-hidden className="shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={`relative ${inline ? 'inline-block' : 'block'}`}>
      <button
        ref={triggerRef}
        id={id}
        data-select=""
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onTriggerKeyDown}
        className={`${SELECT_BASE} ${SELECT_SIZES[size]} ${inline ? '' : 'w-full'} ${className}`}
        style={{ ...style, ...(open ? { borderColor: 'var(--color-accent)' } : null) }}
      >
        <span className="min-w-0 flex-1 truncate" style={muted ? { color: 'var(--color-ink-600)' } : undefined}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} strokeWidth={2} aria-hidden className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--color-ink-400)' }} />
      </button>
      {/* Gives `required` something the browser can validate; the button can't. */}
      {required && <input tabIndex={-1} aria-hidden required value={value} onChange={() => {}} className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0" />}
      {open &&
        createPortal(
          <>
            {sheet && <div aria-hidden className="pava-fade-in fixed inset-0 z-[70]" style={{ backgroundColor: 'rgba(16, 24, 40, 0.5)' }} onClick={() => close(false)} />}
            {list}
          </>,
          document.body,
        )}
    </div>
  );
}
