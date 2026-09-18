import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { GlobalRendererSession } from './session';
import { LocalRendererSession } from './local-session';
import { mapProjectionToGlobal } from './mapping';
import { mapProjectionToLocal } from './local-mapping';
import {
  OBSIDIAN_DARK_NETWORK_THEME,
  OBSIDIAN_LIGHT_NETWORK_THEME,
} from './network-theme';
import { SigmaTestRenderer } from './sigma-test-renderer';
import { globalTestProjection } from './test-fixture';

const graphCoordinates = (renderer: SigmaTestRenderer) =>
  renderer.graph.nodes().map((key) => ({
    key,
    x: renderer.graph.getNodeAttribute(key, 'x'),
    y: renderer.graph.getNodeAttribute(key, 'y'),
  }));

beforeEach(() => {
  SigmaTestRenderer.instances = [];
  vi.stubGlobal('window', {
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
    matchMedia: vi.fn(() => ({ matches: false })),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.each(['global', 'local'] as const)(
  '%s Network theme session',
  (mode) => {
    it('switches dark to light to dark with style-only refreshes', async () => {
      const projection = globalTestProjection();
      const counts = new Map<string, number>();
      const instrumentation = {
        count: (operation: string, amount = 1) =>
          counts.set(operation, (counts.get(operation) ?? 0) + amount),
        measure: <T>(
          _phase: string,
          operation: string | undefined,
          run: () => T,
        ): T => {
          if (operation !== undefined) {
            counts.set(operation, (counts.get(operation) ?? 0) + 1);
          }
          return run();
        },
        record: vi.fn(),
      };
      const session =
        mode === 'global'
          ? new GlobalRendererSession(
              { setAttribute: vi.fn() } as unknown as HTMLElement,
              mapProjectionToGlobal(projection),
              {
                instrumentation,
                settings: {
                  folderClustering: false,
                  spacingPreset: 'normal',
                },
                theme: 'dark',
                trackpadZoomMode: 'pinch-zoom',
              },
            )
          : new LocalRendererSession(
              { setAttribute: vi.fn() } as unknown as HTMLElement,
              mapProjectionToLocal(projection, 'doc-a'),
              {
                instrumentation,
                rootNodeKey: 'entity:doc-a',
                theme: 'dark',
                trackpadZoomMode: 'pinch-zoom',
              },
            );
      await session.ready;
      const renderer = SigmaTestRenderer.instances[0]!;
      const graph = renderer.graph;
      renderer.camera.setState({ x: 0.2, y: 0.7, ratio: 1.8, angle: 0.1 });
      const camera = renderer.camera.getState();
      const coordinates = graphCoordinates(renderer);
      const nonColorPresentation = () => ({
        nodes: [...renderer.displayNodes].map(([key, attributes]) => ({
          key,
          forceLabel: attributes.forceLabel,
          label: attributes.label,
          size: attributes.size,
        })),
        edges: [...renderer.displayEdges].map(([key, attributes]) => ({
          key,
          hidden: attributes.hidden,
          size: attributes.size,
        })),
      });
      const presentation = nonColorPresentation();
      const mutations = renderer.eventOrder.filter((event) =>
        event.startsWith('mutation:'),
      ).length;
      const ordinaryDocument = renderer.graph
        .nodes()
        .find(
          (key) =>
            renderer.graph.getNodeAttribute(key, 'nodeKind') === 'document' &&
            renderer.graph.getNodeAttribute(key, 'root') !== true,
        )!;

      renderer.refresh.mockClear();
      session.setTheme('light');

      expect(SigmaTestRenderer.instances).toHaveLength(1);
      expect(renderer.graph).toBe(graph);
      expect(renderer.camera.getState()).toEqual(camera);
      expect(graphCoordinates(renderer)).toEqual(coordinates);
      expect(nonColorPresentation()).toEqual(presentation);
      expect(
        renderer.eventOrder.filter((event) => event.startsWith('mutation:')),
      ).toHaveLength(mutations);
      expect(renderer.settings).toMatchObject({
        defaultEdgeColor: OBSIDIAN_LIGHT_NETWORK_THEME.edge,
        defaultNodeColor: OBSIDIAN_LIGHT_NETWORK_THEME.node,
        labelColor: { color: OBSIDIAN_LIGHT_NETWORK_THEME.label },
      });
      expect(renderer.displayNodes.get(ordinaryDocument)!.color).toBe(
        OBSIDIAN_LIGHT_NETWORK_THEME.node,
      );
      expect(renderer.refresh).toHaveBeenLastCalledWith({
        skipIndexation: true,
        schedule: true,
      });

      session.setTheme('dark');
      expect(SigmaTestRenderer.instances).toHaveLength(1);
      expect(renderer.graph).toBe(graph);
      expect(renderer.camera.getState()).toEqual(camera);
      expect(graphCoordinates(renderer)).toEqual(coordinates);
      expect(nonColorPresentation()).toEqual(presentation);
      expect(renderer.settings).toMatchObject({
        defaultEdgeColor: OBSIDIAN_DARK_NETWORK_THEME.edge,
        defaultNodeColor: OBSIDIAN_DARK_NETWORK_THEME.node,
        labelColor: { color: OBSIDIAN_DARK_NETWORK_THEME.label },
      });
      expect(renderer.displayNodes.get(ordinaryDocument)!.color).toBe(
        OBSIDIAN_DARK_NETWORK_THEME.node,
      );
      expect(
        counts.get(`${mode === 'global' ? 'global' : 'local'}-layouts`),
      ).toBeUndefined();
      session.destroy();
    });
  },
);
