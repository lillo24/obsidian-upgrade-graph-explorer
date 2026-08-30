import type { DagreLayoutInput } from '@icarus-graph-explorer/dagre-layout';

import type { RendererGraph } from './types';
import type { DisclosureAnchor } from './viewport-navigation';

export interface CommittedRendererLayout {
  readonly generation: number;
  readonly input: DagreLayoutInput;
  readonly graph: RendererGraph;
  readonly disclosureAnchor: DisclosureAnchor | null;
}

export interface RendererLayoutState {
  readonly pendingGeneration: number | null;
  readonly committed: CommittedRendererLayout | null;
}

export const INITIAL_RENDERER_LAYOUT_STATE: RendererLayoutState = {
  pendingGeneration: null,
  committed: null,
};

export function beginRendererLayout(
  state: RendererLayoutState,
  generation: number,
): RendererLayoutState {
  return { ...state, pendingGeneration: generation };
}

export function commitRendererLayout(
  state: RendererLayoutState,
  committed: CommittedRendererLayout,
): RendererLayoutState {
  if (state.pendingGeneration !== committed.generation) return state;
  return { pendingGeneration: null, committed };
}
