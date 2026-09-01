export type WorkspaceOverlay = 'settings' | 'tools' | null;
export type WorkspaceToolPanel = 'filters' | 'groups' | null;

export interface GraphWorkspaceOverlayState {
  readonly activeOverlay: WorkspaceOverlay;
  readonly activeToolPanel: WorkspaceToolPanel;
}

export type GraphWorkspaceOverlayAction =
  | { readonly type: 'change-settings'; readonly open: boolean }
  | {
      readonly type: 'change-tool-panel';
      readonly panel: Exclude<WorkspaceToolPanel, null>;
      readonly open: boolean;
      readonly maximized: boolean;
    }
  | { readonly type: 'toggle-tools' }
  | { readonly type: 'close-tools' }
  | { readonly type: 'close-all' };

export const CLOSED_GRAPH_WORKSPACE_OVERLAYS: GraphWorkspaceOverlayState = {
  activeOverlay: null,
  activeToolPanel: null,
};

/** Keeps graph toolbar overlays deterministic without entering KG6 view state. */
export function graphWorkspaceOverlayReducer(
  state: GraphWorkspaceOverlayState,
  action: GraphWorkspaceOverlayAction,
): GraphWorkspaceOverlayState {
  switch (action.type) {
    case 'change-settings':
      if (action.open) {
        return { activeOverlay: 'settings', activeToolPanel: null };
      }
      return state.activeOverlay === 'settings'
        ? CLOSED_GRAPH_WORKSPACE_OVERLAYS
        : state;
    case 'change-tool-panel':
      if (action.open) {
        return {
          activeOverlay: action.maximized ? 'tools' : null,
          activeToolPanel: action.panel,
        };
      }
      return state.activeToolPanel === action.panel
        ? { ...state, activeToolPanel: null }
        : state;
    case 'toggle-tools':
      return state.activeOverlay === 'tools'
        ? CLOSED_GRAPH_WORKSPACE_OVERLAYS
        : { activeOverlay: 'tools', activeToolPanel: null };
    case 'close-tools':
      return state.activeOverlay === 'tools' || state.activeToolPanel !== null
        ? CLOSED_GRAPH_WORKSPACE_OVERLAYS
        : state;
    case 'close-all':
      return state.activeOverlay === null && state.activeToolPanel === null
        ? state
        : CLOSED_GRAPH_WORKSPACE_OVERLAYS;
  }
}
