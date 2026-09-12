import { describe, expect, it } from 'vitest';

import {
  NETWORK_EDITING_OFF,
  networkFileMoveKeyboardAction,
  reduceNetworkEditing,
} from './network-editing';

describe('Network editing state contract', () => {
  it('gives the explicit folder editor one transient owner', () => {
    const arrange = reduceNetworkEditing(NETWORK_EDITING_OFF, {
      type: 'enter',
      tool: 'arrange-folder',
    });
    expect(arrange).toEqual({
      state: { phase: 'editing', tool: 'arrange-folder' },
      clearActiveGesture: false,
    });
    expect(
      reduceNetworkEditing(arrange.state, {
        type: 'switch-tool',
        tool: 'arrange-folder',
      }),
    ).toEqual({
      state: { phase: 'editing', tool: 'arrange-folder' },
      clearActiveGesture: false,
    });
  });

  it.each(['exit', 'leave-network', 'workspace-changed'] as const)(
    '%s clears editing and any active transient gesture',
    (type) => {
      expect(
        reduceNetworkEditing(
          { phase: 'editing', tool: 'arrange-folder' },
          { type },
        ),
      ).toEqual({ state: NETWORK_EDITING_OFF, clearActiveGesture: true });
    },
  );

  it('keeps repeated tool selection idempotent and out of persistence/history', () => {
    const state = { phase: 'editing', tool: 'arrange-folder' } as const;
    const transition = reduceNetworkEditing(state, {
      type: 'switch-tool',
      tool: 'arrange-folder',
    });
    expect(transition).toEqual({ state, clearActiveGesture: false });
    expect(Object.keys(transition.state).sort()).toEqual(['phase', 'tool']);
  });
});

describe('Network File move keyboard contract', () => {
  it.each([
    ['ArrowLeft', false, { kind: 'nudge', x: -8, y: 0 }],
    ['ArrowRight', true, { kind: 'nudge', x: 32, y: 0 }],
    ['ArrowUp', false, { kind: 'nudge', x: 0, y: -8 }],
    ['ArrowDown', true, { kind: 'nudge', x: 0, y: 32 }],
    ['Enter', false, { kind: 'release' }],
    [' ', false, { kind: 'release' }],
    ['Escape', false, { kind: 'cancel' }],
  ] as const)('%s maps to one viewport action', (key, shiftKey, expected) => {
    expect(
      networkFileMoveKeyboardAction({
        altKey: false,
        ctrlKey: false,
        key,
        metaKey: false,
        shiftKey,
      }),
    ).toEqual(expected);
  });

  it('leaves modified and unrelated keys available to their existing owners', () => {
    expect(
      networkFileMoveKeyboardAction({
        altKey: false,
        ctrlKey: true,
        key: 'ArrowLeft',
        metaKey: false,
        shiftKey: false,
      }),
    ).toEqual({ kind: 'none' });
    expect(
      networkFileMoveKeyboardAction({
        altKey: false,
        ctrlKey: false,
        key: 'Tab',
        metaKey: false,
        shiftKey: false,
      }),
    ).toEqual({ kind: 'none' });
  });
});
