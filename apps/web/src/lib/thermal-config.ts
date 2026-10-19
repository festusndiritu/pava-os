/**
 * Single source of truth for the receipt paper geometry.
 *
 * An "80mm" thermal printer prints 72mm wide (576 dots at 203dpi) — that is
 * why the Windows driver offers 72x210 / 72x297 rather than 80mm presets.
 * The browser page, the on-paper layout and the driver's paper size all have
 * to agree on this width. If a different printer's driver form is 80mm wide,
 * change it here and nowhere else.
 */
export const THERMAL_WIDTH_MM = 72;
export const THERMAL_PADDING_MM = 2;

/** Characters per line for ESC/POS Font A on 72mm (80mm paper) = 48; 58mm paper = 32. */
export const ESCPOS_DEFAULT_COLUMNS = 48;
