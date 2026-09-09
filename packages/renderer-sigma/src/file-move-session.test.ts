import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { globalLayoutPositionsFromInput } from './layout';
import { LocalRendererSession } from './local-session';
import { mapProjectionToLocal } from './local-mapping';
import { localTestProjection } from './local-test-fixture';
import { mapProjectionToGlobal } from './mapping';
import { GlobalRendererSession } from './session';
import { SigmaTestRenderer } from './sigma-test-renderer';
import { globalTestProjection } from './test-fixture';
import { RecordingTemporaryNodeConstraintPort } from './temporary-node-constraint';

describe('temporary File move renderer sessions', () => {
  const windowListeners = new Map<string, (event: unknown) => void>();
  const documentListeners = new Map<string, (event: unknown) => void>();
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    SigmaTestRenderer.instances = [];
    frames = [];
    windowListeners.clear();
    documentListeners.clear();
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
      setTimeout,
      clearTimeout,
      addEventListener: (type: string, callback: (event: unknown) => void) =>
        windowListeners.set(type, callback),
      removeEventListener: (type: string) => windowListeners.delete(type),
    });
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: (type: string, callback: (event: unknown) => void) =>
        documentListeners.set(type, callback),
      removeEventListener: (type: string) => documentListeners.delete(type),
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function globalHarness() {
    const input = mapProjectionToGlobal(globalTestProjection(), {
      folderClustering: false,
      spacingPreset: 'normal',
    });
    const onNodeActivated = vi.fn();
    const onNodeSelected = vi.fn();
    const onNodeSingleClick = vi.fn();
    const count = vi.fn();
    const session = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      input,
      {
        settings: { folderClustering: false, spacingPreset: 'normal' },
        trackpadZoomMode: 'pinch-zoom',
        onNodeActivated,
        onNodeSelected,
        onNodeSingleClick,
        instrumentation: {
          count,
          measure: (_phase, _operation, run) => run(),
          record: vi.fn(),
        },
      },
    );
    const port = new RecordingTemporaryNodeConstraintPort();
    session.setTemporaryFileMoveContext({
      active: true,
      capability: { status: 'available' },
      port,
      sessionGeneration: 'global-session-1',
      simulationGeneration: 'global-simulation-1',
      coordinateGeneration: 'global-coordinates-1',
      fixedTranslationByNodeKey: new Map([['entity:doc-a', { x: 5, y: -2 }]]),
    });
    return {
      input,
      count,
      onNodeActivated,
      onNodeSelected,
      onNodeSingleClick,
      port,
      renderer: SigmaTestRenderer.instances[0]!,
      session,
    };
  }

  function localHarness() {
    const input = mapProjectionToLocal(localTestProjection(), 'root');
    const onNodeActivated = vi.fn();
    const onNodeSelected = vi.fn();
    const onNodeSingleClick = vi.fn();
    const session = new LocalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      input,
      {
        rootNodeKey: input.rootNodeKey,
        trackpadZoomMode: 'pinch-zoom',
        onNodeActivated,
        onNodeSelected,
        onNodeSingleClick,
      },
    );
    const port = new RecordingTemporaryNodeConstraintPort();
    session.setTemporaryFileMoveContext({
      active: true,
      capability: { status: 'available' },
      port,
      sessionGeneration: 'local-session-1',
      simulationGeneration: 'local-simulation-1',
      coordinateGeneration: 'local-coordinates-1',
      fixedTranslationByNodeKey: new Map(),
    });
    return {
      input,
      onNodeActivated,
      onNodeSelected,
      onNodeSingleClick,
      port,
      renderer: SigmaTestRenderer.instances[0]!,
      session,
    };
  }

  it('streams an All drag in dynamic space and suppresses its trailing click/Focus activation', () => {
    const {
      onNodeActivated,
      onNodeSelected,
      onNodeSingleClick,
      port,
      renderer,
    } = globalHarness();
    const node = renderer.graph.getNodeAttributes('entity:doc-a') as {
      x: number;
      y: number;
    };
    const start = { x: node.x, y: node.y };
    const downDefault = vi.fn();
    renderer.handlers.get('downNode')!({
      node: 'entity:doc-a',
      event: { x: start.x + 2, y: start.y + 1 },
      preventSigmaDefault: downDefault,
    });
    const moveDefault = vi.fn();
    renderer.handlers.get('moveBody')!({
      event: { x: start.x + 6, y: start.y + 1 },
      preventSigmaDefault: moveDefault,
    });
    renderer.handlers.get('moveBody')!({
      event: { x: start.x + 9, y: start.y + 2 },
      preventSigmaDefault: moveDefault,
    });
    renderer.handlers.get('upStage')!({});
    expect(downDefault).toHaveBeenCalledOnce();
    expect(moveDefault).toHaveBeenCalledTimes(2);
    expect(port.commands).toEqual([
      expect.objectContaining({ kind: 'begin', sequence: 0 }),
      expect.objectContaining({ kind: 'update', sequence: 1 }),
      expect.objectContaining({ kind: 'end', sequence: 2, reason: 'released' }),
    ]);
    const begin = port.commands[0];
    expect(begin?.kind).toBe('begin');
    if (begin?.kind === 'begin') {
      expect(begin.target.x).toBeCloseTo(start.x - 1);
      expect(begin.target.y).toBeCloseTo(start.y + 2);
    }
    expect(onNodeSelected).toHaveBeenCalledOnce();

    renderer.handlers.get('clickNode')!({ node: 'entity:doc-a' });
    renderer.handlers.get('doubleClickNode')!({
      node: 'entity:doc-a',
      preventSigmaDefault: vi.fn(),
    });
    vi.advanceTimersByTime(300);
    expect(onNodeSingleClick).not.toHaveBeenCalled();
    expect(onNodeActivated).not.toHaveBeenCalled();
  });

  it('retains ordinary single/double-click meaning below threshold', () => {
    const {
      onNodeActivated,
      onNodeSelected,
      onNodeSingleClick,
      port,
      renderer,
    } = globalHarness();
    const node = renderer.graph.getNodeAttributes('entity:doc-a') as {
      x: number;
      y: number;
    };
    renderer.handlers.get('downNode')!({
      node: 'entity:doc-a',
      event: node,
      preventSigmaDefault: vi.fn(),
    });
    renderer.handlers.get('moveBody')!({
      event: { x: node.x + 2, y: node.y },
      preventSigmaDefault: vi.fn(),
    });
    renderer.handlers.get('upNode')!({});
    renderer.handlers.get('clickNode')!({ node: 'entity:doc-a' });
    expect(onNodeSelected).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(300);
    expect(onNodeSingleClick).toHaveBeenCalledWith('entity:doc-a');
    expect(port.commands).toEqual([]);

    renderer.handlers.get('doubleClickNode')!({
      node: 'entity:doc-a',
      preventSigmaDefault: vi.fn(),
    });
    expect(onNodeActivated).toHaveBeenCalledOnce();

    const idleMoveDefault = vi.fn();
    renderer.handlers.get('moveBody')!({
      event: { x: node.x + 20, y: node.y + 20 },
      preventSigmaDefault: idleMoveDefault,
    });
    const idleRightClickDefault = vi.fn();
    renderer.handlers.get('rightClickNode')!({
      node: 'entity:doc-a',
      preventSigmaDefault: idleRightClickDefault,
    });
    expect(idleMoveDefault).not.toHaveBeenCalled();
    expect(idleRightClickDefault).not.toHaveBeenCalled();
  });

  it('uses the live viewport transform again after camera state changes', () => {
    const { port, renderer } = globalHarness();
    const node = renderer.graph.getNodeAttributes('entity:doc-a') as {
      x: number;
      y: number;
    };
    let transformScale = 1;
    const viewportToGraph = vi
      .spyOn(renderer, 'viewportToGraph')
      .mockImplementation((point) => ({
        x: point.x * transformScale,
        y: point.y * transformScale,
      }));
    renderer.handlers.get('downNode')!({
      node: 'entity:doc-a',
      event: { x: 10, y: 10 },
      preventSigmaDefault: vi.fn(),
    });
    transformScale = 2;
    renderer.handlers.get('moveBody')!({
      event: { x: 14, y: 10 },
      preventSigmaDefault: vi.fn(),
    });
    expect(viewportToGraph).toHaveBeenCalledTimes(2);
    const begin = port.commands[0];
    expect(begin?.kind).toBe('begin');
    if (begin?.kind === 'begin') {
      expect(begin.target.x).toBeCloseTo(node.x + 13);
      expect(begin.target.y).toBeCloseTo(node.y + 12);
    }
  });

  it('allows only Focus document nodes and leaves heading/block/diagnostic pointer behavior alone', () => {
    const { port, renderer } = localHarness();
    for (const key of [
      'entity:heading',
      'entity:block',
      'diagnostic:missing',
    ]) {
      const preventSigmaDefault = vi.fn();
      renderer.handlers.get('downNode')!({
        node: key,
        event: { x: 0, y: 0 },
        preventSigmaDefault,
      });
      expect(preventSigmaDefault).not.toHaveBeenCalled();
    }
    expect(port.commands).toEqual([]);

    const root = renderer.graph.getNodeAttributes('entity:root') as {
      x: number;
      y: number;
    };
    const preventSigmaDefault = vi.fn();
    renderer.handlers.get('downNode')!({
      node: 'entity:root',
      event: root,
      preventSigmaDefault,
    });
    renderer.handlers.get('moveBody')!({
      event: { x: root.x + 3, y: root.y },
      preventSigmaDefault,
    });
    expect(preventSigmaDefault).toHaveBeenCalledTimes(2);
    expect(port.commands[0]).toMatchObject({
      kind: 'begin',
      nodeKey: 'entity:root',
    });
  });

  it('routes keyboard nudges through the same All constraint coordinator', () => {
    const { port, session } = globalHarness();

    expect(session.startKeyboardTemporaryFileMove('entity:doc-a')).toEqual({
      status: 'started',
    });
    expect(port.commands).toEqual([]);
    expect(session.nudgeKeyboardTemporaryFileMove({ x: 8, y: 0 })).toBe(true);
    expect(session.nudgeKeyboardTemporaryFileMove({ x: 0, y: -8 })).toBe(true);
    expect(session.releaseKeyboardTemporaryFileMove()).toBe(true);

    expect(port.commands).toEqual([
      expect.objectContaining({
        kind: 'begin',
        nodeKey: 'entity:doc-a',
        sequence: 0,
      }),
      expect.objectContaining({ kind: 'update', sequence: 1 }),
      expect.objectContaining({
        kind: 'end',
        reason: 'released',
        sequence: 2,
      }),
    ]);
  });

  it('keeps non-File Focus rows unavailable to the keyboard controller', () => {
    const { port, session } = localHarness();

    expect(session.startKeyboardTemporaryFileMove('entity:heading')).toEqual({
      status: 'unavailable',
      reason: 'node-unavailable',
    });
    expect(session.nudgeKeyboardTemporaryFileMove({ x: 8, y: 0 })).toBe(false);
    expect(port.commands).toEqual([]);
  });

  it('reports an unavailable simulation attempt without stealing pointer input', () => {
    const { count, renderer, session } = globalHarness();
    session.setTemporaryFileMoveContext({
      active: true,
      capability: {
        status: 'unavailable',
        reason: 'simulation-not-running',
      },
      sessionGeneration: 'global-session-2',
      simulationGeneration: 'global-simulation-2',
      coordinateGeneration: 'global-coordinates-2',
      fixedTranslationByNodeKey: new Map(),
    });
    const preventSigmaDefault = vi.fn();
    renderer.handlers.get('downNode')!({
      node: 'entity:doc-a',
      event: { x: 0, y: 0 },
      preventSigmaDefault,
    });
    expect(preventSigmaDefault).not.toHaveBeenCalled();
    expect(count).toHaveBeenCalledWith('file-move-unavailable-attempts');
  });

  it('ends active work on Escape, topology change, mode arbitration, and disposal', () => {
    const first = globalHarness();
    const node = first.renderer.graph.getNodeAttributes('entity:doc-a') as {
      x: number;
      y: number;
    };
    const begin = () => {
      first.renderer.handlers.get('downNode')!({
        node: 'entity:doc-a',
        event: node,
        preventSigmaDefault: vi.fn(),
      });
      first.renderer.handlers.get('moveBody')!({
        event: { x: node.x + 3, y: node.y },
        preventSigmaDefault: vi.fn(),
      });
    };
    begin();
    windowListeners.get('keydown')!({ key: 'Escape' });
    expect(first.port.commands.at(-1)).toMatchObject({
      kind: 'end',
      reason: 'cancelled',
    });

    begin();
    first.session.update(first.input);
    expect(first.port.commands.at(-1)).toMatchObject({
      kind: 'end',
      reason: 'topology-changed',
    });

    begin();
    first.session.setFolderArrangementContext({
      active: true,
      anchors: new Map(),
      automaticPositions: globalLayoutPositionsFromInput(first.input),
      input: first.input,
    });
    expect(first.port.commands.at(-1)).toMatchObject({
      kind: 'end',
      reason: 'mode-exit',
    });

    first.session.setFolderArrangementContext(undefined);
    first.session.setTemporaryFileMoveContext({
      active: true,
      capability: { status: 'available' },
      port: first.port,
      sessionGeneration: 'global-session-2',
      simulationGeneration: 'global-simulation-2',
      coordinateGeneration: 'global-coordinates-2',
      fixedTranslationByNodeKey: new Map(),
    });
    begin();
    first.session.destroy();
    expect(first.port.commands.at(-1)).toMatchObject({
      kind: 'end',
      reason: 'disposed',
    });
  });
});
