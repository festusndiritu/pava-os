import { LEVEL_TONE, type StockLevel } from '../../lib/stock';

export function StockBadge({ level }: { level: StockLevel | 'supplier' }) {
  const t = LEVEL_TONE[level];
  return (
    <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: t.bg, color: t.fg }}>
      {t.label}
    </span>
  );
}
