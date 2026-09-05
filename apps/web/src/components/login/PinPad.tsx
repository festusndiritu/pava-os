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
  const inputRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // On a wrong PIN: shake the dots, then clear so the next attempt starts fresh.
  useEffect(() => {
    if (!error) return;
    setShake(true);
    const clearShake = setTimeout(() => setShake(false), 400);
    const clearPin = setTimeout(() => {
      setPin('');
      submittedRef.current = false;
      inputRef.current?.focus();
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
      // brief pause so the 4th dot is visible before we swap to a spinner/error
      setTimeout(() => onComplete(next), 120);
    }
  }

  function append(digit: string) {
    if (disabled) return;
    if (error) onErrorClear?.();
    commit((pin + digit).slice(0, 4));
  }

  function backspace() {
    if (disabled) return;
    if (error) onErrorClear?.();
    setPin((p) => p.slice(0, -1));
  }

  const keyStyle = {
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-ink-900)',
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Captures real keyboard input on desktop; visually hidden, kept focused */}
      <input
        ref={inputRef}
        value={pin}
        onChange={(e) => {
          if (disabled) return;
          if (error) onErrorClear?.();
          commit(e.target.value.replace(/\D/g, '').slice(0, 4));
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={4}
        disabled={disabled}
        className="sr-only"
        aria-label="4-digit PIN"
      />

      <div className={`flex gap-3 ${shake ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-full border transition-colors"
            style={{
              borderColor: error ? 'var(--color-status-bad)' : 'var(--color-ink-400)',
              backgroundColor:
                i < pin.length ? (error ? 'var(--color-status-bad)' : 'var(--color-ink-900)') : 'transparent',
            }}
          />
        ))}
      </div>

      <p className="h-5 text-xs font-medium" style={{ color: error ? 'var(--color-status-bad)' : 'var(--color-ink-400)' }}>
        {error ?? 'Enter your 4-digit PIN'}
      </p>

      <div className="grid grid-cols-3 gap-3" onClick={() => inputRef.current?.focus()}>
        {KEYS.map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => append(d)}
            className="h-14 w-14 rounded-full text-base font-medium border transition-colors active:scale-95 disabled:opacity-50"
            style={keyStyle}
          >
            {d}
          </button>
        ))}
        <span aria-hidden className="h-14 w-14" />
        <button
          type="button"
          disabled={disabled}
          onClick={() => append('0')}
          className="h-14 w-14 rounded-full text-base font-medium border transition-colors active:scale-95 disabled:opacity-50"
          style={keyStyle}
        >
          0
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={backspace}
          aria-label="Backspace"
          className="flex h-14 w-14 items-center justify-center rounded-full border transition-colors disabled:opacity-50"
          style={{ ...keyStyle, color: 'var(--color-ink-400)' }}
        >
          <Delete size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}