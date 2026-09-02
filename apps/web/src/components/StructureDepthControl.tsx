import type { StructuralDepth } from '@icarus-graph-explorer/view-projection';

import {
  applyStructureDepthSelection,
  STRUCTURAL_DEPTH_OPTIONS,
} from './structure-depth-selection';

export function StructureDepthControl({
  custom,
  depth,
  onChange,
}: {
  readonly custom: boolean;
  readonly depth: StructuralDepth;
  readonly onChange: (depth: StructuralDepth) => void;
}) {
  return (
    <div aria-label="Hierarchy depth" className="control-group" role="group">
      <label>
        Hierarchy depth
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
      {custom ? <span className="depth-custom-indicator">Custom</span> : null}
    </div>
  );
}
