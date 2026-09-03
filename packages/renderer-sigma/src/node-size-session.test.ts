import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityPresentationOverrideMap } from '@icarus-graph-explorer/presentation-overrides';

vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { SigmaTestRenderer } from './sigma-test-renderer';
import { GlobalRendererSession } from './session';
import { LocalRendererSession } from './local-session';
import { mapProjectionToGlobal } from './mapping';
import { mapProjectionToLocal } from './local-mapping';
import { globalTestProjection } from './test-fixture';
import {
  changedFileSizeNodeKeys,
  indexFileNodeKeys,
} from './node-size-presentation';

const overrides = (sizeScale: number): EntityPresentationOverrideMap =>
  new Map([['doc-c', { sizeScale }]]);
const group = new Map([
  [
    'doc-c',
    { groupName: 'Group', color: 'violet' as const, accent: '#7c3aed' },
  ],
]);
const key = 'entity:doc-c';

beforeEach(() => {
  SigmaTestRenderer.instances = [];
  vi.stubGlobal('window', {
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe.each(['global', 'local'] as const)(
  '%s size presentation session',
  (mode) => {
    function mount() {
      const projection = globalTestProjection();
      const selected = vi.fn();
      const options = {
        trackpadZoomMode: 'pinch-zoom' as const,
        presentationOverrides: overrides(1.5),
        visualGroupStyles: group,
        onNodeSelected: selected,
      };
      const session =
        mode === 'global'
          ? new GlobalRendererSession(
              { setAttribute: vi.fn() } as unknown as HTMLElement,
              mapProjectionToGlobal(projection),
              {
                ...options,
                settings: { folderClustering: false, spacingPreset: 'normal' },
              },
            )
          : new LocalRendererSession(
              { setAttribute: vi.fn() } as unknown as HTMLElement,
              mapProjectionToLocal(projection, 'doc-a'),
              { ...options, rootNodeKey: 'entity:doc-a' },
            );
      const update = (next: typeof projection) =>
        mode === 'global'
          ? (session as GlobalRendererSession).update(
              mapProjectionToGlobal(next),
            )
          : (session as LocalRendererSession).update(
              mapProjectionToLocal(next, 'doc-a'),
            );
      return {
        session,
        renderer: SigmaTestRenderer.instances[0]!,
        selected,
        projection,
        update,
      };
    }

    it('uses stored size on the first refresh and indexes only affected File reducers on edit/reset', async () => {
      const { session, renderer, selected } = mount();
      await session.ready;
      const automaticSize = renderer.graph.getNodeAttribute(
        key,
        'size',
      ) as number;
      expect(renderer.displayNodes.get(key)).toMatchObject({
        size: automaticSize * 1.5,
        color: '#7c3aed',
      });
      expect(renderer.refresh).toHaveBeenCalledTimes(1);
      const untouched = renderer.displayNodes.get('entity:doc-b');
      renderer.refresh.mockClear();
      session.setPresentationOverrides(overrides(2));
      expect(renderer.refresh).toHaveBeenCalledExactlyOnceWith({
        partialGraph: { nodes: [key] },
        skipIndexation: false,
        schedule: true,
      });
      expect(renderer.displayNodes.get(key)?.size).toBe(automaticSize * 2);
      expect(renderer.displayNodes.get('entity:doc-b')).toBe(untouched);
      expect(renderer.graph.getNodeAttribute(key, 'size')).toBe(automaticSize);
      // A distinct map with the same sparse values is not a visual change.
      session.setPresentationOverrides(overrides(2));
      expect(renderer.refresh).toHaveBeenCalledTimes(1);
      session.setPresentationOverrides();
      expect(renderer.refresh).toHaveBeenCalledTimes(2);
      expect(renderer.displayNodes.get(key)?.size).toBe(automaticSize);
      renderer.handlers.get('enterNode')?.({ node: key });
      renderer.handlers.get('clickNode')?.({ node: key });
      expect(selected).toHaveBeenCalledWith(
        key,
        expect.objectContaining({ entityId: 'doc-c' }),
      );
      session.destroy();
    });

    it('coalesces group/size edits behind topology, drops removed keys, and restores stored size on unhide', async () => {
      const { session, renderer, projection, update } = mount();
      await session.ready;
      renderer.refresh.mockClear();
      renderer.deferProcess = true;
      // A real reconciliation creates a process gap; subsequent edits must wait.
      update({
        ...projection,
        nodes: projection.nodes.map((node) =>
          node.id === key && node.kind === 'entity'
            ? { ...node, sourcePath: 'Renamed Note.md' }
            : node,
        ),
      });
      session.setPresentationOverrides(overrides(2));
      session.setVisualGroupStyles(group);
      expect(renderer.refresh).not.toHaveBeenCalled();
      // Hide the edited File before the pending process: no stale partial repaint.
      const hidden = {
        ...projection,
        nodes: projection.nodes.filter((node) => node.id !== key),
        edges: projection.edges.filter(
          (edge) => edge.sourceNodeId !== key && edge.targetNodeId !== key,
        ),
      };
      update(hidden);
      renderer.finishProcess();
      await Promise.resolve();
      expect(renderer.refresh).toHaveBeenCalledTimes(1);
      expect(
        renderer.refresh.mock.calls[0]![0]?.partialGraph?.nodes,
      ).not.toContain(key);
      expect(renderer.graph.hasNode(key)).toBe(false);
      renderer.refresh.mockClear();
      session.setPresentationOverrides(overrides(2.5));
      expect(renderer.refresh).not.toHaveBeenCalled();
      update(projection);
      renderer.finishProcess();
      await Promise.resolve();
      expect(renderer.displayNodes.get(key)?.size).toBe(
        renderer.graph.getNodeAttribute(key, 'size') * 2.5,
      );
      // Latest value wins during another pending topology refresh; one indexed flush.
      update(hidden);
      update(projection);
      session.setPresentationOverrides(overrides(1.1));
      session.setPresentationOverrides(overrides(1.3));
      session.setVisualGroupStyles(group);
      expect(renderer.refresh).not.toHaveBeenCalled();
      renderer.finishProcess();
      await Promise.resolve();
      expect(renderer.refresh).toHaveBeenCalledTimes(1);
      expect(renderer.refresh.mock.calls[0]![0]?.skipIndexation).toBe(false);
      expect(renderer.displayNodes.get(key)).toMatchObject({
        size: renderer.graph.getNodeAttribute(key, 'size') * 1.3,
        color: '#7c3aed',
      });
      session.destroy();
    });
  },
);

it('diffs sparse overrides through canonical File keys only, including repeated projection keys', () => {
  const fileNodeKeys = indexFileNodeKeys([
    { key: 'file-1', attributes: { nodeKind: 'document', entityId: 'file' } },
    { key: 'file-2', attributes: { nodeKind: 'document', entityId: 'file' } },
    {
      key: 'heading',
      attributes: { nodeKind: 'section', entityId: 'heading' },
    },
    {
      key: 'diagnostic',
      attributes: { nodeKind: 'diagnostic', entityId: null },
    },
  ]);
  const next = new Map([
    ['file', { sizeScale: 2 }],
    ['heading', { sizeScale: 2 }],
    ['hidden', { sizeScale: 2 }],
  ]);
  expect(changedFileSizeNodeKeys(undefined, next, fileNodeKeys)).toEqual([
    'file-1',
    'file-2',
  ]);
  expect(changedFileSizeNodeKeys(next, new Map(next), fileNodeKeys)).toEqual(
    [],
  );
  expect(changedFileSizeNodeKeys(next, undefined, fileNodeKeys)).toEqual([
    'file-1',
    'file-2',
  ]);
});
