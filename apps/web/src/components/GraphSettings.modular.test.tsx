// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_GLOBAL_LAYOUT_SETTINGS } from '@icarus-graph-explorer/renderer-sigma/settings';

import { GraphSettings } from './GraphSettings';

describe('Modular Focus Hierarchy Sandbox controls', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  function renderSettings(
    implementation: 'classic' | 'modular-preview',
    internalLayout: 'adaptive-compass' | 'vertical-spine',
    headingOrder: 'crossing-optimized' | 'document-order',
    onInternalLayoutChange = vi.fn(),
    onHeadingOrderChange = vi.fn(),
  ) {
    act(() => {
      root.render(
        <GraphSettings
          allNetworkDensityFramingStrength={100}
          focusNetworkDensityFramingStrength={100}
          focusAppearance="inverted"
          focusHierarchyImplementation={implementation}
          globalLayoutSettings={DEFAULT_GLOBAL_LAYOUT_SETTINGS}
          modularFocusHeadingOrder={headingOrder}
          modularFocusInternalLayout={internalLayout}
          onAllNetworkDensityFramingStrengthChange={() => undefined}
          onFocusAppearanceChange={() => undefined}
          onFocusHierarchyImplementationChange={() => undefined}
          onFocusNetworkDensityFramingStrengthChange={() => undefined}
          onGlobalLayoutSettingsChange={() => undefined}
          onModularFocusHeadingOrderChange={onHeadingOrderChange}
          onModularFocusInternalLayoutChange={onInternalLayoutChange}
          onOpenChange={() => undefined}
          onResetSandbox={() => undefined}
          onTrackpadZoomModeChange={() => undefined}
          open
          trackpadZoomMode="scroll-zoom"
        />,
      );
    });
    const sandbox = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Sandbox',
    );
    act(() => sandbox?.click());
    const experimental = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Experimental'),
    );
    act(() => experimental?.click());
    return { onInternalLayoutChange, onHeadingOrderChange };
  }

  it('shows only the approved product alternatives and disables them under Classic', () => {
    renderSettings('classic', 'adaptive-compass', 'crossing-optimized');

    expect(container.textContent).toContain('Adaptive Compass');
    expect(container.textContent).toContain('Vertical Spine');
    expect(container.textContent).toContain('Crossing optimized');
    expect(container.textContent).toContain('Document order');
    const approvedControls = Array.from(
      container.querySelectorAll<HTMLInputElement>(
        'input[name^="modular-focus-"]',
      ),
    );
    expect(approvedControls).toHaveLength(4);
    expect(approvedControls.map(({ value }) => value).sort()).toEqual(
      [
        'adaptive-compass',
        'crossing-optimized',
        'document-order',
        'vertical-spine',
      ].sort(),
    );
    expect(
      approvedControls.every(
        (control) => control.closest('fieldset')?.disabled === true,
      ),
    ).toBe(true);
  });

  it('reflects persisted alternatives and emits both policy changes under Modular Preview', () => {
    const onInternalLayoutChange = vi.fn();
    const onHeadingOrderChange = vi.fn();
    renderSettings(
      'modular-preview',
      'vertical-spine',
      'document-order',
      onInternalLayoutChange,
      onHeadingOrderChange,
    );

    const byValue = (value: string) =>
      container.querySelector<HTMLInputElement>(`input[value="${value}"]`)!;
    expect(byValue('vertical-spine').checked).toBe(true);
    expect(byValue('document-order').checked).toBe(true);
    expect(byValue('adaptive-compass').disabled).toBe(false);
    act(() => byValue('adaptive-compass').click());
    act(() => byValue('crossing-optimized').click());
    expect(onInternalLayoutChange).toHaveBeenCalledWith('adaptive-compass');
    expect(onHeadingOrderChange).toHaveBeenCalledWith('crossing-optimized');
  });
});
