import { describe, expect, it } from 'vitest';

import {
  createGlobalConvergencePolicy,
  globalConvergenceBatchPlan,
} from './global-convergence';
import {
  computeGlobalLayout,
  createGlobalLayoutFailure,
  createGlobalLayoutRequest,
  globalLayoutFingerprint,
  validateGlobalLayoutWorkerResponse,
} from './layout';
import { mapProjectionToGlobal } from './mapping';
import {
  customGlobalLayoutSettings,
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
} from './settings';
import { globalTestProjection } from './test-fixture';

function request(folderClustering = false) {
  const settings = { ...DEFAULT_GLOBAL_LAYOUT_SETTINGS, folderClustering };
  return {
    ...createGlobalLayoutRequest(
      mapProjectionToGlobal(globalTestProjection(), settings),
      settings,
    ),
    requestId: 1,
  } as const;
}

describe('Global bounded layout convergence', () => {
  it('derives schema-v3 spatial-only requests and macro identity centrally', () => {
    expect(request(false)).toMatchObject({
      schemaVersion: 3,
      algorithm: 'reference-only',
      policy: {
        version: 'global-fa2-folder-convergence-v1',
        batchIterations: 32,
        maxIterations: 640,
      },
      macro: { version: 'global-folder-none-v1', priorApplications: 0 },
    });
    expect(request(true)).toMatchObject({
      algorithm: 'fixed-total-field',
      macro: {
        version: 'global-folder-fixed-field-v1',
        priorApplications: 1,
        feedback: 'output-only',
      },
    });
  });

  it('reuses one graph through full batches and accepts stable output atomically', () => {
    const batches: number[] = [];
    const result = computeGlobalLayout(request(false), {
      assignBatch: (_graph, iterations) => batches.push(iterations),
    });
    expect(batches).toEqual([32, 32, 32]);
    expect(result).toMatchObject({
      stopReason: 'stable',
      iterationsCompleted: 96,
      macroStepsCompleted: 3,
      stableMacroSteps: 3,
    });
  });

  it('plans a partial final cap explicitly', () => {
    expect(globalConvergenceBatchPlan(1_001)).toEqual([32, 32, 32, 24]);
    expect(globalConvergenceBatchPlan(5_001)).toEqual([32, 32, 16]);
  });

  it('executes and accepts the final partial cap without calling it stable', () => {
    const base = request(false);
    const nodes = Array.from({ length: 1_001 }, (_, index) => ({
      key: `node-${index}`,
      x: index % 17,
      y: index % 31,
    }));
    const batches: number[] = [];
    const result = computeGlobalLayout(
      {
        ...base,
        nodes,
        edges: [],
        policy: createGlobalConvergencePolicy(nodes.length),
      },
      {
        assignBatch: (graph, iterations) => {
          batches.push(iterations);
          graph.forEachNode((key, value) =>
            graph.mergeNodeAttributes(key, {
              x: value.x + (Number(key.slice(5)) % 2 === 0 ? 1 : -1),
            }),
          );
        },
      },
    );
    expect(batches).toEqual([32, 32, 32, 24]);
    expect(result).toMatchObject({
      stopReason: 'max-iterations',
      iterationsCompleted: 120,
      macroStepsCompleted: 4,
      finalMacroStepIterations: 24,
    });
  });

  it('turns a between-step timeout into non-success worker evidence', () => {
    let clock = 0;
    const complete = request(false);
    let failure;
    try {
      computeGlobalLayout(complete, {
        maxWallTimeMs: 5,
        now: () => (clock += 3),
        assignBatch: (graph) =>
          graph.forEachNode((key, value) =>
            graph.mergeNodeAttributes(key, { x: value.x + key.length }),
          ),
      });
    } catch (error: unknown) {
      failure = createGlobalLayoutFailure(complete, error);
    }
    expect(failure).toMatchObject({
      kind: 'error',
      code: 'max-wall-time',
      iterationsCompleted: 32,
      macroStepsCompleted: 1,
    });
    expect(failure).not.toHaveProperty('positions');
  });

  it('never feeds folder correction back into the FA2 graph', () => {
    const frames: string[] = [];
    computeGlobalLayout(request(true), {
      assignBatch: (graph) =>
        frames.push(JSON.stringify(graphPositions(graph))),
    });
    expect(new Set(frames).size).toBe(1);
  });

  it('is deterministic and reports centroid drift separately', () => {
    const first = computeGlobalLayout(request(true));
    const second = computeGlobalLayout(request(true));
    expect(second.positions).toEqual(first.positions);
    expect(second.finalMovement).toEqual(first.finalMovement);
    expect(first.finalMovement?.normalizedCentroidDrift).toBeGreaterThanOrEqual(
      0,
    );
  });

  it('strictly validates the originating request identity', () => {
    const complete = request(false);
    const result = computeGlobalLayout(complete);
    expect(validateGlobalLayoutWorkerResponse(result, complete)).toEqual(
      result,
    );
    expect(() =>
      validateGlobalLayoutWorkerResponse(
        { ...result, macroVersion: 'global-folder-fixed-field-v1' },
        complete,
      ),
    ).toThrow('policy identity');
  });

  it('uses v3 identity while excluding warm coordinates', () => {
    const base = request(true);
    const moved = {
      ...base,
      nodes: base.nodes.map((node) => ({ ...node, x: node.x + 99 })),
    };
    expect(globalLayoutFingerprint(base)).toMatch(/^global-layout-v3-/);
    expect(globalLayoutFingerprint(moved)).toBe(globalLayoutFingerprint(base));
  });

  it('makes visual variants exact request/cache matches and spatial variants misses', () => {
    const projection = globalTestProjection();
    const baseline = {
      folderClustering: true,
      spacingPreset: 'normal' as const,
      custom: customGlobalLayoutSettings('normal'),
    };
    const visual = {
      ...baseline,
      custom: {
        ...baseline.custom,
        nodeSize: 8,
        referenceDegreeSizeInfluence: 100,
        linkThickness: 2,
        labelThreshold: 12,
      },
    };
    const baselineRequest = createGlobalLayoutRequest(
      mapProjectionToGlobal(projection, baseline),
      baseline,
    );
    const visualRequest = createGlobalLayoutRequest(
      mapProjectionToGlobal(projection, visual),
      visual,
    );
    expect(visualRequest).toEqual(baselineRequest);
    expect(globalLayoutFingerprint(visualRequest)).toBe(
      globalLayoutFingerprint(baselineRequest),
    );

    for (const spatial of [
      {
        ...baseline,
        custom: { ...baseline.custom, linkForce: 1.5 },
      },
      {
        ...baseline,
        custom: { ...baseline.custom, betweenFolderSpacing: 5 },
      },
    ]) {
      const spatialRequest = createGlobalLayoutRequest(
        mapProjectionToGlobal(projection, spatial),
        spatial,
      );
      expect(globalLayoutFingerprint(spatialRequest)).not.toBe(
        globalLayoutFingerprint(baselineRequest),
      );
    }
  });
});

function graphPositions(graph: {
  mapNodes: <T>(
    callback: (key: string, value: { x: number; y: number }) => T,
  ) => T[];
}) {
  return graph.mapNodes((key, value) => ({ key, x: value.x, y: value.y }));
}
