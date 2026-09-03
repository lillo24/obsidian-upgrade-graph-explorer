// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { globalTestProjection } from './test-fixture';

interface MockSessionApi {
  readonly applyPositions: ReturnType<typeof vi.fn>;
  readonly cancelFolderArrangementGesture: ReturnType<typeof vi.fn>;
  readonly previewFolderAnchor: ReturnType<typeof vi.fn>;
}

const sessionInstances = vi.hoisted(() => [] as MockSessionApi[]);

vi.mock('./session', () => ({
  GlobalRendererSession: class {
    readonly ready = Promise.resolve();
    readonly applyPositions = vi.fn(async () => undefined);
    readonly applyPartialPositions = vi.fn();
    readonly cancelFolderArrangementGesture = vi.fn(() => {
      const changed = this.previewActive;
      this.previewActive = false;
      return changed;
    });
    readonly completeFolderArrangementCommit = vi.fn();
    readonly currentFolderAnchor = vi.fn(() => ({ x: 0, y: 0 }));
    readonly destroy = vi.fn();
    readonly fit = vi.fn();
    readonly previewFolderAnchor = vi.fn(
      (
        folderKey: string,
        anchor: { readonly x: number; readonly y: number },
      ) => {
        this.previewActive = true;
        return {
          folderKey,
          anchor,
          target: { x: 0, y: 0 },
          translation: { x: 0, y: 0 },
          positions: [],
        };
      },
    );
    readonly setControlledSelection = vi.fn();
    readonly setFolderArrangementContext = vi.fn();
    readonly update = vi.fn();
    readonly updateSettings = vi.fn();
    readonly updateTrackpadZoomMode = vi.fn();
    readonly zoomBy = vi.fn();
    private previewActive = false;

    constructor() {
      sessionInstances.push(this);
    }
  },
}));

import { GlobalGraphCanvas } from './GlobalGraphCanvas';

const noop = () => undefined;

describe('All Network Arrange folders canvas', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    sessionInstances.length = 0;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function renderArrangement(options?: {
    readonly commitFailure?: string;
    readonly active?: boolean;
  }) {
    const onAvailabilityChange = vi.fn();
    const onCommitAnchor = vi.fn(() => options?.commitFailure);
    const onActiveChange = vi.fn();
    const onAnnouncement = vi.fn();
    await act(() =>
      root.render(
        <GlobalGraphCanvas
          fitRequestKey={0}
          folderArrangement={{
            active: options?.active ?? true,
            activeFolderKey: 'alpha',
            anchorCount: 0,
            editable: true,
            focusRequestKey: 1,
            persistenceStatus: 'Folder positions are session only',
            onActiveChange,
            onActiveFolderChange: noop,
            onAnnouncement,
            onAvailabilityChange,
            onCommitAnchor,
            onResetAll: () => undefined,
            onResetFolder: () => undefined,
          }}
          layoutRequestKey={0}
          layoutService={{
            dispose: noop,
            layout: async (request) => ({
              schemaVersion: 1,
              kind: 'result',
              requestId: 1,
              algorithm: 'reference-only',
              computeMs: 0,
              folderPriorMs: 0,
              positions: request.nodes.map(({ key, x, y }) => ({ key, x, y })),
              metrics: {
                meanWithinFolderDistance: 0,
                meanCrossFolderDistance: 0,
                meanCrossFolderReferenceLength: 0,
                meanDisplacementFromInput: 0,
              },
            }),
          }}
          onFailure={vi.fn()}
          onNodeActivate={noop}
          onSelectionChange={noop}
          onViewportObservation={noop}
          projection={globalTestProjection()}
          selection={null}
          settings={{ folderClustering: true, spacingPreset: 'normal' }}
          trackpadZoomMode="pinch-zoom"
        />,
      ),
    );
    return {
      onActiveChange,
      onAnnouncement,
      onAvailabilityChange,
      onCommitAnchor,
    };
  }

  it('exposes the mode contract only after layout and supports keyboard nudge/save', async () => {
    const callbacks = await renderArrangement();
    const session = sessionInstances[0]!;
    expect(callbacks.onAvailabilityChange).toHaveBeenLastCalledWith(
      true,
      undefined,
    );
    expect(container.textContent).toContain(
      'Drag any File to move its folder.',
    );
    expect(container.textContent).toContain('Active folderalpha');

    const up = container.querySelector<HTMLButtonElement>(
      '[aria-label="Nudge folder up"]',
    )!;
    await act(() => up.click());
    expect(session.previewFolderAnchor).toHaveBeenCalledWith('alpha', {
      x: 0,
      y: -0.02,
    });
    expect(container.textContent).toContain('2% up');

    const save = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Save position',
    )!;
    await act(() => save.click());
    expect(callbacks.onCommitAnchor).toHaveBeenCalledWith('alpha', {
      x: 0,
      y: -0.02,
    });
    expect(callbacks.onAnnouncement).toHaveBeenCalledWith(
      'Folder position set for this session only',
    );
  });

  it('reverts a failed write and keeps the error actionable', async () => {
    const callbacks = await renderArrangement({ commitFailure: 'disk full' });
    const session = sessionInstances[0]!;
    await act(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Nudge folder right"]')!
        .click(),
    );
    await act(() =>
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === 'Save position')!
        .click(),
    );

    expect(callbacks.onCommitAnchor).toHaveBeenCalled();
    expect(session.cancelFolderArrangementGesture).toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Folder position was not saved: disk full',
    );
    expect(session.applyPositions).toHaveBeenCalled();
  });

  it('keeps the toolbar action visible and explains an inactive transition', async () => {
    const callbacks = await renderArrangement({ active: false });
    const arrange = container.querySelector<HTMLButtonElement>(
      '[aria-label="Arrange folders"]',
    )!;
    expect(arrange.getAttribute('aria-pressed')).toBe('false');
    await act(() => arrange.click());
    expect(callbacks.onActiveChange).toHaveBeenCalledWith(true);
  });
});
