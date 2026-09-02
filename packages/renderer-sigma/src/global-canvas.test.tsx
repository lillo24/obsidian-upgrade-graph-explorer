import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { ViewProjection } from '@icarus-graph-explorer/view-projection';

vi.mock('./session', () => ({ GlobalRendererSession: class {} }));

import { GlobalGraphCanvas } from './GlobalGraphCanvas';

const emptyProjection: ViewProjection = { nodes: [], edges: [], issues: [] };

describe('GlobalGraphCanvas empty state', () => {
  it('distinguishes zero matches from a blank Network canvas', () => {
    const markup = renderToStaticMarkup(
      <GlobalGraphCanvas
        fitRequestKey={0}
        layoutRequestKey={0}
        layoutService={{
          dispose: vi.fn(),
          layout: vi.fn(async () => {
            throw new Error('Empty Network must not request layout.');
          }),
        }}
        onFailure={vi.fn()}
        onNodeActivate={vi.fn()}
        onSelectionChange={vi.fn()}
        onViewportObservation={vi.fn()}
        projection={emptyProjection}
        selection={null}
        settings={{ folderClustering: true, spacingPreset: 'normal' }}
        trackpadZoomMode="pinch-zoom"
      />,
    );

    expect(markup).toContain('No nodes match this view.');
    expect(markup).toContain('Adjust Filters to restore files.');
    expect(markup).toContain('global-graph-canvas__surface');
    expect(markup).not.toContain('All Network canvas controls');
  });
});
