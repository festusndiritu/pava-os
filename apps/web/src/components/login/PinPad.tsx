'use client';

import { useEffect, useRef, useState } from 'react';
import { Delete } from 'lucide-react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinPad({
  onComplete,
  error,
  disabled,
  onErrorClear,
}: {
  onComplete: (pin: string) => void;
  error?: string | null;
  disabled?: boolean;
  onErrorClear?: () => void;
}) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const submittedRef = useRef(false);

  // Support physical keyboards on desktop without using a
  // focusable input, which would trigger the mobile keyboard.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (disabled) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        append(e.key);
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        backspace();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [disabled, pin, error]);

  // On a wrong PIN: shake the dots, then clear so the next attempt
  // starts fresh.
  useEffect(() => {
    if (!error) return;

    setShake(true);

    const clearShake = setTimeout(() => {
      setShake(false);
    }, 400);

    const clearPin = setTimeout(() => {
      setPin('');
      submittedRef.current = false;
    }, 450);

    return () => {
      clearTimeout(clearShake);
      clearTimeout(clearPin);
    };
  }, [error]);

  function commit(next: string) {
    setPin(next);

    if (next.length === 4 && !submittedRef.current) {
      submittedRef.current = true;

      // Brief pause so the 4th dot is visible before
      // switching to the loading/error state.
      setTimeout(() => {
        onComplete(next);
      }, 120);
    }
  }

  function append(digit: string) {
    if (disabled || pin.length >= 4) return;

    if (error) {
      onErrorClear?.();
    }

    commit((pin + digit).slice(0, 4));
  }

  function backspace() {
    if (disabled) return;

    if (error) {
      onErrorClear?.();
    }

    setPin((current) => current.slice(0, -1));
    submittedRef.current = false;
  }

  const keyStyle = {
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-ink-900)',
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* PIN dots */}
      <div className={`flex gap-3 ${shake ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-full border transition-colors"
            style={{
              borderColor: error
                ? 'var(--color-status-bad)'
                : 'var(--color-ink-600)',
              backgroundColor:
                i < pin.length
                  ? error
                    ? 'var(--color-status-bad)'
                    : 'var(--color-ink-900)'
                  : 'transparent',
            }}
          />
        ))}
      </div>

      {/* Status / instruction */}
      <p
        className="h-5 text-xs font-medium"
        style={{
          color: error
            ? 'var(--color-status-bad)'
            : 'var(--color-ink-600)',
        }}
      >
        {error ?? 'Enter your 4-digit PIN'}
      </p>

      {/* Custom keypad */}
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => append(digit)}
            className="h-14 w-14 rounded-full border text-base font-medium transition-colors active:scale-95 disabled:opacity-50"
            style={keyStyle}
          >
            {digit}
          </button>
        ))}

        {/* Empty bottom-left slot */}
        <span aria-hidden className="h-14 w-14" />

        {/* Zero */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => append('0')}
          className="h-14 w-14 rounded-full border text-base font-medium transition-colors active:scale-95 disabled:opacity-50"
          style={keyStyle}
        >
          0
        </button>

        {/* Backspace */}
        <button
          type="button"
          disabled={disabled}
          onClick={backspace}
          aria-label="Backspace"
          className="flex h-14 w-14 items-center justify-center rounded-full border transition-colors disabled:opacity-50"
          style={{
            ...keyStyle,
            color: 'var(--color-ink-600)',
          }}
        >
          <Delete size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}