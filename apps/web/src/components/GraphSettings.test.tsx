import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  customGlobalLayoutSettings,
  withFolderClusteringStrength,
} from '@icarus-graph-explorer/renderer-sigma/settings';

import { GlobalCustomLayoutControls, GraphSettings } from './GraphSettings';

describe('Graph Settings presentation', () => {
  it('groups Graph and Source controls into accessible transient tabs', () => {
    const markup = renderToStaticMarkup(
      <GraphSettings
        focusAppearance="outline"
        globalLayoutSettings={DEFAULT_GLOBAL_LAYOUT_SETTINGS}
        onFocusAppearanceChange={() => undefined}
        onGlobalLayoutSettingsChange={() => undefined}
        onOpenChange={() => undefined}
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
      'aria-controls="graph-settings-graph-panel" aria-selected="true"',
    );
    expect(markup).toContain(
      'aria-controls="graph-settings-source-panel" aria-selected="false"',
    );
    expect(markup).toContain('id="graph-settings-graph-panel" role="tabpanel"');
    expect(markup).toContain(
      'hidden="" id="graph-settings-source-panel" role="tabpanel"',
    );
    expect(markup).toContain('>Graph Appearance<');
    expect(markup).toContain('>All Network Layout<');
    expect(markup).toContain('>Graph Interaction<');
    expect(markup).toContain('>Current Source<');
    expect(markup).toContain('Applies to Scope = All, Layout = Network.');
    expect(markup).toContain('>Folder clustering strength<');
    expect(markup).toContain('aria-valuetext="44 percent"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('Advanced controls</button>');
    expect(markup).not.toContain('Folder tendency');
  });

  it('disables the normalized strength slider without discarding its value', () => {
    const settings = {
      ...withFolderClusteringStrength(DEFAULT_GLOBAL_LAYOUT_SETTINGS, 75),
      folderClustering: false,
    };
    const markup = renderToStaticMarkup(
      <GraphSettings
        focusAppearance="outline"
        globalLayoutSettings={settings}
        onFocusAppearanceChange={() => undefined}
        onGlobalLayoutSettingsChange={() => undefined}
        onOpenChange={() => undefined}
        onTrackpadZoomModeChange={() => undefined}
        open
        trackpadZoomMode="pinch-zoom"
      />,
    );

    expect(markup).toContain('aria-valuetext="75 percent" disabled=""');
    expect(markup).toContain('value="75"');
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
