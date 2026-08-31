import type {
  ProjectedEntityNode,
  ProjectedNode,
  ProjectionNodeId,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

import {
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
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

const STATUS_COLORS = {
  resolved: '#7b8d96',
  unresolved: '#d6a23f',
  ambiguous: '#d97832',
  invalid: '#c34f5d',
} as const satisfies Record<GlobalReferenceStatus, string>;

function hash32(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function unitFromHash(value: string, seed: number): number {
  return hash32(value, seed) / 0xffff_ffff;
}

/** Deterministic warm seed only; never persisted as knowledge or view truth. */
export function deterministicGlobalPosition(key: string): {
  readonly x: number;
  readonly y: number;
} {
  const angle = unitFromHash(key, 2_166_136_261) * Math.PI * 2;
  const radius = 0.12 + Math.sqrt(unitFromHash(key, 1_013_904_223)) * 0.88;
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
    size: nodeSize + Math.min(4, Math.log2(degree + 1) * 0.48),
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
