import { describe, expect, it } from 'vitest';

import { activateGraphFiltersEscape } from './graph-filters-overlay';

describe('graph Filters overlay keyboard behavior', () => {
  it('consumes Escape, closes only the panel, and restores trigger focus', () => {
    type Listener = (event: {
      readonly key: string;
      preventDefault(): void;
      stopImmediatePropagation(): void;
    }) => void;
    const listeners: Listener[] = [];
    let closes = 0;
    let focuses = 0;
    let prevented = 0;
    let stopped = 0;
    const cleanup = activateGraphFiltersEscape(
      {
        trigger: {
          isConnected: true,
          focus: () => {
            focuses += 1;
          },
        },
        addKeydownListener: (listener) => listeners.push(listener),
        removeKeydownListener: (listener) => {
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
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

    cleanup();
    expect(listeners).toHaveLength(0);
  });
});
