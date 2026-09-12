import { describe, expect, it, vi } from 'vitest';

import { activateArgumentWorkspaceOverlay } from './argument-overlay';

function target(hidden = false) {
  return {
    isConnected: true,
    disabled: false,
    focus: vi.fn(),
    closest: () => (hidden ? ({} as Element) : null),
  };
}

describe('Arguments modal ownership', () => {
  it('owns Escape, wraps Tab focus, restores body overflow, and avoids hidden launchers', () => {
    const listeners: Array<(event: never) => void> = [];
    const initial = target();
    const last = target();
    const hiddenReturn = target(true);
    const fallback = target();
    const bodyStyle = { overflow: 'hidden' };
    const escape = vi.fn();
    const cleanup = activateArgumentWorkspaceOverlay(
      {
        bodyStyle,
        initialFocus: initial,
        returnFocus: hiddenReturn,
        fallbackFocus: fallback,
        focusables: () => [initial, last],
        addKeydownListener: (listener) => listeners.push(listener as never),
        removeKeydownListener: (listener) => {
          const index = listeners.indexOf(listener as never);
          if (index >= 0) listeners.splice(index, 1);
        },
        queueFocus: (callback) => callback(),
      },
      escape,
    );
    expect(initial.focus).toHaveBeenCalledOnce();
    const preventDefault = vi.fn();
    const stopImmediatePropagation = vi.fn();
    listeners[0]?.({
      key: 'Tab',
      shiftKey: false,
      target: last,
      preventDefault,
      stopImmediatePropagation,
    } as never);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(initial.focus).toHaveBeenCalledTimes(2);
    listeners[0]?.({
      key: 'Escape',
      shiftKey: false,
      target: initial,
      preventDefault,
      stopImmediatePropagation,
    } as never);
    expect(escape).toHaveBeenCalledOnce();
    expect(stopImmediatePropagation).toHaveBeenCalledOnce();
    cleanup();
    expect(bodyStyle.overflow).toBe('hidden');
    expect(hiddenReturn.focus).not.toHaveBeenCalled();
    expect(fallback.focus).toHaveBeenCalledOnce();
    expect(listeners).toHaveLength(0);
  });
});
