import { useId } from 'react';
import { NODE_SIZE_SCALE_RANGE } from '@icarus-graph-explorer/presentation-overrides';

export interface NodeSizeControlProps {
  readonly sizeScale: number | undefined;
  readonly status: string;
  readonly disabled: boolean;
  readonly onChange: (sizeScale: number | undefined) => void;
}

/** Controlled editor content for the shared Node actions surface. */
export function NodeSizeControl({
  sizeScale,
  status,
  disabled,
  onChange,
}: NodeSizeControlProps) {
  const id = useId();
  const value = sizeScale ?? 1;
  return (
    <fieldset className="network-node-size" disabled={disabled}>
      <legend>Network size</legend>
      <p id={`${id}-status`} className="network-node-size__status">
        {status}
      </p>
      <label>
        Size
        <select
          aria-describedby={`${id}-status`}
          onChange={(event) =>
            onChange(event.target.value === 'auto' ? undefined : 1)
          }
          value={sizeScale === undefined ? 'auto' : 'custom'}
        >
          <option value="auto">Auto</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      {sizeScale === undefined ? null : (
        <label>
          Size multiplier{' '}
          <output htmlFor={`${id}-scale`}>{value.toFixed(2)}×</output>
          <input
            aria-valuetext={`${value.toFixed(2)} times automatic Network size`}
            id={`${id}-scale`}
            max={NODE_SIZE_SCALE_RANGE.max}
            min={NODE_SIZE_SCALE_RANGE.min}
            onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
            step="0.05"
            type="range"
            value={value}
          />
        </label>
      )}
      <p className="network-node-size__status">
        Relative to automatic Network size. Focus roots retain a minimum
        emphasis. Auto removes this override.
      </p>
    </fieldset>
  );
}
