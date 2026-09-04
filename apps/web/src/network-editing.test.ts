import { describe, expect, it } from 'vitest';

import { NETWORK_EDITING_OFF, reduceNetworkEditing } from './network-editing';

describe('Network editing state contract', () => {
  it('allows exactly one transient editing tool at a time', () => {
    const move = reduceNetworkEditing(NETWORK_EDITING_OFF, {
      type: 'enter',
      tool: 'move-file',
    });
    expect(move).toEqual({
      state: { phase: 'editing', tool: 'move-file' },
      clearActiveGesture: false,
    });
    expect(
      reduceNetworkEditing(move.state, {
        type: 'switch-tool',
        tool: 'arrange-folder',
      }),
    ).toEqual({
      state: { phase: 'editing', tool: 'arrange-folder' },
      clearActiveGesture: true,
    });
  });

  it.each(['exit', 'leave-network', 'workspace-changed'] as const)(
    '%s clears editing and any active transient gesture',
    (type) => {
      expect(
        reduceNetworkEditing({ phase: 'editing', tool: 'move-file' }, { type }),
      ).toEqual({ state: NETWORK_EDITING_OFF, clearActiveGesture: true });
    },
  );

  it('keeps repeated tool selection idempotent and out of persistence/history', () => {
    const state = { phase: 'editing', tool: 'move-file' } as const;
    const transition = reduceNetworkEditing(state, {
      type: 'switch-tool',
      tool: 'move-file',
    });
    expect(transition).toEqual({ state, clearActiveGesture: false });
    expect(Object.keys(transition.state).sort()).toEqual(['phase', 'tool']);
  });
});
