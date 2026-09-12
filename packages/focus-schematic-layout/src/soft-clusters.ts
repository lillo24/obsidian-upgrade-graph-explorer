import type {
  FocusSchematicLayoutCandidate,
  FocusSchematicRectangle,
} from '@icarus-graph-explorer/focus-schematic';

import {
  applyFocusSchematicInternalLayoutVariant,
  createFocusSchematicInternalLayoutEvidence,
  createFocusSchematicInternalLayoutRunStats,
} from './internal-layout-variants';
import {
  computeFocusSchematicRevision2LayoutAttempt,
  createFocusSchematicEndpointAttachments,
  evaluateFocusSchematicEndpointLayoutQuality,
} from './endpoint-facing';
import { evaluateFocusSchematicFolderBandQuality } from './folder-bands';
import { normalizeFocusSchematicSoftFolderStrength } from './policies';
import {
  buildFocusSchematicSoftFolderDisplayTree,
  canonicalFocusSchematicSoftFolderDisplayIntent,
  EMPTY_FOCUS_SCHEMATIC_SOFT_FOLDER_DISPLAY_INTENT,
  focusSchematicSoftFolderScopeMemberships,
} from './soft-folder-display';
import type {
  FocusSchematicComputedLayout,
  FocusSchematicEndpointPlan,
  FocusSchematicLayoutInput,
  FocusSchematicSoftClusterEvidence,
  FocusSchematicSoftClusterLayoutAttempt,
  FocusSchematicSoftClusterMetrics,
  FocusSchematicSoftClusterOptions,
  FocusSchematicSoftClusterStrength,
  FocusSchematicSoftFolderDisplayIntent,
  FocusSchematicSoftFolderDisplayTree,
  FocusSchematicSoftHierarchyForcePolicy,
} from './types';

export const FOCUS_SCHEMATIC_SOFT_CLUSTER_ITERATION_SCHEDULE = [
  36, 18,
] as const;
export const FOCUS_SCHEMATIC_SOFT_CLUSTER_ALGORITHM_VERSION = 4 as const;

const STRATEGY_ID = 'HIER4B-soft-folder-clusters' as const;
const HOP_SPACING = 520;
const MODULE_GAP = 72;
const EPSILON = 1e-6;

interface Position {
  x: number;
  y: number;
}

interface Pair {
  readonly a: string;
  readonly b: string;
  readonly count: number;
  readonly weight: number;
}

interface RelaxationStats {
  collisionCheckCount: number;
  collisionCorrectionCount: number;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function hashUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function center(rectangle: FocusSchematicRectangle): Position {
  return {
    x: rectangle.x + rectangle.width / 2,
    y: rectangle.y + rectangle.height / 2,
  };
}

function primaryPairs(endpointPlan: FocusSchematicEndpointPlan): Pair[] {
  const counts = new Map<string, { a: string; b: string; count: number }>();
  for (const connection of endpointPlan.connections) {
    if (connection.role === 'secondary') continue;
    const a =
      compareText(connection.sourceModuleId, connection.targetModuleId) <= 0
        ? connection.sourceModuleId
        : connection.targetModuleId;
    const b =
      a === connection.sourceModuleId
        ? connection.targetModuleId
        : connection.sourceModuleId;
    if (a === b) continue;
    const key = `${a}\u0000${b}`;
    const previous = counts.get(key);
    counts.set(key, { a, b, count: (previous?.count ?? 0) + 1 });
  }
  return [...counts.values()]
    .sort(
      (left, right) =>
        compareText(left.a, right.a) || compareText(left.b, right.b),
    )
    .map(({ a, b, count }) => ({
      a,
      b,
      count,
      weight: Math.min(4, 1 + Math.log2(count)),
    }));
}

function hopDistances(
  rootId: string,
  moduleIds: readonly string[],
  pairs: readonly Pair[],
) {
  const adjacent = new Map(moduleIds.map((id) => [id, [] as string[]]));
  for (const pair of pairs) {
    adjacent.get(pair.a)?.push(pair.b);
    adjacent.get(pair.b)?.push(pair.a);
  }
  for (const neighbors of adjacent.values()) neighbors.sort(compareText);
  const distances = new Map<string, number>([[rootId, 0]]);
  const queue = [rootId];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    const nextDistance = distances.get(current)! + 1;
    for (const neighbor of adjacent.get(current) ?? []) {
      if (distances.has(neighbor)) continue;
      distances.set(neighbor, nextDistance);
      queue.push(neighbor);
    }
  }
  return distances;
}

function translateModule(
  candidate: FocusSchematicLayoutCandidate,
  moduleId: string,
  dx: number,
  dy: number,
): FocusSchematicLayoutCandidate {
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) return candidate;
  return {
    ...candidate,
    modules: candidate.modules.map((module) =>
      module.moduleId === moduleId
        ? { ...module, x: module.x + dx, y: module.y + dy }
        : module,
    ),
    nodes: candidate.nodes.map((node) =>
      node.moduleId === moduleId
        ? { ...node, x: node.x + dx, y: node.y + dy }
        : node,
    ),
    routes: [],
  };
}

function placeAtCenters(
  candidate: FocusSchematicLayoutCandidate,
  positions: ReadonlyMap<string, Position>,
): FocusSchematicLayoutCandidate {
  let placed = candidate;
  for (const module of [...candidate.modules].sort((a, b) =>
    compareText(a.moduleId, b.moduleId),
  )) {
    const target = positions.get(module.moduleId);
    if (target === undefined) continue;
    const own = center(
      placed.modules.find(({ moduleId }) => moduleId === module.moduleId)!,
    );
    placed = translateModule(
      placed,
      module.moduleId,
      target.x - own.x,
      target.y - own.y,
    );
  }
  return placed;
}

function rootFileCenter(
  input: FocusSchematicLayoutInput,
  candidate: FocusSchematicLayoutCandidate,
): Position {
  const root = input.model.modules.find(
    ({ id }) => id === input.model.rootModuleId,
  );
  const document =
    root?.documentProjectionNodeId === null
      ? undefined
      : candidate.nodes.find(
          ({ projectionNodeId }) =>
            projectionNodeId === root?.documentProjectionNodeId,
        );
  const module = candidate.modules.find(
    ({ moduleId }) => moduleId === input.model.rootModuleId,
  );
  if (module === undefined)
    throw new Error('Soft Clusters could not find the root module.');
  return center(document ?? module);
}

function anchorRootFile(
  input: FocusSchematicLayoutInput,
  candidate: FocusSchematicLayoutCandidate,
) {
  const fileCenter = rootFileCenter(input, candidate);
  return {
    ...candidate,
    modules: candidate.modules.map((module) => ({
      ...module,
      x: module.x - fileCenter.x,
      y: module.y - fileCenter.y,
    })),
    nodes: candidate.nodes.map((node) => ({
      ...node,
      x: node.x - fileCenter.x,
      y: node.y - fileCenter.y,
    })),
    routes: [],
  };
}

function initialPositions(
  input: FocusSchematicLayoutInput,
  candidate: FocusSchematicLayoutCandidate,
  hops: ReadonlyMap<string, number>,
): Map<string, Position> {
  return new Map(
    [...candidate.modules]
      .sort((a, b) => compareText(a.moduleId, b.moduleId))
      .map((module) => {
        if (module.moduleId === input.model.rootModuleId)
          return [module.moduleId, center(module)] as const;
        const semantic = input.model.modules.find(
          ({ id }) => id === module.moduleId,
        )!;
        const hop =
          hops.get(module.moduleId) ?? Math.max(1, semantic.focusDistance);
        const angle = hashUnit(`module:${module.moduleId}`) * Math.PI * 2;
        const radialJitter = (hashUnit(`radius:${module.moduleId}`) - 0.5) * 90;
        const radius = Math.max(HOP_SPACING, hop * HOP_SPACING + radialJitter);
        return [
          module.moduleId,
          { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius },
        ] as const;
      }),
  );
}

function displayTree(
  input: FocusSchematicLayoutInput,
  intent: FocusSchematicSoftFolderDisplayIntent,
): FocusSchematicSoftFolderDisplayTree {
  return buildFocusSchematicSoftFolderDisplayTree({
    visibleFiles: input.model.modules
      .filter(({ presentation }) => presentation !== 'filtered')
      .map(({ id, folderKey }) => ({ fileId: id, exactFolderKey: folderKey })),
    intent,
  });
}

function hierarchyFolderGroups(
  tree: FocusSchematicSoftFolderDisplayTree,
  strength: FocusSchematicSoftClusterStrength,
  policy: FocusSchematicSoftHierarchyForcePolicy,
  rootModuleId: string,
) {
  if (strength === 0)
    return new Map<
      string,
      readonly { readonly id: string; readonly weight: number }[]
    >();
  const groups = new Map<string, { id: string; weight: number }[]>();
  for (const [id, memberships] of focusSchematicSoftFolderScopeMemberships(
    tree,
    policy,
  )) {
    // The Focus File remains a displayed folder member, but it is the neutral
    // topology anchor and must not bias Soft folder-attraction centroids.
    if (id === rootModuleId) continue;
    for (const { folderKey, weight } of memberships) {
      const members = groups.get(folderKey) ?? [];
      members.push({ id, weight });
      groups.set(folderKey, members);
    }
  }
  return new Map(
    [...groups.entries()]
      .filter(([, members]) => members.length > 1)
      .sort(([a], [b]) => compareText(a, b)),
  );
}

function maximumFolderForceWeight(
  groups: ReadonlyMap<
    string,
    readonly { readonly id: string; readonly weight: number }[]
  >,
) {
  const weights = new Map<string, number>();
  for (const members of groups.values())
    for (const { id, weight } of members)
      weights.set(id, (weights.get(id) ?? 0) + weight);
  return Math.max(0, ...weights.values());
}

function collisionPass(
  modules: readonly FocusSchematicLayoutCandidate['modules'][number][],
  positions: Map<string, Position>,
  rootId: string,
  stats: RelaxationStats,
) {
  for (let leftIndex = 0; leftIndex < modules.length; leftIndex += 1) {
    const left = modules[leftIndex]!;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < modules.length;
      rightIndex += 1
    ) {
      const right = modules[rightIndex]!;
      stats.collisionCheckCount += 1;
      const a = positions.get(left.moduleId)!;
      const b = positions.get(right.moduleId)!;
      const overlapX =
        (left.width + right.width) / 2 + MODULE_GAP - Math.abs(b.x - a.x);
      const overlapY =
        (left.height + right.height) / 2 + MODULE_GAP - Math.abs(b.y - a.y);
      if (overlapX <= 0 || overlapY <= 0) continue;
      stats.collisionCorrectionCount += 1;
      const axis = overlapX < overlapY ? 'x' : 'y';
      const delta = axis === 'x' ? overlapX / 2 : overlapY / 2;
      const rawSign = axis === 'x' ? b.x - a.x : b.y - a.y;
      const sign =
        Math.abs(rawSign) > EPSILON
          ? Math.sign(rawSign)
          : hashUnit(`${left.moduleId}:${right.moduleId}:${axis}`) < 0.5
            ? -1
            : 1;
      const leftFixed = left.moduleId === rootId;
      const rightFixed = right.moduleId === rootId;
      const moveA = leftFixed ? 0 : rightFixed ? delta * 2 : delta;
      const moveB = rightFixed ? 0 : leftFixed ? delta * 2 : delta;
      positions.set(left.moduleId, {
        x: a.x - (axis === 'x' ? sign * moveA : 0),
        y: a.y - (axis === 'y' ? sign * moveA : 0),
      });
      positions.set(right.moduleId, {
        x: b.x + (axis === 'x' ? sign * moveB : 0),
        y: b.y + (axis === 'y' ? sign * moveB : 0),
      });
    }
  }
}

function packWithoutOverlaps(
  modules: readonly FocusSchematicLayoutCandidate['modules'][number][],
  positions: Map<string, Position>,
  rootId: string,
  stats: RelaxationStats,
) {
  const ordered = [...modules].sort((left, right) => {
    if (left.moduleId === rootId) return -1;
    if (right.moduleId === rootId) return 1;
    const leftPoint = positions.get(left.moduleId)!;
    const rightPoint = positions.get(right.moduleId)!;
    return (
      Math.hypot(leftPoint.x, leftPoint.y) -
        Math.hypot(rightPoint.x, rightPoint.y) ||
      compareText(left.moduleId, right.moduleId)
    );
  });
  const placed: { module: (typeof modules)[number]; point: Position }[] = [];
  for (const module of ordered) {
    const target = positions.get(module.moduleId)!;
    const phase = hashUnit(`pack:${module.moduleId}`) * Math.PI * 2;
    let selected: Position | undefined;
    for (let ring = 0; ring <= 160 && selected === undefined; ring += 1) {
      const sampleCount = ring === 0 ? 1 : 32;
      for (let sample = 0; sample < sampleCount; sample += 1) {
        const angle = phase + (sample / sampleCount) * Math.PI * 2;
        const radius = ring * 64;
        const point = {
          x: target.x + Math.cos(angle) * radius,
          y: target.y + Math.sin(angle) * radius,
        };
        const collision = placed.some(
          ({ module: other, point: otherPoint }) => {
            stats.collisionCheckCount += 1;
            return (
              Math.abs(point.x - otherPoint.x) <
                (module.width + other.width) / 2 + MODULE_GAP &&
              Math.abs(point.y - otherPoint.y) <
                (module.height + other.height) / 2 + MODULE_GAP
            );
          },
        );
        if (!collision) {
          selected = point;
          break;
        }
      }
    }
    if (selected === undefined)
      throw new Error(
        `Soft Clusters could not collision-pack module "${module.moduleId}" within the fixed candidate bound.`,
      );
    if (Math.hypot(selected.x - target.x, selected.y - target.y) > EPSILON)
      stats.collisionCorrectionCount += 1;
    positions.set(module.moduleId, selected);
    placed.push({ module, point: selected });
  }
}

function relax(
  input: FocusSchematicLayoutInput,
  candidate: FocusSchematicLayoutCandidate,
  starting: Map<string, Position>,
  pairs: readonly Pair[],
  hops: ReadonlyMap<string, number>,
  strength: FocusSchematicSoftClusterStrength,
  tree: FocusSchematicSoftFolderDisplayTree,
  hierarchyForcePolicy: FocusSchematicSoftHierarchyForcePolicy,
  iterations: number,
  stats: RelaxationStats,
) {
  const positions = new Map(starting);
  const seed = new Map(starting);
  const modules = [...candidate.modules].sort((a, b) =>
    compareText(a.moduleId, b.moduleId),
  );
  const sizeById = new Map(modules.map((module) => [module.moduleId, module]));
  const folderGroups = hierarchyFolderGroups(
    tree,
    strength,
    hierarchyForcePolicy,
    input.model.rootModuleId,
  );
  const folderFactor = strength / 100;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const changes = new Map(
      modules.map(({ moduleId }) => [moduleId, { x: 0, y: 0 }]),
    );
    for (const pair of pairs) {
      const a = positions.get(pair.a)!;
      const b = positions.get(pair.b)!;
      const aSize = sizeById.get(pair.a)!;
      const bSize = sizeById.get(pair.b)!;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distance = Math.hypot(dx, dy);
      if (distance < EPSILON) {
        const angle = hashUnit(`${pair.a}:${pair.b}`) * Math.PI * 2;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        distance = 1;
      }
      const desired =
        Math.hypot(
          (aSize.width + bSize.width) / 2,
          (aSize.height + bSize.height) / 2,
        ) + 155;
      const force = Math.max(
        -55,
        Math.min(55, (distance - desired) * 0.055 * pair.weight),
      );
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      if (pair.a !== input.model.rootModuleId) {
        changes.get(pair.a)!.x += fx;
        changes.get(pair.a)!.y += fy;
      }
      if (pair.b !== input.model.rootModuleId) {
        changes.get(pair.b)!.x -= fx;
        changes.get(pair.b)!.y -= fy;
      }
    }
    if (folderFactor > 0) {
      for (const members of folderGroups.values()) {
        const centroid = members.reduce(
          (sum, { id }) => {
            const point = positions.get(id)!;
            return {
              x: sum.x + point.x / members.length,
              y: sum.y + point.y / members.length,
            };
          },
          { x: 0, y: 0 },
        );
        for (const { id, weight } of members) {
          if (id === input.model.rootModuleId) continue;
          const point = positions.get(id)!;
          changes.get(id)!.x +=
            (centroid.x - point.x) * 0.075 * folderFactor * weight;
          changes.get(id)!.y +=
            (centroid.y - point.y) * 0.075 * folderFactor * weight;
        }
      }
    }
    for (const module of modules) {
      if (module.moduleId === input.model.rootModuleId) continue;
      const point = positions.get(module.moduleId)!;
      const change = changes.get(module.moduleId)!;
      const hop = hops.get(module.moduleId) ?? 1;
      const targetRadius = Math.max(1, hop) * HOP_SPACING;
      const radius = Math.max(EPSILON, Math.hypot(point.x, point.y));
      const radial = (targetRadius - radius) * 0.032;
      change.x += (point.x / radius) * radial;
      change.y += (point.y / radius) * radial;
      const initial = seed.get(module.moduleId)!;
      change.x += (initial.x - point.x) * 0.006;
      change.y += (initial.y - point.y) * 0.006;
      change.x += -point.x * 0.002;
      change.y += -point.y * 0.002;
      const magnitude = Math.hypot(change.x, change.y);
      const scale = magnitude > 70 ? 70 / magnitude : 1;
      positions.set(module.moduleId, {
        x: point.x + change.x * scale,
        y: point.y + change.y * scale,
      });
    }
    collisionPass(modules, positions, input.model.rootModuleId, stats);
  }
  // A short fixed pairwise tail preserves local structure, then a bounded
  // deterministic spiral pack guarantees valid variable-rectangle geometry.
  for (let pass = 0; pass < 24; pass += 1)
    collisionPass(modules, positions, input.model.rootModuleId, stats);
  packWithoutOverlaps(modules, positions, input.model.rootModuleId, stats);
  return positions;
}

function branchRegions(
  input: FocusSchematicLayoutInput,
  candidate: FocusSchematicLayoutCandidate,
) {
  const nodeById = new Map(
    candidate.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const values = new Map<string, string>();
  for (const module of input.model.modules) {
    if (module.documentProjectionNodeId === null) continue;
    const file = nodeById.get(module.documentProjectionNodeId);
    if (file === undefined) continue;
    const fileCenter = center(file);
    for (const node of candidate.nodes.filter(
      ({ moduleId, projectionNodeId }) =>
        moduleId === module.id &&
        projectionNodeId !== module.documentProjectionNodeId,
    )) {
      const point = center(node);
      const dx = point.x - fileCenter.x;
      const dy = point.y - fileCenter.y;
      const region =
        Math.abs(dx) > Math.abs(dy)
          ? dx < 0
            ? 'left'
            : 'right'
          : dy < 0
            ? 'top'
            : 'bottom';
      values.set(node.projectionNodeId, region);
    }
  }
  return values;
}

function percentile(
  values: readonly number[],
  fraction: number,
): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ]!;
}

function mean(values: readonly number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function correlation(
  left: readonly number[],
  right: readonly number[],
): number | null {
  if (left.length < 2 || left.length !== right.length) return null;
  const leftMean = mean(left)!;
  const rightMean = mean(right)!;
  let numerator = 0;
  let leftSquare = 0;
  let rightSquare = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]! - leftMean;
    const b = right[index]! - rightMean;
    numerator += a * b;
    leftSquare += a * a;
    rightSquare += b * b;
  }
  const denominator = Math.sqrt(leftSquare * rightSquare);
  return denominator < EPSILON ? null : numerator / denominator;
}

function metrics(
  input: FocusSchematicLayoutInput,
  candidate: FocusSchematicLayoutCandidate,
  endpointPlan: FocusSchematicEndpointPlan,
  attachments: FocusSchematicComputedLayout['attachments'],
  quality: FocusSchematicComputedLayout['quality'],
  pairs: readonly Pair[],
  hops: ReadonlyMap<string, number>,
  tree: FocusSchematicSoftFolderDisplayTree,
  hierarchyForcePolicy: FocusSchematicSoftHierarchyForcePolicy,
): FocusSchematicSoftClusterMetrics {
  const positions = new Map(
    candidate.modules.map((module) => [module.moduleId, center(module)]),
  );
  const repeated = hierarchyFolderGroups(
    tree,
    100,
    hierarchyForcePolicy,
    input.model.rootModuleId,
  );
  const folderRadiiByKey = [...repeated].map(([folderKey, members]) => {
    const centroid = members.reduce(
      (sum, { id }) => {
        const point = positions.get(id)!;
        return {
          x: sum.x + point.x / members.length,
          y: sum.y + point.y / members.length,
        };
      },
      { x: 0, y: 0 },
    );
    return [
      folderKey,
      Math.sqrt(
        members.reduce((sum, { id }) => {
          const point = positions.get(id)!;
          return (
            sum + (point.x - centroid.x) ** 2 + (point.y - centroid.y) ** 2
          );
        }, 0) / members.length,
      ),
    ] as const;
  });
  const folderRadii = folderRadiiByKey.map(([, radius]) => radius);
  const folderByKey = new Map(
    tree.folders.map((folder) => [folder.folderKey, folder]),
  );
  const pairDistances = pairs.map(({ a, b }) => {
    const left = positions.get(a)!;
    const right = positions.get(b)!;
    return Math.hypot(right.x - left.x, right.y - left.y);
  });
  const attachmentByKey = new Map(
    attachments.map((item) => [`${item.connectionId}:${item.endpoint}`, item]),
  );
  const spans = endpointPlan.connections.flatMap((connection) => {
    if (connection.role === 'secondary') return [];
    const source = attachmentByKey.get(`${connection.id}:source`);
    const target = attachmentByKey.get(`${connection.id}:target`);
    return source === undefined || target === undefined
      ? []
      : [Math.hypot(target.x - source.x, target.y - source.y)];
  });
  const hopValues: number[] = [];
  const radiusValues: number[] = [];
  const hopErrors: number[] = [];
  for (const [id, hop] of hops) {
    if (id === input.model.rootModuleId) continue;
    const point = positions.get(id);
    if (point === undefined) continue;
    const radius = Math.hypot(point.x, point.y);
    hopValues.push(hop);
    radiusValues.push(radius);
    hopErrors.push(Math.abs(radius - hop * HOP_SPACING));
  }
  const modules = [...candidate.modules];
  const left = Math.min(...modules.map((module) => module.x));
  const right = Math.max(...modules.map((module) => module.x + module.width));
  const top = Math.min(...modules.map((module) => module.y));
  const bottom = Math.max(...modules.map((module) => module.y + module.height));
  let minimumGap: number | null = null;
  for (let a = 0; a < modules.length; a += 1)
    for (let b = a + 1; b < modules.length; b += 1) {
      const first = modules[a]!;
      const second = modules[b]!;
      const gapX = Math.max(
        second.x - (first.x + first.width),
        first.x - (second.x + second.width),
      );
      const gapY = Math.max(
        second.y - (first.y + first.height),
        first.y - (second.y + second.height),
      );
      const gap = Math.max(gapX, gapY);
      minimumGap = minimumGap === null ? gap : Math.min(minimumGap, gap);
    }
  return {
    repeatedFolderCount: repeated.size,
    repeatedFolderModuleCount: [...repeated.values()].reduce(
      (sum, members) => sum + members.length,
      0,
    ),
    repeatedFolderRmsRadiusMean: mean(folderRadii),
    repeatedFolderRmsRadiusMedian: percentile(folderRadii, 0.5),
    repeatedFolderRmsRadiusP95: percentile(folderRadii, 0.95),
    childFolderCoherenceMean: mean(
      folderRadiiByKey.flatMap(([folderKey, radius]) =>
        folderByKey.get(folderKey)?.childFolderKeys.length === 0
          ? [radius]
          : [],
      ),
    ),
    parentFolderCoherenceMean: mean(
      folderRadiiByKey.flatMap(([folderKey, radius]) =>
        (folderByKey.get(folderKey)?.childFolderKeys.length ?? 0) > 0
          ? [radius]
          : [],
      ),
    ),
    connectedPairCount: pairs.length,
    connectedPairDistanceMean: mean(pairDistances),
    connectedPairDistanceP95: percentile(pairDistances, 0.95),
    exactPrimaryEndpointSpanMean: mean(spans),
    exactPrimaryEndpointSpanP95: percentile(spans, 0.95),
    exactEndpointCrossingCount: quality.exactEndpointCrossingCount,
    hopMeanAbsoluteRadiusError: mean(hopErrors),
    hopRadiusCorrelation: correlation(hopValues, radiusValues),
    boundsWidth: right - left,
    boundsHeight: bottom - top,
    boundsArea: (right - left) * (bottom - top),
    overlapCount: quality.moduleOverlapPairs.length,
    minimumModuleGap: minimumGap,
  };
}

export function computeFocusSchematicSoftClusterLayoutAttempt(
  input: FocusSchematicLayoutInput,
  options: FocusSchematicSoftClusterOptions = {},
): FocusSchematicSoftClusterLayoutAttempt {
  const strength = normalizeFocusSchematicSoftFolderStrength(options.strength);
  const internalLayoutVariant =
    options.internalLayoutVariant ?? 'adaptive-compass';
  const endpointOrderPolicy =
    options.endpointOrderPolicy ?? 'crossing-optimized';
  const displayIntent = canonicalFocusSchematicSoftFolderDisplayIntent(
    options.displayIntent ?? EMPTY_FOCUS_SCHEMATIC_SOFT_FOLDER_DISPLAY_INTENT,
  );
  const hierarchyForcePolicy =
    options.hierarchyForcePolicy ?? 'normalized-decay';
  const intentFingerprint = Math.floor(
    hashUnit(JSON.stringify(displayIntent)) * 0x1_0000_0000,
  )
    .toString(16)
    .padStart(8, '0');
  const configId = `HIER4B-soft-clusters-s${strength}-${internalLayoutVariant}-${endpointOrderPolicy}-${hierarchyForcePolicy}-intent-${displayIntent.fileParentOverrides.length}-${displayIntent.flattenedFolderKeys.length}-${intentFingerprint}`;
  const started = performance.now();
  try {
    const baseAttempt = computeFocusSchematicRevision2LayoutAttempt(input);
    if (baseAttempt.status !== 'success') throw new Error(baseAttempt.reason);
    const softStarted = performance.now();
    const base = baseAttempt.result;
    const tree = displayTree(input, displayIntent);
    const memberships = focusSchematicSoftFolderScopeMemberships(
      tree,
      hierarchyForcePolicy,
    );
    const forceGroups = hierarchyFolderGroups(
      tree,
      100,
      hierarchyForcePolicy,
      input.model.rootModuleId,
    );
    const pairs = primaryPairs(base.endpointPlan);
    const moduleIds = base.candidate.modules
      .map(({ moduleId }) => moduleId)
      .sort(compareText);
    const hops = hopDistances(input.model.rootModuleId, moduleIds, pairs);
    const stats = createFocusSchematicInternalLayoutRunStats();
    const relaxation: RelaxationStats = {
      collisionCheckCount: 0,
      collisionCorrectionCount: 0,
    };
    let positions = initialPositions(input, base.candidate, hops);
    let candidate = placeAtCenters(base.candidate, positions);
    candidate = applyFocusSchematicInternalLayoutVariant(
      input,
      base.modulePlan,
      base.endpointPlan,
      candidate,
      internalLayoutVariant,
      endpointOrderPolicy,
      stats,
      'soft-cardinal-files',
    );
    const firstRegions = branchRegions(input, candidate);
    positions = new Map(
      candidate.modules.map((module) => [module.moduleId, center(module)]),
    );
    positions = relax(
      input,
      candidate,
      positions,
      pairs,
      hops,
      strength,
      tree,
      hierarchyForcePolicy,
      FOCUS_SCHEMATIC_SOFT_CLUSTER_ITERATION_SCHEDULE[0],
      relaxation,
    );
    candidate = placeAtCenters(candidate, positions);
    candidate = applyFocusSchematicInternalLayoutVariant(
      input,
      base.modulePlan,
      base.endpointPlan,
      candidate,
      internalLayoutVariant,
      endpointOrderPolicy,
      stats,
      'soft-cardinal-files',
    );
    const secondRegions = branchRegions(input, candidate);
    positions = new Map(
      candidate.modules.map((module) => [module.moduleId, center(module)]),
    );
    positions = relax(
      input,
      candidate,
      positions,
      pairs,
      hops,
      strength,
      tree,
      hierarchyForcePolicy,
      FOCUS_SCHEMATIC_SOFT_CLUSTER_ITERATION_SCHEDULE[1],
      relaxation,
    );
    candidate = anchorRootFile(input, placeAtCenters(candidate, positions));
    const attachments = createFocusSchematicEndpointAttachments(
      base.endpointPlan,
      candidate,
      'soft-cardinal-files',
    );
    const quality = evaluateFocusSchematicEndpointLayoutQuality(
      input,
      base.modulePlan,
      base.endpointPlan,
      base.internalLanePlan,
      candidate,
      attachments,
      'soft-cardinal-files',
    );
    if (quality.moduleOverlapPairs.length > 0)
      throw new Error(
        `Soft Clusters left ${quality.moduleOverlapPairs.length} module overlaps: ${quality.moduleOverlapPairs.join(', ')}.`,
      );
    const churn = [...secondRegions].filter(
      ([id, region]) => firstRegions.get(id) !== region,
    ).length;
    const folderBandQuality = evaluateFocusSchematicFolderBandQuality(
      input,
      base.modulePlan,
      base.folderBandPlan,
      candidate,
      base.quality,
      quality,
    );
    const evidence: FocusSchematicSoftClusterEvidence = {
      schemaVersion: 2,
      developmentOnly: true,
      layoutFamily: 'soft-folder-clusters',
      strength,
      endpointOrderPolicy,
      fileParentOverrideCount: tree.reconciledIntent.fileParentOverrides.length,
      flattenedFolderCount: tree.reconciledIntent.flattenedFolderKeys.length,
      displayedFolderCount: tree.folders.length,
      automaticallyCompressedFolderCount:
        tree.automaticallyCompressedFolderKeys.length,
      maximumDisplayedDepth: Math.max(
        0,
        ...tree.files.map(({ fileId }) => memberships.get(fileId)?.length ?? 0),
      ),
      hierarchyForcePolicy,
      maximumPerFileFolderWeight: maximumFolderForceWeight(forceGroups),
      fileAttachmentPolicy: 'spatial-cardinal',
      folderInfluenceEnabled: strength > 0,
      topologyDirectionality: 'undirected-primary',
      secondaryGeometryInfluence: 0,
      fixedIterationSchedule: FOCUS_SCHEMATIC_SOFT_CLUSTER_ITERATION_SCHEDULE,
      metrics: metrics(
        input,
        candidate,
        base.endpointPlan,
        attachments,
        quality,
        pairs,
        hops,
        tree,
        hierarchyForcePolicy,
      ),
      runtime: {
        moduleCount: candidate.modules.length,
        primaryPairCount: pairs.length,
        repeatedFolderCount: forceGroups.size,
        iterationCount: 54,
        jointRoundCount: 2,
        compassAssignmentCount: stats.completeCompassAssignmentsEvaluated,
        compassBranchRegionChurn: churn,
        collisionCheckCount: relaxation.collisionCheckCount,
        collisionCorrectionCount: relaxation.collisionCorrectionCount,
        layoutMs: performance.now() - softStarted,
      },
    };
    const result: FocusSchematicComputedLayout = {
      ...base,
      candidate,
      attachments,
      quality,
      folderBandQuality,
      internalLayoutEvidence: {
        ...createFocusSchematicInternalLayoutEvidence(
          input,
          base.endpointPlan,
          candidate,
          base.candidate,
          internalLayoutVariant,
          stats,
        ),
        softClusterPolicyEvidence: {
          schemaVersion: 2,
          layoutFamily: 'soft-folder-clusters',
          strength,
          endpointOrderPolicy,
          displayIntent,
          hierarchyForcePolicy,
          fileAttachmentPolicy: 'spatial-cardinal',
        },
      },
    };
    const timings = {
      ...baseAttempt.timings,
      macroMs: baseAttempt.timings.macroMs + evidence.runtime.layoutMs,
      outputSerializedBytes: new TextEncoder().encode(JSON.stringify(result))
        .byteLength,
      totalMs: performance.now() - started,
    };
    return {
      status: 'success',
      strategyId: STRATEGY_ID,
      configId,
      result,
      evidence,
      timings,
    };
  } catch (error) {
    return {
      status: 'failure',
      strategyId: STRATEGY_ID,
      configId,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function computeFocusSchematicSoftClusterLayout(
  input: FocusSchematicLayoutInput,
  options: FocusSchematicSoftClusterOptions = {},
): FocusSchematicComputedLayout {
  const attempt = computeFocusSchematicSoftClusterLayoutAttempt(input, options);
  if (attempt.status !== 'success') throw new Error(attempt.reason);
  return attempt.result;
}
