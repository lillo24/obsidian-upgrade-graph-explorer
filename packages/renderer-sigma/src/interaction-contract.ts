export type GlobalInteraction =
  | 'zoom'
  | 'pan'
  | 'hover'
  | 'selection'
  | 'inspector'
  | 'projection-change'
  | 'folder-assignment-change'
  | 'layout-settings-change'
  | 'source-topology-change'
  | 'explicit-relayout';

export interface GlobalInteractionOperationContract {
  readonly projection: 0 | 1;
  readonly graphReconciliation: 0 | 1;
  readonly layoutRequest: 0 | 1;
  readonly visualRefresh: 0 | 1;
}

const VISUAL_ONLY = {
  projection: 0,
  graphReconciliation: 0,
  layoutRequest: 0,
  visualRefresh: 1,
} as const;

const NO_RENDERER_WORK = {
  projection: 0,
  graphReconciliation: 0,
  layoutRequest: 0,
  visualRefresh: 0,
} as const;

/**
 * Deterministic product-operation oracle. Camera and selection interactions
 * remain reducer/camera work; only semantic or layout facts can request a new
 * background layout.
 */
export const GLOBAL_INTERACTION_OPERATION_CONTRACTS: Readonly<
  Record<GlobalInteraction, GlobalInteractionOperationContract>
> = {
  zoom: VISUAL_ONLY,
  pan: VISUAL_ONLY,
  hover: VISUAL_ONLY,
  selection: VISUAL_ONLY,
  inspector: NO_RENDERER_WORK,
  'projection-change': {
    projection: 1,
    graphReconciliation: 1,
    layoutRequest: 1,
    visualRefresh: 1,
  },
  'folder-assignment-change': {
    projection: 1,
    graphReconciliation: 1,
    layoutRequest: 1,
    visualRefresh: 1,
  },
  'layout-settings-change': {
    projection: 0,
    graphReconciliation: 0,
    layoutRequest: 1,
    visualRefresh: 1,
  },
  'source-topology-change': {
    projection: 1,
    graphReconciliation: 1,
    layoutRequest: 1,
    visualRefresh: 1,
  },
  'explicit-relayout': {
    projection: 0,
    graphReconciliation: 0,
    layoutRequest: 1,
    visualRefresh: 1,
  },
};
