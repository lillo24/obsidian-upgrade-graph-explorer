import type {
  ProjectedEntityNode,
  ProjectedNode,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

import { stableUnit } from './deterministic';
import type {
  LocalEdgeAttributes,
  LocalInputNode,
  LocalNodeAttributes,
  LocalNodeKind,
  LocalRendererInput,
} from './local-types';

const NODE_COLORS = {
  document: '#176f8a',
  section: '#6c63a8',
  block: '#6c7b80',
  diagnostic: '#c45b50',
} as const satisfies Record<LocalNodeKind, string>;

function entityLabel(node: ProjectedEntityNode): string {
  if (node.entityKind === 'section') return node.title ?? 'Untitled heading';
  if (node.entityKind === 'block')
    return `Block · line ${node.sourceStartLine}`;
  return node.sourcePath.split('/').at(-1) ?? node.sourcePath;
}

function nodeKind(node: ProjectedNode): LocalNodeKind {
  return node.kind === 'reference-target' ? 'diagnostic' : node.entityKind;
}

function nodeSize(kind: LocalNodeKind, root: boolean): number {
  if (root) return 8.4;
  switch (kind) {
    case 'document':
      return 6.4;
    case 'section':
      return 4.7;
    case 'block':
      return 3.1;
    case 'diagnostic':
      return 3.8;
  }
}

function mappedNode(node: ProjectedNode, rootEntityId: string): LocalInputNode {
  const kind = nodeKind(node);
  const root = node.kind === 'entity' && node.entityId === rootEntityId;
  const attributes: LocalNodeAttributes = {
    x: 0,
    y: 0,
    size: nodeSize(kind, root),
    color:
      node.kind === 'reference-target'
        ? node.status === 'unresolved'
          ? '#d6a23f'
          : node.status === 'ambiguous'
            ? '#d97832'
            : '#c34f5d'
        : NODE_COLORS[kind],
    label: node.kind === 'entity' ? entityLabel(node) : node.rawTarget,
    nodeKind: kind,
    entityId: node.kind === 'entity' ? node.entityId : null,
    sourcePath: node.kind === 'entity' ? node.sourcePath : null,
    status: node.kind === 'reference-target' ? node.status : null,
    root,
    revealableDescendantCount:
      node.kind === 'entity' ? node.revealableDescendantCount : 0,
  };
  return { key: node.id, attributes };
}

function mappedEdge(
  edge: ViewProjection['edges'][number],
): LocalRendererInput['edges'][number] {
  const referenceCount =
    edge.kind === 'reference' ? edge.referenceIds.length : 0;
  const attributes: LocalEdgeAttributes = {
    edgeKind: edge.kind,
    referenceCount,
    weight:
      edge.kind === 'hierarchy'
        ? 6
        : Math.max(1, Math.log2(referenceCount + 1)),
    size:
      edge.kind === 'hierarchy'
        ? 1.25
        : 0.65 + Math.min(1.6, Math.log2(referenceCount + 1) * 0.35),
    color: edge.kind === 'hierarchy' ? '#8b96a0' : '#91aab2',
  };
  return {
    key: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    attributes,
  };
}

export function mapProjectionToLocalTopology(
  projection: ViewProjection,
  rootEntityId: string,
): LocalRendererInput {
  const nodes = projection.nodes.map((node) => mappedNode(node, rootEntityId));
  const nodeKeys = new Set(nodes.map(({ key }) => key));
  const root = nodes.find(({ attributes }) => attributes.root);
  if (root === undefined) {
    throw new Error(
      `Local renderer could not find root document "${rootEntityId}" in the projection.`,
    );
  }
  if (nodes.length !== nodeKeys.size) {
    throw new Error('Local renderer input contains duplicate node IDs.');
  }
  const edges = projection.edges.map(mappedEdge);
  const edgeKeys = new Set<string>();
  for (const edge of edges) {
    if (edgeKeys.has(edge.key)) {
      throw new Error(
        `Local renderer input has duplicate edge ID ${edge.key}.`,
      );
    }
    edgeKeys.add(edge.key);
    if (!nodeKeys.has(edge.source) || !nodeKeys.has(edge.target)) {
      throw new Error(
        `Local renderer edge ${edge.key} references a missing endpoint.`,
      );
    }
  }
  return {
    rootNodeKey: root.key,
    nodes,
    edges,
    projectionIssues: projection.issues,
  };
}

function radialPosition(key: string, radius: number, seed: number) {
  const angle = stableUnit(key, seed) * Math.PI * 2;
  return {
    x: Number((Math.cos(angle) * radius).toFixed(6)),
    y: Number((Math.sin(angle) * radius).toFixed(6)),
  };
}

/** Deterministic, immediately renderable Local geometry; never persisted. */
export function seedLocalRendererInput(
  input: LocalRendererInput,
): LocalRendererInput {
  const positionByKey = new Map<string, { x: number; y: number }>([
    [input.rootNodeKey, { x: 0, y: 0 }],
  ]);
  const hierarchyParent = new Map(
    input.edges
      .filter(({ attributes }) => attributes.edgeKind === 'hierarchy')
      .map(({ source, target }) => [target, source]),
  );
  const nodeByKey = new Map(input.nodes.map((node) => [node.key, node]));

  for (const node of input.nodes) {
    if (node.key === input.rootNodeKey) continue;
    if (node.attributes.nodeKind === 'document') {
      positionByKey.set(node.key, radialPosition(node.key, 1.35, 0x9e37_79b9));
    }
  }
  const pending = new Set(
    input.nodes
      .filter(
        ({ key, attributes }) =>
          key !== input.rootNodeKey && attributes.nodeKind !== 'document',
      )
      .map(({ key }) => key),
  );
  for (let pass = 0; pass < input.nodes.length && pending.size > 0; pass += 1) {
    for (const key of [...pending].sort()) {
      const parentKey = hierarchyParent.get(key);
      const parent =
        parentKey === undefined ? undefined : positionByKey.get(parentKey);
      if (parentKey !== undefined && parent === undefined) continue;
      const kind = nodeByKey.get(key)?.attributes.nodeKind;
      const distance =
        kind === 'block' ? 0.22 : kind === 'diagnostic' ? 0.18 : 0.34;
      const offset = radialPosition(key, distance, 0x85eb_ca6b);
      positionByKey.set(key, {
        x: Number(((parent?.x ?? 0) + offset.x).toFixed(6)),
        y: Number(((parent?.y ?? 0) + offset.y).toFixed(6)),
      });
      pending.delete(key);
    }
  }
  for (const key of pending) {
    const source = input.edges.find(
      ({ target, attributes }) =>
        target === key && attributes.edgeKind === 'reference',
    )?.source;
    const base = source === undefined ? undefined : positionByKey.get(source);
    const offset = radialPosition(key, 0.2, 0xc2b2_ae35);
    positionByKey.set(key, {
      x: Number(((base?.x ?? 0) + offset.x).toFixed(6)),
      y: Number(((base?.y ?? 0) + offset.y).toFixed(6)),
    });
  }
  return {
    ...input,
    nodes: input.nodes.map((node) => ({
      ...node,
      attributes: {
        ...node.attributes,
        ...(positionByKey.get(node.key) ?? radialPosition(node.key, 1, 17)),
      },
    })),
  };
}

export function mapProjectionToLocal(
  projection: ViewProjection,
  rootEntityId: string,
): LocalRendererInput {
  return seedLocalRendererInput(
    mapProjectionToLocalTopology(projection, rootEntityId),
  );
}
