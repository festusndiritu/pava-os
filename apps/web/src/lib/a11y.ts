import type { KeyboardEvent } from 'react';

/**
 * Makes a clickable row or card work from the keyboard: Enter or Space runs
 * the same handler as a click. Ignores keys pressed inside a nested control
 * (the row's own edit/archive buttons) so those keep their own behaviour.
 * Pair it with tabIndex={0} so the row can be reached with Tab at all.
 */
export function activateOnKey(handler: () => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  };
}
