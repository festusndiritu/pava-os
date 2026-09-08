export type ThicknessMode = 'mm' | 'inch_fraction' | 'none';

export interface ThicknessOption {
  /** Always in mm, even for inch-fraction shapes — the schema's thicknessMm column is one consistent unit. */
  mm: number;
  label: string;
  /** Only set where the business actually names it by gauge, per Pava's own convention (1mm = 18G, 2mm = 16G). */
  gauge?: number;
}

export interface ShapeConfig {
  key: string;
  label: string;
  thicknessMode: ThicknessMode;
  thicknessOptions: ThicknessOption[];
  /** SHS/RHS/flat stock need width+height; round tube/bar/deformed bar are sized by nominalSize (diameter) alone. */
  hasWidthHeight: boolean;
}

const TUBE_THICKNESSES: ThicknessOption[] = [
  { mm: 1.0, label: '1.0mm', gauge: 18 },
  { mm: 1.2, label: '1.2mm' },
  { mm: 1.6, label: '1.6mm' },
  { mm: 2.0, label: '2.0mm', gauge: 16 },
  { mm: 2.5, label: '2.5mm' },
  { mm: 3.0, label: '3.0mm' },
];

// 1/8" and 3/16" — the two gauges Pava actually stocks for angle/line bars.
const ANGLE_THICKNESSES: ThicknessOption[] = [
  { mm: 3.175, label: '1/8"' },
  { mm: 4.7625, label: '3/16"' },
];

// Flat bars additionally come in 1/4".
const FLAT_THICKNESSES: ThicknessOption[] = [...ANGLE_THICKNESSES, { mm: 6.35, label: '1/4"' }];

const MARINE_BOARD_THICKNESSES: ThicknessOption[] = [
  { mm: 12, label: '12mm' },
  { mm: 15, label: '15mm' },
  { mm: 18, label: '18mm' },
  { mm: 25, label: '25mm' },
];

export const SHAPES: ShapeConfig[] = [
  { key: 'SQUARE_TUBE', label: 'Square Tube (SHS)', thicknessMode: 'mm', hasWidthHeight: true, thicknessOptions: TUBE_THICKNESSES },
  { key: 'RECT_TUBE', label: 'Rectangular Tube (RHS)', thicknessMode: 'mm', hasWidthHeight: true, thicknessOptions: TUBE_THICKNESSES },
  { key: 'ROUND_TUBE', label: 'Round Tube', thicknessMode: 'mm', hasWidthHeight: false, thicknessOptions: TUBE_THICKNESSES },
  { key: 'ANGLE_BAR', label: 'Angle Bar', thicknessMode: 'inch_fraction', hasWidthHeight: true, thicknessOptions: ANGLE_THICKNESSES },
  { key: 'FLAT_BAR', label: 'Flat Bar', thicknessMode: 'inch_fraction', hasWidthHeight: true, thicknessOptions: FLAT_THICKNESSES },
  { key: 'ROUND_BAR', label: 'Round Bar', thicknessMode: 'none', hasWidthHeight: false, thicknessOptions: [] },
  { key: 'DEFORMED_BAR', label: 'Deformed Bar', thicknessMode: 'none', hasWidthHeight: false, thicknessOptions: [] },
  { key: 'MARINE_BOARD', label: 'Marine Board', thicknessMode: 'mm', hasWidthHeight: true, thicknessOptions: MARINE_BOARD_THICKNESSES },
  { key: 'NAIL', label: 'Nail', thicknessMode: 'none', hasWidthHeight: false, thicknessOptions: [] },
  { key: 'CUTTING_DISC', label: 'Cutting Disc', thicknessMode: 'none', hasWidthHeight: false, thicknessOptions: [] },
  { key: 'OTHER', label: 'Other', thicknessMode: 'none', hasWidthHeight: false, thicknessOptions: [] },
];

export function shapeConfig(key?: string | null): ShapeConfig | undefined {
  return SHAPES.find((s) => s.key === key);
}

/** Finds the matching option label for a stored thicknessMm value under a given shape, e.g. (SQUARE_TUBE, 1.0) -> "1.0mm". */
export function thicknessLabel(shapeKey: string | null | undefined, thicknessMm: number | null | undefined): string | null {
  if (thicknessMm == null) return null;
  const cfg = shapeConfig(shapeKey);
  const match = cfg?.thicknessOptions.find((o) => Math.abs(o.mm - thicknessMm) < 0.001);
  return match?.label ?? `${thicknessMm}mm`;
}