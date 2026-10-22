// Literal values only, never a theme variable — a PDF is a fixed document that has to look the same
// regardless of which theme the app happens to be running in when it's generated.
export const INK = '#111827';
export const MUTED = '#4b5563';
export const LABEL = '#6b7280';
export const LINE = '#d1d5db';
export const HAIRLINE = '#e5e7eb';
export const ACCENT = '#D88922';
export const PANEL = '#f3f4f6';

// mm, not pt — @react-pdf/renderer accepts CSS units directly, and mm reads the same as the
// measurements in the original design notes.
export const PAGE_PADDING = '16mm';
