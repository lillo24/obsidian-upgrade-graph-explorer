import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { ViewProjection } from '@icarus-graph-explorer/view-projection';

vi.mock('./session', () => ({ GlobalRendererSession: class {} }));

import { GlobalGraphCanvas } from './GlobalGraphCanvas';
import { GlobalLayoutCache } from './layout-cache';
import { createGlobalLayoutRequest, globalLayoutFingerprint } from './layout';
import { mapProjectionToGlobal } from './mapping';
import { globalTestProjection } from './test-fixture';

const emptyProjection: ViewProjection = { nodes: [], edges: [], issues: [] };
const settings = { folderClustering: true, spacingPreset: 'normal' } as const;

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
        settings={settings}
        trackpadZoomMode="pinch-zoom"
      />,
    );

    expect(markup).toContain('No nodes match this view.');
    expect(markup).toContain(
      'Clear or adjust the graph filters to restore results.',
    );
    expect(markup).toContain('global-graph-canvas__surface');
    expect(markup).not.toContain('All Network canvas controls');
  });

  it('keeps exact in-memory cache restoration out of the user-facing status', () => {
    const input = mapProjectionToGlobal(globalTestProjection(), settings);
    const request = createGlobalLayoutRequest(input, settings, 100);
    const cache = new GlobalLayoutCache();
    cache.set(
      globalLayoutFingerprint(request),
      request.nodes.map(({ key, x, y }) => ({ key, x, y })),
    );

    const markup = renderToStaticMarkup(
      <GlobalGraphCanvas
        fitRequestKey={0}
        layoutCache={cache}
        layoutRequestKey={0}
        layoutService={{ dispose: vi.fn(), layout: vi.fn() }}
        onFailure={vi.fn()}
        onNodeActivate={vi.fn()}
        onSelectionChange={vi.fn()}
        onViewportObservation={vi.fn()}
        projection={globalTestProjection()}
        selection={null}
        settings={settings}
        trackpadZoomMode="pinch-zoom"
      />,
    );

    expect(markup).toContain('All Network canvas controls');
    expect(markup).not.toContain('global-graph-canvas__status');
    expect(markup).not.toContain('layout restored from the in-memory cache');
  });
});
