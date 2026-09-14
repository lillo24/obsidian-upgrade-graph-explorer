// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_GLOBAL_LAYOUT_SETTINGS } from '@icarus-graph-explorer/renderer-sigma/settings';

import type { ExplorationLayout, ExplorationScope } from '../exploration-model';

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
    folderStrips = true,
    connectionStyle: 'direct' | 'electronic' = 'direct',
    onInternalLayoutChange = vi.fn(),
    onHeadingOrderChange = vi.fn(),
    macroLayout:
      'directional-bands' | 'soft-folder-clusters' = 'directional-bands',
    softFolderStrength = 50,
    onMacroLayoutChange = vi.fn(),
    onSoftFolderStrengthChange = vi.fn(),
    onFolderStripsChange = vi.fn(),
    onConnectionStyleChange = vi.fn(),
  ) {
    act(() => {
      root.render(
        <GraphSettings
          activeLayout="hierarchy"
          activeScope="focus"
          allNetworkDensityFramingStrength={100}
          focusNetworkDensityFramingStrength={100}
          focusAppearance="inverted"
          focusHierarchyImplementation={implementation}
          globalLayoutSettings={DEFAULT_GLOBAL_LAYOUT_SETTINGS}
          modularFocusHeadingOrder={headingOrder}
          modularFocusInternalLayout={internalLayout}
          modularFocusMacroLayout={macroLayout}
          modularFocusSoftFolderStrength={softFolderStrength}
          modularFolderStripsVisible={folderStrips}
          modularConnectionStyle={connectionStyle}
          onAllNetworkDensityFramingStrengthChange={() => undefined}
          onFocusAppearanceChange={() => undefined}
          onFocusHierarchyImplementationChange={() => undefined}
          onFocusNetworkDensityFramingStrengthChange={() => undefined}
          onGlobalLayoutSettingsChange={() => undefined}
          onModularFocusHeadingOrderChange={onHeadingOrderChange}
          onModularFocusInternalLayoutChange={onInternalLayoutChange}
          onModularFocusMacroLayoutChange={onMacroLayoutChange}
          onModularFocusSoftFolderStrengthChange={onSoftFolderStrengthChange}
          onModularFolderStripsVisibleChange={onFolderStripsChange}
          onModularConnectionStyleChange={onConnectionStyleChange}
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
      onFolderStripsChange,
      onConnectionStyleChange,
    };
  }

  function renderContextSettings({
    activeLayout,
    activeScope,
    allNetworkDensityFramingStrength = 73,
    focusHierarchyImplementation = 'classic',
    onAllNetworkDensityFramingStrengthChange = vi.fn(),
    onFocusNetworkDensityFramingStrengthChange = vi.fn(),
  }: {
    readonly activeLayout: ExplorationLayout;
    readonly activeScope: ExplorationScope;
    readonly allNetworkDensityFramingStrength?: number;
    readonly focusHierarchyImplementation?: 'classic' | 'modular-preview';
    readonly onAllNetworkDensityFramingStrengthChange?: (value: number) => void;
    readonly onFocusNetworkDensityFramingStrengthChange?: (
      value: number,
    ) => void;
  }) {
    act(() => {
      root.render(
        <GraphSettings
          activeLayout={activeLayout}
          activeScope={activeScope}
          allNetworkDensityFramingStrength={allNetworkDensityFramingStrength}
          focusNetworkDensityFramingStrength={61}
          focusAppearance="inverted"
          focusHierarchyImplementation={focusHierarchyImplementation}
          globalLayoutSettings={DEFAULT_GLOBAL_LAYOUT_SETTINGS}
          modularFocusHeadingOrder="crossing-optimized"
          modularFocusInternalLayout="adaptive-compass"
          modularFocusMacroLayout="directional-bands"
          modularFocusSoftFolderStrength={50}
          modularFolderStripsVisible
          modularConnectionStyle="direct"
          onAllNetworkDensityFramingStrengthChange={
            onAllNetworkDensityFramingStrengthChange
          }
          onFocusAppearanceChange={() => undefined}
          onFocusHierarchyImplementationChange={() => undefined}
          onFocusNetworkDensityFramingStrengthChange={
            onFocusNetworkDensityFramingStrengthChange
          }
          onGlobalLayoutSettingsChange={() => undefined}
          onModularFocusHeadingOrderChange={() => undefined}
          onModularFocusInternalLayoutChange={() => undefined}
          onModularFocusMacroLayoutChange={() => undefined}
          onModularFocusSoftFolderStrengthChange={() => undefined}
          onModularFolderStripsVisibleChange={() => undefined}
          onModularConnectionStyleChange={() => undefined}
          onOpenChange={() => undefined}
          onResetSandbox={() => undefined}
          onTrackpadZoomModeChange={() => undefined}
          open
          showExperimentalAllHierarchy={false}
          trackpadZoomMode="scroll-zoom"
        />,
      );
    });
  }

  function openSandboxAndExperimental() {
    const sandbox = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Sandbox',
    );
    if (sandbox?.getAttribute('aria-selected') !== 'true') {
      act(() => sandbox?.click());
    }
    const experimental = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Experimental'),
    );
    if (experimental?.getAttribute('aria-expanded') !== 'true') {
      act(() => experimental?.click());
    }
  }

  it.each([
    {
      name: 'All + Network',
      activeScope: 'all' as const,
      activeLayout: 'network' as const,
      implementation: 'classic' as const,
      focusRoot: false,
      network: true,
      allNetwork: true,
      allDensity: true,
      focusDensity: false,
      hierarchyImplementation: false,
      modularControls: false,
    },
    {
      name: 'Focus + Network',
      activeScope: 'focus' as const,
      activeLayout: 'network' as const,
      implementation: 'classic' as const,
      focusRoot: false,
      network: true,
      allNetwork: false,
      allDensity: false,
      focusDensity: true,
      hierarchyImplementation: false,
      modularControls: false,
    },
    {
      name: 'Focus + Hierarchy + Classic',
      activeScope: 'focus' as const,
      activeLayout: 'hierarchy' as const,
      implementation: 'classic' as const,
      focusRoot: true,
      network: false,
      allNetwork: false,
      allDensity: false,
      focusDensity: false,
      hierarchyImplementation: true,
      modularControls: false,
    },
    {
      name: 'Focus + Hierarchy + Modular preview',
      activeScope: 'focus' as const,
      activeLayout: 'hierarchy' as const,
      implementation: 'modular-preview' as const,
      focusRoot: true,
      network: false,
      allNetwork: false,
      allDensity: false,
      focusDensity: false,
      hierarchyImplementation: true,
      modularControls: true,
    },
    {
      name: 'All + Hierarchy',
      activeScope: 'all' as const,
      activeLayout: 'hierarchy' as const,
      implementation: 'classic' as const,
      focusRoot: false,
      network: false,
      allNetwork: false,
      allDensity: false,
      focusDensity: false,
      hierarchyImplementation: false,
      modularControls: false,
    },
  ])(
    'renders only controls applicable to $name',
    ({
      activeLayout,
      activeScope,
      allDensity,
      allNetwork,
      focusDensity,
      focusRoot,
      hierarchyImplementation,
      implementation,
      modularControls,
      network,
    }) => {
      renderContextSettings({
        activeLayout,
        activeScope,
        focusHierarchyImplementation: implementation,
      });
      openSandboxAndExperimental();

      expect(
        container.querySelector('#graph-appearance-settings-heading') !== null,
      ).toBe(focusRoot);
      expect(
        container.querySelector('#network-settings-heading') !== null,
      ).toBe(network);
      expect(
        container.querySelector('#global-layout-settings-heading') !== null,
      ).toBe(allNetwork);
      expect(
        container.querySelector('#all-density-framing-strength') !== null,
      ).toBe(allDensity);
      expect(
        container.querySelector('#focus-density-framing-strength') !== null,
      ).toBe(focusDensity);
      expect(
        container.querySelector(
          'input[name="focus-hierarchy-implementation"]',
        ) !== null,
      ).toBe(hierarchyImplementation);
      expect(container.querySelector('input[name^="modular-"]') !== null).toBe(
        modularControls,
      );
      expect(
        Array.from(container.querySelectorAll('label')).some((label) =>
          label.textContent?.includes('Show All Hierarchy'),
        ),
      ).toBe(true);
    },
  );

  it('updates an open Sandbox live, preserves hidden values, and restores focus from an unmounted control', () => {
    const onAllDensityChange = vi.fn();
    const onFocusDensityChange = vi.fn();
    renderContextSettings({
      activeLayout: 'network',
      activeScope: 'all',
      allNetworkDensityFramingStrength: 73,
      onAllNetworkDensityFramingStrengthChange: onAllDensityChange,
      onFocusNetworkDensityFramingStrengthChange: onFocusDensityChange,
    });
    openSandboxAndExperimental();
    const allDensity = container.querySelector<HTMLInputElement>(
      '#all-density-framing-strength',
    )!;
    allDensity.focus();
    expect(document.activeElement).toBe(allDensity);

    renderContextSettings({
      activeLayout: 'hierarchy',
      activeScope: 'focus',
      allNetworkDensityFramingStrength: 73,
      onAllNetworkDensityFramingStrengthChange: onAllDensityChange,
      onFocusNetworkDensityFramingStrengthChange: onFocusDensityChange,
    });

    expect(container.querySelector('#network-settings-heading')).toBeNull();
    expect(container.querySelector('#all-density-framing-strength')).toBeNull();
    expect(
      container.querySelector('input[name="focus-hierarchy-implementation"]'),
    ).not.toBeNull();
    expect(document.activeElement?.textContent).toBe('Sandbox');
    expect(onAllDensityChange).not.toHaveBeenCalled();
    expect(onFocusDensityChange).not.toHaveBeenCalled();

    renderContextSettings({
      activeLayout: 'network',
      activeScope: 'all',
      allNetworkDensityFramingStrength: 73,
      onAllNetworkDensityFramingStrengthChange: onAllDensityChange,
      onFocusNetworkDensityFramingStrengthChange: onFocusDensityChange,
    });

    expect(
      container.querySelector<HTMLInputElement>('#all-density-framing-strength')
        ?.value,
    ).toBe('73');
    expect(onAllDensityChange).not.toHaveBeenCalled();
    expect(onFocusDensityChange).not.toHaveBeenCalled();
  });

  it('keeps modular-only controls out of the DOM under Classic', () => {
    renderSettings('classic', 'adaptive-compass', 'crossing-optimized');

    expect(container.textContent).toContain('Focus Hierarchy implementation');
    expect(container.textContent).not.toContain('Adaptive Compass');
    expect(container.textContent).not.toContain('Vertical Spine');
    expect(container.textContent).not.toContain('Crossing optimized');
    expect(container.textContent).not.toContain('Document order');
    expect(container.textContent).not.toContain('Directional Bands');
    expect(container.textContent).not.toContain('Soft Folder Clusters');
    expect(
      container.querySelector('input[aria-label="Folder strength"]'),
    ).toBeNull();
    const modularControls = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[name^="modular-"]'),
    );
    expect(modularControls).toHaveLength(0);
  });

  it('reflects persisted alternatives and emits every renderer and layout policy change under Modular Preview', () => {
    const onInternalLayoutChange = vi.fn();
    const onHeadingOrderChange = vi.fn();
    const onMacroLayoutChange = vi.fn();
    const onSoftFolderStrengthChange = vi.fn();
    const onFolderStripsChange = vi.fn();
    const onConnectionStyleChange = vi.fn();
    renderSettings(
      'modular-preview',
      'vertical-spine',
      'document-order',
      false,
      'electronic',
      onInternalLayoutChange,
      onHeadingOrderChange,
      'soft-folder-clusters',
      50,
      onMacroLayoutChange,
      onSoftFolderStrengthChange,
      onFolderStripsChange,
      onConnectionStyleChange,
    );

    const byValue = (value: string) =>
      container.querySelector<HTMLInputElement>(`input[value="${value}"]`)!;
    expect(byValue('vertical-spine').checked).toBe(true);
    expect(byValue('document-order').checked).toBe(true);
    expect(byValue('electronic').checked).toBe(true);
    expect(
      container.querySelector<HTMLInputElement>(
        'input[name="modular-folder-guides"]',
      )?.checked,
    ).toBe(false);
    expect(byValue('adaptive-compass').disabled).toBe(false);
    expect(byValue('soft-folder-clusters').checked).toBe(true);
    act(() => byValue('adaptive-compass').click());
    act(() => byValue('crossing-optimized').click());
    act(() => byValue('directional-bands').click());
    act(() => byValue('direct').click());
    act(() =>
      container
        .querySelector<HTMLInputElement>('input[name="modular-folder-guides"]')
        ?.click(),
    );
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
    expect(onConnectionStyleChange).toHaveBeenCalledWith('direct');
    expect(onFolderStripsChange).toHaveBeenCalledWith(true);
  });
});
