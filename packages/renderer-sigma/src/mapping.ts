import type {
  ProjectedEntityNode,
  ProjectedNode,
  ProjectionNodeId,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

import {
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE,
  resolveGlobalLayoutSettings,
} from './settings';
import type {
  GlobalEdgeAttributes,
  GlobalLayoutSettings,
  GlobalNodeAttributes,
  GlobalReferenceStatus,
  GlobalRendererInput,
  GlobalSpatialMetadata,
} from './types';
import { stableUnit } from './deterministic';

const STATUS_COLORS = {
  resolved: '#7b8d96',
  unresolved: '#d6a23f',
  ambiguous: '#d97832',
  invalid: '#c34f5d',
} as const satisfies Record<GlobalReferenceStatus, string>;

/** Deterministic warm seed only; never persisted as knowledge or view truth. */
export function deterministicGlobalPosition(key: string): {
  readonly x: number;
  readonly y: number;
} {
  const angle = stableUnit(key, 2_166_136_261) * Math.PI * 2;
  const radius = 0.12 + Math.sqrt(stableUnit(key, 1_013_904_223)) * 0.88;
  return {
    x: Number((Math.cos(angle) * radius).toFixed(6)),
    y: Number((Math.sin(angle) * radius).toFixed(6)),
  };
}

export function folderKeyFromWorkspacePath(sourcePath: string): string {
  if (
    sourcePath.length === 0 ||
    sourcePath.startsWith('/') ||
    sourcePath.includes('\\') ||
    /^[A-Za-z]:\//u.test(sourcePath) ||
    sourcePath
      .split('/')
      .some(
        (segment) =>
          segment.length === 0 || segment === '.' || segment === '..',
      )
  ) {
    throw new Error(
      `Cannot derive a Global folder key from invalid workspace path ${JSON.stringify(sourcePath)}.`,
    );
  }
  const separator = sourcePath.lastIndexOf('/');
  return separator === -1 ? '.' : sourcePath.slice(0, separator);
}

export function deriveGlobalSpatialMetadata(
  projection: ViewProjection,
): GlobalSpatialMetadata {
  const folderKeyByProjectionNodeId = new Map<ProjectionNodeId, string>();
  for (const node of projection.nodes) {
    if (node.kind !== 'entity') continue;
    if (node.entityKind !== 'document') {
      throw new Error(
        `Global projection contains unsupported ${node.entityKind} node ${node.id}; Global must remain documents-only.`,
      );
    }
    folderKeyByProjectionNodeId.set(
      node.id,
      folderKeyFromWorkspacePath(node.sourcePath),
    );
  }
  return { folderKeyByProjectionNodeId };
}

function entityLabel(node: ProjectedEntityNode): string {
  if (node.title !== null) return node.title;
  const segments = node.sourcePath.split('/');
  return segments.at(-1) ?? node.sourcePath;
}

function referenceDegreeByNodeId(
  projection: ViewProjection,
): ReadonlyMap<string, number> {
  const degrees = new Map<string, number>();
  for (const edge of projection.edges) {
    if (edge.kind !== 'reference') continue;
    const weight = Math.max(1, edge.referenceIds.length);
    degrees.set(
      edge.sourceNodeId,
      (degrees.get(edge.sourceNodeId) ?? 0) + weight,
    );
    degrees.set(
      edge.targetNodeId,
      (degrees.get(edge.targetNodeId) ?? 0) + weight,
    );
  }
  return degrees;
}

function nodeAttributes(
  node: ProjectedNode,
  degree: number,
  folderKey: string | undefined,
  nodeSize: number,
  referenceDegreeSizeInfluence: number,
): GlobalNodeAttributes {
  const position = deterministicGlobalPosition(node.id);
  if (node.kind === 'reference-target') {
    return {
      ...position,
      size: Math.max(2, nodeSize * 0.62),
      color: STATUS_COLORS[node.status],
      label: node.rawTarget,
      nodeKind: 'diagnostic',
      entityId: null,
      sourcePath: null,
      status: node.status,
      folderKey: null,
      revealableDescendantCount: 0,
    };
  }
  if (node.entityKind !== 'document' || folderKey === undefined) {
    throw new Error(
      `Global renderer received non-document entity node ${node.id}.`,
    );
  }
  return {
    ...position,
    size:
      nodeSize + referenceDegreeSizeBoost(degree, referenceDegreeSizeInfluence),
    color: '#277b95',
    label: entityLabel(node),
    nodeKind: 'document',
    entityId: node.entityId,
    sourcePath: node.sourcePath,
    status: null,
    folderKey,
    revealableDescendantCount: node.revealableDescendantCount,
  };
}

const MAX_LEGACY_REFERENCE_DEGREE_BOOST = 4;
const MAX_STRONG_REFERENCE_DEGREE_BOOST = 6;

/**
 * Keeps the pre-VISUAL1A curve exact at the default 50%, then gives the upper
 * half of the product scale additional prominence without letting hubs grow
 * by more than six display-size units.
 */
export function referenceDegreeSizeBoost(
  degree: number,
  influence: number,
): number {
  const legacyBoost = Math.min(
    MAX_LEGACY_REFERENCE_DEGREE_BOOST,
    Math.log2(degree + 1) * 0.48,
  );
  const influenceScale =
    influence <= DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE
      ? influence / DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE
      : 1 +
        (influence - DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE) /
          (2 * DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE);
  return Math.min(
    MAX_STRONG_REFERENCE_DEGREE_BOOST,
    legacyBoost * influenceScale,
  );
}

function edgeAttributes(
  edge: ViewProjection['edges'][number],
  linkThickness: number,
): GlobalEdgeAttributes {
  if (edge.kind !== 'reference') {
    throw new Error(
      `Global renderer received hierarchy edge ${edge.id}; Global topology must remain documents-only references.`,
    );
  }
  return {
    size:
      linkThickness *
      (0.6 + Math.min(2.6, Math.log2(edge.referenceIds.length + 1) * 0.5)),
    color: STATUS_COLORS[edge.status],
    edgeKind: 'reference',
    status: edge.status,
    referenceCount: edge.referenceIds.length,
  };
}

export function mapProjectionToGlobal(
  projection: ViewProjection,
  settings: GlobalLayoutSettings = DEFAULT_GLOBAL_LAYOUT_SETTINGS,
): GlobalRendererInput {
  const resolvedSettings = resolveGlobalLayoutSettings(settings);
  const spatial = deriveGlobalSpatialMetadata(projection);
  const degrees = referenceDegreeByNodeId(projection);
  const nodeIds = new Set<string>();
  const nodes = projection.nodes.map((node) => {
    if (nodeIds.has(node.id)) {
      throw new Error(
        `Global renderer input has duplicate node ID ${node.id}.`,
      );
    }
    nodeIds.add(node.id);
    return {
      key: node.id,
      attributes: nodeAttributes(
        node,
        degrees.get(node.id) ?? 0,
        spatial.folderKeyByProjectionNodeId.get(node.id),
        resolvedSettings.nodeSize,
        resolvedSettings.referenceDegreeSizeInfluence,
      ),
    };
  });
  const edgeIds = new Set<string>();
  const edges = projection.edges.map((edge) => {
    if (edgeIds.has(edge.id)) {
      throw new Error(
        `Global renderer input has duplicate edge ID ${edge.id}.`,
      );
    }
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      throw new Error(
        `Global renderer edge ${edge.id} references a missing endpoint.`,
      );
    }
    return {
      key: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      attributes: edgeAttributes(edge, resolvedSettings.linkThickness),
    };
  });
  return { nodes, edges, projectionIssues: projection.issues };
}

export function resetGlobalSeedPositions(
  input: GlobalRendererInput,
): GlobalRendererInput {
  return {
    ...input,
    nodes: input.nodes.map((node) => ({
      ...node,
      attributes: {
        ...node.attributes,
        ...deterministicGlobalPosition(node.key),
      },
    })),
  };
}
