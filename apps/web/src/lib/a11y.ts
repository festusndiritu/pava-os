import type { KeyboardEvent } from 'react';

/** Makes a clickable row or card work from the keyboard: Enter or Space runs the same handler as a click. */
export function activateOnKey(handler: () => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  };
}
