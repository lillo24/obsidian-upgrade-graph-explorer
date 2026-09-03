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
      <legend>Size</legend>
      <div className="network-node-size__range">
        <span aria-hidden="true">{NODE_SIZE_SCALE_RANGE.min.toFixed(2)}×</span>
        <input
          aria-describedby={`${id}-help ${id}-status`}
          aria-label="File size"
          aria-valuetext={`${value.toFixed(2)} times calculated Network size`}
          id={`${id}-scale`}
          max={NODE_SIZE_SCALE_RANGE.max}
          min={NODE_SIZE_SCALE_RANGE.min}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
          step="0.05"
          type="range"
          value={value}
        />
        <span aria-hidden="true">{NODE_SIZE_SCALE_RANGE.max.toFixed(2)}×</span>
      </div>
      <output
        aria-hidden="true"
        className="network-node-size__value"
        htmlFor={`${id}-scale`}
      >
        {value.toFixed(2)}×
      </output>
      <button
        aria-label="Reset size"
        onClick={() => onChange(undefined)}
        type="button"
      >
        Reset
      </button>
      <span className="visually-hidden" id={`${id}-help`}>
        Adjust this File relative to its calculated Network size.
      </span>
      <p id={`${id}-status`} className="network-node-size__status">
        {status}
      </p>
    </fieldset>
  );
}
