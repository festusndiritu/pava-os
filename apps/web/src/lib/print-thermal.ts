import { THERMAL_WIDTH_MM } from './thermal-config';

/**
 * Browser (driver) path: print the receipt as ONE page exactly as tall as the receipt.
 * Chromium ignores `size: 72mm auto`, and a huge fixed page makes the driver feed blank
 * paper, so the real height is measured and passed to @page. Nothing else may set a page size.
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

  // Measuring before the monospace font loads gives a shorter height than the printed one, which
  // would spill the last lines onto a second page.
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
