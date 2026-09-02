import { describe, expect, it } from 'vitest';

import { activateGraphFiltersOverlay } from './graph-filters-overlay';

describe('graph Filters overlay keyboard behavior', () => {
  it('consumes Escape, closes only the panel, and restores trigger focus', () => {
    type Listener = (event: {
      readonly key: string;
      preventDefault(): void;
      stopImmediatePropagation(): void;
    }) => void;
    const listeners: Listener[] = [];
    const pointerListeners: Array<(event: { target: unknown }) => void> = [];
    let closes = 0;
    let focuses = 0;
    let prevented = 0;
    let stopped = 0;
    const cleanup = activateGraphFiltersOverlay(
      {
        trigger: {
          isConnected: true,
          focus: () => {
            focuses += 1;
          },
        },
        panelContains: (target) => target === 'panel',
        triggerContains: (target) => target === 'trigger',
        addKeydownListener: (listener) => listeners.push(listener),
        removeKeydownListener: (listener) => {
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        },
        addPointerdownListener: (listener) => pointerListeners.push(listener),
        removePointerdownListener: (listener) => {
          const index = pointerListeners.indexOf(listener);
          if (index >= 0) pointerListeners.splice(index, 1);
        },
        queueFocus: (callback) => callback(),
      },
      () => {
        closes += 1;
      },
    );

    listeners[0]?.({
      key: 'Enter',
      preventDefault: () => {
        prevented += 1;
      },
      stopImmediatePropagation: () => {
        stopped += 1;
      },
    });
    expect(closes).toBe(0);

    listeners[0]?.({
      key: 'Escape',
      preventDefault: () => {
        prevented += 1;
      },
      stopImmediatePropagation: () => {
        stopped += 1;
      },
    });
    expect({ closes, focuses, prevented, stopped }).toEqual({
      closes: 1,
      focuses: 1,
      prevented: 1,
      stopped: 1,
    });

    pointerListeners[0]?.({ target: 'panel' });
    pointerListeners[0]?.({ target: 'trigger' });
    expect(closes).toBe(1);

    pointerListeners[0]?.({ target: 'canvas' });
    expect(closes).toBe(2);
    expect(focuses).toBe(1);

    cleanup();
    expect(listeners).toHaveLength(0);
    expect(pointerListeners).toHaveLength(0);
  });
});
