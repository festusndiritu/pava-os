/**
 * The PAVA brand mark (the hollow square-tube from ThermalBrandMark: an outer
 * square and an inner square, both stroked 3 on a 40-unit grid) drawn
 * straight into a 1-bit ESC/POS raster image — no canvas, no image file, so
 * it is crisp at 203dpi and identical on every machine.
 *
 * The image is full paper width with the mark centred, so it does not depend
 * on the printer honouring ESC a for raster images.
 */
function inSquare(x: number, y: number, a: number, b: number) {
  return x >= a && x < b && y >= a && y < b;
}

function inkAt(ux: number, uy: number) {
  const ring = (a: number, b: number, t: number) => inSquare(ux, uy, a - t / 2, b + t / 2) && !inSquare(ux, uy, a + t / 2, b - t / 2);
  return ring(6, 34, 3) || ring(14, 26, 3);
}

/** GS v 0 raster-image command. `widthDots` is the printable width: 576 for 80mm paper, 384 for 58mm. */
export function brandMarkRaster(widthDots = 576, heightDots = 96): Uint8Array {
  const widthBytes = Math.ceil(widthDots / 8);
  const w = widthBytes * 8;
  const pad = 4;
  const mark = heightDots - pad * 2;
  const unitsPerDot = 40 / mark;
  const x0 = Math.floor((w - mark) / 2);

  const out = new Uint8Array(8 + widthBytes * heightDots);
  out.set([0x1d, 0x76, 0x30, 0x00, widthBytes & 0xff, widthBytes >> 8, heightDots & 0xff, heightDots >> 8]);

  for (let y = 0; y < heightDots; y++) {
    for (let x = 0; x < w; x++) {
      const ux = (x - x0 + 0.5) * unitsPerDot;
      const uy = (y - pad + 0.5) * unitsPerDot;
      if (ux < 0 || uy < 0 || ux >= 40 || uy >= 40) continue;
      if (inkAt(ux, uy)) out[8 + y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return out;
}
