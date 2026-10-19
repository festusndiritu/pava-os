/**
 * Ways to get raw ESC/POS bytes to a printer from the browser.
 *
 *  - WebUSB:  Chrome/Edge on Android, ChromeOS, Linux, macOS. On WINDOWS the
 *             OS printer driver owns the USB interface and the browser is
 *             refused ("Access denied") unless the printer is switched to the
 *             WinUSB driver (e.g. with Zadig) — which removes it from normal
 *             Windows printing. Use Web Serial or a print helper there.
 *  - Serial:  Web Serial — a USB-serial / Bluetooth-SPP virtual COM port.
 *  - Helper:  a tiny local program (tools/print-helper) that receives the
 *             bytes over http://127.0.0.1 and hands them to the Windows print
 *             spooler as a RAW job. The normal driver stays installed, so
 *             this is the practical route on a Windows PC with a USB printer.
 */
export type TransportMode = 'usb' | 'serial' | 'helper';

export class PrinterError extends Error {}

type Nav = Navigator & { usb?: any; serial?: any };
const nav = () => navigator as Nav;

const KEY_USB = 'pava.printer.usb';
const KEY_BAUD = 'pava.printer.baud';
const CHUNK = 4096;

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
    /* private mode — pairing still works for this session */
  }
}

export function getBaud(): number {
  const n = Number(read(KEY_BAUD));
  return Number.isFinite(n) && n > 0 ? n : 9600;
}
export function setBaud(n: number) {
  write(KEY_BAUD, String(n));
}

const KEY_HELPER_URL = 'pava.printer.helperUrl';
const KEY_HELPER_PRINTER = 'pava.printer.helperPrinter';

export function getHelperUrl(): string {
  return read(KEY_HELPER_URL) || 'http://127.0.0.1:9101';
}
export function setHelperUrl(v: string) {
  write(KEY_HELPER_URL, v.trim().replace(/\/+$/, ''));
}
/** Windows printer name; empty means "the PC's default printer". */
export function getHelperPrinter(): string {
  return read(KEY_HELPER_PRINTER) ?? '';
}
export function setHelperPrinter(v: string) {
  write(KEY_HELPER_PRINTER, v);
}

async function sendHelper(data: Uint8Array) {
  let res: Response;
  try {
    res = await fetch(`${getHelperUrl()}/print?printer=${encodeURIComponent(getHelperPrinter())}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: data as unknown as BodyInit,
    });
  } catch {
    throw new PrinterError('Cannot reach the print helper. Is it running on this PC? If Chrome asks to allow local network access, choose Allow.');
  }
  if (!res.ok) throw new PrinterError((await res.text().catch(() => '')) || `Print helper error ${res.status}`);
}

export async function listHelperPrinters(): Promise<{ name: string; isDefault: boolean }[]> {
  let res: Response;
  try {
    res = await fetch(`${getHelperUrl()}/printers`);
  } catch {
    throw new PrinterError('Cannot reach the print helper. Is it running on this PC?');
  }
  if (!res.ok) throw new PrinterError(`Print helper error ${res.status}`);
  return (await res.json()) as { name: string; isDefault: boolean }[];
}

const idOf = (d: { vendorId: number; productId: number }) => `${d.vendorId}:${d.productId}`;

async function pickUsbDevice(pair: boolean): Promise<any> {
  const usb = nav().usb;
  if (!usb) throw new PrinterError('This browser has no WebUSB. Use Chrome or Edge.');
  const saved = read(KEY_USB);
  const known: any[] = await usb.getDevices();
  const device =
    known.find((d) => idOf(d) === saved) ??
    known[0] ??
    (pair ? await usb.requestDevice({ filters: [{ classCode: 7 }, { classCode: 255 }] }) : null);
  if (!device) throw new PrinterError('No USB printer paired yet. Pair it under Settings > Receipt printer.');
  write(KEY_USB, idOf(device));
  return device;
}

async function sendUsb(data: Uint8Array, pair: boolean) {
  const device = await pickUsbDevice(pair);
  await device.open();
  let claimed: number | null = null;
  try {
    if (device.configuration === null) await device.selectConfiguration(1);
    let found: { iface: any; alt: any; ep: any } | null = null;
    for (const iface of device.configuration.interfaces) {
      for (const alt of iface.alternates) {
        const ep = alt.endpoints.find((e: any) => e.direction === 'out' && e.type === 'bulk');
        if (ep && !found) found = { iface, alt, ep };
      }
    }
    if (!found) throw new PrinterError('This USB device has no printable (bulk OUT) endpoint.');
    try {
      await device.claimInterface(found.iface.interfaceNumber);
    } catch (e) {
      throw new PrinterError(
        'The browser was not allowed to open the USB printer. On Windows the printer driver blocks WebUSB — use Serial instead, or switch the printer to the WinUSB driver.',
      );
    }
    claimed = found.iface.interfaceNumber;
    if (found.alt.alternateSetting !== 0) await device.selectAlternateInterface(claimed, found.alt.alternateSetting);
    for (let i = 0; i < data.length; i += CHUNK) {
      await device.transferOut(found.ep.endpointNumber, data.slice(i, i + CHUNK));
    }
  } finally {
    try {
      if (claimed !== null) await device.releaseInterface(claimed);
      await device.close();
    } catch {
      /* already gone */
    }
  }
}

async function sendSerial(data: Uint8Array, pair: boolean) {
  const serial = nav().serial;
  if (!serial) throw new PrinterError('This browser has no Web Serial. Use Chrome or Edge.');
  const ports: any[] = await serial.getPorts();
  const port = ports[0] ?? (pair ? await serial.requestPort() : null);
  if (!port) throw new PrinterError('No serial printer paired yet. Pair it under Settings > Receipt printer.');
  await port.open({ baudRate: getBaud() });
  try {
    const writer = port.writable.getWriter();
    try {
      for (let i = 0; i < data.length; i += CHUNK) await writer.write(data.slice(i, i + CHUNK));
    } finally {
      writer.releaseLock();
    }
  } finally {
    await port.close();
  }
}

/** `pair` lets the browser show its device chooser if nothing is paired — only valid inside a click. */
export function sendBytes(mode: TransportMode, data: Uint8Array, pair = true): Promise<void> {
  if (mode === 'helper') return sendHelper(data);
  return mode === 'usb' ? sendUsb(data, pair) : sendSerial(data, pair);
}

/** Always shows the chooser, replacing any earlier pairing. */
export async function pairPrinter(mode: 'usb' | 'serial'): Promise<void> {
  if (mode === 'usb') {
    const usb = nav().usb;
    if (!usb) throw new PrinterError('This browser has no WebUSB. Use Chrome or Edge.');
    const device = await usb.requestDevice({ filters: [{ classCode: 7 }, { classCode: 255 }] });
    write(KEY_USB, idOf(device));
  } else {
    const serial = nav().serial;
    if (!serial) throw new PrinterError('This browser has no Web Serial. Use Chrome or Edge.');
    await serial.requestPort();
  }
}
