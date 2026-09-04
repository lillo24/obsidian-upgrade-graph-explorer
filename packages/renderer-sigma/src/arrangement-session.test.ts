import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { globalLayoutPositionsFromInput } from './layout';
import { mapProjectionToGlobal } from './mapping';
import { GlobalRendererSession } from './session';
import { SigmaTestRenderer } from './sigma-test-renderer';
import { globalTestProjection } from './test-fixture';

const settings = { folderClustering: false, spacingPreset: 'normal' } as const;

describe('Global sparse folder arrangement session', () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    SigmaTestRenderer.instances = [];
    frames = [];
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function createSession() {
    const input = mapProjectionToGlobal(globalTestProjection(), settings);
    const onArrangementCommit = vi.fn();
    const onNodeActivated = vi.fn();
    const onNodeSelected = vi.fn();
    const onNodeSingleClick = vi.fn();
    const onArrangementScopeFolderClick = vi.fn();
    const onArrangementTargetPoint = vi.fn();
    const session = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      input,
      {
        settings,
        trackpadZoomMode: 'pinch-zoom',
        onArrangementCommit,
        onArrangementScopeFolderClick,
        onArrangementTargetPoint,
        onNodeActivated,
        onNodeSelected,
        onNodeSingleClick,
      },
    );
    session.setFolderArrangementContext({
      active: true,
      anchors: new Map(),
      automaticPositions: globalLayoutPositionsFromInput(input),
      input,
    });
    return {
      input,
      onArrangementCommit,
      onArrangementScopeFolderClick,
      onArrangementTargetPoint,
      onNodeActivated,
      onNodeSelected,
      onNodeSingleClick,
      renderer: SigmaTestRenderer.instances[0]!,
      session,
    };
  }

  it('rejects unknown, duplicate, and invalid sparse positions before mutation', () => {
    const { renderer, session } = createSession();
    const before = renderer.graph.getNodeAttributes('entity:doc-a');
    expect(() =>
      session.applyPartialPositions([{ key: 'missing', x: 0, y: 0 }]),
    ).toThrow('unknown or duplicate');
    expect(() =>
      session.applyPartialPositions([
        { key: 'entity:doc-a', x: 1, y: 1 },
        { key: 'entity:doc-a', x: 2, y: 2 },
      ]),
    ).toThrow('unknown or duplicate');
    expect(() =>
      session.applyPartialPositions([
        { key: 'entity:doc-a', x: Number.NaN, y: 0 },
      ]),
    ).toThrow('invalid coordinates');
    expect(renderer.graph.getNodeAttributes('entity:doc-a')).toEqual(before);
  });

  it('updates only supplied nodes and refreshes their incident edge geometry with indexation', () => {
    const { renderer, session } = createSession();
    const untouched = { ...renderer.graph.getNodeAttributes('entity:doc-c') };
    session.applyPartialPositions([
      { key: 'entity:doc-a', x: 11, y: 12 },
      { key: 'entity:doc-b', x: 13, y: 14 },
    ]);
    expect(renderer.graph.getNodeAttributes('entity:doc-a')).toMatchObject({
      x: 11,
      y: 12,
    });
    expect(renderer.graph.getNodeAttributes('entity:doc-b')).toMatchObject({
      x: 13,
      y: 14,
    });
    expect(renderer.graph.getNodeAttributes('entity:doc-c')).toEqual(untouched);
    expect(renderer.refresh).toHaveBeenLastCalledWith({
      partialGraph: {
        nodes: ['entity:doc-a', 'entity:doc-b'],
        edges: expect.arrayContaining(['edge-ab', 'edge-ac']),
      },
      schedule: true,
      skipIndexation: false,
    });
  });

  it('coalesces node drag preview to one frame, preserves stage pan, and commits once', () => {
    const { onArrangementCommit, renderer, session } = createSession();
    const down = renderer.handlers.get('downNode')!;
    const move = renderer.handlers.get('moveBody')!;
    const up = renderer.handlers.get('upStage')!;
    down({
      node: 'entity:doc-a',
      event: { x: 10, y: 10 },
      preventSigmaDefault: vi.fn(),
    });
    const preventFirst = vi.fn();
    const preventSecond = vi.fn();
    move({
      event: { x: 20, y: 20 },
      preventSigmaDefault: preventFirst,
    });
    move({
      event: { x: 24, y: 22 },
      preventSigmaDefault: preventSecond,
    });
    expect(preventFirst).toHaveBeenCalledTimes(1);
    expect(preventSecond).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(1);
    frames[0]!(16);
    expect(renderer.refresh).toHaveBeenLastCalledWith(
      expect.objectContaining({
        partialGraph: {
          nodes: ['entity:doc-a', 'entity:doc-b'],
          edges: expect.any(Array),
        },
        skipIndexation: false,
      }),
    );
    up({});
    expect(onArrangementCommit).toHaveBeenCalledTimes(1);
    expect(onArrangementCommit).toHaveBeenCalledWith(
      'alpha',
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    );

    session.completeFolderArrangementCommit();
    const stageMoveDefault = vi.fn();
    move({
      event: { x: 30, y: 30 },
      preventSigmaDefault: stageMoveDefault,
    });
    expect(stageMoveDefault).not.toHaveBeenCalled();
  });

  it('suppresses ordinary click and double-click actions only while Arrange is active', () => {
    const {
      onNodeActivated,
      onNodeSelected,
      onNodeSingleClick,
      renderer,
      session,
    } = createSession();
    const click = renderer.handlers.get('clickNode')!;
    const doubleClick = renderer.handlers.get('doubleClickNode')!;
    click({ node: 'entity:doc-a' });
    const preventSigmaDefault = vi.fn();
    doubleClick({ node: 'entity:doc-a', preventSigmaDefault });
    expect(preventSigmaDefault).toHaveBeenCalledTimes(1);
    expect(onNodeSelected).not.toHaveBeenCalled();
    expect(onNodeSingleClick).not.toHaveBeenCalled();
    expect(onNodeActivated).not.toHaveBeenCalled();

    session.setFolderArrangementContext(undefined);
    click({ node: 'entity:doc-a' });
    expect(onNodeSelected).toHaveBeenCalledTimes(1);
  });

  it('cancels pointer and keyboard previews without committing', () => {
    const { onArrangementCommit, renderer, session } = createSession();
    const original = {
      ...renderer.graph.getNodeAttributes('entity:doc-a'),
    };
    session.previewFolderAnchor('alpha', { x: 0.5, y: 0.5 });
    expect(renderer.graph.getNodeAttributes('entity:doc-a')).not.toEqual(
      original,
    );
    expect(session.cancelFolderArrangementGesture()).toBe(true);
    expect(onArrangementCommit).not.toHaveBeenCalled();
  });

  it('uses graph clicks as folder-scope shortcuts and disables target dragging while choosing', () => {
    const {
      input,
      onArrangementCommit,
      onArrangementScopeFolderClick,
      renderer,
      session,
    } = createSession();
    session.setFolderArrangementContext({
      active: true,
      activeFolderKey: 'alpha',
      activeMemberNodeKeys: ['entity:doc-a', 'entity:doc-b'],
      anchors: new Map(),
      automaticPositions: globalLayoutPositionsFromInput(input),
      chooseScope: true,
      input,
    });
    renderer.handlers.get('clickNode')!({ node: 'entity:doc-a' });
    expect(onArrangementScopeFolderClick).toHaveBeenCalledWith(
      'entity:doc-a',
      'alpha',
    );

    renderer.handlers.get('downNode')!({
      node: 'entity:doc-a',
      event: { x: 10, y: 10 },
      preventSigmaDefault: vi.fn(),
    });
    const preventSigmaDefault = vi.fn();
    renderer.handlers.get('moveBody')!({
      event: { x: 30, y: 30 },
      preventSigmaDefault,
    });
    expect(preventSigmaDefault).not.toHaveBeenCalled();
    expect(frames).toHaveLength(0);
    expect(onArrangementCommit).not.toHaveBeenCalled();
  });

  it('re-emits the target marker after raw viewport correction uses the processed frame', async () => {
    const { input, onArrangementTargetPoint, renderer, session } =
      createSession();
    session.setFolderArrangementContext({
      active: true,
      activeFolderKey: 'alpha',
      activeMemberNodeKeys: ['entity:doc-a', 'entity:doc-b'],
      anchors: new Map(),
      automaticPositions: globalLayoutPositionsFromInput(input),
      input,
      targetAnchor: { x: 0.4, y: -0.3 },
    });
    onArrangementTargetPoint.mockClear();

    await session.applySpatialPositions(globalLayoutPositionsFromInput(input));

    expect(renderer.camera.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        angle: 0,
        ratio: 1,
        x: expect.any(Number),
        y: expect.any(Number),
      }),
    );
    expect(onArrangementTargetPoint).toHaveBeenCalledWith({
      x: expect.any(Number),
      y: expect.any(Number),
    });
  });
});
