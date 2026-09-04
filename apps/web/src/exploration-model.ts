import type {
  GraphPresentationMode,
  LocalLayoutMode,
} from '@icarus-graph-explorer/view-state';
import type { GraphVisualVariant } from '@icarus-graph-explorer/renderer-reactflow';
import {
  sameGlobalPhysicsSettings,
  type GlobalLayoutSettings,
} from '@icarus-graph-explorer/renderer-sigma/settings';
import type { ViewProjectionState } from '@icarus-graph-explorer/view-projection';

export type ExplorationScope = 'all' | 'focus';
export type ExplorationLayout = 'network' | 'hierarchy';

export interface ExplorationAvailability {
  readonly showExperimentalAllHierarchy: boolean;
  readonly allNetworkAvailable: boolean;
}

export function allHierarchyAvailable(
  availability: ExplorationAvailability,
): boolean {
  return (
    availability.showExperimentalAllHierarchy ||
    !availability.allNetworkAvailable
  );
}

/** All activation routes share this policy; callers reconcile missing roots first. */
export function resolveAvailablePresentationMode(
  requested: GraphPresentationMode,
  state: ViewProjectionState,
  availability: ExplorationAvailability,
  preferredAll: 'global' | 'structure' = 'global',
): GraphPresentationMode {
  if (requested === 'local') {
    if (state.focus !== undefined) return 'local';
    requested = preferredAll;
  }
  if (requested === 'structure' && allHierarchyAvailable(availability))
    return 'structure';
  return availability.allNetworkAvailable ? 'global' : 'structure';
}

export function explorationScope(
  presentationMode: GraphPresentationMode,
): ExplorationScope {
  return presentationMode === 'local' ? 'focus' : 'all';
}

export function explorationLayout(
  presentationMode: GraphPresentationMode,
  localLayoutMode: LocalLayoutMode,
): ExplorationLayout {
  if (presentationMode === 'global') return 'network';
  if (presentationMode === 'structure') return 'hierarchy';
  return localLayoutMode === 'free' ? 'network' : 'hierarchy';
}

export function allPresentationMode(
  layout: ExplorationLayout,
): Exclude<GraphPresentationMode, 'local'> {
  return layout === 'network' ? 'global' : 'structure';
}

export function focusLayoutMode(layout: ExplorationLayout): LocalLayoutMode {
  return layout === 'network' ? 'free' : 'structured';
}

/** Product density rule for hierarchy cards; Dagre mode remains independent. */
export function hierarchyVisualVariantForScope(
  scope: ExplorationScope,
): GraphVisualVariant {
  return scope === 'all' ? 'compact-schematic' : 'extended';
}

export function globalLayoutSettingsApplyImmediately(
  scope: ExplorationScope,
  layout: ExplorationLayout,
): boolean {
  return scope === 'all' && layout === 'network';
}

/** Explicit relayout policy: active All Network plus a real physics change. */
export function globalLayoutSettingsRequireImmediateLayout(
  scope: ExplorationScope,
  layout: ExplorationLayout,
  previous: GlobalLayoutSettings,
  next: GlobalLayoutSettings,
): boolean {
  return (
    globalLayoutSettingsApplyImmediately(scope, layout) &&
    !sameGlobalPhysicsSettings(previous, next)
  );
}
