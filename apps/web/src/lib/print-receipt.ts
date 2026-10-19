import type { DocumentViewModel } from './document-view-model';
import { buildReceiptBytes, buildTestBytes } from './escpos';
import { brandMarkRaster } from './escpos-logo';
import { PrinterError, sendBytes, type TransportMode } from './escpos-transport';
import { printThermal } from './print-thermal';
import { ESCPOS_DEFAULT_COLUMNS } from './thermal-config';
import { toast } from '../components/ui/Toast';

export type PrintMode = 'browser' | TransportMode;

const KEY_MODE = 'pava.printer.mode';
const KEY_COLS = 'pava.printer.columns';
const KEY_AUTO = 'pava.printer.auto';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function getPrintMode(): PrintMode {
  const m = read(KEY_MODE);
  return m === 'usb' || m === 'serial' || m === 'helper' ? m : 'browser';
}
export function setPrintMode(m: PrintMode) {
  write(KEY_MODE, m);
}
export function getColumns(): number {
  const n = Number(read(KEY_COLS));
  return Number.isInteger(n) && n >= 24 && n <= 80 ? n : ESCPOS_DEFAULT_COLUMNS;
}
export function setColumns(n: number) {
  write(KEY_COLS, String(n));
}

/** Print automatically when a sale completes (only ever applies to direct modes). */
export function getAutoPrint(): boolean {
  return read(KEY_AUTO) === '1';
}
export function setAutoPrint(on: boolean) {
  write(KEY_AUTO, on ? '1' : '0');
}

/** 80mm paper prints 576 dots across, 58mm prints 384. */
function escposOptions() {
  const columns = getColumns();
  return { columns, logo: brandMarkRaster(columns <= 32 ? 384 : 576) };
}

/**
 * The one entry point every Print button uses. Direct ESC/POS when a printer
 * has been set up on this device; otherwise (or if direct printing fails) the
 * browser path, so a receipt is never lost to a printer-setup problem.
 */
export async function printReceipt(vm: DocumentViewModel): Promise<void> {
  const mode = getPrintMode();
  if (mode === 'browser') return printThermal();
  try {
    await sendBytes(mode, buildReceiptBytes(vm, escposOptions()));
  } catch (e) {
    const why = e instanceof PrinterError ? e.message : e instanceof Error ? e.message : 'unknown error';
    toast.error(`Direct print failed (${why}). Opening the browser print instead.`);
    await printThermal();
  }
}

export async function printTestPage(): Promise<void> {
  const mode = getPrintMode();
  if (mode === 'browser') throw new PrinterError('Choose a direct mode first — the test page is sent straight to the printer.');
  await sendBytes(mode, buildTestBytes(escposOptions()));
}
