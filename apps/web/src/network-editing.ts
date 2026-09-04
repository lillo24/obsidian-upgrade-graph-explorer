export type NetworkEditingTool = 'move-file' | 'arrange-folder';

export type NetworkEditingState =
  | { readonly phase: 'off' }
  | { readonly phase: 'editing'; readonly tool: NetworkEditingTool };

export type NetworkEditingAction =
  | { readonly type: 'enter'; readonly tool: NetworkEditingTool }
  | { readonly type: 'switch-tool'; readonly tool: NetworkEditingTool }
  | { readonly type: 'exit' }
  | { readonly type: 'leave-network' }
  | { readonly type: 'workspace-changed' };

export interface NetworkEditingTransition {
  readonly state: NetworkEditingState;
  /** The renderer must end any temporary gesture before applying this state. */
  readonly clearActiveGesture: boolean;
}

export const NETWORK_EDITING_OFF = {
  phase: 'off',
} as const satisfies NetworkEditingState;

/**
 * Pure, transient product contract for the future Network editing toolbar.
 * It owns no persistence and intentionally does not participate in history.
 */
export function reduceNetworkEditing(
  state: NetworkEditingState,
  action: NetworkEditingAction,
): NetworkEditingTransition {
  switch (action.type) {
    case 'enter':
      return {
        state: { phase: 'editing', tool: action.tool },
        clearActiveGesture:
          state.phase === 'editing' && state.tool !== action.tool,
      };
    case 'switch-tool':
      return state.phase === 'editing' && state.tool === action.tool
        ? { state, clearActiveGesture: false }
        : {
            state: { phase: 'editing', tool: action.tool },
            clearActiveGesture: state.phase === 'editing',
          };
    case 'exit':
    case 'leave-network':
    case 'workspace-changed':
      return {
        state: NETWORK_EDITING_OFF,
        clearActiveGesture: state.phase === 'editing',
      };
  }
}
