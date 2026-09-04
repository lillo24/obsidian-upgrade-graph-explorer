export type LocalInteraction =
  | 'zoom'
  | 'pan'
  | 'hover'
  | 'selection'
  | 'visual-group-style-change'
  | 'inspector'
  | 'disclosure-change'
  | 'focus-change'
  | 'source-topology-change'
  | 'exact-cache-hit'
  | 'accepted-layout'
  | 'density-strength-change'
  | 'manual-fit';

export interface LocalInteractionOperationContract {
  readonly projection: 0 | 1;
  readonly topologyReconciliation: 0 | 1;
  readonly layoutRequest: 0 | 1;
  readonly globalLayoutRequest: 0;
  readonly densityEvaluation: 0 | 1;
  readonly visualRefresh: 0 | 1;
}

const VISUAL_ONLY = {
  projection: 0,
  topologyReconciliation: 0,
  layoutRequest: 0,
  globalLayoutRequest: 0,
  densityEvaluation: 0,
  visualRefresh: 1,
} as const;

const NO_RENDERER_WORK = {
  projection: 0,
  topologyReconciliation: 0,
  layoutRequest: 0,
  globalLayoutRequest: 0,
  densityEvaluation: 0,
  visualRefresh: 0,
} as const;

const LOCAL_TOPOLOGY = {
  projection: 1,
  topologyReconciliation: 1,
  layoutRequest: 1,
  globalLayoutRequest: 0,
  densityEvaluation: 0,
  visualRefresh: 1,
} as const;

/** Product oracle proving Local interaction and Global layout isolation. */
export const LOCAL_INTERACTION_OPERATION_CONTRACTS: Readonly<
  Record<LocalInteraction, LocalInteractionOperationContract>
> = {
  zoom: VISUAL_ONLY,
  pan: VISUAL_ONLY,
  hover: VISUAL_ONLY,
  selection: VISUAL_ONLY,
  'visual-group-style-change': VISUAL_ONLY,
  inspector: NO_RENDERER_WORK,
  'disclosure-change': LOCAL_TOPOLOGY,
  'focus-change': LOCAL_TOPOLOGY,
  'source-topology-change': LOCAL_TOPOLOGY,
  'exact-cache-hit': {
    projection: 0,
    topologyReconciliation: 0,
    layoutRequest: 0,
    globalLayoutRequest: 0,
    densityEvaluation: 1,
    visualRefresh: 1,
  },
  'accepted-layout': {
    projection: 0,
    topologyReconciliation: 0,
    layoutRequest: 0,
    globalLayoutRequest: 0,
    densityEvaluation: 1,
    visualRefresh: 1,
  },
  'density-strength-change': VISUAL_ONLY,
  'manual-fit': VISUAL_ONLY,
};
