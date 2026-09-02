import type {
  GraphPresentationMode,
  LocalLayoutMode,
} from '@icarus-graph-explorer/view-state';
import type { GraphVisualVariant } from '@icarus-graph-explorer/renderer-reactflow';

export type ExplorationScope = 'all' | 'focus';
export type ExplorationLayout = 'network' | 'hierarchy';

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
