/**
 * Print the thermal receipt as ONE page exactly as tall as the receipt.
 *
 * Why this exists: the browser paginates to a fixed @page size, and `auto`
 * height is not honoured for print in Chromium. A receipt taller than the
 * driver's page was split into several pages, and the printer's auto-cutter
 * fires at every page break — so long receipts came out as separate strips
 * with lines lost at the seams. Measuring the real height and handing the
 * browser a page of precisely that size means there is no page break.
 */
const STYLE_ID = 'thermal-page-size';
const PAGE_WIDTH_MM = 80;
const PX_PER_MM = 96 / 25.4;

export function printThermal() {
  const el = document.getElementById('print-area');
  if (!el) {
    window.print();
    return;
  }

  // The element is hidden off-screen when not printing, so measure it with
  // the same width it will have on paper. +3mm of slack guards against
  // sub-pixel rounding spilling a last line onto a second page.
  const heightMm = Math.ceil(el.scrollHeight / PX_PER_MM) + 3;

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: ${PAGE_WIDTH_MM}mm ${heightMm}mm; margin: 0; }`;

  const cleanup = () => {
    style?.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  window.print();
}
