import type {
  FocusSchematicLayoutCandidate,
  FocusSchematicRectangle,
} from '@icarus-graph-explorer/focus-schematic';

import type {
  FocusSchematicConnectionEndpoint,
  FocusSchematicEndpointAttachmentGeometry,
  FocusSchematicEndpointPlan,
} from './types';

export type FocusSchematicEndpointAttachmentPolicy =
  'directional' | 'soft-cardinal-files';

const EPSILON = 1e-6;
const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function center(rectangle: FocusSchematicRectangle) {
  return {
    x: rectangle.x + rectangle.width / 2,
    y: rectangle.y + rectangle.height / 2,
  };
}

function rectangleForEndpoint(
  endpoint: FocusSchematicConnectionEndpoint,
  moduleById: ReadonlyMap<string, FocusSchematicRectangle>,
  nodeById: ReadonlyMap<string, FocusSchematicRectangle>,
): FocusSchematicRectangle | undefined {
  return endpoint.kind === 'visible-entity'
    ? nodeById.get(endpoint.projectionNodeId)
    : moduleById.get(endpoint.moduleId);
}

function resolveDirectionalAutoSide(
  ownModule: FocusSchematicRectangle,
  counterpartModule: FocusSchematicRectangle,
): 'left' | 'right' | 'top' | 'bottom' {
  const ownCenter = center(ownModule);
  const counterpartCenter = center(counterpartModule);
  if (counterpartCenter.x < ownCenter.x) return 'left';
  if (counterpartCenter.x > ownCenter.x) return 'right';
  return counterpartCenter.y < ownCenter.y ? 'top' : 'bottom';
}

/** Four deterministic angle sectors; horizontal wins exact 45-degree ties. */
export function focusSchematicSpatialCardinalSide(
  own: FocusSchematicRectangle,
  counterpart: FocusSchematicRectangle,
): 'left' | 'right' | 'top' | 'bottom' {
  const ownCenter = center(own);
  const counterpartCenter = center(counterpart);
  const dx = counterpartCenter.x - ownCenter.x;
  const dy = counterpartCenter.y - ownCenter.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

function attachmentPoint(
  rectangle: FocusSchematicRectangle,
  side: 'left' | 'right' | 'top' | 'bottom',
) {
  return side === 'left'
    ? { x: rectangle.x, y: rectangle.y + rectangle.height / 2 }
    : side === 'right'
      ? {
          x: rectangle.x + rectangle.width,
          y: rectangle.y + rectangle.height / 2,
        }
      : side === 'top'
        ? { x: rectangle.x + rectangle.width / 2, y: rectangle.y }
        : {
            x: rectangle.x + rectangle.width / 2,
            y: rectangle.y + rectangle.height,
          };
}

/**
 * Directional mode preserves HIER4A sides. Soft mode spatially classifies only
 * File/document and anonymous module-anchor endpoints from current geometry.
 */
export function createFocusSchematicEndpointAttachments(
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
  policy: FocusSchematicEndpointAttachmentPolicy = 'directional',
): readonly FocusSchematicEndpointAttachmentGeometry[] {
  const moduleById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const nodeById = new Map(
    candidate.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const one = (
    connectionId: string,
    endpointName: 'source' | 'target',
    endpoint: FocusSchematicConnectionEndpoint,
    counterpartEndpoint: FocusSchematicConnectionEndpoint,
  ): FocusSchematicEndpointAttachmentGeometry => {
    const ownModule = moduleById.get(endpoint.moduleId);
    const counterpartModule = moduleById.get(counterpartEndpoint.moduleId);
    if (ownModule === undefined || counterpartModule === undefined)
      throw new Error(
        `Attachment ${JSON.stringify(connectionId)} references a missing module.`,
      );
    const rectangle = rectangleForEndpoint(endpoint, moduleById, nodeById);
    const counterpartRectangle = rectangleForEndpoint(
      counterpartEndpoint,
      moduleById,
      nodeById,
    );
    if (rectangle === undefined || counterpartRectangle === undefined)
      throw new Error(
        `Attachment ${JSON.stringify(connectionId)} references a missing node.`,
      );
    const useCardinal =
      policy === 'soft-cardinal-files' &&
      (endpoint.kind === 'module-anchor' || endpoint.entityKind === 'document');
    const side = useCardinal
      ? focusSchematicSpatialCardinalSide(rectangle, counterpartRectangle)
      : endpoint.attachmentSide === 'auto'
        ? resolveDirectionalAutoSide(ownModule, counterpartModule)
        : endpoint.attachmentSide;
    return {
      connectionId,
      endpoint: endpointName,
      kind:
        endpoint.kind === 'visible-entity' ? 'visible-node' : 'module-anchor',
      projectionNodeId:
        endpoint.kind === 'visible-entity' ? endpoint.projectionNodeId : null,
      moduleId: endpoint.moduleId,
      side,
      ...attachmentPoint(rectangle, side),
    };
  };
  return endpointPlan.connections
    .flatMap((connection) => [
      one(connection.id, 'source', connection.source, connection.target),
      one(connection.id, 'target', connection.target, connection.source),
    ])
    .sort(
      (left, right) =>
        compareText(left.connectionId, right.connectionId) ||
        compareText(left.endpoint, right.endpoint),
    );
}

function properSegmentCrossing(
  first: readonly [number, number, number, number],
  second: readonly [number, number, number, number],
): boolean {
  const side = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
  ) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const [ax, ay, bx, by] = first;
  const [cx, cy, dx, dy] = second;
  const firstA = side(ax, ay, bx, by, cx, cy);
  const firstB = side(ax, ay, bx, by, dx, dy);
  const secondA = side(cx, cy, dx, dy, ax, ay);
  const secondB = side(cx, cy, dx, dy, bx, by);
  return firstA * firstB < -EPSILON && secondA * secondB < -EPSILON;
}

/** Counts straight primary segments using the attachment geometry under review. */
export function measureFocusSchematicAttachmentCrossings(
  endpointPlan: FocusSchematicEndpointPlan,
  attachments: readonly FocusSchematicEndpointAttachmentGeometry[],
): number {
  const byKey = new Map(
    attachments.map((attachment) => [
      `${attachment.connectionId}\0${attachment.endpoint}`,
      attachment,
    ]),
  );
  const segments = endpointPlan.connections.flatMap((connection) => {
    if (connection.role === 'secondary') return [];
    const source = byKey.get(`${connection.id}\0source`);
    const target = byKey.get(`${connection.id}\0target`);
    return source === undefined || target === undefined
      ? []
      : [
          {
            id: connection.id,
            source,
            target,
            segment: [source.x, source.y, target.x, target.y] as const,
          },
        ];
  });
  let crossings = 0;
  for (let left = 0; left < segments.length; left += 1)
    for (let right = left + 1; right < segments.length; right += 1) {
      const first = segments[left]!;
      const second = segments[right]!;
      if (
        (first.source.projectionNodeId !== null &&
          (first.source.projectionNodeId === second.source.projectionNodeId ||
            first.source.projectionNodeId ===
              second.target.projectionNodeId)) ||
        (first.target.projectionNodeId !== null &&
          (first.target.projectionNodeId === second.source.projectionNodeId ||
            first.target.projectionNodeId === second.target.projectionNodeId))
      )
        continue;
      if (properSegmentCrossing(first.segment, second.segment)) crossings += 1;
    }
  return crossings;
}

/** Exact crossing objective used while comparing bounded Soft candidates. */
export function measureFocusSchematicCandidateAttachmentCrossings(
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
  policy: FocusSchematicEndpointAttachmentPolicy,
): number {
  return measureFocusSchematicAttachmentCrossings(
    endpointPlan,
    createFocusSchematicEndpointAttachments(endpointPlan, candidate, policy),
  );
}
