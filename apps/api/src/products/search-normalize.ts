// Applied to BOTH stored ProductAlias.term values and incoming search
// queries, so "1.5 inch square pipe", "1½\" square pipe" and "1 1/2 inch
// square pipe" all collapse to the same normalized string and a plain
// substring match finds the right family. See brief §9.
export function normalizeSearchTerm(raw: string): string {
  let s = raw.toLowerCase().trim();

  // Unicode fractions glued to a preceding digit: "1½" -> "1.5"
  s = s.replace(/(\d)\s*½/g, '$1.5').replace(/(\d)\s*¼/g, '$1.25').replace(/(\d)\s*¾/g, '$1.75');
  // Spaced fractions: "1 1/2" -> "1.5"
  s = s.replace(/(\d+)\s+1\/2\b/g, (_m, w) => String(Number(w) + 0.5));
  s = s.replace(/(\d+)\s+1\/4\b/g, (_m, w) => String(Number(w) + 0.25));
  s = s.replace(/(\d+)\s+3\/4\b/g, (_m, w) => String(Number(w) + 0.75));

  // Inch notation: 1.5" / 1.5in / 1.5 inch(es) -> "1.5 inch"
  s = s.replace(/(\d+(?:\.\d+)?)\s*(?:"|in\b|inch(?:es)?\b)/g, '$1 inch');

  // Gauge notation: "16 gauge" / "16-gauge" -> "16g" (canonical form)
  s = s.replace(/(\d+)\s*-?\s*gauge\b/g, '$1g');

  // Dimension pairs: "40 x 40" / "40×40" -> "40x40"
  s = s.replace(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/g, '$1x$2');

  return s.replace(/\s+/g, ' ').trim();
}

export interface ParsedSearchHints {
  gauge?: number;
  widthMm?: number;
  heightMm?: number;
  inchSize?: number;
}

// Pulls out anything that looks like a structured attribute from an already-
// normalized query, so e.g. searching "16g" also matches products via their
// `gauge` column even if no alias happens to contain that exact substring.
export function parseSearchHints(normalized: string): ParsedSearchHints {
  const hints: ParsedSearchHints = {};

  const gaugeMatch = normalized.match(/\b(\d+)g\b/);
  if (gaugeMatch) hints.gauge = Number(gaugeMatch[1]);

  const dimMatch = normalized.match(/\b(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)\b/);
  if (dimMatch) {
    hints.widthMm = Number(dimMatch[1]);
    hints.heightMm = Number(dimMatch[2]);
  }

  const inchMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s*inch\b/);
  if (inchMatch) hints.inchSize = Number(inchMatch[1]);

  return hints;
}