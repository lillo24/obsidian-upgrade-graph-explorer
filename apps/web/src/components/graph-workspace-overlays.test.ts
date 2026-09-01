import { describe, expect, it } from 'vitest';

import {
  CLOSED_GRAPH_WORKSPACE_OVERLAYS,
  graphWorkspaceOverlayReducer,
} from './graph-workspace-overlays';

describe('graph workspace overlay policy', () => {
  it('makes Settings and Filters mutually exclusive in normal mode', () => {
    const filters = graphWorkspaceOverlayReducer(
      CLOSED_GRAPH_WORKSPACE_OVERLAYS,
      {
        type: 'change-tool-panel',
        panel: 'filters',
        open: true,
        maximized: false,
      },
    );
    const settings = graphWorkspaceOverlayReducer(filters, {
      type: 'change-settings',
      open: true,
    });
    const filtersAgain = graphWorkspaceOverlayReducer(settings, {
      type: 'change-tool-panel',
      panel: 'filters',
      open: true,
      maximized: false,
    });

    expect(filters).toEqual({
      activeOverlay: null,
      activeToolPanel: 'filters',
    });
    expect(settings).toEqual({
      activeOverlay: 'settings',
      activeToolPanel: null,
    });
    expect(filtersAgain).toEqual({
      activeOverlay: null,
      activeToolPanel: 'filters',
    });
  });

  it('gives Filters and Groups one mutually exclusive owner', () => {
    const filters = graphWorkspaceOverlayReducer(
      CLOSED_GRAPH_WORKSPACE_OVERLAYS,
      {
        type: 'change-tool-panel',
        panel: 'filters',
        open: true,
        maximized: false,
      },
    );
    const groups = graphWorkspaceOverlayReducer(filters, {
      type: 'change-tool-panel',
      panel: 'groups',
      open: true,
      maximized: false,
    });

    expect(groups).toEqual({
      activeOverlay: null,
      activeToolPanel: 'groups',
    });
  });

  it('contains Filters within maximized Tools and closes the nearest layer first', () => {
    const filters = graphWorkspaceOverlayReducer(
      CLOSED_GRAPH_WORKSPACE_OVERLAYS,
      {
        type: 'change-tool-panel',
        panel: 'filters',
        open: true,
        maximized: true,
      },
    );
    const panelClosed = graphWorkspaceOverlayReducer(filters, {
      type: 'change-tool-panel',
      panel: 'filters',
      open: false,
      maximized: true,
    });
    const toolsClosed = graphWorkspaceOverlayReducer(panelClosed, {
      type: 'close-all',
    });

    expect(filters).toEqual({
      activeOverlay: 'tools',
      activeToolPanel: 'filters',
    });
    expect(panelClosed).toEqual({
      activeOverlay: 'tools',
      activeToolPanel: null,
    });
    expect(toolsClosed).toBe(CLOSED_GRAPH_WORKSPACE_OVERLAYS);
  });

  it('closes all graph toolbar overlays for an application modal', () => {
    const settings = {
      activeOverlay: 'settings' as const,
      activeToolPanel: null,
    };

    expect(graphWorkspaceOverlayReducer(settings, { type: 'close-all' })).toBe(
      CLOSED_GRAPH_WORKSPACE_OVERLAYS,
    );
  });
});
