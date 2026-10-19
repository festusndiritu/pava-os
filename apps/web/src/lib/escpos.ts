import type { DocumentViewModel } from './document-view-model';
import { fmtNumber, money } from './format';
import { ESCPOS_DEFAULT_COLUMNS } from './thermal-config';

/**
 * ESC/POS receipt encoder. Produces the raw bytes a thermal printer
 * understands — no page size, no driver, no rasterising. The printer prints
 * exactly as many lines as there are and then cuts, whatever the length.
 *
 * Text only (plus bold / double-size for the total). Everything is forced to
 * plain ASCII so it prints correctly on any code page.
 */
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export interface EscPosOptions {
  /** Characters per line: 48 for 80mm paper (Font A), 32 for 58mm. */
  columns?: number;
  cut?: boolean;
  openDrawer?: boolean;
  /** A ready-made ESC/POS raster image (see escpos-logo.ts), printed first. */
  logo?: Uint8Array;
}

/** Make any string safe for a default code page: ASCII only, one line per \n. */
export function asciiSafe(s: string): string {
  return s
    .replace(/[\u00a0\u2007\u202f\u2009]/g, ' ')
    .replace(/[×✕]/g, 'x')
    .replace(/[–—−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e\n]/g, '?');
}

/** Word-wrap to `width`, honouring explicit newlines and hard-splitting long words. */
export function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of asciiSafe(text).split('\n')) {
    let line = '';
    for (let word of para.split(/\s+/).filter(Boolean)) {
      while (word.length > width) {
        if (line) {
          out.push(line);
          line = '';
        }
        out.push(word.slice(0, width));
        word = word.slice(width);
      }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= width) line += ' ' + word;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

class Builder {
  private bytes: number[] = [];
  raw(...b: number[]) {
    for (const x of b) this.bytes.push(x);
    return this;
  }
  bytesRaw(u: Uint8Array) {
    for (let i = 0; i < u.length; i++) this.bytes.push(u[i]);
    return this;
  }
  text(s: string) {
    for (const ch of asciiSafe(s)) this.bytes.push(ch.charCodeAt(0));
    return this;
  }
  line(s = '') {
    return this.text(s).raw(LF);
  }
  init() {
    return this.raw(ESC, 0x40);
  }
  align(a: 'left' | 'center' | 'right') {
    return this.raw(ESC, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2);
  }
  bold(on: boolean) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }
  /** GS ! n — character magnification (1 or 2 each way). */
  size(w: 1 | 2, h: 1 | 2) {
    return this.raw(GS, 0x21, ((w - 1) << 4) | (h - 1));
  }
  feed(n: number) {
    return this.raw(ESC, 0x64, n);
  }
  /** GS V 66 0 — feed to the cutter position, then partial cut. */
  cut() {
    return this.raw(GS, 0x56, 0x42, 0x00);
  }
  drawer() {
    return this.raw(ESC, 0x70, 0x00, 0x19, 0xfa);
  }
  build() {
    return Uint8Array.from(this.bytes);
  }
}

/** `left` ... `right` on one line; if it can't fit, wrap left and put right on its own line. */
function pair(left: string, right: string, cols: number): string[] {
  const l = asciiSafe(left);
  const r = asciiSafe(right);
  if (l.length + r.length + 1 <= cols) return [l + ' '.repeat(cols - l.length - r.length) + r];
  return [...wrap(l, cols), ' '.repeat(Math.max(0, cols - r.length)) + r];
}

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export function buildReceiptBytes(vm: DocumentViewModel, opts: EscPosOptions = {}): Uint8Array {
  const cols = opts.columns ?? ESCPOS_DEFAULT_COLUMNS;
  const rule = '-'.repeat(cols);
  const b = new Builder().init();
  b.raw(0x1b, 0x42, 0x01, 0x02); // ESC B n t — printer beeps once (200ms) as the receipt starts; ignored by printers without a buzzer
  if (opts.logo) b.align('center').bytesRaw(opts.logo);

  const center = (s: string) => wrap(s, cols).forEach((l) => b.line(l));

  // Header
  b.align('center').bold(true).size(2, 2);
  wrap(vm.letterhead.businessName.toUpperCase(), Math.floor(cols / 2)).forEach((l) => b.line(l)); // double width halves the columns
  b.size(1, 1).bold(false);
  if (vm.letterhead.address) center(vm.letterhead.address);
  if (vm.letterhead.phone) center(vm.letterhead.phone);
  b.line().bold(true);
  center(vm.title.toUpperCase());
  b.bold(false);
  center(vm.number);
  center(fmtDateTime(vm.createdAt));
  center(vm.isDeliveryNote ? `Deliver to: ${vm.customerName}` : vm.customerName);
  b.align('left').line(rule);

  if (vm.isDeliveryNote) {
    b.align('center');
    if (vm.customerAddress) center(vm.customerAddress);
    if (vm.customerPhone) center(vm.customerPhone);
    if (vm.sourceReference) center(`Order ref ${vm.sourceReference}`);
    b.align('left');
    for (const item of vm.items) {
      pair(item.description, `${fmtNumber(item.qty)} ${item.unitSymbol}`.trim(), cols).forEach((l) => b.line(l));
    }
    if (vm.notes) {
      b.line();
      wrap(vm.notes, cols).forEach((l) => b.line(l));
    }
    b.line(rule).align('center');
    b.line('Received by: ____________________');
    b.line('Name, signature & date');
  } else {
    for (const item of vm.items) {
      wrap(item.description, cols).forEach((l) => b.line(l));
      pair(`  ${fmtNumber(item.qty)} x ${money(item.unitPrice)}`, money(item.lineTotal), cols).forEach((l) => b.line(l));
    }
    b.line(rule);
    if (!vm.showTransportIncludedNote) pair('Subtotal', money(vm.subtotal), cols).forEach((l) => b.line(l));
    if (vm.showTransportLine) pair('Delivery', money(vm.transportAmount), cols).forEach((l) => b.line(l));
    if (vm.showTransportIncludedNote) b.align('center').line('Delivery included').align('left');

    b.bold(true);
    pair('TOTAL', money(vm.total), cols).forEach((l) => b.line(l));
    b.bold(false).align('center');
    b.line();
    if (vm.type === 'RECEIPT' && vm.paymentLabel) center(`Paid by ${vm.paymentLabel}`);
    if (vm.type !== 'RECEIPT' && vm.letterhead.paymentDetails) center(`How to pay: ${vm.letterhead.paymentDetails}`);
    if (vm.issuedByName) center(`Served by ${vm.issuedByName}`);
  }

  b.align('left').line(rule).align('center');
  center(vm.letterhead.footerText);
  b.align('left');

  b.feed(2);
  if (opts.openDrawer) b.drawer();
  if (opts.cut !== false) b.cut();
  return b.build();
}

/** A ruler plus sample lines, to confirm connection, width and cutter without a real sale. */
export function buildTestBytes(opts: EscPosOptions = {}): Uint8Array {
  const cols = opts.columns ?? ESCPOS_DEFAULT_COLUMNS;
  const b = new Builder().init();
  if (opts.logo) b.align('center').bytesRaw(opts.logo);
  b.align('center').bold(true).line('PRINTER TEST').bold(false);
  b.align('left');
  let ruler = '';
  for (let i = 1; i <= cols; i++) ruler += i % 10 === 0 ? String((i / 10) % 10) : String(i % 10);
  b.line(ruler).line('|' + ' '.repeat(cols - 2) + '|');
  pair('Left', 'Right', cols).forEach((l) => b.line(l));
  b.bold(true);
  pair('TOTAL', 'KSh 1,234', cols).forEach((l) => b.line(l));
  b.bold(false).line('If both edges of the ruler are visible,').line('the width is right.').feed(2);
  if (opts.cut !== false) b.cut();
  return b.build();
}
