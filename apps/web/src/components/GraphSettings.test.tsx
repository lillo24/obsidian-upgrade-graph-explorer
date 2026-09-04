import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  customGlobalLayoutSettings,
  withFolderClusteringStrength,
} from '@icarus-graph-explorer/renderer-sigma/settings';

import { GlobalCustomLayoutControls, GraphSettings } from './GraphSettings';

describe('Graph Settings presentation', () => {
  it('separates Preferences, Sandbox, and Source into accessible transient tabs', () => {
    const markup = renderToStaticMarkup(
      <GraphSettings
        densityQaDiagnostics={{
          rawDecisionRatio: 1.23456,
          effectiveRatio: 1.11728,
          cameraRatio: 1.11729,
          fallback: true,
          fallbackReason: 'Synthetic fallback reason.',
        }}
        densityFramingStrength={100}
        focusAppearance="outline"
        globalLayoutSettings={DEFAULT_GLOBAL_LAYOUT_SETTINGS}
        onDensityFramingStrengthChange={() => undefined}
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
    expect(markup).toContain('>Sandbox</button>');
    expect(markup).toContain('>Interaction<');
    expect(markup).toContain('>Focus Root appearance<');
    expect(markup).toContain('>All Network Layout<');
    expect(markup).toContain('>Focus Network Density Framing<');
    expect(markup).toContain('id="focus-density-framing-strength"');
    expect(markup).toContain('>Legacy</span><span>Auto</span>');
    expect(markup).toContain(
      'Previews the current Focus Network camera immediately around its semantic anchor.',
    );
    expect(markup).toContain('>Temporary QA diagnostics<');
    expect(markup).toContain('>Raw decision ratio<');
    expect(markup).toContain('>1.2346<');
    expect(markup).toContain('>Effective ratio<');
    expect(markup).toContain('>1.1173<');
    expect(markup).toContain('>Sigma camera ratio<');
    expect(markup).toContain('>Fallback reason<');
    expect(markup).toContain('Synthetic fallback reason.');
    expect(markup).toContain(
      'Runtime only; never saved or used as layout input.',
    );
    expect(markup).toContain('>Reset Sandbox</button>');
    expect(markup).toContain('>Current Source<');
    expect(markup).toContain('Applies to Scope = All, Layout = Network.');
    expect(markup).toContain('>Folder clustering strength<');
    expect(markup).toContain('aria-valuetext="44 percent"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('Advanced controls</button>');
    expect(markup).not.toContain('Folder tendency');
    expect(markup).toContain(
      'aria-controls="graph-experimental-controls" aria-expanded="false"',
    );
    expect(markup.indexOf('Experimental</button>')).toBeGreaterThan(
      markup.indexOf('>Focus Network Density Framing<'),
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
        densityFramingStrength={65}
        focusAppearance="outline"
        globalLayoutSettings={settings}
        onDensityFramingStrengthChange={() => undefined}
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
    expect(markup).toContain('aria-valuetext="65 percent"');
  });

  it('groups advanced controls by responsibility with an accessible influence scale', () => {
    const markup = renderToStaticMarkup(
      <GlobalCustomLayoutControls
        onChange={() => undefined}
        settings={{
          ...customGlobalLayoutSettings('normal'),
          referenceDegreeSizeInfluence: 65,
        }}
      />,
    );

    expect(markup).toContain('>Layout</h4>');
    expect(markup).toContain('>Visual</h4>');
    expect(markup).toContain('Reference pull');
    expect(markup).toContain('Folder separation');
    expect(markup).toContain('Base node size');
    expect(markup).toContain('Link influence on node size');
    expect(markup).toContain('aria-valuetext="65 percent"');
    expect(markup).toContain('max="100" min="0" step="1"');
    expect(markup).toContain('type="range" value="65"');
    expect(markup).toContain('>None</span><span>Strong</span>');
    expect(markup).toContain('Link thickness');
    expect(markup).toContain('Label threshold');
    expect(markup).not.toContain('Folder cohesion');
  });
});
