type Cell = string | number | null | undefined;

// A cell starting with = + - @ is read as a formula by Excel and Sheets, and
// product names are typed by people. Text cells get a leading apostrophe;
// real numbers (including negatives) are left alone.
function escapeCell(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  let s = String(cell);
  if (typeof cell === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Downloads rows as a UTF-8 CSV that Excel opens correctly (BOM included). */
export function downloadCsv(filename: string, rows: Cell[][]) {
  const body = rows.map((r) => r.map(escapeCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
