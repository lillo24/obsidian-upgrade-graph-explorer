import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';

import type { GraphFlowEdge } from './types';

function GraphEdgeComponent({
  data,
  id,
  markerEnd,
  sourcePosition,
  sourceX,
  sourceY,
  style,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps<GraphFlowEdge>) {
  if (data === undefined) {
    throw new Error(`Renderer edge ${id} is missing graph edge data.`);
  }
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: data.visualVariant === 'compact-schematic' ? 3 : 10,
  });
  const diagnosticMarker =
    data.status === 'unresolved'
      ? '?'
      : data.status === 'ambiguous'
        ? '≋'
        : data.status === 'invalid'
          ? '!'
          : null;
  const showCount = data.kind === 'reference' && data.referenceCount > 1;

  return (
    <>
      <BaseEdge
        className={`graph-edge-path graph-edge-path--${data.kind}${
          data.status === null ? '' : ` graph-edge-path--${data.status}`
        }${data.visualVariant === 'compact-schematic' ? ' graph-edge-path--compact-schematic' : ''}`}
        id={id}
        markerEnd={markerEnd ?? ''}
        path={path}
        style={style ?? {}}
      />
      {diagnosticMarker === null && !showCount ? null : (
        <EdgeLabelRenderer>
          <span
            aria-hidden="true"
            className={`graph-edge-label graph-edge-label--${data.status ?? data.kind} nopan nodrag`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {diagnosticMarker}
            {showCount ? `×${data.referenceCount}` : null}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const GraphEdge = memo(GraphEdgeComponent);
