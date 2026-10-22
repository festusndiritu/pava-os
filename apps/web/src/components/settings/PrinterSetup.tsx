'use client';

import { useState } from 'react';
import { toast } from '../ui/Toast';
import {
  getBaud,
  getHelperPrinter,
  getHelperUrl,
  listHelperPrinters,
  pairPrinter,
  setBaud,
  setHelperPrinter,
  setHelperUrl,
} from '../../lib/escpos-transport';
import { getAutoPrint, getColumns, getPrintMode, printTestPage, setAutoPrint, setColumns, setPrintMode, type PrintMode } from '../../lib/print-receipt';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const labelClass = 'text-xs font-semibold uppercase';
const labelStyle = { color: 'var(--color-ink-600)', letterSpacing: '0.06em' };

const MODES: { value: PrintMode; label: string; hint: string }[] = [
  { value: 'helper', label: 'Print helper (Windows + USB) — recommended', hint: 'No print dialog. Sends ESC/POS straight to the Windows printer through a small program running on this PC.' },
  { value: 'browser', label: 'Browser print (driver)', hint: 'Uses the browser print dialog and the printer driver.' },
  { value: 'usb', label: 'Direct USB from the browser (WebUSB)', hint: 'Android/ChromeOS/Linux. On Windows needs the WinUSB driver.' },
  { value: 'serial', label: 'Direct serial / Bluetooth from the browser', hint: 'For a printer that shows up as a COM port.' },
];

export function PrinterSetup() {
  const [mode, setMode] = useState<PrintMode>(() => getPrintMode());
  const [columns, setCols] = useState(() => getColumns());
  const [baud, setBaudState] = useState(() => getBaud());
  const [auto, setAuto] = useState(() => getAutoPrint());
  const [helperUrl, setUrl] = useState(() => getHelperUrl());
  const [helperPrinter, setPrinterName] = useState(() => getHelperPrinter());
  const [printers, setPrinters] = useState<{ name: string; isDefault: boolean }[]>([]);
  const [busy, setBusy] = useState(false);

  function pick(m: PrintMode) {
    setMode(m);
    setPrintMode(m);
  }

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message || 'Printer error' : 'Printer error');
    } finally {
      setBusy(false);
    }
  }

  const direct = mode !== 'browser';

  return (
    <div className="mt-5 rounded-lg border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
        Receipt printer (this device)
      </h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
        Saved in this browser only.
      </p>

      <div className="mt-4 flex flex-col gap-2.5">
        {MODES.map((m) => (
          <label key={m.value} className="flex cursor-pointer items-start gap-2.5 text-sm" style={{ color: 'var(--color-ink-900)' }}>
            <input type="radio" name="print-mode" className="mt-1" checked={mode === m.value} onChange={() => pick(m.value)} />
            <span>
              <span className="font-medium">{m.label}</span>
              <span className="block text-xs" style={{ color: 'var(--color-ink-600)' }}>
                {m.hint}
              </span>
            </span>
          </label>
        ))}
      </div>

      {direct && (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className={labelClass} style={labelStyle}>
              Characters per line
              <select
                value={columns}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setCols(n);
                  setColumns(n);
                }}
                className="mt-1.5 block rounded-md border px-3 py-2 text-sm"
                style={inputStyle}
              >
                <option value={48}>48 — 80mm paper</option>
                <option value={42}>42 — 80mm, compact font</option>
                <option value={32}>32 — 58mm paper</option>
              </select>
            </label>

            {mode === 'serial' && (
              <label className={labelClass} style={labelStyle}>
                Baud rate
                <select
                  value={baud}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setBaudState(n);
                    setBaud(n);
                  }}
                  className="mt-1.5 block rounded-md border px-3 py-2 text-sm"
                  style={inputStyle}
                >
                  {[9600, 19200, 38400, 57600, 115200].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {mode === 'helper' && (
              <>
                <label className={labelClass} style={labelStyle}>
                  Helper address
                  <input
                    value={helperUrl}
                    onChange={(e) => setUrl(e.target.value)}
                    onBlur={() => setHelperUrl(helperUrl)}
                    className="mt-1.5 block w-56 rounded-md border px-3 py-2 text-sm normal-case"
                    style={inputStyle}
                  />
                </label>
                <label className={labelClass} style={labelStyle}>
                  Windows printer name
                  <input
                    value={helperPrinter}
                    list="pava-printers"
                    placeholder="(PC default printer)"
                    onChange={(e) => setPrinterName(e.target.value)}
                    onBlur={() => setHelperPrinter(helperPrinter)}
                    className="mt-1.5 block w-64 rounded-md border px-3 py-2 text-sm normal-case"
                    style={inputStyle}
                  />
                  <datalist id="pava-printers">
                    {printers.map((p) => (
                      <option key={p.name} value={p.name} />
                    ))}
                  </datalist>
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      setHelperUrl(helperUrl);
                      const list = await listHelperPrinters();
                      setPrinters(list);
                      if (!helperPrinter) {
                        const def = list.find((p) => p.isDefault);
                        if (def) {
                          setPrinterName(def.name);
                          setHelperPrinter(def.name);
                        }
                      }
                    }, 'Helper found')
                  }
                  className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
                >
                  Find printers
                </button>
              </>
            )}

            {(mode === 'usb' || mode === 'serial') && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => pairPrinter(mode), 'Printer paired')}
                className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
              >
                Pair printer
              </button>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() => run(printTestPage, 'Test page sent')}
              className="rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              Print test page
            </button>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm" style={{ color: 'var(--color-ink-900)' }}>
            <input
              type="checkbox"
              className="mt-1"
              checked={auto}
              onChange={(e) => {
                setAuto(e.target.checked);
                setAutoPrint(e.target.checked);
              }}
            />
            <span>
              <span className="font-medium">Print automatically when a sale completes</span>
            </span>
          </label>
        </>
      )}
    </div>
  );
}
