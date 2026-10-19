/**
 * The real PAVA logo (steel I-beam inside a swoosh ring — public/pava-logo.png)
 * converted to a 1-bit 128x128 bitmap: ring solid black, beam outlined with
 * dithered shading. Embedded as packed bits so printing needs no image file,
 * no canvas and no network, and is identical on every machine.
 *
 * The image sent to the printer is full paper width with the mark centred, so
 * it does not depend on the printer honouring ESC a for raster images. A blank
 * strip under the mark keeps the business name from touching it.
 */
const MARK_SIZE = 128;
const GAP_DOTS = 16;
const MARK_BITS = Uint8Array.from(
  atob(
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA///AAAAAAAAAAAAAAAAAH////AAAAAAAAAAAAAAAA' +
  'P/////AAAAAAAAAAAAAAAf+Af//+AAAAAAAAAAAAAAfgAAD//4AAAAAAAAAAAAAeAAAAH//gAAAAAAAAAAAAcAf/+AH/+AAAAAAH' +
  '////8AD////Af/4AAAAABAAAAAgH////+B//gAAAAAQAAAAOH/////4H/8AAAAAEAAAADwf/////gf/wAAAABAAAAA+D/////+D/' +
  '+AAAAAIAAAAf4P/////4P/wAAAABAAA/X/B/AAP//B//AAAAAOAA///8IAAAP/8P/4AAAAAgAf/X/gAAAAf/h//AAAAAGAP///8A' +
  'AAAA/+P/4AAAAAwB//3/wAAAAD/x//AAAAACA////+AAAAAP+H/4AAAAAYH//9/4AAAAA/x//AAAAABD/////AAAAAH+P/wAAAAA' +
  'Qf//9/4AAAAAfx/+AAAAAEP/////gAAAAD+P/wAAAABB///9/8AAAAAfh/+AAAAAS//////wAAAAD8f/gAAAAEF3//9f+AAAAAfj' +
  '/8AAAABq//////4AAAAD8f/gAAAAVV////f/AAAAAfH/4AAAAH7//////4AAAAD4//AAAAB0FX///X/gAAAAeH/wAAAAfiv///+/' +
  '8AAAADx/+AAAAHwFX///3/wAAAA+P/gAAAB8Cv/////+AAAAHj/8AAAAfAFX///3/wAAAA8//AAAAHwCv//////AAAAHH/4AAAB8' +
  'AFX///1/4AAABx/+AAAAfgCv//////AAAAOP/wAAAH0ABXf//9/8AAADj/8AAAB+gAq//////gAAAc//AAAAVUAAXf//9f+AAAHH' +
  '/4AAAGvoAK//////wAAAx/+AAABD0AAVf///f/AAAMf/gAAAQ/oAK////7/4AADn/8AAAIH8AAVf///f/AAAY//AAAMA/oAK////' +
  '//8AAGP/wAAEAD9AAVf///X/gABj/8AP+AAqqAC//////+AAI//ACAAAABQAFf///3/wACP/4AgAAAAeAC//////+AAj/+AIAAAA' +
  'HwABV///1/4AI//gCAAAAD+gAr//////AAH/4AgAAAAfwABd///9/8AB/+AH//7uv+gAr//////gAf/gAVVVVX/wABV///9/8AH/' +
  '4AD6u/v//gAr//////wB//AAN9VX1/8ABV///9f+Ef/wAB/u7///oAr//////wH/8AAFFVVVf8AAV3//9f/B//AAA6qqqr/4AK//' +
  '////4//wAADFVVVf/AAV3///f+P/8AAQaqqqr/6AC//////j//AAEBAAERH/AAFX///34//gABAOIqqq/+ACv///++P/4AARggAA' +
  'BF/gAFX///3j/+AAGMGACIqv+ACv////4//gABjAQAAAB/wAFX///0f/4AAYwCAAAAP+ACv////H/+AAGOAYAAAAf4AFX///x//g' +
  'ABxgBAAAAD/gAv///4f/wAAMYAMAAAAP8AAVf/+P/8AADGAAgAAAA/gAK///j//AAA4wAGAAAAH8AAXf/w//wAAOMAAQAAAA/4AK' +
  '//8f/8AABhAADAAAAD/AAVf/H/+AAAcYAAIAAAAP4AK//j//gAAHCAABgAAAB/AAVf4//4AAA4gAAEAAAAP8AK/8f/8AAAOEAAAw' +
  'AAAAfgAFeH//AAADwAAACAAAAD+AC/j//wAAAcAAAAQAAAAfwAFQ//4AAAHgAAADqoAAD+AAsf/+AAAA4AAAAJEAAAPwACH//AAA' +
  'APAAAAB6qqog/gBD//wAAAB4AAAAHVVVRH8Ah//4AAAAfAAAAA///uq/gQ//+AAAADwAAAAD93VVX8EP//AAAAA+AAAAAf/////y' +
  'H//wAAAAHwAAAAB////d9D//4AAAAB+AAAAAP/////h//+AAAAAPwAAAAA/////w///AAAAAB+AAAAAH////4f//gAAAAAfwAAAA' +
  'Af///4P//wAAAAAD+AAAAAD///8H//8AAAAAAfwAAAAAf//8D//+AAAAAAD/AAAAAB//+D///AAAAAAAf4AAAAAP/+B///gAAAAA' +
  'AD/AAAAAA/+B///wAAAAAAA/8AAAAAH+A///4AAAAAAAH/wAAAAAcA///8AAAAAAAA//AAAAAAA///+AAAAAAAAD/8AAAAAA////' +
  'AAAAAAAAAf/4AAAAB////gAAAAAAAAD//wAAAD////wAAAAAAAAAf//wAAP////4AAAAAAAAAB//////////4AAAAAAAAAAP////' +
  '/////8AAAAAAAAAAA/////////8AAAAAAAAAAAH////////8AAAAAAAAAAAAf///////+AAAAAAAAAAAAB///////+AAAAAAAAAA' +
  'AAAH//////8AAAAAAAAAAAAAAP/////8AAAAAAAAAAAAAAAf////4AAAAAAAAAAAAAAAAf///gAAAAAAAAAAAAAAAAAH/4AAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  ),
  (c) => c.charCodeAt(0),
);

/** GS v 0 raster-image command. `widthDots` is the printable width: 576 for 80mm paper, 384 for 58mm. */
export function brandMarkRaster(widthDots = 576): Uint8Array {
  const widthBytes = Math.ceil(widthDots / 8);
  const markBytes = MARK_SIZE / 8;
  const x0 = Math.floor((widthBytes - markBytes) / 2); // byte offset that centres the mark
  const height = MARK_SIZE + GAP_DOTS;

  const out = new Uint8Array(8 + widthBytes * height);
  out.set([0x1d, 0x76, 0x30, 0x00, widthBytes & 0xff, widthBytes >> 8, height & 0xff, height >> 8]);
  for (let y = 0; y < MARK_SIZE; y++) {
    out.set(MARK_BITS.subarray(y * markBytes, (y + 1) * markBytes), 8 + y * widthBytes + x0);
  }
  return out;
}
