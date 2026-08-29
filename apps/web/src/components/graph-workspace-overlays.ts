export type WorkspaceOverlay = 'settings' | 'tools' | null;

export interface GraphWorkspaceOverlayState {
  readonly activeOverlay: WorkspaceOverlay;
  readonly filtersOpen: boolean;
}

export type GraphWorkspaceOverlayAction =
  | { readonly type: 'change-settings'; readonly open: boolean }
  | {
      readonly type: 'change-filters';
      readonly open: boolean;
      readonly maximized: boolean;
    }
  | { readonly type: 'toggle-tools' }
  | { readonly type: 'close-tools' }
  | { readonly type: 'close-all' };

export const CLOSED_GRAPH_WORKSPACE_OVERLAYS: GraphWorkspaceOverlayState = {
  activeOverlay: null,
  filtersOpen: false,
};

/** Keeps graph toolbar overlays deterministic without entering KG6 view state. */
export function graphWorkspaceOverlayReducer(
  state: GraphWorkspaceOverlayState,
  action: GraphWorkspaceOverlayAction,
): GraphWorkspaceOverlayState {
  switch (action.type) {
    case 'change-settings':
      if (action.open) {
        return { activeOverlay: 'settings', filtersOpen: false };
      }
      return state.activeOverlay === 'settings'
        ? CLOSED_GRAPH_WORKSPACE_OVERLAYS
        : state;
    case 'change-filters':
      if (action.open) {
        return {
          activeOverlay: action.maximized ? 'tools' : null,
          filtersOpen: true,
        };
      }
      return state.filtersOpen ? { ...state, filtersOpen: false } : state;
    case 'toggle-tools':
      return state.activeOverlay === 'tools'
        ? CLOSED_GRAPH_WORKSPACE_OVERLAYS
        : { activeOverlay: 'tools', filtersOpen: false };
    case 'close-tools':
      return state.activeOverlay === 'tools' || state.filtersOpen
        ? CLOSED_GRAPH_WORKSPACE_OVERLAYS
        : state;
    case 'close-all':
      return state.activeOverlay === null && !state.filtersOpen
        ? state
        : CLOSED_GRAPH_WORKSPACE_OVERLAYS;
  }
}
