import type {
  ProjectedNode,
  ProjectedReferenceEdge,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

export type GlobalFixtureProfile =
  | 'product-small'
  | 'product-medium'
  | 'stress-1000'
  | 'stress-5000'
  | 'stress-10000'
  | 'stress-25000';

interface FixtureShape {
  readonly documents: number;
  readonly references: number;
  readonly diagnostics: boolean;
}

const FIXTURE_SHAPES = {
  'product-small': { documents: 100, references: 1_200, diagnostics: true },
  'product-medium': { documents: 500, references: 10_000, diagnostics: true },
  'stress-1000': { documents: 1_000, references: 2_000, diagnostics: false },
  'stress-5000': { documents: 5_000, references: 10_000, diagnostics: false },
  'stress-10000': {
    documents: 10_000,
    references: 20_000,
    diagnostics: false,
  },
  'stress-25000': {
    documents: 25_000,
    references: 50_000,
    diagnostics: false,
  },
} as const satisfies Record<GlobalFixtureProfile, FixtureShape>;

function entityId(index: number): string {
  return `synthetic-document-${String(index).padStart(5, '0')}`;
}

function nodeId(index: number): string {
  return JSON.stringify(['entity', entityId(index)]);
}

function documentNode(index: number): ProjectedNode {
  const cluster = index % 12;
  const sourcePath =
    cluster === 0
      ? `document-${index}.md`
      : cluster % 3 === 0
        ? `folder-${cluster % 4}/branch-${cluster}/document-${index}.md`
        : `folder-${cluster % 4}/document-${index}.md`;
  return {
    id: nodeId(index),
    kind: 'entity',
    entityId: entityId(index),
    entityKind: 'document',
    sourcePath,
    sourceStartLine: 1,
    title: null,
    revealableDescendantCount: 1 + (index % 8),
    internalReferenceIds: [],
    role: 'content',
    focusDistance: null,
  };
}

function statusFor(index: number): ProjectedReferenceEdge['status'] {
  if (index % 97 === 0) return 'invalid';
  switch (index % 3) {
    case 0:
      return 'resolved';
    case 1:
      return 'unresolved';
    default:
      return 'ambiguous';
  }
}

function resolvedTarget(
  source: number,
  edgeIndex: number,
  count: number,
): number {
  const clusterCount = 12;
  const activeCount = Math.max(2, Math.floor(count * 0.98));
  const cluster = source % clusterCount;
  const crossCluster = edgeIndex % 11 === 0;
  const target = crossCluster
    ? (cluster + 1 + (edgeIndex % (clusterCount - 1))) % clusterCount
    : (cluster + clusterCount * (edgeIndex + 1 + (source % 7))) % activeCount;
  if (target !== source) return target;
  return (target + clusterCount) % activeCount;
}

export function createGlobalFixtureProjection(
  profile: GlobalFixtureProfile,
): ViewProjection {
  const shape = FIXTURE_SHAPES[profile];
  const nodes: ProjectedNode[] = Array.from(
    { length: shape.documents },
    (_, index) => documentNode(index),
  );
  const diagnosticByKey = new Map<
    string,
    {
      readonly id: string;
      readonly status: 'unresolved' | 'ambiguous' | 'invalid';
      readonly rawTarget: string;
      readonly candidateEntityIds: readonly string[];
      readonly reasons: readonly string[];
      readonly referenceIds: string[];
    }
  >();
  const edges: ProjectedReferenceEdge[] = [];

  for (let index = 0; index < shape.references; index += 1) {
    const activeDocumentCount = Math.max(2, Math.floor(shape.documents * 0.98));
    const sourceIndex = index % activeDocumentCount;
    const sourceNodeId = nodeId(sourceIndex);
    const status = shape.diagnostics ? statusFor(index) : 'resolved';
    const referenceId = `synthetic-reference-${String(index).padStart(6, '0')}`;
    let targetNodeId: string;
    if (status === 'resolved') {
      targetNodeId = nodeId(
        resolvedTarget(
          sourceIndex,
          Math.floor(index / shape.documents),
          shape.documents,
        ),
      );
    } else {
      const rawTarget = `${status}-target-${sourceIndex % 20}`;
      const candidateEntityIds =
        status === 'ambiguous'
          ? [
              entityId((sourceIndex + 1) % shape.documents),
              entityId((sourceIndex + 2) % shape.documents),
            ].sort()
          : [];
      const diagnosticKey = JSON.stringify([
        'reference-target',
        sourceNodeId,
        status,
        rawTarget,
        candidateEntityIds,
      ]);
      let diagnostic = diagnosticByKey.get(diagnosticKey);
      if (diagnostic === undefined) {
        diagnostic = {
          id: diagnosticKey,
          status,
          rawTarget,
          candidateEntityIds,
          reasons: [`synthetic-${status}`],
          referenceIds: [],
        };
        diagnosticByKey.set(diagnosticKey, diagnostic);
      }
      diagnostic.referenceIds.push(referenceId);
      targetNodeId = diagnostic.id;
    }
    edges.push({
      id: JSON.stringify([
        'reference',
        sourceNodeId,
        targetNodeId,
        status,
        index,
      ]),
      kind: 'reference',
      sourceNodeId,
      targetNodeId,
      status,
      referenceIds: [referenceId],
    });
  }

  for (const diagnostic of diagnosticByKey.values()) {
    nodes.push({
      id: diagnostic.id,
      kind: 'reference-target',
      status: diagnostic.status,
      rawTarget: diagnostic.rawTarget,
      referenceIds: [...diagnostic.referenceIds].sort(),
      candidateEntityIds: diagnostic.candidateEntityIds,
      reasons: diagnostic.reasons,
    });
  }

  nodes.sort((left, right) => left.id.localeCompare(right.id));
  edges.sort((left, right) => left.id.localeCompare(right.id));
  return { nodes, edges, issues: [] };
}

export function mutateFixtureProjection(
  projection: ViewProjection,
  fraction: 0.01 | 0.1,
): ViewProjection {
  const mutationCount = Math.max(
    1,
    Math.floor(projection.nodes.length * fraction),
  );
  return {
    ...projection,
    nodes: projection.nodes.map((node, index) => {
      if (index >= mutationCount || node.kind !== 'entity') return node;
      return {
        ...node,
        revealableDescendantCount: node.revealableDescendantCount + 1,
      };
    }),
  };
}
