import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getStraightPath,
  type Position,
  type EdgeProps,
} from '@xyflow/react';

import type {
  GraphEdgePathStyle,
  GraphFlowEdge,
  GraphVisualVariant,
} from './types';

export interface GraphEdgePathInput {
  readonly routeStyle: GraphEdgePathStyle | undefined;
  readonly sourcePosition: Position;
  readonly sourceX: number;
  readonly sourceY: number;
  readonly targetPosition: Position;
  readonly targetX: number;
  readonly targetY: number;
  readonly visualVariant: GraphVisualVariant;
}

/** Keeps path selection at the renderer seam; geometry and endpoint identity stay intact. */
export function graphEdgePath({
  routeStyle,
  sourcePosition,
  sourceX,
  sourceY,
  targetPosition,
  targetX,
  targetY,
  visualVariant,
}: GraphEdgePathInput) {
  if (routeStyle === 'direct')
    return getStraightPath({ sourceX, sourceY, targetX, targetY });
  return getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: visualVariant === 'compact-schematic' ? 3 : 10,
  });
}

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
  const [path, labelX, labelY] = graphEdgePath({
    routeStyle: data.routeStyle,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    visualVariant: data.visualVariant,
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
        }${data.visualVariant === 'compact-schematic' ? ' graph-edge-path--compact-schematic' : ''}${data.routeStyle === undefined ? '' : ` graph-edge-path--${data.routeStyle}`}`}
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
