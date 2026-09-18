// @vitest-environment happy-dom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_GLOBAL_LAYOUT_SETTINGS } from '@icarus-graph-explorer/renderer-sigma/settings';
import type { ThemePreference } from '@icarus-graph-explorer/theme';

import { GraphSettings } from './GraphSettings';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function SettingsHarness() {
  const [open, setOpen] = useState(true);
  const [themePreference, setThemePreference] =
    useState<ThemePreference>('system');
  return (
    <>
      <GraphSettings
        activeLayout="network"
        activeScope="all"
        allNetworkDensityFramingStrength={100}
        focusAppearance="outline"
        focusNetworkDensityFramingStrength={100}
        globalLayoutSettings={DEFAULT_GLOBAL_LAYOUT_SETTINGS}
        onAllNetworkDensityFramingStrengthChange={() => undefined}
        onFocusAppearanceChange={() => undefined}
        onFocusNetworkDensityFramingStrengthChange={() => undefined}
        onGlobalLayoutSettingsChange={() => undefined}
        onOpenChange={setOpen}
        onResetSandbox={() => undefined}
        onThemePreferenceChange={setThemePreference}
        onTrackpadZoomModeChange={() => undefined}
        open={open}
        themePreference={themePreference}
        trackpadZoomMode="scroll-zoom"
      />
      <button
        data-testid="network-canvas"
        onPointerDown={(event) => event.stopPropagation()}
        type="button"
      >
        Network canvas
      </button>
    </>
  );
}

describe('Graph Settings interactions', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(() => root.render(<SettingsHarness />));
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
  });

  it('closes from the Sandbox tab when the network receives an outside pointer', async () => {
    const sandbox = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Sandbox',
    );
    if (!(sandbox instanceof HTMLButtonElement)) {
      throw new Error('Missing Sandbox tab.');
    }
    await act(() => sandbox.click());
    expect(sandbox.getAttribute('aria-selected')).toBe('true');

    const network = container.querySelector('[data-testid="network-canvas"]');
    if (!(network instanceof HTMLButtonElement)) {
      throw new Error('Missing network canvas target.');
    }
    await act(() =>
      network.dispatchEvent(new Event('pointerdown', { bubbles: true })),
    );

    expect(container.querySelector('#graph-settings-popover')).toBeNull();
    expect(
      container.querySelector('[aria-label="Open Settings"]'),
    ).not.toBeNull();
  });

  it('applies a keyboard-accessible Theme selection immediately', async () => {
    const select = container.querySelector('#theme-preference');
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('Missing Theme selector.');
    }

    await act(() => {
      select.value = 'dark';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(select.value).toBe('dark');
  });
});
