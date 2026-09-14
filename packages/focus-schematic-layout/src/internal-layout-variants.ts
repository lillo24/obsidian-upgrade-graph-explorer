import type {
  FocusSchematicLayoutCandidate,
  FocusSchematicRectangle,
} from '@icarus-graph-explorer/focus-schematic';
import type { ProjectionNodeId } from '@icarus-graph-explorer/view-projection';

import { measureFocusSchematicEndpointOrder } from './crossing-minimization';
import {
  measureFocusSchematicCandidateAttachmentCrossings,
  type FocusSchematicEndpointAttachmentPolicy,
} from './attachments';
import type {
  FocusSchematicEndpointOrderPolicy,
  FocusSchematicEndpointPlan,
  FocusSchematicCompassDemandPolicy,
  FocusSchematicInternalLayoutEvidence,
  FocusSchematicInternalLayoutModuleMetrics,
  FocusSchematicInternalLayoutQualityMetrics,
  FocusSchematicInternalLayoutVariant,
  FocusSchematicLayoutInput,
  FocusSchematicLayoutPlan,
  FocusSchematicSpatialDemandSummary,
} from './types';

export const FOCUS_SCHEMATIC_VERTICAL_SPINE_PLACEMENT_CANDIDATE_CAP = 64;
export const FOCUS_SCHEMATIC_COMPASS_ASSIGNMENT_CAP = 64;
export const FOCUS_SCHEMATIC_COMPASS_LOCAL_RELOCATION_SWEEP_LIMIT = 4;
export const FOCUS_SCHEMATIC_INTERNAL_FOLDER_JOINT_ROUND_LIMIT = 2 as const;

const EPSILON = 1e-6;
const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const centerX = (rectangle: FocusSchematicRectangle): number =>
  rectangle.x + rectangle.width / 2;
const centerY = (rectangle: FocusSchematicRectangle): number =>
  rectangle.y + rectangle.height / 2;

type CandidateNode = FocusSchematicLayoutCandidate['nodes'][number];
type CandidateModule = FocusSchematicLayoutCandidate['modules'][number];
type CompassRegion = 'top' | 'bottom' | 'left' | 'right';

interface BranchDemand {
  readonly preferredY: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly preferredCardinal: CompassRegion | null;
  readonly fallbackCardinal: CompassRegion;
}

const CARDINAL_REGIONS: readonly CompassRegion[] = [
  'top',
  'bottom',
  'left',
  'right',
];

interface BranchGeometry {
  readonly rootId: ProjectionNodeId;
  readonly nodeIds: readonly ProjectionNodeId[];
  readonly sourceIndex: number;
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly width: number;
  readonly height: number;
  readonly root: CandidateNode;
}

interface ModuleStructure {
  readonly semanticModule: FocusSchematicLayoutInput['model']['modules'][number];
  readonly module: CandidateModule;
  readonly document: CandidateNode;
  readonly branches: readonly BranchGeometry[];
}

export interface FocusSchematicInternalLayoutRunStats {
  jointFolderRounds: number;
  completeCompassAssignmentsEvaluated: number;
  placementCandidatesEvaluated: number;
  localRelocationSweeps: number;
  largeModuleFallbackCount: number;
  spatialDemandCrossingOverrideCount: number;
  spatialDemandInversionOverrideCount: number;
  spatialDemandHierarchyOverrideCount: number;
  readonly optimizedModuleIds: Set<string>;
}

export function createFocusSchematicInternalLayoutRunStats(): FocusSchematicInternalLayoutRunStats {
  return {
    jointFolderRounds: 0,
    completeCompassAssignmentsEvaluated: 0,
    placementCandidatesEvaluated: 0,
    localRelocationSweeps: 0,
    largeModuleFallbackCount: 0,
    spatialDemandCrossingOverrideCount: 0,
    spatialDemandInversionOverrideCount: 0,
    spatialDemandHierarchyOverrideCount: 0,
    optimizedModuleIds: new Set(),
  };
}

function percentile(
  values: readonly number[],
  fraction: number,
): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ]!;
}

function rectangleForEndpoint(
  candidate: FocusSchematicLayoutCandidate,
  endpoint: FocusSchematicEndpointPlan['connections'][number]['source'],
): FocusSchematicRectangle | undefined {
  if (endpoint.kind === 'visible-entity')
    return candidate.nodes.find(
      ({ projectionNodeId }) => projectionNodeId === endpoint.projectionNodeId,
    );
  return candidate.modules.find(
    ({ moduleId }) => moduleId === endpoint.moduleId,
  );
}

function primarySpans(
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
): readonly { readonly manhattan: number; readonly vertical: number }[] {
  return endpointPlan.connections.flatMap((connection) => {
    if (
      connection.role === 'secondary' ||
      connection.sourceModuleId === connection.targetModuleId
    )
      return [];
    const source = rectangleForEndpoint(candidate, connection.source);
    const target = rectangleForEndpoint(candidate, connection.target);
    return source === undefined || target === undefined
      ? []
      : [
          {
            manhattan:
              Math.abs(centerX(source) - centerX(target)) +
              Math.abs(centerY(source) - centerY(target)),
            vertical: Math.abs(centerY(source) - centerY(target)),
          },
        ];
  });
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

export function measureFocusSchematicInternalHierarchyCrossings(
  input: FocusSchematicLayoutInput,
  candidate: FocusSchematicLayoutCandidate,
): number {
  const nodeById = new Map(
    candidate.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const edges = input.projection.edges.flatMap((edge) => {
    if (edge.kind !== 'hierarchy') return [];
    const source = nodeById.get(edge.sourceNodeId);
    const target = nodeById.get(edge.targetNodeId);
    return source === undefined ||
      target === undefined ||
      source.moduleId !== target.moduleId
      ? []
      : [
          {
            id: edge.id,
            sourceId: edge.sourceNodeId,
            targetId: edge.targetNodeId,
            moduleId: source.moduleId,
            segment: [
              centerX(source),
              centerY(source),
              centerX(target),
              centerY(target),
            ] as const,
          },
        ];
  });
  let count = 0;
  for (let left = 0; left < edges.length; left += 1)
    for (let right = left + 1; right < edges.length; right += 1) {
      const first = edges[left]!;
      const second = edges[right]!;
      if (
        first.moduleId !== second.moduleId ||
        first.sourceId === second.sourceId ||
        first.sourceId === second.targetId ||
        first.targetId === second.sourceId ||
        first.targetId === second.targetId
      )
        continue;
      if (properSegmentCrossing(first.segment, second.segment)) count += 1;
    }
  return count;
}

function sourceLineByNodeId(input: FocusSchematicLayoutInput) {
  return new Map(
    input.projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [[node.id, node.sourceStartLine] as const] : [],
    ),
  );
}

function moduleStructure(
  input: FocusSchematicLayoutInput,
  candidate: FocusSchematicLayoutCandidate,
  moduleId: string,
): ModuleStructure | null {
  const semanticModule = input.model.modules.find(({ id }) => id === moduleId);
  const module = candidate.modules.find((item) => item.moduleId === moduleId);
  if (
    semanticModule === undefined ||
    module === undefined ||
    semanticModule.presentation === 'filtered' ||
    semanticModule.documentProjectionNodeId === null
  )
    return null;
  const document = candidate.nodes.find(
    ({ projectionNodeId }) =>
      projectionNodeId === semanticModule.documentProjectionNodeId,
  );
  if (document === undefined) return null;
  const hierarchyIds = new Set(semanticModule.hierarchyEdgeIds);
  const childrenByNodeId = new Map<ProjectionNodeId, ProjectionNodeId[]>();
  for (const edge of input.projection.edges) {
    if (edge.kind !== 'hierarchy' || !hierarchyIds.has(edge.id)) continue;
    const children = childrenByNodeId.get(edge.sourceNodeId) ?? [];
    children.push(edge.targetNodeId);
    childrenByNodeId.set(edge.sourceNodeId, children);
  }
  const sourceLine = sourceLineByNodeId(input);
  const sourceOrder = (left: ProjectionNodeId, right: ProjectionNodeId) =>
    (sourceLine.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (sourceLine.get(right) ?? Number.MAX_SAFE_INTEGER) ||
    compareText(left, right);
  for (const children of childrenByNodeId.values()) children.sort(sourceOrder);
  const roots = [
    ...(childrenByNodeId.get(document.projectionNodeId) ?? []),
  ].sort(sourceOrder);
  const nodeById = new Map(
    candidate.nodes
      .filter((node) => node.moduleId === moduleId)
      .map((node) => [node.projectionNodeId, node]),
  );
  const branches = roots.flatMap((rootId, sourceIndex) => {
    const nodeIds: ProjectionNodeId[] = [];
    const visit = (nodeId: ProjectionNodeId) => {
      if (!nodeById.has(nodeId)) return;
      nodeIds.push(nodeId);
      for (const childId of childrenByNodeId.get(nodeId) ?? []) visit(childId);
    };
    visit(rootId);
    const nodes = nodeIds.map((nodeId) => nodeById.get(nodeId)!);
    const root = nodeById.get(rootId);
    if (root === undefined || nodes.length === 0) return [];
    const left = Math.min(...nodes.map(({ x }) => x));
    const right = Math.max(...nodes.map(({ x, width }) => x + width));
    const top = Math.min(...nodes.map(({ y }) => y));
    const bottom = Math.max(...nodes.map(({ y, height }) => y + height));
    return [
      {
        rootId,
        nodeIds,
        sourceIndex,
        left,
        right,
        top,
        bottom,
        width: right - left,
        height: bottom - top,
        root,
      },
    ];
  });
  return { semanticModule, module, document, branches };
}

function stackExtent(
  branches: readonly BranchGeometry[],
  separation: number,
): number {
  return branches.reduce(
    (total, branch, index) =>
      total + branch.height + (index === 0 ? 0 : separation),
    0,
  );
}

function applyBranchOffsets(
  candidate: FocusSchematicLayoutCandidate,
  structure: ModuleStructure,
  offsetsByRootId: ReadonlyMap<
    ProjectionNodeId,
    { readonly x: number; readonly y: number }
  >,
): FocusSchematicLayoutCandidate {
  const offsetByNodeId = new Map<
    ProjectionNodeId,
    { readonly x: number; readonly y: number }
  >();
  for (const branch of structure.branches) {
    const offset = offsetsByRootId.get(branch.rootId);
    if (offset === undefined) continue;
    for (const nodeId of branch.nodeIds) offsetByNodeId.set(nodeId, offset);
  }
  return {
    ...candidate,
    nodes: candidate.nodes.map((node) => {
      if (node.moduleId !== structure.module.moduleId) return node;
      const offset = offsetByNodeId.get(node.projectionNodeId);
      return offset === undefined
        ? node
        : { ...node, x: node.x + offset.x, y: node.y + offset.y };
    }),
  };
}

function reframeModule(
  input: FocusSchematicLayoutInput,
  candidate: FocusSchematicLayoutCandidate,
  structure: ModuleStructure,
): FocusSchematicLayoutCandidate {
  const nodes = candidate.nodes.filter(
    ({ moduleId }) => moduleId === structure.module.moduleId,
  );
  if (nodes.length === 0) return candidate;
  const minX = Math.min(...nodes.map(({ x }) => x));
  const maxX = Math.max(...nodes.map(({ x, width }) => x + width));
  const minY = Math.min(...nodes.map(({ y }) => y));
  const maxY = Math.max(...nodes.map(({ y, height }) => y + height));
  const reserve =
    structure.semanticModule.diagnosticIds.length > 0
      ? input.settings.diagnosticReserveHeight
      : 0;
  const raw = {
    x: minX - input.settings.modulePaddingX,
    y: minY - input.settings.modulePaddingY,
    width: maxX - minX + input.settings.modulePaddingX * 2,
    height: maxY - minY + input.settings.modulePaddingY * 2 + reserve,
  };
  const deltaX = centerX(structure.module) - centerX(raw);
  const deltaY = centerY(structure.module) - centerY(raw);
  return {
    ...candidate,
    modules: candidate.modules.map((module) =>
      module.moduleId === structure.module.moduleId
        ? {
            ...module,
            x: raw.x + deltaX,
            y: raw.y + deltaY,
            width: raw.width,
            height: raw.height,
          }
        : module,
    ),
    nodes: candidate.nodes.map((node) =>
      node.moduleId === structure.module.moduleId
        ? { ...node, x: node.x + deltaX, y: node.y + deltaY }
        : node,
    ),
  };
}

function placeRegions(
  input: FocusSchematicLayoutInput,
  candidate: FocusSchematicLayoutCandidate,
  structure: ModuleStructure,
  regionByRootId: ReadonlyMap<ProjectionNodeId, CompassRegion>,
  orderByRegion: ReadonlyMap<CompassRegion, readonly ProjectionNodeId[]>,
  verticalSpineOnly: boolean,
): FocusSchematicLayoutCandidate {
  const branchById = new Map(
    structure.branches.map((branch) => [branch.rootId, branch]),
  );
  const separation = input.settings.internalNodeSeparation;
  const fileGap = input.settings.internalRankSeparation;
  const offsets = new Map<
    ProjectionNodeId,
    { readonly x: number; readonly y: number }
  >();
  const ordered = (region: CompassRegion) =>
    (orderByRegion.get(region) ?? []).map((rootId) => branchById.get(rootId)!);
  const left = ordered('left');
  const right = ordered('right');
  const sideTop = (branches: readonly BranchGeometry[]) =>
    centerY(structure.document) - stackExtent(branches, separation) / 2;
  for (const [region, branches] of [
    ['left', left],
    ['right', right],
  ] as const) {
    let cursor = sideTop(branches);
    for (const branch of branches) {
      const x =
        region === 'left'
          ? structure.document.x - fileGap - branch.right
          : structure.document.x +
            structure.document.width +
            fileGap -
            branch.left;
      offsets.set(branch.rootId, { x, y: cursor - branch.top });
      cursor += branch.height + separation;
    }
  }
  const sideBounds = [...offsets].flatMap(([rootId, offset]) => {
    const branch = branchById.get(rootId)!;
    return [{ top: branch.top + offset.y, bottom: branch.bottom + offset.y }];
  });
  const centerTop = Math.min(
    structure.document.y,
    ...sideBounds.map(({ top }) => top),
  );
  const centerBottom = Math.max(
    structure.document.y + structure.document.height,
    ...sideBounds.map(({ bottom }) => bottom),
  );
  const top = ordered('top');
  let cursor =
    centerTop - (top.length === 0 ? 0 : fileGap) - stackExtent(top, separation);
  for (const branch of top) {
    offsets.set(branch.rootId, {
      x: centerX(structure.document) - centerX(branch.root),
      y: cursor - branch.top,
    });
    cursor += branch.height + separation;
  }
  const bottom = ordered('bottom');
  cursor = centerBottom + (bottom.length === 0 ? 0 : fileGap);
  for (const branch of bottom) {
    offsets.set(branch.rootId, {
      x: centerX(structure.document) - centerX(branch.root),
      y: cursor - branch.top,
    });
    cursor += branch.height + separation;
  }
  if (
    verticalSpineOnly &&
    [...regionByRootId.values()].some(
      (region) => region === 'left' || region === 'right',
    )
  )
    throw new Error('Vertical-spine placement received a compass side region.');
  return reframeModule(
    input,
    applyBranchOffsets(candidate, structure, offsets),
    structure,
  );
}

function directionalBranchDemand(
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
  structure: ModuleStructure,
  branch: BranchGeometry,
): BranchDemand {
  const nodeIds = new Set(branch.nodeIds);
  const moduleById = new Map(
    candidate.modules.map((module) => [module.moduleId, module]),
  );
  const counterpartYs: number[] = [];
  let left = 0;
  let right = 0;
  for (const connection of endpointPlan.connections) {
    if (connection.role === 'secondary') continue;
    const sourceIn =
      connection.source.kind === 'visible-entity' &&
      nodeIds.has(connection.source.projectionNodeId);
    const targetIn =
      connection.target.kind === 'visible-entity' &&
      nodeIds.has(connection.target.projectionNodeId);
    if (sourceIn === targetIn) continue;
    const counterpart = sourceIn ? connection.target : connection.source;
    const rectangle = rectangleForEndpoint(candidate, counterpart);
    if (rectangle === undefined) continue;
    counterpartYs.push(centerY(rectangle));
    const counterpartModule = moduleById.get(counterpart.moduleId);
    if (counterpartModule === undefined) continue;
    if (centerX(counterpartModule) < centerX(structure.module) - EPSILON)
      left += 1;
    if (centerX(counterpartModule) > centerX(structure.module) + EPSILON)
      right += 1;
  }
  counterpartYs.sort((first, second) => first - second);
  return {
    preferredY:
      counterpartYs.length === 0
        ? centerY(branch.root)
        : counterpartYs[Math.floor((counterpartYs.length - 1) / 2)]!,
    left,
    right,
    top: 0,
    bottom: 0,
    preferredCardinal:
      left > 0 && right === 0
        ? 'left'
        : right > 0 && left === 0
          ? 'right'
          : null,
    fallbackCardinal: branch.sourceIndex % 2 === 0 ? 'top' : 'bottom',
  };
}

function cardinalRegion(dx: number, dy: number): CompassRegion | null {
  if (Math.abs(dx) <= EPSILON && Math.abs(dy) <= EPSILON) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'top' : 'bottom';
}

function spatialBranchDemand(
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
  structure: ModuleStructure,
  branch: BranchGeometry,
  summary: FocusSchematicSpatialDemandSummary,
): BranchDemand {
  const nodeIds = new Set(branch.nodeIds);
  const file = {
    x: centerX(structure.document),
    y: centerY(structure.document),
  };
  const counterpartYs: number[] = [];
  const counts: Record<CompassRegion, number> = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };
  let aggregateX = 0;
  let aggregateY = 0;
  for (const connection of endpointPlan.connections) {
    if (connection.role === 'secondary') continue;
    const sourceIn =
      connection.source.kind === 'visible-entity' &&
      nodeIds.has(connection.source.projectionNodeId);
    const targetIn =
      connection.target.kind === 'visible-entity' &&
      nodeIds.has(connection.target.projectionNodeId);
    if (sourceIn === targetIn) continue;
    const counterpart = sourceIn ? connection.target : connection.source;
    if (counterpart.moduleId === structure.module.moduleId) continue;
    const rectangle = rectangleForEndpoint(candidate, counterpart);
    if (rectangle === undefined) continue;
    const point = { x: centerX(rectangle), y: centerY(rectangle) };
    const dx = point.x - file.x;
    const dy = point.y - file.y;
    const distance = Math.hypot(dx, dy);
    const region = cardinalRegion(dx, dy);
    if (region === null || distance <= EPSILON) continue;
    const authoredReferenceCount = Math.max(1, connection.referenceIds.length);
    for (let index = 0; index < authoredReferenceCount; index += 1)
      counterpartYs.push(point.y);
    counts[region] += authoredReferenceCount;
    // Unit vectors keep one distant module from outweighing several authored
    // references while preserving their aggregate spatial direction.
    aggregateX += (dx / distance) * authoredReferenceCount;
    aggregateY += (dy / distance) * authoredReferenceCount;
  }
  counterpartYs.sort((first, second) => first - second);
  const ranked = [...CARDINAL_REGIONS].sort(
    (left, right) =>
      counts[right] - counts[left] ||
      CARDINAL_REGIONS.indexOf(left) - CARDINAL_REGIONS.indexOf(right),
  );
  const aggregateRegion = cardinalRegion(aggregateX, aggregateY);
  const preferredCardinal =
    counterpartYs.length === 0
      ? null
      : summary === 'aggregate-vector' && aggregateRegion !== null
        ? aggregateRegion
        : ranked[0]!;
  const secondDemanded = ranked.find(
    (region) => region !== preferredCardinal && counts[region] > 0,
  );
  const fallbackCardinal =
    secondDemanded ??
    (preferredCardinal === 'top'
      ? 'bottom'
      : preferredCardinal === 'bottom'
        ? 'top'
        : branch.sourceIndex % 2 === 0
          ? 'top'
          : 'bottom');
  return {
    preferredY:
      counterpartYs.length === 0
        ? centerY(branch.root)
        : counterpartYs[Math.floor((counterpartYs.length - 1) / 2)]!,
    ...counts,
    preferredCardinal,
    fallbackCardinal,
  };
}

function branchDemand(
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
  structure: ModuleStructure,
  branch: BranchGeometry,
  demandPolicy: FocusSchematicCompassDemandPolicy = 'directional-horizontal',
  spatialDemandSummary: FocusSchematicSpatialDemandSummary = 'dominant-cardinal',
): BranchDemand {
  return demandPolicy === 'spatial-cardinal'
    ? spatialBranchDemand(
        endpointPlan,
        candidate,
        structure,
        branch,
        spatialDemandSummary,
      )
    : directionalBranchDemand(endpointPlan, candidate, structure, branch);
}

function classifyRegion(
  structure: ModuleStructure,
  branch: BranchGeometry,
): CompassRegion {
  if (branch.right <= structure.document.x - EPSILON) return 'left';
  if (branch.left >= structure.document.x + structure.document.width + EPSILON)
    return 'right';
  if (branch.bottom <= structure.document.y + EPSILON) return 'top';
  return 'bottom';
}

function moduleDemandAlignment(
  endpointPlan: FocusSchematicEndpointPlan,
  demandCandidate: FocusSchematicLayoutCandidate,
  layoutCandidate: FocusSchematicLayoutCandidate,
  input: FocusSchematicLayoutInput,
  moduleId: string,
  demandPolicy: FocusSchematicCompassDemandPolicy,
  spatialDemandSummary: FocusSchematicSpatialDemandSummary,
) {
  const demandStructure = moduleStructure(input, demandCandidate, moduleId);
  const layoutStructure = moduleStructure(input, layoutCandidate, moduleId);
  if (demandStructure === null || layoutStructure === null)
    return { demanded: 0, matched: 0 };
  const finalRegionByRootId = new Map(
    layoutStructure.branches.map((branch) => [
      branch.rootId,
      classifyRegion(layoutStructure, branch),
    ]),
  );
  let demanded = 0;
  let matched = 0;
  for (const branch of demandStructure.branches) {
    const demand = branchDemand(
      endpointPlan,
      demandCandidate,
      demandStructure,
      branch,
      demandPolicy,
      spatialDemandSummary,
    );
    if (demand.preferredCardinal === null) continue;
    demanded += 1;
    if (finalRegionByRootId.get(branch.rootId) === demand.preferredCardinal)
      matched += 1;
  }
  return { demanded, matched };
}

export function measureFocusSchematicCompassDemandAlignment(
  input: FocusSchematicLayoutInput,
  endpointPlan: FocusSchematicEndpointPlan,
  demandCandidate: FocusSchematicLayoutCandidate,
  layoutCandidate: FocusSchematicLayoutCandidate,
  demandPolicy: FocusSchematicCompassDemandPolicy,
  spatialDemandSummary: FocusSchematicSpatialDemandSummary,
) {
  return layoutCandidate.modules.reduce(
    (total, module) => {
      const value = moduleDemandAlignment(
        endpointPlan,
        demandCandidate,
        layoutCandidate,
        input,
        module.moduleId,
        demandPolicy,
        spatialDemandSummary,
      );
      return {
        demandedBranchCount: total.demandedBranchCount + value.demanded,
        demandMatchedBranchCount:
          total.demandMatchedBranchCount + value.matched,
      };
    },
    { demandedBranchCount: 0, demandMatchedBranchCount: 0 },
  );
}

function moduleMetrics(
  input: FocusSchematicLayoutInput,
  candidate: FocusSchematicLayoutCandidate,
  moduleId: string,
): FocusSchematicInternalLayoutModuleMetrics | null {
  const structure = moduleStructure(input, candidate, moduleId);
  if (structure === null) return null;
  const regions = structure.branches.map((branch) => ({
    branch,
    region: classifyRegion(structure, branch),
  }));
  const top = regions.filter(({ region }) => region === 'top');
  const bottom = regions.filter(({ region }) => region === 'bottom');
  const aboveExtent =
    top.length === 0
      ? 0
      : structure.document.y - Math.min(...top.map(({ branch }) => branch.top));
  const belowExtent =
    bottom.length === 0
      ? 0
      : Math.max(...bottom.map(({ branch }) => branch.bottom)) -
        (structure.document.y + structure.document.height);
  return {
    moduleId,
    topLevelBranchCount: structure.branches.length,
    branchesAboveFile: top.length,
    branchesBelowFile: bottom.length,
    branchesLeftOfFile: regions.filter(({ region }) => region === 'left')
      .length,
    branchesRightOfFile: regions.filter(({ region }) => region === 'right')
      .length,
    packedExtentAboveFile: aboveExtent,
    packedExtentBelowFile: belowExtent,
    packedExtentImbalance: Math.abs(aboveExtent - belowExtent),
    width: structure.module.width,
    height: structure.module.height,
    area: structure.module.width * structure.module.height,
  };
}

function internalSourceOrderDeviation(
  input: FocusSchematicLayoutInput,
  candidate: FocusSchematicLayoutCandidate,
): number {
  let inversions = 0;
  for (const module of candidate.modules) {
    const structure = moduleStructure(input, candidate, module.moduleId);
    if (structure === null) continue;
    const regions = new Map<CompassRegion, BranchGeometry[]>();
    for (const branch of structure.branches) {
      const region = classifyRegion(structure, branch);
      const values = regions.get(region) ?? [];
      values.push(branch);
      regions.set(region, values);
    }
    for (const values of regions.values()) {
      const visual = [...values].sort(
        (left, right) =>
          left.top - right.top || compareText(left.rootId, right.rootId),
      );
      for (let left = 0; left < visual.length; left += 1)
        for (let right = left + 1; right < visual.length; right += 1)
          if (visual[left]!.sourceIndex > visual[right]!.sourceIndex)
            inversions += 1;
    }
  }
  return inversions;
}

function qualityMetrics(
  input: FocusSchematicLayoutInput,
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
  movementBaseline: FocusSchematicLayoutCandidate,
): FocusSchematicInternalLayoutQualityMetrics {
  const spans = primarySpans(endpointPlan, candidate);
  const manhattan = spans.map((span) => span.manhattan);
  const vertical = spans.map((span) => span.vertical);
  const baselineNodes = new Map(
    movementBaseline.nodes.map((node) => [node.projectionNodeId, node]),
  );
  const totalInternalBranchMovement = candidate.nodes.reduce((sum, node) => {
    const before = baselineNodes.get(node.projectionNodeId);
    return before === undefined
      ? sum
      : sum + Math.abs(node.x - before.x) + Math.abs(node.y - before.y);
  }, 0);
  return {
    totalPrimaryReferenceManhattanSpan: manhattan.reduce(
      (sum, value) => sum + value,
      0,
    ),
    meanPrimaryReferenceManhattanSpan:
      manhattan.length === 0
        ? null
        : manhattan.reduce((sum, value) => sum + value, 0) / manhattan.length,
    p95PrimaryReferenceManhattanSpan: percentile(manhattan, 0.95),
    totalPrimaryReferenceVerticalSpan: vertical.reduce(
      (sum, value) => sum + value,
      0,
    ),
    meanPrimaryReferenceVerticalSpan:
      vertical.length === 0
        ? null
        : vertical.reduce((sum, value) => sum + value, 0) / vertical.length,
    internalHierarchyCrossingCount:
      measureFocusSchematicInternalHierarchyCrossings(input, candidate),
    internalSourceOrderDeviation: internalSourceOrderDeviation(
      input,
      candidate,
    ),
    totalInternalBranchMovement,
    totalModuleArea: candidate.modules.reduce(
      (sum, module) => sum + module.width * module.height,
      0,
    ),
    maximumModuleWidth:
      candidate.modules.length === 0
        ? 0
        : Math.max(...candidate.modules.map(({ width }) => width)),
    maximumModuleHeight:
      candidate.modules.length === 0
        ? 0
        : Math.max(...candidate.modules.map(({ height }) => height)),
  };
}

function scoreCandidate(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
  baseline: FocusSchematicLayoutCandidate,
  moduleId: string,
  variant: FocusSchematicInternalLayoutVariant,
  stableKey: string,
  attachmentPolicy: FocusSchematicEndpointAttachmentPolicy,
  demandPolicy: FocusSchematicCompassDemandPolicy = 'directional-horizontal',
  spatialDemandSummary: FocusSchematicSpatialDemandSummary = 'dominant-cardinal',
): readonly (number | string)[] {
  const order = measureFocusSchematicEndpointOrder(
    modulePlan,
    endpointPlan,
    candidate,
  );
  const quality = qualityMetrics(input, endpointPlan, candidate, baseline);
  const module = moduleMetrics(input, candidate, moduleId);
  const exactEndpointCrossingCount =
    attachmentPolicy === 'soft-cardinal-files'
      ? measureFocusSchematicCandidateAttachmentCrossings(
          endpointPlan,
          candidate,
          attachmentPolicy,
        )
      : order.exactEndpointCrossingCount;
  const verticalBranchCount =
    (module?.branchesAboveFile ?? 0) + (module?.branchesBelowFile ?? 0);
  const hasLateralBranches =
    (module?.branchesLeftOfFile ?? 0) + (module?.branchesRightOfFile ?? 0) > 0;
  const oneSided =
    verticalBranchCount >= 2 &&
    (variant === 'vertical-spine' || !hasLateralBranches) &&
    ((module?.branchesAboveFile ?? 0) === 0 ||
      (module?.branchesBelowFile ?? 0) === 0)
      ? 1
      : 0;
  const demandMismatch =
    demandPolicy === 'spatial-cardinal'
      ? (() => {
          const alignment = moduleDemandAlignment(
            endpointPlan,
            baseline,
            candidate,
            input,
            moduleId,
            demandPolicy,
            spatialDemandSummary,
          );
          return alignment.demanded - alignment.matched;
        })()
      : 0;
  return [
    exactEndpointCrossingCount,
    order.adjacentRankOrderInversionCount,
    quality.internalHierarchyCrossingCount,
    demandMismatch,
    oneSided,
    variant === 'vertical-spine' || !hasLateralBranches
      ? (module?.packedExtentImbalance ?? 0)
      : 0,
    quality.totalPrimaryReferenceManhattanSpan,
    quality.totalPrimaryReferenceVerticalSpan,
    quality.internalSourceOrderDeviation,
    variant === 'adaptive-compass' ? (module?.width ?? 0) : 0,
    variant === 'adaptive-compass' ? (module?.area ?? 0) : 0,
    stableKey,
  ];
}

function improves(
  left: readonly (number | string)[],
  right: readonly (number | string)[],
) {
  for (let index = 0; index < left.length - 1; index += 1) {
    const delta = (left[index] as number) - (right[index] as number);
    if (Math.abs(delta) > EPSILON) return delta < 0;
  }
  return (
    compareText(
      left[left.length - 1] as string,
      right[right.length - 1] as string,
    ) < 0
  );
}

function regionOrders(
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
  structure: ModuleStructure,
  regionByRootId: ReadonlyMap<ProjectionNodeId, CompassRegion>,
  policy: FocusSchematicEndpointOrderPolicy,
  demandPolicy: FocusSchematicCompassDemandPolicy = 'directional-horizontal',
  spatialDemandSummary: FocusSchematicSpatialDemandSummary = 'dominant-cardinal',
): ReadonlyMap<CompassRegion, readonly ProjectionNodeId[]> {
  const demand = new Map(
    structure.branches.map((branch) => [
      branch.rootId,
      branchDemand(
        endpointPlan,
        candidate,
        structure,
        branch,
        demandPolicy,
        spatialDemandSummary,
      ),
    ]),
  );
  return new Map(
    (['top', 'bottom', 'left', 'right'] as const).map((region) => [
      region,
      structure.branches
        .filter((branch) => regionByRootId.get(branch.rootId) === region)
        .sort((left, right) =>
          policy === 'crossing-optimized'
            ? demand.get(left.rootId)!.preferredY -
                demand.get(right.rootId)!.preferredY ||
              left.sourceIndex - right.sourceIndex ||
              compareText(left.rootId, right.rootId)
            : left.sourceIndex - right.sourceIndex ||
              compareText(left.rootId, right.rootId),
        )
        .map(({ rootId }) => rootId),
    ]),
  );
}

function selectBest(
  candidates: readonly {
    readonly candidate: FocusSchematicLayoutCandidate;
    readonly key: string;
  }[],
  score: (item: {
    readonly candidate: FocusSchematicLayoutCandidate;
    readonly key: string;
  }) => readonly (number | string)[],
) {
  if (candidates.length === 0)
    throw new Error('Internal layout generated no candidates.');
  return candidates
    .slice(1)
    .reduce(
      (best, item) => (improves(score(item), score(best)) ? item : best),
      candidates[0]!,
    );
}

function verticalSpineModule(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  initial: FocusSchematicLayoutCandidate,
  structure: ModuleStructure,
  policy: FocusSchematicEndpointOrderPolicy,
  stats: FocusSchematicInternalLayoutRunStats,
  attachmentPolicy: FocusSchematicEndpointAttachmentPolicy,
): FocusSchematicLayoutCandidate {
  const demand = new Map(
    structure.branches.map((branch) => [
      branch.rootId,
      branchDemand(endpointPlan, initial, structure, branch),
    ]),
  );
  const sourceOrder = structure.branches.map(({ rootId }) => rootId);
  const demandOrder = [...structure.branches]
    .sort(
      (left, right) =>
        demand.get(left.rootId)!.preferredY -
          demand.get(right.rootId)!.preferredY ||
        left.sourceIndex - right.sourceIndex ||
        compareText(left.rootId, right.rootId),
    )
    .map(({ rootId }) => rootId);
  const orders = new Map<string, readonly ProjectionNodeId[]>();
  orders.set(sourceOrder.join('\u0000'), sourceOrder);
  if (policy === 'crossing-optimized')
    orders.set(demandOrder.join('\u0000'), demandOrder);
  if (policy === 'crossing-optimized') {
    let working = demandOrder;
    for (
      let sweep = 0;
      sweep < FOCUS_SCHEMATIC_COMPASS_LOCAL_RELOCATION_SWEEP_LIMIT;
      sweep += 1
    ) {
      const indexes = Array.from(
        { length: Math.max(0, working.length - 1) },
        (_, index) => index,
      );
      if (sweep % 2 === 1) indexes.reverse();
      for (const index of indexes) {
        const swapped = [...working];
        [swapped[index], swapped[index + 1]] = [
          swapped[index + 1]!,
          swapped[index]!,
        ];
        orders.set(swapped.join('\u0000'), swapped);
        working = swapped;
      }
    }
  }
  const candidates: {
    candidate: FocusSchematicLayoutCandidate;
    key: string;
  }[] = [];
  for (const order of orders.values()) {
    for (let cut = 0; cut <= order.length; cut += 1) {
      if (
        candidates.length >=
        FOCUS_SCHEMATIC_VERTICAL_SPINE_PLACEMENT_CANDIDATE_CAP
      )
        break;
      const regionByRootId = new Map<ProjectionNodeId, CompassRegion>(
        order.map((rootId, index) => [rootId, index < cut ? 'top' : 'bottom']),
      );
      const orderByRegion = new Map<CompassRegion, readonly ProjectionNodeId[]>(
        [
          ['top', order.slice(0, cut)],
          ['bottom', order.slice(cut)],
          ['left', []],
          ['right', []],
        ],
      );
      candidates.push({
        candidate: placeRegions(
          input,
          initial,
          structure,
          regionByRootId,
          orderByRegion,
          true,
        ),
        key: `${order.join('|')}@${cut}`,
      });
      stats.placementCandidatesEvaluated += 1;
    }
  }
  return selectBest(candidates, ({ candidate, key }) =>
    scoreCandidate(
      input,
      modulePlan,
      endpointPlan,
      candidate,
      initial,
      structure.module.moduleId,
      'vertical-spine',
      key,
      attachmentPolicy,
    ),
  ).candidate;
}

function compassAssignments(
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
  structure: ModuleStructure,
  stats: FocusSchematicInternalLayoutRunStats,
  demandPolicy: FocusSchematicCompassDemandPolicy,
  spatialDemandSummary: FocusSchematicSpatialDemandSummary,
): readonly ReadonlyMap<ProjectionNodeId, CompassRegion>[] {
  const choices = structure.branches.map((branch) => {
    const demand = branchDemand(
      endpointPlan,
      candidate,
      structure,
      branch,
      demandPolicy,
      spatialDemandSummary,
    );
    if (demandPolicy === 'spatial-cardinal')
      return demand.preferredCardinal === null
        ? (['top', 'bottom'] as const)
        : ([demand.preferredCardinal, demand.fallbackCardinal] as const);
    if (demand.left > 0 && demand.right === 0)
      return ['left', branch.sourceIndex % 2 === 0 ? 'top' : 'bottom'] as const;
    if (demand.right > 0 && demand.left === 0)
      return [
        'right',
        branch.sourceIndex % 2 === 0 ? 'top' : 'bottom',
      ] as const;
    return ['top', 'bottom'] as const;
  });
  const combinationCount = 2 ** choices.length;
  const assignments: ReadonlyMap<ProjectionNodeId, CompassRegion>[] = [];
  if (combinationCount <= FOCUS_SCHEMATIC_COMPASS_ASSIGNMENT_CAP) {
    for (let mask = 0; mask < combinationCount; mask += 1)
      assignments.push(
        new Map(
          structure.branches.map((branch, index) => [
            branch.rootId,
            choices[index]![(mask >> index) & 1]!,
          ]),
        ),
      );
  } else {
    stats.largeModuleFallbackCount += 1;
    const initial = new Map<ProjectionNodeId, CompassRegion>();
    let topHeight = 0;
    let bottomHeight = 0;
    for (const [index, branch] of structure.branches.entries()) {
      const [preferred, fallback] = choices[index]!;
      if (preferred === 'top' && fallback === 'bottom') {
        const region = topHeight <= bottomHeight ? 'top' : 'bottom';
        initial.set(branch.rootId, region);
        if (region === 'top') topHeight += branch.height;
        else bottomHeight += branch.height;
      } else initial.set(branch.rootId, preferred);
    }
    assignments.push(initial);
    let working = initial;
    for (
      let sweep = 0;
      sweep < FOCUS_SCHEMATIC_COMPASS_LOCAL_RELOCATION_SWEEP_LIMIT;
      sweep += 1
    ) {
      stats.localRelocationSweeps += 1;
      const indexes = Array.from(
        { length: structure.branches.length },
        (_, index) => index,
      );
      if (sweep % 2 === 1) indexes.reverse();
      for (const index of indexes) {
        if (assignments.length >= FOCUS_SCHEMATIC_COMPASS_ASSIGNMENT_CAP) break;
        const branch = structure.branches[index]!;
        const next = new Map(working);
        const [first, second] = choices[index]!;
        next.set(
          branch.rootId,
          next.get(branch.rootId) === first ? second : first,
        );
        assignments.push(next);
        working = next;
      }
    }
  }
  stats.completeCompassAssignmentsEvaluated += assignments.length;
  return assignments;
}

function adaptiveCompassModule(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  initial: FocusSchematicLayoutCandidate,
  structure: ModuleStructure,
  policy: FocusSchematicEndpointOrderPolicy,
  stats: FocusSchematicInternalLayoutRunStats,
  attachmentPolicy: FocusSchematicEndpointAttachmentPolicy,
  demandPolicy: FocusSchematicCompassDemandPolicy,
  spatialDemandSummary: FocusSchematicSpatialDemandSummary,
): FocusSchematicLayoutCandidate {
  const candidates = compassAssignments(
    endpointPlan,
    initial,
    structure,
    stats,
    demandPolicy,
    spatialDemandSummary,
  ).flatMap((regionByRootId, assignmentIndex) => {
    const policies: FocusSchematicEndpointOrderPolicy[] =
      policy === 'crossing-optimized'
        ? ['document-order', 'crossing-optimized']
        : ['document-order'];
    return policies.map((orderingPolicy) => {
      const orderByRegion = regionOrders(
        endpointPlan,
        initial,
        structure,
        regionByRootId,
        orderingPolicy,
        demandPolicy,
        spatialDemandSummary,
      );
      stats.placementCandidatesEvaluated += 1;
      return {
        candidate: placeRegions(
          input,
          initial,
          structure,
          regionByRootId,
          orderByRegion,
          false,
        ),
        key: `${assignmentIndex}:${orderingPolicy}:${structure.branches
          .map(({ rootId }) => `${rootId}:${regionByRootId.get(rootId)}`)
          .join('|')}`,
      };
    });
  });
  if (demandPolicy === 'spatial-cardinal')
    candidates.push({ candidate: initial, key: '' });
  const score = ({ candidate, key }: (typeof candidates)[number]) =>
    scoreCandidate(
      input,
      modulePlan,
      endpointPlan,
      candidate,
      initial,
      structure.module.moduleId,
      'adaptive-compass',
      key,
      attachmentPolicy,
      demandPolicy,
      spatialDemandSummary,
    );
  const selected = selectBest(candidates, score);
  if (demandPolicy === 'spatial-cardinal') {
    const selectedScore = score(selected);
    const leastMismatch = Math.min(
      ...candidates.map((item) => score(item)[3] as number),
    );
    if ((selectedScore[3] as number) > leastMismatch) {
      const aligned = selectBest(
        candidates.filter(
          (item) => (score(item)[3] as number) === leastMismatch,
        ),
        score,
      );
      const alignedScore = score(aligned);
      if ((selectedScore[0] as number) < (alignedScore[0] as number))
        stats.spatialDemandCrossingOverrideCount += 1;
      else if ((selectedScore[1] as number) < (alignedScore[1] as number))
        stats.spatialDemandInversionOverrideCount += 1;
      else if ((selectedScore[2] as number) < (alignedScore[2] as number))
        stats.spatialDemandHierarchyOverrideCount += 1;
    }
  }
  return selected.candidate;
}

export function applyFocusSchematicInternalLayoutVariant(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  initial: FocusSchematicLayoutCandidate,
  variant: FocusSchematicInternalLayoutVariant,
  policy: FocusSchematicEndpointOrderPolicy,
  stats: FocusSchematicInternalLayoutRunStats,
  attachmentPolicy: FocusSchematicEndpointAttachmentPolicy = 'directional',
  compassDemandPolicy: FocusSchematicCompassDemandPolicy = 'directional-horizontal',
  spatialDemandSummary: FocusSchematicSpatialDemandSummary = 'dominant-cardinal',
): FocusSchematicLayoutCandidate {
  if (variant === 'current') return initial;
  let candidate = initial;
  for (const module of [...candidate.modules].sort((left, right) =>
    compareText(left.moduleId, right.moduleId),
  )) {
    const structure = moduleStructure(input, candidate, module.moduleId);
    if (structure === null || structure.branches.length === 0) continue;
    stats.optimizedModuleIds.add(module.moduleId);
    candidate =
      variant === 'vertical-spine'
        ? verticalSpineModule(
            input,
            modulePlan,
            endpointPlan,
            candidate,
            structure,
            policy,
            stats,
            attachmentPolicy,
          )
        : adaptiveCompassModule(
            input,
            modulePlan,
            endpointPlan,
            candidate,
            structure,
            policy,
            stats,
            attachmentPolicy,
            compassDemandPolicy,
            spatialDemandSummary,
          );
  }
  return candidate;
}

export function refineFocusSchematicInternalLayoutOrder(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  endpointPlan: FocusSchematicEndpointPlan,
  initial: FocusSchematicLayoutCandidate,
  variant: FocusSchematicInternalLayoutVariant,
  policy: FocusSchematicEndpointOrderPolicy,
  stats: FocusSchematicInternalLayoutRunStats,
  attachmentPolicy: FocusSchematicEndpointAttachmentPolicy = 'directional',
): FocusSchematicLayoutCandidate {
  if (variant === 'current' || policy === 'document-order') return initial;
  let candidate = initial;
  for (const module of [...candidate.modules].sort((left, right) =>
    compareText(left.moduleId, right.moduleId),
  )) {
    const structure = moduleStructure(input, candidate, module.moduleId);
    if (structure === null || structure.branches.length < 2) continue;
    const regionByRootId = new Map(
      structure.branches.map((branch) => [
        branch.rootId,
        classifyRegion(structure, branch),
      ]),
    );
    const sourceOrder = regionOrders(
      endpointPlan,
      candidate,
      structure,
      regionByRootId,
      'document-order',
    );
    const demandOrder = regionOrders(
      endpointPlan,
      candidate,
      structure,
      regionByRootId,
      'crossing-optimized',
    );
    const proposals = [sourceOrder, demandOrder].map((orderByRegion, index) => {
      stats.placementCandidatesEvaluated += 1;
      return {
        candidate: placeRegions(
          input,
          candidate,
          structure,
          regionByRootId,
          orderByRegion,
          variant === 'vertical-spine',
        ),
        key: String(index),
      };
    });
    candidate = selectBest(proposals, ({ candidate: proposal, key }) =>
      scoreCandidate(
        input,
        modulePlan,
        endpointPlan,
        proposal,
        candidate,
        module.moduleId,
        variant,
        key,
        attachmentPolicy,
      ),
    ).candidate;
  }
  return candidate;
}

export function createFocusSchematicInternalLayoutEvidence(
  input: FocusSchematicLayoutInput,
  endpointPlan: FocusSchematicEndpointPlan,
  candidate: FocusSchematicLayoutCandidate,
  movementBaseline: FocusSchematicLayoutCandidate,
  variant: FocusSchematicInternalLayoutVariant,
  stats: FocusSchematicInternalLayoutRunStats,
): FocusSchematicInternalLayoutEvidence {
  return {
    variant,
    developmentOnly: variant === 'current',
    verticalSpinePlacementCandidateCap:
      FOCUS_SCHEMATIC_VERTICAL_SPINE_PLACEMENT_CANDIDATE_CAP,
    compassAssignmentCap: FOCUS_SCHEMATIC_COMPASS_ASSIGNMENT_CAP,
    compassLocalRelocationSweepLimit:
      FOCUS_SCHEMATIC_COMPASS_LOCAL_RELOCATION_SWEEP_LIMIT,
    jointFolderRoundLimit: FOCUS_SCHEMATIC_INTERNAL_FOLDER_JOINT_ROUND_LIMIT,
    jointFolderRounds: stats.jointFolderRounds,
    modulesOptimized: stats.optimizedModuleIds.size,
    completeCompassAssignmentsEvaluated:
      stats.completeCompassAssignmentsEvaluated,
    placementCandidatesEvaluated: stats.placementCandidatesEvaluated,
    localRelocationSweeps: stats.localRelocationSweeps,
    largeModuleFallbackCount: stats.largeModuleFallbackCount,
    moduleMetrics: candidate.modules
      .flatMap((module) => {
        const metrics = moduleMetrics(input, candidate, module.moduleId);
        return metrics === null ? [] : [metrics];
      })
      .sort((left, right) => compareText(left.moduleId, right.moduleId)),
    metrics: qualityMetrics(input, endpointPlan, candidate, movementBaseline),
  };
}
