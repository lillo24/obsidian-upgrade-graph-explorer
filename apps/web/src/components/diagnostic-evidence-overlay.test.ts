import { describe, expect, it } from 'vitest';

import { activateDiagnosticEvidenceOverlay } from './diagnostic-evidence-overlay';

describe('diagnostic evidence overlay lifecycle', () => {
  it('focuses the dialog, owns Escape, restores scroll, and returns focus', () => {
    type Listener = (event: {
      readonly key: string;
      preventDefault(): void;
      stopImmediatePropagation(): void;
    }) => void;
    const listeners: Listener[] = [];
    const bodyStyle = { overflow: 'scroll' };
    let initialFocuses = 0;
    let returnFocuses = 0;
    let fallbackFocuses = 0;
    let closes = 0;
    let prevented = 0;
    let stopped = 0;
    const cleanup = activateDiagnosticEvidenceOverlay(
      {
        bodyStyle,
        initialFocus: { focus: () => (initialFocuses += 1) },
        returnFocus: {
          isConnected: true,
          focus: () => (returnFocuses += 1),
        },
        fallbackFocus: { focus: () => (fallbackFocuses += 1) },
        addKeydownListener: (listener) => listeners.push(listener),
        removeKeydownListener: (listener) => {
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        },
        queueFocus: (callback) => callback(),
      },
      () => (closes += 1),
    );

    expect(bodyStyle.overflow).toBe('hidden');
    expect(initialFocuses).toBe(1);
    listeners[0]?.({
      key: 'Enter',
      preventDefault: () => (prevented += 1),
      stopImmediatePropagation: () => (stopped += 1),
    });
    expect(closes).toBe(0);
    listeners[0]?.({
      key: 'Escape',
      preventDefault: () => (prevented += 1),
      stopImmediatePropagation: () => (stopped += 1),
    });
    expect({ closes, prevented, stopped }).toEqual({
      closes: 1,
      prevented: 1,
      stopped: 1,
    });

    cleanup();
    expect(bodyStyle.overflow).toBe('scroll');
    expect(returnFocuses).toBe(1);
    expect(fallbackFocuses).toBe(0);
    expect(listeners).toHaveLength(0);
  });

  it('falls back to the main landmark when the launcher was unmounted', () => {
    let fallbackFocuses = 0;
    const cleanup = activateDiagnosticEvidenceOverlay(
      {
        bodyStyle: { overflow: '' },
        initialFocus: { focus: () => undefined },
        returnFocus: { isConnected: false, focus: () => undefined },
        fallbackFocus: { focus: () => (fallbackFocuses += 1) },
        addKeydownListener: () => undefined,
        removeKeydownListener: () => undefined,
        queueFocus: (callback) => callback(),
      },
      () => undefined,
    );

    cleanup();
    expect(fallbackFocuses).toBe(1);
  });
});
