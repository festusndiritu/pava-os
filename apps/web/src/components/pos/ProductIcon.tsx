'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Blocks,
  CircleDashed,
  Cylinder,
  Disc3,
  Grid2x2,
  Hammer,
  Layers,
  PaintBucket,
  Pipette,
  Ruler,
  Square,
  Wrench,
  Zap,
} from 'lucide-react';
import type { Product } from '../../lib/products-api';

type IconTone = 'steel' | 'timber' | 'consumable' | 'tool' | 'neutral';

const TONE_STYLES: Record<IconTone, { fg: string; bg: string }> = {
  // Deliberately quiet: these read as a product class marker, not decoration.
  steel: { fg: 'var(--color-accent)', bg: 'var(--color-accent-soft)' },
  timber: { fg: 'var(--color-status-warn)', bg: 'var(--color-status-warnSoft)' },
  consumable: { fg: 'var(--color-status-ok)', bg: 'var(--color-status-okSoft)' },
  tool: { fg: 'var(--color-ink-600)', bg: 'var(--color-bg)' },
  neutral: { fg: 'var(--color-ink-600)', bg: 'var(--color-bg)' },
};

// Shape is the catalogue's own structured field, so it is the most reliable
// signal — matched first, before falling back to category and then to name
// keywords for products that predate the shape taxonomy.
const SHAPE_ICONS: Record<string, { icon: LucideIcon; tone: IconTone }> = {
  SQUARE_TUBE: { icon: Square, tone: 'steel' },
  RECT_TUBE: { icon: Grid2x2, tone: 'steel' },
  ROUND_TUBE: { icon: Cylinder, tone: 'steel' },
  ANGLE_BAR: { icon: Blocks, tone: 'steel' },
  FLAT_BAR: { icon: Ruler, tone: 'steel' },
  ROUND_BAR: { icon: CircleDashed, tone: 'steel' },
  DEFORMED_BAR: { icon: Ruler, tone: 'steel' },
  MARINE_BOARD: { icon: Layers, tone: 'timber' },
  NAIL: { icon: Hammer, tone: 'consumable' },
  CUTTING_DISC: { icon: Disc3, tone: 'tool' },
};

const KEYWORD_ICONS: { match: RegExp; icon: LucideIcon; tone: IconTone }[] = [
  { match: /(nail|screw|bolt|nut|washer|rivet)/i, icon: Hammer, tone: 'consumable' },
  { match: /(blade|disc|cutting|grind)/i, icon: Disc3, tone: 'tool' },
  { match: /(pipe|tube|conduit)/i, icon: Cylinder, tone: 'steel' },
  { match: /(sheet|board|ply|plate)/i, icon: Layers, tone: 'timber' },
  { match: /(weld|electrode|rod)/i, icon: Zap, tone: 'consumable' },
  { match: /(paint|primer|thinner|adhesive|sealant)/i, icon: PaintBucket, tone: 'consumable' },
  { match: /(hinge|handle|lock|bracket|tool|spanner)/i, icon: Wrench, tone: 'tool' },
  { match: /(wire|mesh|binding)/i, icon: Grid2x2, tone: 'steel' },
  { match: /(hose|nozzle|tap|valve)/i, icon: Pipette, tone: 'neutral' },
];

export function productIcon(product: Pick<Product, 'name' | 'displayName' | 'shape' | 'category'>) {
  const byShape = product.shape ? SHAPE_ICONS[product.shape] : undefined;
  if (byShape) return byShape;

  const haystack = `${product.category?.name ?? ''} ${product.displayName ?? ''} ${product.name}`;
  const byKeyword = KEYWORD_ICONS.find((entry) => entry.match.test(haystack));
  if (byKeyword) return { icon: byKeyword.icon, tone: byKeyword.tone };

  return { icon: Blocks, tone: 'neutral' as IconTone };
}

/**
 * Square icon tile used everywhere a product appears in the POS. PAVA does not
 * store product photography on purpose, so this is the product's real visual
 * identity rather than a placeholder waiting for an upload.
 */
export function ProductIcon({
  product,
  size = 44,
  className = '',
}: {
  product: Pick<Product, 'name' | 'displayName' | 'shape' | 'category'>;
  size?: number;
  className?: string;
}) {
  const { icon: Icon, tone } = productIcon(product);
  const colors = TONE_STYLES[tone];
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-md ${className}`}
      style={{ width: size, height: size, backgroundColor: colors.bg, color: colors.fg }}
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={1.75} />
    </span>
  );
}