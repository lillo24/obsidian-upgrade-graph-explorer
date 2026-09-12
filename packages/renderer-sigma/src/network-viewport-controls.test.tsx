// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NetworkViewportControls } from './NetworkViewportControls';

describe('Network viewport controls', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('renders the polished icon-only camera actions with accessible names', async () => {
    const onFit = vi.fn();
    const onMaximizedChange = vi.fn();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    await act(() =>
      root.render(
        <NetworkViewportControls
          label="All Network viewport controls"
          maximized={false}
          onFit={onFit}
          onMaximizedChange={onMaximizedChange}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
        />,
      ),
    );

    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Zoom in',
      'Zoom out',
      'Fit graph to view',
      'Maximize graph',
    ]);
    expect(
      buttons.every((button) => button.querySelector('svg') !== null),
    ).toBe(true);
    expect(container.textContent).toBe('');

    await act(() => buttons[0]!.click());
    await act(() => buttons[1]!.click());
    await act(() => buttons[2]!.click());
    await act(() => buttons[3]!.click());
    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    expect(onFit).toHaveBeenCalledTimes(1);
    expect(onMaximizedChange).toHaveBeenCalledWith(true);
  });

  it('switches only the shell action to Restore while maximized', async () => {
    const onFit = vi.fn();
    const onMaximizedChange = vi.fn();
    await act(() =>
      root.render(
        <NetworkViewportControls
          label="Focus Network viewport controls"
          maximized
          onFit={onFit}
          onMaximizedChange={onMaximizedChange}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
        />,
      ),
    );

    const restore = container.querySelector<HTMLButtonElement>(
      '[aria-label="Restore graph"]',
    );
    await act(() => restore!.click());
    expect(onMaximizedChange).toHaveBeenCalledWith(false);
    expect(onFit).not.toHaveBeenCalled();
  });
});
