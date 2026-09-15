// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { globalTestProjection } from './test-fixture';
import type {
  GlobalLayoutRequest,
  GlobalSpatialInfluenceRequest,
  GlobalSpatialInfluenceResult,
} from './types';
import type { FolderSpatialRule } from '@icarus-graph-explorer/spatial-overrides';

interface MockSessionApi {
  readonly applyPositions: ReturnType<typeof vi.fn>;
  readonly applySpatialPositions: ReturnType<typeof vi.fn>;
  readonly cancelFolderArrangementGesture: ReturnType<typeof vi.fn>;
  readonly center: ReturnType<typeof vi.fn>;
  readonly fit: ReturnType<typeof vi.fn>;
  readonly folderTargetAnchorFromPointer: ReturnType<typeof vi.fn>;
  readonly positionFolderTargetAnchor: ReturnType<typeof vi.fn>;
  readonly previewFolderAnchor: ReturnType<typeof vi.fn>;
  readonly setFolderTargetPointerActive: ReturnType<typeof vi.fn>;
}

const sessionInstances = vi.hoisted(() => [] as MockSessionApi[]);

vi.mock('./session', () => ({
  GlobalRendererSession: class {
    commitInitialPresentation = vi.fn(async () => undefined);
    readonly ready = Promise.resolve();
    readonly applyPositions = vi.fn(async () => undefined);
    readonly applySpatialPositions = vi.fn(async () => undefined);
    readonly applyPartialPositions = vi.fn();
    readonly cancelFolderArrangementGesture = vi.fn(() => {
      const changed = this.previewActive;
      this.previewActive = false;
      return changed;
    });
    readonly completeFolderArrangementCommit = vi.fn();
    readonly center = vi.fn(async () => undefined);
    readonly currentFolderAnchor = vi.fn(() => ({ x: 0, y: 0 }));
    readonly destroy = vi.fn();
    readonly fit = vi.fn();
    readonly folderTargetAnchorFromPointer = vi.fn(() => ({ x: 0.4, y: 0.3 }));
    readonly positionFolderTargetAnchor = vi.fn();
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
    readonly setFolderTargetPointerActive = vi.fn();
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
import { GlobalSpatialInfluenceCache } from './spatial-influence-cache';

const noop = () => undefined;

async function perform(action: () => void): Promise<void> {
  await act(async () => {
    action();
    for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
  });
}

describe('All Network Arrange folders canvas', () => {
  let container: HTMLDivElement;
  let previewFrames: FrameRequestCallback[];
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    sessionInstances.length = 0;
    previewFrames = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      previewFrames.push(callback);
      return previewFrames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
      previewFrames[handle - 1] = () => undefined;
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await perform(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function renderArrangement(options?: {
    readonly commitFailure?: string;
    readonly active?: boolean;
    readonly genericRules?: boolean;
    readonly scopeChildCount?: number;
    readonly spatialRules?: readonly FolderSpatialRule[];
    readonly previewLayout?: (
      request: Omit<GlobalSpatialInfluenceRequest, 'requestId'>,
    ) => Promise<GlobalSpatialInfluenceResult>;
    readonly spatialInfluenceCache?: GlobalSpatialInfluenceCache;
  }) {
    const onAvailabilityChange = vi.fn();
    const onCommitAnchor = vi.fn(() => options?.commitFailure);
    const onCommitRule = vi.fn(() => options?.commitFailure);
    const onActiveChange = vi.fn();
    const onAnnouncement = vi.fn();
    const layout = vi.fn(
      async (request: Omit<GlobalLayoutRequest, 'requestId'>) => ({
        schemaVersion: 3 as const,
        kind: 'result' as const,
        requestId: 1,
        algorithm: 'reference-only' as const,
        policyVersion: request.policy.version,
        macroVersion: request.macro.version,
        stopReason: 'max-iterations' as const,
        iterationsCompleted: request.policy.maxIterations,
        macroStepsCompleted: Math.ceil(request.policy.maxIterations / 32),
        stableMacroSteps: 0,
        finalMacroStepIterations: 32,
        finalMovement: null,
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
    );
    await perform(() =>
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
            ...(options?.genericRules === true
              ? {
                  onCommitRule,
                  ruleCount: 0,
                  scopeTree: {
                    folderKey: '.',
                    name: 'Root folder',
                    depth: 0,
                    directFileCount: 0,
                    totalFileCount: 2,
                    visibleFileCount: 2,
                    children: [
                      {
                        folderKey: 'alpha',
                        name: 'alpha',
                        depth: 1,
                        directFileCount: 2,
                        totalFileCount: 2 + (options.scopeChildCount ?? 0),
                        visibleFileCount: 2,
                        children: Array.from(
                          { length: options.scopeChildCount ?? 0 },
                          (_value, index) => ({
                            folderKey: `alpha/child-${index}`,
                            name: `child-${index}`,
                            depth: 2,
                            directFileCount: 1,
                            totalFileCount: 1,
                            visibleFileCount: 0,
                            children: [],
                          }),
                        ),
                      },
                    ],
                  },
                }
              : {}),
            onResetAll: () => undefined,
            onResetFolder: () => undefined,
          }}
          layoutRequestKey={0}
          layoutService={{
            dispose: noop,
            layout,
          }}
          onFailure={vi.fn()}
          onNodeActivate={noop}
          onSelectionChange={noop}
          onViewportObservation={noop}
          projection={globalTestProjection()}
          selection={null}
          settings={{ folderClustering: true, spacingPreset: 'normal' }}
          {...(options?.spatialInfluenceCache === undefined
            ? {}
            : { spatialInfluenceCache: options.spatialInfluenceCache })}
          {...(options?.spatialRules === undefined
            ? {}
            : { spatialRules: options.spatialRules })}
          {...(options?.previewLayout === undefined
            ? {}
            : {
                spatialPullPreviewServiceFactory: () => ({
                  dispose: noop,
                  layout: options.previewLayout!,
                }),
              })}
          trackpadZoomMode="pinch-zoom"
        />,
      ),
    );
    return {
      onActiveChange,
      onAnnouncement,
      onAvailabilityChange,
      onCommitAnchor,
      onCommitRule,
      layout,
    };
  }

  async function flushPreviewFrame(): Promise<void> {
    const frames = previewFrames;
    previewFrames = [];
    await perform(() => {
      for (const frame of frames) frame(0);
    });
  }

  function previewResult(
    request: Omit<GlobalSpatialInfluenceRequest, 'requestId'>,
  ): GlobalSpatialInfluenceResult {
    const pullX = request.attractors[0]?.targetX ?? 0;
    return {
      schemaVersion: 1,
      kind: 'result',
      requestId: 1,
      algorithm: request.algorithm,
      computeMs: 1,
      forceAtlasMs: 0.5,
      attractorMs: 0.5,
      positions: request.nodes.map(({ key, x, y }) => ({
        key,
        x: x + pullX * 0.1,
        y,
      })),
      metrics: {
        meanTargetError: 0,
        maxTargetError: 0,
        meanAffectedDisplacement: 0,
        meanUnaffectedDisplacement: 0,
        meanCrossBoundaryReferenceLength: 0,
        meanReferenceLength: 0,
      },
    };
  }

  it('does not preview merely because an unchanged confirmed Pull rule opens', async () => {
    const previewLayout = vi.fn(async (request) => previewResult(request));
    await renderArrangement({
      genericRules: true,
      spatialRules: [
        {
          folderKey: 'alpha',
          behavior: 'pull',
          scope: { kind: 'exact' },
          anchor: { x: 0.25, y: -0.1 },
          strength: 70,
        },
      ],
      previewLayout,
    });
    await flushPreviewFrame();
    expect(previewLayout).not.toHaveBeenCalled();
  });

  it('previews a Pull nudge from base geometry and holds it through successful commit', async () => {
    const previewLayout = vi.fn(async (request) => previewResult(request));
    const spatialInfluenceCache = new GlobalSpatialInfluenceCache();
    const cacheSet = vi.spyOn(spatialInfluenceCache, 'set');
    const callbacks = await renderArrangement({
      genericRules: true,
      spatialRules: [],
      previewLayout,
      spatialInfluenceCache,
    });
    const session = sessionInstances[0]!;
    const spatialAppliesBefore =
      session.applySpatialPositions.mock.calls.length;

    await perform(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Nudge folder right"]')!
        .click(),
    );
    expect(previewLayout).not.toHaveBeenCalled();
    await flushPreviewFrame();

    expect(previewLayout).toHaveBeenCalledTimes(1);
    expect(previewLayout.mock.calls[0]![0].iterations).toBe(12);
    expect(previewLayout.mock.calls[0]![0].nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'entity:doc-a' }),
        expect.objectContaining({ key: 'entity:doc-b' }),
      ]),
    );
    expect(previewLayout.mock.calls[0]![0].attractors[0]).toMatchObject({
      ruleFolderKey: 'alpha',
      strength: 70,
    });
    expect(session.applySpatialPositions).toHaveBeenCalledTimes(
      spatialAppliesBefore + 1,
    );
    expect(session.fit).not.toHaveBeenCalled();
    expect(session.center).not.toHaveBeenCalled();
    expect(callbacks.layout).toHaveBeenCalledTimes(1);
    expect(cacheSet).not.toHaveBeenCalled();

    const firstBaseNodes = previewLayout.mock.calls[0]![0].nodes;
    await perform(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Nudge folder right"]')!
        .click(),
    );
    await flushPreviewFrame();
    expect(previewLayout).toHaveBeenCalledTimes(2);
    expect(previewLayout.mock.calls[1]![0].nodes).toEqual(firstBaseNodes);

    const previewApplyCount = session.applySpatialPositions.mock.calls.length;
    await perform(() =>
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === 'Apply changes')!
        .click(),
    );
    expect(callbacks.onCommitRule).toHaveBeenCalledTimes(1);
    expect(session.applySpatialPositions).toHaveBeenCalledTimes(
      previewApplyCount,
    );
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it('schedules live Pull preview for strength and every scope authoring field', async () => {
    const previewLayout = vi.fn(async (request) => previewResult(request));
    await renderArrangement({
      genericRules: true,
      scopeChildCount: 1,
      spatialRules: [],
      previewLayout,
    });
    const strength = container.querySelector<HTMLInputElement>(
      '[aria-label="Pull strength"]',
    )!;
    await perform(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(strength, '30');
      strength.dispatchEvent(new Event('input', { bubbles: true }));
      strength.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flushPreviewFrame();
    expect(previewLayout.mock.calls.at(-1)![0].attractors[0]?.strength).toBe(
      30,
    );

    for (const label of ['Folder + subfolders', 'Custom']) {
      await perform(() =>
        [...container.querySelectorAll('button')]
          .find((button) => button.textContent === label)!
          .click(),
      );
      await flushPreviewFrame();
    }
    const directFiles = [...container.querySelectorAll('label')]
      .find((label) => label.textContent?.includes('Files directly in alpha'))!
      .querySelector<HTMLInputElement>('input')!;
    await perform(() => directFiles.click());
    await flushPreviewFrame();
    const child = container.querySelector<HTMLInputElement>(
      '[aria-label="Included subfolders"] input[type="checkbox"]',
    )!;
    await perform(() => child.click());
    await flushPreviewFrame();

    expect(previewLayout).toHaveBeenCalledTimes(5);
  });

  it('restores confirmed geometry when Pull preview yields to Place', async () => {
    const previewLayout = vi.fn(async (request) => previewResult(request));
    await renderArrangement({
      genericRules: true,
      spatialRules: [],
      previewLayout,
    });
    const session = sessionInstances[0]!;
    await perform(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Nudge folder right"]')!
        .click(),
    );
    await flushPreviewFrame();
    const previewApplyCount = session.applySpatialPositions.mock.calls.length;

    await perform(() =>
      [...container.querySelectorAll('label')]
        .find((label) => label.textContent?.includes('Fixed placement'))!
        .querySelector<HTMLInputElement>('input')!
        .click(),
    );

    expect(session.applySpatialPositions).toHaveBeenCalledTimes(
      previewApplyCount + 1,
    );
    expect(previewLayout).toHaveBeenCalledTimes(1);
  });

  it('starts Pull geometry before target release while the marker intent stays immediate', async () => {
    let resolvePreview:
      ((result: GlobalSpatialInfluenceResult) => void) | undefined;
    let previewRequest:
      Omit<GlobalSpatialInfluenceRequest, 'requestId'> | undefined;
    const previewLayout = vi.fn(
      (request: Omit<GlobalSpatialInfluenceRequest, 'requestId'>) => {
        previewRequest = request;
        return new Promise<GlobalSpatialInfluenceResult>((resolve) => {
          resolvePreview = resolve;
        });
      },
    );
    const callbacks = await renderArrangement({
      genericRules: true,
      spatialRules: [],
      previewLayout,
    });
    const session = sessionInstances[0]!;
    const marker = container.querySelector<HTMLDivElement>(
      '[aria-label="Spatial target for alpha"]',
    )!;
    Object.assign(marker, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });
    await perform(() =>
      marker.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: 10,
          clientY: 12,
          pointerId: 17,
        }),
      ),
    );
    await perform(() =>
      marker.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 30,
          clientY: 36,
          pointerId: 17,
        }),
      ),
    );

    expect(container.textContent).toContain('40% right, 30% down');
    expect(callbacks.onCommitRule).not.toHaveBeenCalled();
    await flushPreviewFrame();
    expect(previewLayout).toHaveBeenCalledTimes(1);
    const applyCountBeforeWorkerResult =
      session.applySpatialPositions.mock.calls.length;
    if (previewRequest === undefined || resolvePreview === undefined) {
      throw new Error('Expected live Pull preview work.');
    }
    resolvePreview(previewResult(previewRequest));
    await perform(noop);
    expect(session.applySpatialPositions).toHaveBeenCalledTimes(
      applyCountBeforeWorkerResult + 1,
    );
    expect(callbacks.onCommitRule).not.toHaveBeenCalled();

    await perform(() =>
      marker.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          button: 0,
          clientX: 30,
          clientY: 36,
          pointerId: 17,
        }),
      ),
    );
    expect(callbacks.onCommitRule).toHaveBeenCalledTimes(1);
  });

  it('restores exact confirmed geometry when a live Pull draft is canceled', async () => {
    const previewLayout = vi.fn(async (request) => previewResult(request));
    const callbacks = await renderArrangement({
      genericRules: true,
      spatialRules: [],
      previewLayout,
    });
    const session = sessionInstances[0]!;
    const confirmed = session.applySpatialPositions.mock.calls.at(-1)?.[0];
    await perform(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Nudge folder right"]')!
        .click(),
    );
    await flushPreviewFrame();
    expect(session.applySpatialPositions.mock.calls.at(-1)?.[0]).not.toEqual(
      confirmed,
    );

    await perform(() =>
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === 'Cancel changes')!
        .click(),
    );

    expect(session.applySpatialPositions.mock.calls.at(-1)?.[0]).toEqual(
      confirmed,
    );
    expect(callbacks.onCommitRule).not.toHaveBeenCalled();
  });

  it('never leaves a live Pull preview presented after persistence fails', async () => {
    const previewLayout = vi.fn(async (request) => previewResult(request));
    await renderArrangement({
      commitFailure: 'disk full',
      genericRules: true,
      spatialRules: [],
      previewLayout,
    });
    const session = sessionInstances[0]!;
    const confirmed = session.applySpatialPositions.mock.calls.at(-1)?.[0];
    await perform(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Nudge folder right"]')!
        .click(),
    );
    await flushPreviewFrame();
    await perform(() =>
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === 'Apply changes')!
        .click(),
    );

    expect(session.applySpatialPositions.mock.calls.at(-1)?.[0]).toEqual(
      confirmed,
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Folder position was not saved: disk full',
    );
  });

  it('keeps editing usable and retries after a preview worker failure', async () => {
    const previewLayout = vi
      .fn<
        (
          request: Omit<GlobalSpatialInfluenceRequest, 'requestId'>,
        ) => Promise<GlobalSpatialInfluenceResult>
      >()
      .mockRejectedValueOnce(new Error('worker unavailable'))
      .mockImplementation(async (request) => previewResult(request));
    await renderArrangement({
      genericRules: true,
      spatialRules: [],
      previewLayout,
    });
    await perform(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Nudge folder right"]')!
        .click(),
    );
    await flushPreviewFrame();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Pull preview unavailable: worker unavailable',
    );

    await perform(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Nudge folder right"]')!
        .click(),
    );
    await flushPreviewFrame();
    expect(previewLayout).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('nudges a Pull target without a rigid preview and saves it after layout', async () => {
    const callbacks = await renderArrangement();
    const session = sessionInstances[0]!;
    expect(callbacks.onAvailabilityChange).toHaveBeenLastCalledWith(
      true,
      undefined,
    );
    expect(container.textContent).toContain(
      'Choose a folder, define its rule, then drag its spatial target.',
    );
    expect(container.textContent).toContain('Active folderalpha');

    const up = container.querySelector<HTMLButtonElement>(
      '[aria-label="Nudge folder up"]',
    )!;
    await perform(() => up.click());
    expect(session.previewFolderAnchor).not.toHaveBeenCalled();
    expect(session.positionFolderTargetAnchor).toHaveBeenCalledWith({
      x: 0,
      y: -0.02,
    });
    expect(callbacks.layout).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('2% up');

    const save = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Apply changes',
    )!;
    await perform(() => save.click());
    expect(callbacks.onCommitAnchor).toHaveBeenCalledWith('alpha', {
      x: 0,
      y: -0.02,
    });
    expect(callbacks.onAnnouncement).toHaveBeenCalledWith(
      'Spatial rule set for this session only',
    );
  });

  it('drags the Pull marker under pointer capture without rigid preview or bubbling to stage pan', async () => {
    const callbacks = await renderArrangement({ genericRules: true });
    const session = sessionInstances[0]!;
    const marker = container.querySelector<HTMLDivElement>(
      '[aria-label="Spatial target for alpha"]',
    )!;
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.assign(marker, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture,
      setPointerCapture,
    });
    const pointerDown = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 10,
      clientY: 12,
      pointerId: 7,
    });

    await perform(() => {
      marker.dispatchEvent(pointerDown);
      marker.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 30,
          clientY: 36,
          pointerId: 7,
        }),
      );
      marker.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          button: 0,
          clientX: 30,
          clientY: 36,
          pointerId: 7,
        }),
      );
    });

    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    expect(pointerDown.defaultPrevented).toBe(true);
    expect(session.setFolderTargetPointerActive.mock.calls).toEqual([
      [true],
      [false],
    ]);
    expect(session.positionFolderTargetAnchor).toHaveBeenCalledWith({
      x: 0.4,
      y: 0.3,
    });
    expect(session.previewFolderAnchor).not.toHaveBeenCalled();
    expect(session.fit).not.toHaveBeenCalled();
    expect(session.center).not.toHaveBeenCalled();
    expect(callbacks.layout).toHaveBeenCalledTimes(1);
    expect(callbacks.onCommitRule).toHaveBeenCalledWith(
      expect.objectContaining({
        behavior: 'pull',
        anchor: { x: 0.4, y: 0.3 },
      }),
    );
  });

  it('keeps Fixed placement marker drag as an exact rigid preview', async () => {
    const callbacks = await renderArrangement({ genericRules: true });
    const session = sessionInstances[0]!;
    await perform(() =>
      [...container.querySelectorAll('label')]
        .find((label) => label.textContent?.includes('Fixed placement'))!
        .querySelector<HTMLInputElement>('input')!
        .click(),
    );
    const marker = container.querySelector<HTMLDivElement>(
      '[aria-label="Spatial target for alpha"]',
    )!;
    Object.assign(marker, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });
    await perform(() => {
      marker.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: 8,
          clientY: 9,
          pointerId: 3,
        }),
      );
      marker.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 28,
          clientY: 29,
          pointerId: 3,
        }),
      );
      marker.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          button: 0,
          clientX: 28,
          clientY: 29,
          pointerId: 3,
        }),
      );
    });

    expect(session.previewFolderAnchor).toHaveBeenCalledWith('alpha', {
      x: 0.4,
      y: 0.3,
    });
    expect(callbacks.onCommitRule).toHaveBeenCalledWith(
      expect.objectContaining({
        behavior: 'place',
        anchor: { x: 0.4, y: 0.3 },
      }),
    );
  });

  it('reverts a failed write and keeps the error actionable', async () => {
    const callbacks = await renderArrangement({ commitFailure: 'disk full' });
    const session = sessionInstances[0]!;
    await perform(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Nudge folder right"]')!
        .click(),
    );
    await perform(() =>
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === 'Apply changes')!
        .click(),
    );

    expect(callbacks.onCommitAnchor).toHaveBeenCalled();
    expect(session.cancelFolderArrangementGesture).toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Folder position was not saved: disk full',
    );
    expect(session.applySpatialPositions).toHaveBeenCalled();
  });

  it('keeps the toolbar action visible and explains an inactive transition', async () => {
    const callbacks = await renderArrangement({ active: false });
    const arrange = container.querySelector<HTMLButtonElement>(
      '[aria-label="Arrange folders"]',
    )!;
    expect(arrange.getAttribute('aria-pressed')).toBe('false');
    await perform(() => arrange.click());
    expect(callbacks.onActiveChange).toHaveBeenCalledWith(true);
  });

  it('authors a complete default Pull rule and switches to Place/Custom transactionally', async () => {
    const callbacks = await renderArrangement({ genericRules: true });
    const fixed = [...container.querySelectorAll('label')]
      .find((label) => label.textContent?.includes('Fixed placement'))!
      .querySelector<HTMLInputElement>('input')!;
    await perform(() => fixed.click());
    const custom = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Custom',
    )!;
    await perform(() => custom.click());
    const directFiles = [...container.querySelectorAll('label')]
      .find((label) => label.textContent?.includes('Files directly in alpha'))!
      .querySelector<HTMLInputElement>('input')!;
    await perform(() => directFiles.click());
    await perform(() =>
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === 'Apply changes')!
        .click(),
    );
    expect(callbacks.onCommitRule).toHaveBeenCalledWith({
      folderKey: 'alpha',
      behavior: 'place',
      scope: {
        kind: 'subtree',
        includeRootFiles: false,
        excludedSubtrees: [],
      },
      anchor: { x: 0, y: 0 },
    });
  });

  it('keeps a large Custom folder tree DOM-bounded with accessible paging', async () => {
    await renderArrangement({ genericRules: true, scopeChildCount: 250 });
    await perform(() =>
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === 'Custom')!
        .click(),
    );
    const scopeTree = container.querySelector<HTMLElement>(
      '[aria-label="Included subfolders"]',
    )!;
    expect(scopeTree.querySelectorAll('input[type="checkbox"]')).toHaveLength(
      200,
    );
    const showMore = [...scopeTree.querySelectorAll('button')].find((button) =>
      button.textContent?.startsWith('Show more folders'),
    )!;
    expect(showMore.textContent).toContain('50 remaining');
    await perform(() => showMore.click());
    expect(scopeTree.querySelectorAll('input[type="checkbox"]')).toHaveLength(
      250,
    );
  });

  it('discards a dirty draft explicitly before closing Arrange folders', async () => {
    const callbacks = await renderArrangement({ genericRules: true });
    await perform(() =>
      [...container.querySelectorAll('label')]
        .find((label) => label.textContent?.includes('Fixed placement'))!
        .querySelector<HTMLInputElement>('input')!
        .click(),
    );
    await perform(() =>
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === 'Done')!
        .click(),
    );
    expect(callbacks.onActiveChange).toHaveBeenCalledWith(false);
    expect(callbacks.onAnnouncement).toHaveBeenLastCalledWith(
      'Unapplied spatial rule changes were discarded; Arrange folders closed.',
    );
  });
});
