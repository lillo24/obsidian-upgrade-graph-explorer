import { describe, expect, it } from 'vitest';

import {
  CLOSED_GRAPH_WORKSPACE_OVERLAYS,
  graphWorkspaceOverlayReducer,
} from './graph-workspace-overlays';

describe('graph workspace overlay policy', () => {
  it('makes Settings and Filters mutually exclusive in normal mode', () => {
    const filters = graphWorkspaceOverlayReducer(
      CLOSED_GRAPH_WORKSPACE_OVERLAYS,
      { type: 'change-filters', open: true, maximized: false },
    );
    const settings = graphWorkspaceOverlayReducer(filters, {
      type: 'change-settings',
      open: true,
    });
    const filtersAgain = graphWorkspaceOverlayReducer(settings, {
      type: 'change-filters',
      open: true,
      maximized: false,
    });

    expect(filters).toEqual({ activeOverlay: null, filtersOpen: true });
    expect(settings).toEqual({
      activeOverlay: 'settings',
      filtersOpen: false,
    });
    expect(filtersAgain).toEqual({ activeOverlay: null, filtersOpen: true });
  });

  it('contains Filters within maximized Tools and closes the nearest layer first', () => {
    const filters = graphWorkspaceOverlayReducer(
      CLOSED_GRAPH_WORKSPACE_OVERLAYS,
      { type: 'change-filters', open: true, maximized: true },
    );
    const panelClosed = graphWorkspaceOverlayReducer(filters, {
      type: 'change-filters',
      open: false,
      maximized: true,
    });
    const toolsClosed = graphWorkspaceOverlayReducer(panelClosed, {
      type: 'close-all',
    });

    expect(filters).toEqual({ activeOverlay: 'tools', filtersOpen: true });
    expect(panelClosed).toEqual({
      activeOverlay: 'tools',
      filtersOpen: false,
    });
    expect(toolsClosed).toBe(CLOSED_GRAPH_WORKSPACE_OVERLAYS);
  });

  it('closes all graph toolbar overlays for an application modal', () => {
    const settings = {
      activeOverlay: 'settings' as const,
      filtersOpen: false,
    };

    expect(graphWorkspaceOverlayReducer(settings, { type: 'close-all' })).toBe(
      CLOSED_GRAPH_WORKSPACE_OVERLAYS,
    );
  });
});
