import {
  createLocalLayoutRequest,
  createGlobalConvergencePolicy,
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  deterministicGlobalPosition,
} from '@icarus-graph-explorer/renderer-sigma/core';
import type {
  GlobalFolderPriorAlgorithm,
  GlobalLayoutEdge,
  GlobalLayoutNode,
  GlobalLayoutRequest,
  LocalLayoutRequest,
} from '@icarus-graph-explorer/renderer-sigma/core';

import { focusSpacingFixtures } from './focus-spacing-fixtures';

export interface LocalConvergenceFixture {
  readonly mode: 'focus';
  readonly id: string;
  readonly description: string;
  readonly currentBudget: number;
  readonly request: Omit<LocalLayoutRequest, 'requestId'>;
}

export interface GlobalConvergenceFixture {
  readonly mode: 'global';
  readonly id: string;
  readonly description: string;
  readonly currentBudget: number;
  readonly request: Omit<GlobalLayoutRequest, 'requestId'>;
}

export type ConvergenceFixture =
  LocalConvergenceFixture | GlobalConvergenceFixture;

function localBudget(nodeCount: number): number {
  return nodeCount <= 100 ? 160 : nodeCount <= 500 ? 100 : 60;
}

export function focusConvergenceFixtures(): readonly LocalConvergenceFixture[] {
  return focusSpacingFixtures().map((fixture) => {
    const currentBudget = localBudget(fixture.input.nodes.length);
    return {
      mode: 'focus',
      id: `focus-${fixture.id}`,
      description: fixture.description,
      currentBudget,
      request: createLocalLayoutRequest(fixture.input),
    };
  });
}

interface GlobalFixtureDefinition {
  readonly id: string;
  readonly description: string;
  readonly nodeCount: number;
  readonly folders: readonly (string | undefined)[];
  readonly edges: readonly {
    readonly source: number;
    readonly target: number;
    readonly weight?: number;
  }[];
  readonly algorithm: GlobalFolderPriorAlgorithm;
}

function globalBudget(nodeCount: number): number {
  return nodeCount <= 1_000 ? 100 : nodeCount <= 5_000 ? 30 : 20;
}

function nodeKey(id: string, index: number): string {
  return `${id}-node-${index}`;
}

function globalFixture(
  definition: GlobalFixtureDefinition,
): GlobalConvergenceFixture {
  if (definition.folders.length !== definition.nodeCount) {
    throw new Error(
      `Global convergence fixture ${definition.id} has an invalid folder map.`,
    );
  }
  const nodes: GlobalLayoutNode[] = Array.from(
    { length: definition.nodeCount },
    (_, index) => {
      const key = nodeKey(definition.id, index);
      const position = deterministicGlobalPosition(key);
      const folderKey = definition.folders[index];
      return {
        key,
        ...position,
        size: 4.5,
        ...(folderKey === undefined ? {} : { folderKey }),
      };
    },
  );
  const edges: GlobalLayoutEdge[] = definition.edges.map((edge, index) => ({
    key: `${definition.id}-edge-${index}`,
    source: nodeKey(definition.id, edge.source),
    target: nodeKey(definition.id, edge.target),
    weight: edge.weight ?? 1,
  }));
  const folderClustering = definition.algorithm !== 'reference-only';
  return {
    mode: 'global',
    id: `global-${definition.id}`,
    description: definition.description,
    currentBudget: globalBudget(definition.nodeCount),
    request: {
      schemaVersion: 2,
      algorithm: definition.algorithm,
      policy: createGlobalConvergencePolicy(definition.nodeCount),
      macro:
        definition.algorithm === 'reference-only'
          ? {
              version: 'global-folder-none-v1',
              algorithm: 'reference-only',
              priorApplications: 0,
              feedback: 'output-only',
            }
          : {
              version: 'global-folder-fixed-field-v1',
              algorithm: definition.algorithm,
              priorApplications: 1,
              feedback: 'output-only',
            },
      settings: { ...DEFAULT_GLOBAL_LAYOUT_SETTINGS, folderClustering },
      nodes,
      edges,
    },
  };
}

function connectedEdges(count: number): GlobalFixtureDefinition['edges'] {
  const edges: {
    source: number;
    target: number;
    weight?: number;
  }[] = [];
  for (let index = 1; index < count; index += 1) {
    edges.push({
      source: Math.max(0, Math.floor((index - 1) / 2)),
      target: index,
      weight: index % 5 === 0 ? 2 : 1,
    });
  }
  for (let index = 3; index < count; index += 4) {
    edges.push({ source: index - 2, target: index, weight: 1 });
  }
  return edges;
}

function clusteredEdges(
  folderCount: number,
  perFolder: number,
  crossEdges: readonly [number, number][],
): GlobalFixtureDefinition['edges'] {
  const edges: {
    source: number;
    target: number;
    weight?: number;
  }[] = [];
  for (let folder = 0; folder < folderCount; folder += 1) {
    const start = folder * perFolder;
    for (let offset = 1; offset < perFolder; offset += 1) {
      edges.push({ source: start, target: start + offset, weight: 1 });
      if (offset > 1) {
        edges.push({ source: start + offset - 1, target: start + offset });
      }
    }
  }
  for (const [source, target] of crossEdges) {
    edges.push({ source, target, weight: 1 });
  }
  return edges;
}

function repeatedFolders(
  folderCount: number,
  perFolder: number,
): readonly string[] {
  return Array.from(
    { length: folderCount * perFolder },
    (_, index) => `synthetic/folder-${Math.floor(index / perFolder)}`,
  );
}

export function globalConvergenceFixtures(): readonly GlobalConvergenceFixture[] {
  const mediumConnected = 110;
  const mediumEdges = connectedEdges(mediumConnected);
  return [
    globalFixture({
      id: 'small-connected',
      description: 'Twelve-node connected reference graph',
      nodeCount: 12,
      folders: Array.from({ length: 12 }, () => undefined),
      edges: connectedEdges(12),
      algorithm: 'reference-only',
    }),
    globalFixture({
      id: 'small-isolates',
      description: 'Ten connected nodes plus six isolates',
      nodeCount: 16,
      folders: Array.from({ length: 16 }, () => undefined),
      edges: connectedEdges(10),
      algorithm: 'reference-only',
    }),
    globalFixture({
      id: 'medium-mixed',
      description: 'One hundred ten connected nodes plus ten isolates',
      nodeCount: 120,
      folders: Array.from({ length: 120 }, (_, index) =>
        index < mediumConnected
          ? `synthetic/region-${Math.floor(index / 22)}`
          : undefined,
      ),
      edges: mediumEdges,
      algorithm: 'reference-only',
    }),
    globalFixture({
      id: 'folder-off-reference-only',
      description: 'Three synthetic folders with clustering disabled',
      nodeCount: 24,
      folders: repeatedFolders(3, 8),
      edges: clusteredEdges(3, 8, [
        [7, 8],
        [15, 16],
        [3, 20],
      ]),
      algorithm: 'reference-only',
    }),
    globalFixture({
      id: 'folder-on-chunked-prior',
      description: 'Three synthetic folders with the production chunked prior',
      nodeCount: 24,
      folders: repeatedFolders(3, 8),
      edges: clusteredEdges(3, 8, [
        [7, 8],
        [15, 16],
        [3, 20],
      ]),
      algorithm: 'chunked-prior',
    }),
    globalFixture({
      id: 'multiple-folders-cross-references',
      description: 'Four folders with several cross-folder references',
      nodeCount: 36,
      folders: repeatedFolders(4, 9),
      edges: clusteredEdges(4, 9, [
        [2, 12],
        [5, 22],
        [14, 30],
        [17, 27],
        [8, 35],
      ]),
      algorithm: 'chunked-prior',
    }),
    globalFixture({
      id: 'weak-folder-clusters',
      description:
        'Four internally connected folders joined by three weak bridges',
      nodeCount: 48,
      folders: repeatedFolders(4, 12),
      edges: clusteredEdges(4, 12, [
        [11, 12],
        [23, 24],
        [35, 36],
      ]),
      algorithm: 'chunked-prior',
    }),
  ];
}

export function convergenceFixtures(): readonly ConvergenceFixture[] {
  return [...focusConvergenceFixtures(), ...globalConvergenceFixtures()];
}
