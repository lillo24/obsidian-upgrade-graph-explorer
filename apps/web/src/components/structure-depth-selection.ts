import type { StructuralDepth } from '@icarus-graph-explorer/view-projection';

export const STRUCTURAL_DEPTH_OPTIONS = [
  { depth: 0, label: 'Files only' },
  { depth: 1, label: '1 level' },
  { depth: 2, label: '2 levels' },
  { depth: 3, label: '3 levels' },
] as const satisfies readonly {
  readonly depth: StructuralDepth;
  readonly label: string;
}[];

function structuralDepthFromValue(value: string): StructuralDepth {
  const option = STRUCTURAL_DEPTH_OPTIONS.find(
    ({ depth }) => String(depth) === value,
  );
  if (option === undefined) {
    throw new Error(`Unknown Structure depth value "${value}".`);
  }
  return option.depth;
}

export function applyStructureDepthSelection(
  value: string,
  onChange: (depth: StructuralDepth) => void,
): void {
  onChange(structuralDepthFromValue(value));
}
