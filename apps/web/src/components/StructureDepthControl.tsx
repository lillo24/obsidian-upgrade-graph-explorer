import type { StructuralDepth } from '@icarus-graph-explorer/view-projection';

import {
  applyStructureDepthSelection,
  STRUCTURAL_DEPTH_OPTIONS,
} from './structure-depth-selection';

export function StructureDepthControl({
  depth,
  onChange,
}: {
  readonly depth: StructuralDepth;
  readonly onChange: (depth: StructuralDepth) => void;
}) {
  return (
    <div aria-label="Structural depth" className="control-group" role="group">
      <label>
        Structure depth
        <select
          onChange={(event) =>
            applyStructureDepthSelection(event.currentTarget.value, onChange)
          }
          value={depth}
        >
          {STRUCTURAL_DEPTH_OPTIONS.map(({ depth: optionDepth, label }) => (
            <option key={optionDepth} value={optionDepth}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
