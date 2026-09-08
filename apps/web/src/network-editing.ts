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

export type NetworkFileMoveKeyboardAction =
  | { readonly kind: 'none' }
  | { readonly kind: 'nudge'; readonly x: number; readonly y: number }
  | { readonly kind: 'release' }
  | { readonly kind: 'cancel' };

/** Viewport-relative keyboard commands for the accessible Move File controller. */
export function networkFileMoveKeyboardAction(input: {
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly key: string;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}): NetworkFileMoveKeyboardAction {
  if (input.altKey || input.ctrlKey || input.metaKey) return { kind: 'none' };
  const step = input.shiftKey ? 32 : 8;
  switch (input.key) {
    case 'ArrowLeft':
      return { kind: 'nudge', x: -step, y: 0 };
    case 'ArrowRight':
      return { kind: 'nudge', x: step, y: 0 };
    case 'ArrowUp':
      return { kind: 'nudge', x: 0, y: -step };
    case 'ArrowDown':
      return { kind: 'nudge', x: 0, y: step };
    case 'Enter':
    case ' ':
      return { kind: 'release' };
    case 'Escape':
      return { kind: 'cancel' };
    default:
      return { kind: 'none' };
  }
}

export const NETWORK_EDITING_OFF = {
  phase: 'off',
} as const satisfies NetworkEditingState;

/**
 * Pure, transient product contract for the Network editing toolbar.
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
