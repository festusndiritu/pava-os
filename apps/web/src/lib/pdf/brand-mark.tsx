import { Svg, Rect, Image } from '@react-pdf/renderer';
import { INK } from './theme';

/**
 * Direction B from the Phase 2 mark review: a hollow square-tube
 * cross-section (two concentric squares). Pure geometry, no gradients or
 * fine detail, so this same shape renders unmodified on the thermal
 * template (ThermalBrandMark), which has no room for a raster image.
 */
export function BrandMark({ size = 40, color = INK }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect x={6} y={6} width={28} height={28} fill="none" stroke={color} strokeWidth={3} />
      <Rect x={14} y={14} width={12} height={12} fill="none" stroke={color} strokeWidth={3} />
    </Svg>
  );
}

/**
 * The real Pava logo (public/pava-logo.png — same file the poster loads
 * onto its canvas), used on every letterhead so a quote, invoice, receipt,
 * delivery note, and pricelist all carry the same mark as the poster.
 */
export function Logo({ size = 40 }: { size?: number }) {
  return <Image src="/pava-logo.png" style={{ width: size, height: size, objectFit: 'contain' }} />;
}
