import type {
  PersistedRendererViewports,
  PersistedViewportAnchor,
  GraphPresentationMode,
} from '@icarus-graph-explorer/view-state';
import type {
  ProjectionNodeId,
  ViewProjection,
  ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import type { GraphStateAction } from './graph-state';

export const GRAPH_NAVIGATION_HISTORY_LIMIT = 100;

const VIEWPORT_ZOOM_EPSILON = 0.0001;

export interface GraphHistoryCheckpoint {
  readonly presentationMode: GraphPresentationMode;
  readonly state: ViewProjectionState;
  readonly viewports: PersistedRendererViewports;
}

export interface GraphNavigationHistory {
  readonly past: readonly GraphHistoryCheckpoint[];
  readonly future: readonly GraphHistoryCheckpoint[];
}

export type GraphHistoryActionPolicy = 'record' | 'system' | 'clear';

export type GraphHistoryTraversal = {
  readonly history: GraphNavigationHistory;
  readonly target: GraphHistoryCheckpoint;
};

export type SemanticViewportRestore =
  | { readonly kind: 'fit' }
  | {
      readonly kind: 'center';
      readonly nodeId: ProjectionNodeId;
      readonly zoom: number;
    };

function sameValues<T>(
  left: readonly T[] | undefined,
  right: readonly T[] | undefined,
): boolean {
  return (
    left === right ||
    (left !== undefined &&
      right !== undefined &&
      left.length === right.length &&
      left.every((value, index) => value === right[index]))
  );
}

export function sameGraphViewState(
  left: ViewProjectionState,
  right: ViewProjectionState,
): boolean {
  if (left === right) return true;
  const leftDisclosure = left.disclosure;
  const rightDisclosure = right.disclosure;
  const leftFocus = left.focus;
  const rightFocus = right.focus;
  const leftFilters = left.filters;
  const rightFilters = right.filters;
  return (
    leftDisclosure.defaultDepth === rightDisclosure.defaultDepth &&
    leftDisclosure.maxSectionLevel === rightDisclosure.maxSectionLevel &&
    leftDisclosure.includeBlocks === rightDisclosure.includeBlocks &&
    sameValues(
      leftDisclosure.expandedEntityIds,
      rightDisclosure.expandedEntityIds,
    ) &&
    sameValues(
      leftDisclosure.collapsedEntityIds,
      rightDisclosure.collapsedEntityIds,
    ) &&
    ((leftFocus === undefined && rightFocus === undefined) ||
      (leftFocus !== undefined &&
        rightFocus !== undefined &&
        leftFocus.rootEntityId === rightFocus.rootEntityId &&
        leftFocus.hops === rightFocus.hops &&
        leftFocus.direction === rightFocus.direction &&
        leftFocus.hierarchyContext === rightFocus.hierarchyContext)) &&
    ((leftFilters === undefined && rightFilters === undefined) ||
      (leftFilters !== undefined &&
        rightFilters !== undefined &&
        leftFilters.text === rightFilters.text &&
        leftFilters.query === rightFilters.query &&
        sameValues(leftFilters.pathPrefixes, rightFilters.pathPrefixes) &&
        sameValues(leftFilters.entityKinds, rightFilters.entityKinds) &&
        sameValues(
          leftFilters.referenceStatuses,
          rightFilters.referenceStatuses,
        )))
  );
}

function sameViewport(
  left: PersistedViewportAnchor | undefined,
  right: PersistedViewportAnchor | undefined,
): boolean {
  return (
    left === right ||
    (left !== undefined &&
      right !== undefined &&
      left.anchorEntityId === right.anchorEntityId &&
      Math.abs(left.zoom - right.zoom) <= VIEWPORT_ZOOM_EPSILON)
  );
}

function sameRendererViewports(
  left: PersistedRendererViewports,
  right: PersistedRendererViewports,
): boolean {
  const sameGlobal =
    (left.global === undefined && right.global === undefined) ||
    (left.global !== undefined &&
      right.global !== undefined &&
      left.global.anchorEntityId === right.global.anchorEntityId &&
      Math.abs(left.global.ratio - right.global.ratio) <=
        VIEWPORT_ZOOM_EPSILON);
  const sameStructuredZoom =
    (left.local?.structuredZoom === undefined &&
      right.local?.structuredZoom === undefined) ||
    (left.local?.structuredZoom !== undefined &&
      right.local?.structuredZoom !== undefined &&
      Math.abs(left.local.structuredZoom - right.local.structuredZoom) <=
        VIEWPORT_ZOOM_EPSILON);
  const sameLocal =
    (left.local === undefined && right.local === undefined) ||
    (left.local !== undefined &&
      right.local !== undefined &&
      left.local.anchorEntityId === right.local.anchorEntityId &&
      Math.abs(left.local.freeRatio - right.local.freeRatio) <=
        VIEWPORT_ZOOM_EPSILON &&
      sameStructuredZoom);
  return (
    sameViewport(left.structure, right.structure) && sameGlobal && sameLocal
  );
}

export function createGraphHistoryCheckpoint(
  state: ViewProjectionState,
  viewport?: PersistedViewportAnchor,
  presentationMode: GraphPresentationMode = 'structure',
  viewports: PersistedRendererViewports = {},
): GraphHistoryCheckpoint {
  return {
    presentationMode,
    state,
    viewports: {
      ...(viewports.structure !== undefined
        ? { structure: viewports.structure }
        : viewport !== undefined
          ? { structure: viewport }
          : {}),
      ...(viewports.global === undefined ? {} : { global: viewports.global }),
      ...(viewports.local === undefined ? {} : { local: viewports.local }),
    },
  };
}

export function sameGraphHistoryCheckpoint(
  left: GraphHistoryCheckpoint,
  right: GraphHistoryCheckpoint,
): boolean {
  return (
    left.presentationMode === right.presentationMode &&
    sameGraphViewState(left.state, right.state) &&
    sameRendererViewports(left.viewports, right.viewports)
  );
}

export function createGraphNavigationHistory(): GraphNavigationHistory {
  return { past: [], future: [] };
}

/** Request identity advances independently from whether a request is active. */
export function nextGraphViewportRequestKey(lastIssuedKey: number): number {
  return lastIssuedKey + 1;
}

function appendBounded(
  entries: readonly GraphHistoryCheckpoint[],
  checkpoint: GraphHistoryCheckpoint,
): readonly GraphHistoryCheckpoint[] {
  const overflow = entries.length + 1 - GRAPH_NAVIGATION_HISTORY_LIMIT;
  return [...(overflow > 0 ? entries.slice(overflow) : entries), checkpoint];
}

export function recordGraphNavigation(
  history: GraphNavigationHistory,
  current: GraphHistoryCheckpoint,
  destination: GraphHistoryCheckpoint,
): GraphNavigationHistory {
  if (sameGraphHistoryCheckpoint(current, destination)) return history;
  return {
    past: appendBounded(history.past, current),
    future: [],
  };
}

export function goBackInGraphHistory(
  history: GraphNavigationHistory,
  current: GraphHistoryCheckpoint,
): GraphHistoryTraversal | null {
  const target = history.past.at(-1);
  if (target === undefined) return null;
  return {
    target,
    history: {
      past: history.past.slice(0, -1),
      future: appendBounded(history.future, current),
    },
  };
}

export function goForwardInGraphHistory(
  history: GraphNavigationHistory,
  current: GraphHistoryCheckpoint,
): GraphHistoryTraversal | null {
  const target = history.future.at(-1);
  if (target === undefined) return null;
  return {
    target,
    history: {
      past: appendBounded(history.past, current),
      future: history.future.slice(0, -1),
    },
  };
}

/** Jumps to the most recent checkpoint for a presentation, preserving history. */
export function returnToPresentationInGraphHistory(
  history: GraphNavigationHistory,
  current: GraphHistoryCheckpoint,
  presentationMode: GraphPresentationMode,
): GraphHistoryTraversal | null {
  let targetIndex = -1;
  for (let index = history.past.length - 1; index >= 0; index -= 1) {
    if (history.past[index]?.presentationMode === presentationMode) {
      targetIndex = index;
      break;
    }
  }
  if (targetIndex < 0) return null;
  const target = history.past[targetIndex];
  if (target === undefined) return null;
  const skipped = history.past.slice(targetIndex + 1);
  let future = appendBounded(history.future, current);
  for (const checkpoint of [...skipped].reverse()) {
    future = appendBounded(future, checkpoint);
  }
  return {
    target,
    history: { past: history.past.slice(0, targetIndex), future },
  };
}

export function graphHistoryActionPolicy(
  action: GraphStateAction,
): GraphHistoryActionPolicy {
  switch (action.type) {
    case 'toggle-entity':
    case 'set-depth':
    case 'set-heading-limit':
    case 'set-include-blocks':
    case 'enter-focus':
    case 'exit-focus':
    case 'set-focus-hops':
    case 'set-focus-direction':
    case 'set-path-scope':
    case 'set-query':
    case 'toggle-entity-kind':
    case 'toggle-reference-status':
    case 'apply-navigation':
      return 'record';
    case 'replace-state':
      return 'system';
    case 'reset-view':
      return 'clear';
  }
}

export function planSemanticViewportRestore(
  projection: ViewProjection,
  viewport: PersistedViewportAnchor | undefined,
): SemanticViewportRestore {
  if (viewport === undefined) return { kind: 'fit' };
  const anchor = projection.nodes.find(
    (candidate) =>
      candidate.kind === 'entity' &&
      candidate.entityId === viewport.anchorEntityId,
  );
  return anchor === undefined
    ? { kind: 'fit' }
    : { kind: 'center', nodeId: anchor.id, zoom: viewport.zoom };
}
