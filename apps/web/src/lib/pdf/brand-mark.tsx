import { Svg, Rect } from '@react-pdf/renderer';
import { INK } from './theme';

/**
 * Direction B from the Phase 2 mark review: a hollow square-tube
 * cross-section (two concentric squares). Pure geometry, no gradients or
 * fine detail, so this same shape renders unmodified on the color PDF
 * letterhead here and on the thermal template (ThermalBrandMark).
 */
export function BrandMark({ size = 40, color = INK }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect x={6} y={6} width={28} height={28} fill="none" stroke={color} strokeWidth={3} />
      <Rect x={14} y={14} width={12} height={12} fill="none" stroke={color} strokeWidth={3} />
    </Svg>
  );
}
