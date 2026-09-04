// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GlobalGraphCanvas } from './GlobalGraphCanvas';
import { LocalGraphCanvas } from './LocalGraphCanvas';
import { createGlobalLayoutRequest } from './layout';
import { createLocalLayoutRequest } from './local-layout';
import { localTestProjection } from './local-test-fixture';
import { globalTestProjection } from './test-fixture';
import type { GlobalLayoutResult } from './types';

vi.mock('./session', () => ({
  GlobalRendererSession: class {
    ready = Promise.resolve();
    applyPositions = vi.fn(async () => undefined);
    createLayoutRequest = createGlobalLayoutRequest;
    destroy = vi.fn();
    setControlledSelection = vi.fn();
    update = vi.fn();
    updateSettings = vi.fn();
    updateTrackpadZoomMode = vi.fn();
  },
}));

vi.mock('./local-session', () => ({
  LocalRendererSession: class {
    ready = Promise.resolve();
    applyPositions = vi.fn(async () => undefined);
    createLayoutRequest = createLocalLayoutRequest;
    destroy = vi.fn();
    setControlledSelection = vi.fn();
    update = vi.fn();
    updateDensityFramingStrength = vi.fn();
    updateTrackpadZoomMode = vi.fn();
  },
}));

describe.each(['global', 'local'] as const)(
  'visible %s layout status lifecycle',
  (mode) => {
    let container: HTMLDivElement;
    let root: Root;
    beforeEach(() => {
      vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
      container = document.createElement('div');
      document.body.append(container);
      root = createRoot(container);
    });
    afterEach(async () => {
      await act(() => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    });

    async function mount() {
      let resolve!: (result: GlobalLayoutResult) => void;
      let reject!: (error: Error) => void;
      const layout = vi.fn(
        () =>
          new Promise<GlobalLayoutResult>((yes, no) => {
            resolve = yes;
            reject = no;
          }),
      );
      await act(() =>
        root.render(
          mode === 'global' ? (
            <GlobalGraphCanvas
              fitRequestKey={0}
              layoutRequestKey={0}
              layoutService={{ dispose: vi.fn(), layout }}
              onFailure={vi.fn()}
              onNodeActivate={vi.fn()}
              onSelectionChange={vi.fn()}
              onViewportObservation={vi.fn()}
              projection={globalTestProjection()}
              selection={null}
              settings={{ folderClustering: true, spacingPreset: 'normal' }}
              trackpadZoomMode="pinch-zoom"
            />
          ) : (
            <LocalGraphCanvas
              layoutRequestKey={0}
              layoutService={{ dispose: vi.fn(), layout }}
              onFailure={vi.fn()}
              onSelectionChange={vi.fn()}
              onViewportObservation={vi.fn()}
              projection={localTestProjection()}
              rootEntityId="root"
              selection={null}
              trackpadZoomMode="pinch-zoom"
            />
          ),
        ),
      );
      expect(layout).toHaveBeenCalledTimes(1);
      return { resolve, reject };
    }

    it.each(['reference-only', 'chunked-prior'] as const)(
      'shows progress and clears visible status after %s succeeds',
      async (algorithm) => {
        const pending = await mount();
        expect(container.textContent).toContain(
          mode === 'global' ? 'Refining All Network layout' : 'refining layout',
        );
        await act(() =>
          pending.resolve({
            schemaVersion: 1,
            kind: 'result',
            requestId: 1,
            positions: [],
            computeMs: 1,
            folderPriorMs: 0,
            algorithm,
            metrics: {
              meanWithinFolderDistance: 0,
              meanCrossFolderDistance: 0,
              meanCrossFolderReferenceLength: 0,
              meanDisplacementFromInput: 0,
            },
          }),
        );
        expect(
          container.querySelector(`.${mode}-graph-canvas__status`),
        ).toBeNull();
        expect(container.querySelector('[role="alert"]')).toBeNull();
      },
    );

    it('keeps the failure and recovery information visible', async () => {
      const pending = await mount();
      await act(() => pending.reject(new Error('worker unavailable')));
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        `${mode === 'global' ? 'All' : 'Focus'} Network layout failed: worker unavailable`,
      );
      expect(container.textContent).toContain(
        `The last valid ${mode === 'global' ? 'All' : 'Focus'} Network positions remain visible.`,
      );
    });
  },
);
