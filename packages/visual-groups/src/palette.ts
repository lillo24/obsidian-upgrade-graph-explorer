import type { VisualGroupColor, VisualGroupPaletteEntry } from './types';

export const VISUAL_GROUP_PALETTE = [
  { token: 'teal', label: 'Teal', accent: '#0f766e' },
  { token: 'blue', label: 'Blue', accent: '#2563eb' },
  { token: 'violet', label: 'Violet', accent: '#7c3aed' },
  { token: 'magenta', label: 'Magenta', accent: '#c026d3' },
  { token: 'red', label: 'Red', accent: '#dc2626' },
  { token: 'orange', label: 'Orange', accent: '#ea580c' },
  { token: 'amber', label: 'Amber', accent: '#d97706' },
  { token: 'green', label: 'Green', accent: '#16a34a' },
] as const satisfies readonly VisualGroupPaletteEntry[];

const PALETTE_BY_TOKEN = new Map<VisualGroupColor, VisualGroupPaletteEntry>(
  VISUAL_GROUP_PALETTE.map((entry) => [entry.token, entry]),
);

export function isVisualGroupColor(value: unknown): value is VisualGroupColor {
  return (
    typeof value === 'string' && PALETTE_BY_TOKEN.has(value as VisualGroupColor)
  );
}

export function visualGroupPaletteEntry(
  color: VisualGroupColor,
): VisualGroupPaletteEntry {
  const entry = PALETTE_BY_TOKEN.get(color);
  if (entry === undefined) {
    throw new Error(
      `Unsupported Visual Group color token ${JSON.stringify(color)}.`,
    );
  }
  return entry;
}
