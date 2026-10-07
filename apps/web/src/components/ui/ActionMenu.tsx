'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMediaQuery } from '../../lib/use-media-query';

export interface RowAction {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  /** Makes the item a link (tel:, wa.me, a page) instead of a button. */
  href?: string;
  external?: boolean;
  tone?: 'default' | 'danger' | 'accent';
  disabled?: boolean;
  /** A second, smaller line: why an item is disabled, or what it will do. */
  hint?: string;
  /** Draws a divider above this item. Used to set destructive actions apart. */
  separatorBefore?: boolean;
}

/** What a screen may list: conditions can be written inline as `isAdmin && { … }`. */
export type RowActionInput = RowAction | false | null | undefined;

export const actionList = (items: RowActionInput[]): RowAction[] => items.filter((i): i is RowAction => !!i);

const TONES = { default: 'var(--color-ink-900)', danger: 'var(--color-status-bad)', accent: 'var(--color-accent)' } as const;

/**
 * The "⋮" button at the end of a row, and the menu it opens.
 *
 * On a desktop it is a small popover next to the button; on a phone it is a
 * sheet from the bottom with thumb-sized rows. Either way it is a real menu:
 * arrow keys move between items (Home/End jump, a letter jumps to the next
 * item starting with it), Escape and Tab close it and give focus back to the
 * button, and picking an item closes it first so a dialog the item opens
 * returns focus to the button afterwards.
 *
 * It is drawn in a portal at the end of the page because the table around it
 * scrolls and clips; a menu drawn inside would be cut off by the last rows.
 */
export function ActionMenu({ actions, label, heading }: { actions: RowAction[]; /** Names the button for screen readers. */ label: string; /** Title of the phone sheet. */ heading?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<'first' | 'last'>('first');
  const menuId = useId();
  const sheet = useMediaQuery('(max-width: 767px)');

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setPos(null);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);

  // Place the popover under the button, right-aligned with it; flip above when
  // there isn't room below, and keep it inside the window either way.
  useLayoutEffect(() => {
    if (!open || sheet || !triggerRef.current || !menuRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const m = menuRef.current.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    let top = t.bottom + gap;
    if (top + m.height > window.innerHeight - margin && t.top - gap - m.height >= margin) top = t.top - gap - m.height;
    top = Math.max(margin, Math.min(top, window.innerHeight - m.height - margin));
    const left = Math.max(margin, Math.min(t.right - m.width, window.innerWidth - m.width - margin));
    setPos({ top, left });
  }, [open, sheet, actions.length]);

  // Move focus into the menu once it is on screen.
  useEffect(() => {
    if (!open) return;
    const list = items();
    (focusOnOpen.current === 'last' ? list[list.length - 1] : list[0])?.focus();
  }, [open, pos === null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Anything that moves the button out from under an open popover closes it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return; // the menu's own scrolling
      if (!sheet) close(false);
    };
    const onResize = () => close(false);
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, sheet, close]);

  // Escape closes this menu only, not the drawer or dialog the page may have open behind it.
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

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusOnOpen.current = e.key === 'ArrowUp' ? 'last' : 'first';
      setOpen(true);
    }
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const list = items();
    if (list.length === 0) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      list[(n + list.length) % list.length].focus();
    };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i <= 0 ? list.length - 1 : i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(list.length - 1);
    else if (e.key === 'Tab') {
      e.preventDefault();
      close(true);
    } else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Typeahead: the next item whose label starts with the typed letter.
      const ch = e.key.toLowerCase();
      const ordered = [...list.slice(i + 1), ...list.slice(0, i + 1)];
      const hit = ordered.find((el) => el.textContent?.trim().toLowerCase().startsWith(ch));
      if (hit) {
        e.preventDefault();
        hit.focus();
      }
    }
  }

  function choose(action: RowAction) {
    // Close first and put focus back on the button, so a dialog this opens remembers the button as where to return to.
    close(true);
    action.onClick?.();
  }

  if (actions.length === 0) return null;

  const baseItem = 'flex w-full items-center gap-3 px-3 text-left text-sm outline-none transition-colors focus:bg-[var(--color-bg)] aria-disabled:cursor-not-allowed aria-disabled:opacity-45';
  const itemSize = sheet ? 'min-h-12' : 'min-h-10';

  const menu = (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label={heading ?? label}
      onKeyDown={onMenuKeyDown}
      onClick={(e) => e.stopPropagation()}
      className={
        sheet
          ? 'fixed inset-x-0 bottom-0 z-[71] max-h-[80vh] overflow-y-auto rounded-t-xl border-t pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-xl'
          : 'fixed z-[71] min-w-[13rem] max-w-[18rem] overflow-y-auto rounded-lg border py-1 shadow-lg'
      }
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        ...(sheet ? {} : { top: pos?.top ?? 0, left: pos?.left ?? 0, maxHeight: 'calc(100vh - 16px)', visibility: pos ? 'visible' : 'hidden' }),
      }}
    >
      {sheet && heading && (
        <p className="truncate px-4 pb-1 pt-3 text-xs font-medium uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.04em' }}>
          {heading}
        </p>
      )}
      {actions.map((a, i) => {
        const Icon = a.icon;
        const content = (
          <>
            {Icon && <Icon size={16} strokeWidth={2} aria-hidden style={{ flexShrink: 0 }} />}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{a.label}</span>
              {a.hint && (
                <span className="block text-xs" style={{ color: 'var(--color-ink-600)' }}>
                  {a.hint}
                </span>
              )}
            </span>
          </>
        );
        const common = {
          role: 'menuitem' as const,
          tabIndex: -1,
          'aria-disabled': a.disabled || undefined,
          className: `${baseItem} ${itemSize} ${a.hint ? 'py-1.5' : ''}`,
          style: { color: TONES[a.tone ?? 'default'] },
        };
        return (
          <div key={`${a.label}-${i}`}>
            {a.separatorBefore && i > 0 && <div role="separator" className="my-1 border-t" style={{ borderColor: 'var(--color-border)' }} />}
            {a.href && !a.disabled ? (
              <a {...common} href={a.href} {...(a.external ? { target: '_blank', rel: 'noreferrer' } : {})} onClick={() => close(false)}>
                {content}
              </a>
            ) : (
              <button {...common} type="button" onClick={() => (a.disabled ? undefined : choose(a))}>
                {content}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => {
          e.stopPropagation(); // the row itself opens the record; the menu button must not
          focusOnOpen.current = 'first';
          if (open) close(false);
          else setOpen(true);
        }}
        onKeyDown={onTriggerKeyDown}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-bg)] md:h-9 md:w-9"
        style={{ color: 'var(--color-ink-600)', backgroundColor: open ? 'var(--color-bg)' : undefined }}
      >
        <MoreVertical size={17} strokeWidth={2} aria-hidden />
      </button>
      {open &&
        createPortal(
          <>
            {sheet && <div aria-hidden className="fixed inset-0 z-[70]" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={(e) => { e.stopPropagation(); close(false); }} />}
            {menu}
          </>,
          document.body,
        )}
    </>
  );
}
