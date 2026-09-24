'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

/**
 * The one overlay primitive behind every dialog, sheet and drawer in the app.
 *
 * What it guarantees, so each dialog doesn't have to (and used to forget to):
 *  - Escape closes the topmost overlay only (a confirm on top of a drawer
 *    closes first, the drawer stays)
 *  - Tab stays inside the topmost overlay
 *  - focus moves in on open and returns to whatever had it on close
 *  - the page behind stops scrolling while anything is open
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const FIELD =
  'input:not([disabled]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select:not([disabled]), textarea:not([disabled])';

const stack: symbol[] = [];
let lockCount = 0;
let savedOverflow = '';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
}

export function useOverlay(panelRef: RefObject<HTMLElement | null>, onEscape: () => void) {
  const escapeRef = useRef(onEscape);
  useEffect(() => {
    escapeRef.current = onEscape;
  });

  useEffect(() => {
    const panel = panelRef.current;
    const id = Symbol('overlay');
    stack.push(id);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (lockCount++ === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    if (panel && !panel.contains(document.activeElement)) {
      // A phone keyboard popping up over a form the moment it opens is worse
      // than tapping the first field, so only auto-focus fields with a mouse.
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      const target =
        panel.querySelector<HTMLElement>('[data-autofocus]') ??
        (coarse ? null : panel.querySelector<HTMLElement>(FIELD)) ??
        (coarse ? null : focusables(panel)[0]) ??
        panel;
      target.focus();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (stack[stack.length - 1] !== id) return;
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        escapeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = focusables(panel);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const at = stack.indexOf(id);
      if (at !== -1) stack.splice(at, 1);
      if (--lockCount === 0) document.body.style.overflow = savedOverflow;
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [panelRef]);
}

export function Modal({
  onClose,
  children,
  className = '',
  label,
  labelledBy,
  role = 'dialog',
  placement = 'sheet',
  dismissOnBackdrop = true,
}: {
  onClose: () => void;
  children: ReactNode;
  /** Panel sizing and layout (max width, padding, flex). Border, radius and colours come from here. */
  className?: string;
  label?: string;
  labelledBy?: string;
  role?: 'dialog' | 'alertdialog';
  /** "sheet" rises from the bottom on phones and centres from `sm` up; "center" always centres. */
  placement?: 'sheet' | 'center';
  /** Set false for anything holding typed input, so a stray tap outside can't throw it away. */
  dismissOnBackdrop?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlay(panelRef, onClose);

  const outer = placement === 'sheet' ? 'items-end sm:items-center sm:px-4' : 'items-center px-4';
  const radius = placement === 'sheet' ? 'rounded-t-xl sm:rounded-lg' : 'rounded-lg';

  return (
    <div className={`fixed inset-0 z-50 flex justify-center ${outer}`}>
      <div
        aria-hidden="true"
        className="pava-fade-in absolute inset-0"
        style={{ backgroundColor: 'rgba(16, 24, 40, 0.5)' }}
        onClick={dismissOnBackdrop ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`pava-rise relative w-full border outline-none ${radius} ${className}`}
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
      >
        {children}
      </div>
    </div>
  );
}
