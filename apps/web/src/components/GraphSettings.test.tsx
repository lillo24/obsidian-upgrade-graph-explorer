import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DEFAULT_GLOBAL_LAYOUT_SETTINGS } from '@icarus-graph-explorer/renderer-sigma/settings';

import { GraphSettings } from './GraphSettings';

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
    expect(markup).toContain('>Global Layout<');
    expect(markup).toContain('>Graph Interaction<');
    expect(markup).toContain('>Current Source<');
  });
});
