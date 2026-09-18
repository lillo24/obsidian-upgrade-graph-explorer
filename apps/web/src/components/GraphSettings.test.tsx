import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  customGlobalLayoutSettings,
  withFolderClusteringStrength,
} from '@icarus-graph-explorer/renderer-sigma/settings';

import {
  GlobalCustomLayoutControls,
  GraphSettings as GraphSettingsComponent,
  NetworkSharedControls,
} from './GraphSettings';

function GraphSettings(
  props: Omit<
    ComponentProps<typeof GraphSettingsComponent>,
    'onThemePreferenceChange' | 'themePreference'
  >,
) {
  return (
    <GraphSettingsComponent
      {...props}
      onThemePreferenceChange={() => undefined}
      themePreference="system"
    />
  );
}

describe('Graph Settings presentation', () => {
  it('separates Preferences, Sandbox, and Source into accessible transient tabs', () => {
    const markup = renderToStaticMarkup(
      <GraphSettings
        activeLayout="network"
        activeScope="all"
        allNetworkDensityQaDiagnostics={{
          rawDecisionRatio: 1.4,
          effectiveRatio: 1.2,
          cameraRatio: 1.2,
          fallback: false,
          nodeCount: 50,
          edgeCount: 0,
          isolatedNodeCount: 50,
        }}
        allNetworkDensityFramingStrength={50}
        focusNetworkDensityQaDiagnostics={{
          rawDecisionRatio: 1.23456,
          effectiveRatio: 1.11728,
          cameraRatio: 1.11729,
          fallback: true,
          fallbackReason: 'Synthetic fallback reason.',
        }}
        focusNetworkDensityFramingStrength={100}
        focusAppearance="outline"
        globalLayoutSettings={DEFAULT_GLOBAL_LAYOUT_SETTINGS}
        onAllNetworkDensityFramingStrengthChange={() => undefined}
        onFocusNetworkDensityFramingStrengthChange={() => undefined}
        onFocusAppearanceChange={() => undefined}
        onGlobalLayoutSettingsChange={() => undefined}
        onOpenChange={() => undefined}
        onResetSandbox={() => undefined}
        onTrackpadZoomModeChange={() => undefined}
        open
        trackpadZoomMode="pinch-zoom"
      >
        <section className="graph-settings__section">
          <h3>Current Source</h3>
        </section>
      </GraphSettings>,
    );

    expect(markup).toContain('role="tablist"');
    expect(markup).toContain(
      'aria-controls="graph-settings-preferences-panel" aria-selected="true"',
    );
    expect(markup).toContain(
      'aria-controls="graph-settings-sandbox-panel" aria-selected="false"',
    );
    expect(markup).toContain(
      'aria-controls="graph-settings-source-panel" aria-selected="false"',
    );
    expect(markup).toContain(
      'id="graph-settings-preferences-panel" role="tabpanel"',
    );
    expect(markup).toContain(
      'hidden="" id="graph-settings-sandbox-panel" role="tabpanel"',
    );
    expect(markup).toContain(
      'hidden="" id="graph-settings-source-panel" role="tabpanel"',
    );
    expect(markup).toContain('>Preferences</button>');
    expect(markup).toContain('id="theme-preference"');
    expect(markup).toContain(
      '<option value="system" selected="">System</option>',
    );
    expect(markup).toContain('<option value="light">Light</option>');
    expect(markup).toContain('<option value="dark">Dark</option>');
    expect(markup).toContain('>Sandbox</button>');
    expect(markup).toContain('>Interaction<');
    expect(markup).not.toContain('>Focus Root appearance<');
    expect(markup).toContain('>Network<');
    expect(markup).toContain('>All Network<');
    expect(markup).toContain('>Network Density<');
    expect(markup).toContain('>All Network Density<');
    expect(markup).toContain('id="all-density-framing-strength"');
    expect(markup).not.toContain('>Focus Network Density<');
    expect(markup).not.toContain('id="focus-density-framing-strength"');
    expect(markup).toContain(
      '>Legacy</span><span>Auto</span><span>Stronger</span>',
    );
    expect(markup).toContain(
      'id="all-density-framing-strength" max="150" min="0"',
    );
    expect(markup).not.toContain(
      'id="focus-density-framing-strength" max="150" min="0"',
    );
    expect(markup).toContain(
      'Camera-only framing for Scope = All, Layout = Network.',
    );
    expect(markup).toContain('>Temporary QA diagnostics<');
    expect(markup).toContain('>Raw decision ratio<');
    expect(markup).toContain('>1.4000<');
    expect(markup).toContain('>Effective ratio<');
    expect(markup).toContain('>1.2000<');
    expect(markup).toContain('>Sigma camera ratio<');
    expect(markup).not.toContain('>Fallback reason<');
    expect(markup).not.toContain('Synthetic fallback reason.');
    expect(markup).toContain('>Isolated nodes<');
    expect(markup).toContain('>50</dd>');
    expect(markup).toContain(
      'Runtime only; never saved or used as layout input.',
    );
    expect(markup).toContain('>Reset Sandbox</button>');
    expect(markup).toContain('>Current Source<');
    expect(markup).not.toContain(
      'Shared by Scope = All and Scope = Focus when Layout = Network.',
    );
    expect(markup).not.toContain(
      'Folder physics apply only to Scope = All, Layout = Network.',
    );
    expect(markup).toContain('Reference Pull');
    expect(markup).toContain('Base node size');
    expect(markup).toContain('Link thickness');
    expect(markup).toContain('Label threshold');
    expect(markup).toContain('>Folder clustering strength<');
    expect(markup).toContain('aria-valuetext="44 percent"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('Advanced All Network controls</button>');
    expect(markup).not.toContain('Folder tendency');
    expect(markup).toContain(
      'aria-controls="graph-experimental-controls" aria-expanded="false"',
    );
    expect(markup.indexOf('Experimental</button>')).toBeGreaterThan(
      markup.indexOf('>All Network Density<'),
    );
    expect(markup).not.toContain('Show All Hierarchy');
  });

  it('disables the normalized strength slider without discarding its value', () => {
    const settings = {
      ...withFolderClusteringStrength(DEFAULT_GLOBAL_LAYOUT_SETTINGS, 75),
      folderClustering: false,
    };
    const markup = renderToStaticMarkup(
      <GraphSettings
        activeLayout="network"
        activeScope="all"
        allNetworkDensityFramingStrength={35}
        focusNetworkDensityFramingStrength={65}
        focusAppearance="outline"
        globalLayoutSettings={settings}
        onAllNetworkDensityFramingStrengthChange={() => undefined}
        onFocusNetworkDensityFramingStrengthChange={() => undefined}
        onFocusAppearanceChange={() => undefined}
        onGlobalLayoutSettingsChange={() => undefined}
        onOpenChange={() => undefined}
        onResetSandbox={() => undefined}
        onTrackpadZoomModeChange={() => undefined}
        open
        trackpadZoomMode="pinch-zoom"
      />,
    );

    expect(markup).toContain('aria-valuetext="75 percent" disabled=""');
    expect(markup).toContain('value="75"');
    expect(markup).not.toContain('aria-valuetext="65 percent"');
    expect(markup).toContain('aria-valuetext="35 percent"');
  });

  it('keeps the advanced All Network controls scoped to All', () => {
    const markup = renderToStaticMarkup(
      <GlobalCustomLayoutControls
        onChange={() => undefined}
        settings={{
          ...customGlobalLayoutSettings('normal'),
          referenceDegreeSizeInfluence: 65,
        }}
      />,
    );

    expect(markup).toContain('>All-only controls</h4>');
    expect(markup).toContain('>All-only visual</h4>');
    expect(markup).toContain('Folder separation');
    expect(markup).toContain('Link influence on node size');
    expect(markup).toContain('aria-valuetext="65 percent"');
    expect(markup).toContain('max="100" min="0" step="1"');
    expect(markup).toContain('type="range" value="65"');
    expect(markup).toContain('>None</span><span>Strong</span>');
    expect(markup).not.toContain('Reference Pull');
    expect(markup).not.toContain('Base node size');
    expect(markup).not.toContain('Link thickness');
    expect(markup).not.toContain('Label threshold');
    expect(markup).not.toContain('Folder cohesion');
  });

  it('presents the four shared Network controls as one accessible group', () => {
    const markup = renderToStaticMarkup(
      <NetworkSharedControls
        onChange={() => undefined}
        settings={customGlobalLayoutSettings('normal')}
      />,
    );

    expect(markup).toContain('id="network-shared-controls"');
    expect(markup).toContain('Reference Pull');
    expect(markup).toContain('id="network-setting-linkForce"');
    expect(markup).toContain('>Weak</span><span>Strong</span>');
    expect(markup).toContain('Base node size');
    expect(markup).toContain('id="network-setting-nodeSize"');
    expect(markup).toContain('Link thickness');
    expect(markup).toContain('id="network-setting-linkThickness"');
    expect(markup).toContain('Label threshold');
    expect(markup).toContain('id="network-setting-labelThreshold"');
    expect(markup).not.toContain('Folder separation');
  });
});
