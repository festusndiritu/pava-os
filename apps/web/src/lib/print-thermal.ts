import { THERMAL_WIDTH_MM } from './thermal-config';

/**
 * Browser (driver) path: print the thermal receipt as ONE page exactly as
 * tall as the receipt.
 *
 * Why this is shaped the way it is:
 *  - Chromium does not honour `size: 72mm auto` for print; an `auto` height
 *    falls back to whatever page the driver is set to (72x210, 72x297 ...),
 *    the receipt is split across pages and the cutter fires at every break.
 *  - A fixed huge "user defined" page (2000/9999mm) is the opposite failure:
 *    the driver rasterises the whole page and feeds out blank paper (the
 *    stray dots) and can stall mid-print while it streams the bitmap.
 *  - So: measure the real height, hand the browser a page of exactly that
 *    size, and make sure NOTHING else in the stylesheets declares a page size
 *    for this element (a named `@page thermal { size: ... auto }` rule used
 *    to override the page injected here, which is what broke printing).
 */
const STYLE_ID = 'thermal-page-size';
const PX_PER_MM = 96 / 25.4;
// Slack so sub-pixel rounding can't push the last line onto a second page.
const SLACK_MM = 3;
const MAX_HEIGHT_MM = 3000;

export async function printThermal(): Promise<void> {
  const el = document.getElementById('print-area');
  if (!el) {
    window.print();
    return;
  }

  // Measuring before the monospace font loads gives a shorter height than
  // the printed one, which would spill the last lines onto a second page.
  try {
    await document.fonts?.ready;
  } catch {
    /* ignore — measure with whatever font is there */
  }

  const heightMm = Math.min(MAX_HEIGHT_MM, Math.ceil(el.getBoundingClientRect().height / PX_PER_MM) + SLACK_MM);

  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `@page { size: ${THERMAL_WIDTH_MM}mm ${heightMm}mm; margin: 0; }`;
  document.head.appendChild(style);

  const cleanup = () => {
    style.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  window.print();
}
