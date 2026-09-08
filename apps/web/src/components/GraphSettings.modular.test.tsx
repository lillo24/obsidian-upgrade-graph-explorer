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
    macroLayout:
      'directional-bands' | 'soft-folder-clusters' = 'directional-bands',
    softFolderStrength = 50,
    onMacroLayoutChange = vi.fn(),
    onSoftFolderStrengthChange = vi.fn(),
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
          modularFocusMacroLayout={macroLayout}
          modularFocusSoftFolderStrength={softFolderStrength}
          onAllNetworkDensityFramingStrengthChange={() => undefined}
          onFocusAppearanceChange={() => undefined}
          onFocusHierarchyImplementationChange={() => undefined}
          onFocusNetworkDensityFramingStrengthChange={() => undefined}
          onGlobalLayoutSettingsChange={() => undefined}
          onModularFocusHeadingOrderChange={onHeadingOrderChange}
          onModularFocusInternalLayoutChange={onInternalLayoutChange}
          onModularFocusMacroLayoutChange={onMacroLayoutChange}
          onModularFocusSoftFolderStrengthChange={onSoftFolderStrengthChange}
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
    return {
      onHeadingOrderChange,
      onInternalLayoutChange,
      onMacroLayoutChange,
      onSoftFolderStrengthChange,
    };
  }

  it('shows only the approved product alternatives and disables them under Classic', () => {
    renderSettings('classic', 'adaptive-compass', 'crossing-optimized');

    expect(container.textContent).toContain('Adaptive Compass');
    expect(container.textContent).toContain('Vertical Spine');
    expect(container.textContent).toContain('Crossing optimized');
    expect(container.textContent).toContain('Document order');
    expect(container.textContent).toContain('Directional Bands');
    expect(container.textContent).toContain('Soft Folder Clusters');
    expect(
      container.querySelector('input[aria-label="Folder strength"]'),
    ).toBeNull();
    const approvedControls = Array.from(
      container.querySelectorAll<HTMLInputElement>(
        'input[name^="modular-focus-"]',
      ),
    );
    expect(approvedControls).toHaveLength(6);
    expect(approvedControls.map(({ value }) => value).sort()).toEqual(
      [
        'adaptive-compass',
        'crossing-optimized',
        'document-order',
        'directional-bands',
        'soft-folder-clusters',
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
    const onMacroLayoutChange = vi.fn();
    const onSoftFolderStrengthChange = vi.fn();
    renderSettings(
      'modular-preview',
      'vertical-spine',
      'document-order',
      onInternalLayoutChange,
      onHeadingOrderChange,
      'soft-folder-clusters',
      50,
      onMacroLayoutChange,
      onSoftFolderStrengthChange,
    );

    const byValue = (value: string) =>
      container.querySelector<HTMLInputElement>(`input[value="${value}"]`)!;
    expect(byValue('vertical-spine').checked).toBe(true);
    expect(byValue('document-order').checked).toBe(true);
    expect(byValue('adaptive-compass').disabled).toBe(false);
    expect(byValue('soft-folder-clusters').checked).toBe(true);
    act(() => byValue('adaptive-compass').click());
    act(() => byValue('crossing-optimized').click());
    act(() => byValue('directional-bands').click());
    const slider = container.querySelector<HTMLInputElement>(
      'input[aria-label="Folder strength"]',
    )!;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(slider, '75');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onInternalLayoutChange).toHaveBeenCalledWith('adaptive-compass');
    expect(onHeadingOrderChange).toHaveBeenCalledWith('crossing-optimized');
    expect(onMacroLayoutChange).toHaveBeenCalledWith('directional-bands');
    expect(onSoftFolderStrengthChange).toHaveBeenCalledWith(75);
  });
});
