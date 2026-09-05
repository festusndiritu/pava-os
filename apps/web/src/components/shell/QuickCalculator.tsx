'use client';

import { useEffect, useRef, useState } from 'react';
import { Calculator as CalculatorIcon } from 'lucide-react';

type Operator = '+' | '−' | '×' | '÷';

function compute(a: number, b: number, op: Operator): number {
  switch (op) {
    case '+':
      return a + b;
    case '−':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return b === 0 ? NaN : a / b;
  }
}

function formatDisplay(value: string) {
  if (value === 'Error') return value;
  const num = Number(value);
  if (!Number.isFinite(num)) return 'Error';
  return Math.abs(num) >= 1e12 || (Math.abs(num) < 1e-9 && num !== 0)
    ? num.toExponential(4)
    : String(Math.round(num * 1e9) / 1e9);
}

export function QuickCalculator() {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState('0');
  const [stored, setStored] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [overwrite, setOverwrite] = useState(true);
  // Set right after "=" so the finished sum stays visible until the next digit.
  const [history, setHistory] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function inputDigit(d: string) {
    setHistory(null);
    if (display === 'Error' || overwrite) {
      setDisplay(d);
      setOverwrite(false);
    } else {
      setDisplay((prev) => (prev === '0' ? d : prev.length < 14 ? prev + d : prev));
    }
  }

  function inputDecimal() {
    setHistory(null);
    if (overwrite || display === 'Error') {
      setDisplay('0.');
      setOverwrite(false);
      return;
    }
    if (!display.includes('.')) setDisplay((prev) => prev + '.');
  }

  function clearAll() {
    setDisplay('0');
    setStored(null);
    setOperator(null);
    setOverwrite(true);
    setHistory(null);
  }

  function backspace() {
    if (overwrite || display === 'Error') return;
    setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  }

  function toggleSign() {
    if (display === 'Error') return;
    setDisplay((prev) => (prev.startsWith('-') ? prev.slice(1) : prev === '0' ? prev : `-${prev}`));
  }

  function percent() {
    if (display === 'Error') return;
    setDisplay((prev) => formatDisplay(String(Number(prev) / 100)));
  }

  function chooseOperator(next: Operator) {
    setHistory(null);
    const current = Number(display);
    if (operator && stored !== null && !overwrite) {
      const result = compute(stored, current, operator);
      setStored(result);
      setDisplay(formatDisplay(String(result)));
    } else {
      setStored(current);
    }
    setOperator(next);
    setOverwrite(true);
  }

  function equals() {
    if (operator === null || stored === null) return;
    const b = Number(display);
    const result = compute(stored, b, operator);
    setHistory(`${formatDisplay(String(stored))} ${operator} ${formatDisplay(String(b))} =`);
    setDisplay(formatDisplay(String(result)));
    setStored(null);
    setOperator(null);
    setOverwrite(true);
  }

  // Live running equation shown above the main display while mid-entry, e.g.
  // typing "12 × 4" shows exactly that before "=" is pressed. Once equals
  // fires, `history` takes over instead (see equals() above).
  const liveExpression =
    operator && stored !== null ? `${formatDisplay(String(stored))} ${operator}${overwrite ? '' : ' ' + display}` : '';
  const topLine = history ?? liveExpression;

  // Keyboard support, active only while the popover is open — mirrors the
  // PIN pad's approach of letting real typing drive the same handlers the
  // on-screen buttons use.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) {
        inputDigit(e.key);
      } else if (e.key === '.') {
        inputDecimal();
      } else if (e.key === '+') {
        chooseOperator('+');
      } else if (e.key === '-') {
        chooseOperator('−');
      } else if (e.key === '*') {
        chooseOperator('×');
      } else if (e.key === '/') {
        e.preventDefault(); // avoid triggering browser "quick find"
        chooseOperator('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        equals();
      } else if (e.key === 'Backspace') {
        backspace();
      } else if (e.key === 'Delete') {
        clearAll();
      } else if (e.key === 'Escape') {
        setOpen(false);
        return;
      } else if (e.key === '%') {
        percent();
      } else {
        return;
      }
      e.stopPropagation();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, display, stored, operator, overwrite]);

  const keyBase = 'h-10 rounded-md text-sm font-medium transition-colors active:scale-95';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Quick calculator"
        className="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
        style={{ backgroundColor: open ? 'var(--color-bg)' : 'transparent', color: 'var(--color-ink-600)' }}
      >
        <CalculatorIcon size={17} strokeWidth={2} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border p-3"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
        >
          <div className="mb-3 rounded-md px-3 py-2.5" style={{ backgroundColor: 'var(--color-bg)' }}>
            <div className="h-4 truncate text-right text-xs data-num" style={{ color: 'var(--color-ink-600)' }}>
              {topLine || '\u00A0'}
            </div>
            <div className="truncate text-right text-xl font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
              {display}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <button onClick={clearAll} className={keyBase} style={{ color: 'var(--color-status-bad)', backgroundColor: 'var(--color-bg)' }}>
              AC
            </button>
            <button onClick={toggleSign} className={keyBase} style={{ color: 'var(--color-ink-600)', backgroundColor: 'var(--color-bg)' }}>
              ±
            </button>
            <button onClick={percent} className={keyBase} style={{ color: 'var(--color-ink-600)', backgroundColor: 'var(--color-bg)' }}>
              %
            </button>
            <button
              onClick={() => chooseOperator('÷')}
              className={keyBase}
              style={{ color: operator === '÷' ? '#fff' : 'var(--color-accent)', backgroundColor: operator === '÷' ? 'var(--color-accent)' : 'var(--color-accent-soft)' }}
            >
              ÷
            </button>

            {['7', '8', '9'].map((d) => (
              <button key={d} onClick={() => inputDigit(d)} className={keyBase} style={{ color: 'var(--color-ink-900)', backgroundColor: 'var(--color-bg)' }}>
                {d}
              </button>
            ))}
            <button
              onClick={() => chooseOperator('×')}
              className={keyBase}
              style={{ color: operator === '×' ? '#fff' : 'var(--color-accent)', backgroundColor: operator === '×' ? 'var(--color-accent)' : 'var(--color-accent-soft)' }}
            >
              ×
            </button>

            {['4', '5', '6'].map((d) => (
              <button key={d} onClick={() => inputDigit(d)} className={keyBase} style={{ color: 'var(--color-ink-900)', backgroundColor: 'var(--color-bg)' }}>
                {d}
              </button>
            ))}
            <button
              onClick={() => chooseOperator('−')}
              className={keyBase}
              style={{ color: operator === '−' ? '#fff' : 'var(--color-accent)', backgroundColor: operator === '−' ? 'var(--color-accent)' : 'var(--color-accent-soft)' }}
            >
              −
            </button>

            {['1', '2', '3'].map((d) => (
              <button key={d} onClick={() => inputDigit(d)} className={keyBase} style={{ color: 'var(--color-ink-900)', backgroundColor: 'var(--color-bg)' }}>
                {d}
              </button>
            ))}
            <button
              onClick={() => chooseOperator('+')}
              className={keyBase}
              style={{ color: operator === '+' ? '#fff' : 'var(--color-accent)', backgroundColor: operator === '+' ? 'var(--color-accent)' : 'var(--color-accent-soft)' }}
            >
              +
            </button>

            <button onClick={backspace} className={keyBase} style={{ color: 'var(--color-ink-600)', backgroundColor: 'var(--color-bg)' }}>
              Del
            </button>
            <button onClick={() => inputDigit('0')} className={keyBase} style={{ color: 'var(--color-ink-900)', backgroundColor: 'var(--color-bg)' }}>
              0
            </button>
            <button onClick={inputDecimal} className={keyBase} style={{ color: 'var(--color-ink-900)', backgroundColor: 'var(--color-bg)' }}>
              .
            </button>
            <button onClick={equals} className={keyBase} style={{ color: '#fff', backgroundColor: 'var(--color-accent)' }}>
              =
            </button>
          </div>
        </div>
      )}
    </div>
  );
}