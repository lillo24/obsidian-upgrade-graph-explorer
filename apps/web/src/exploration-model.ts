import type {
  GraphPresentationMode,
  LocalLayoutMode,
} from '@icarus-graph-explorer/view-state';

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
