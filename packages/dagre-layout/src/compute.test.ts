import { describe, expect, it } from 'vitest';

import {
  DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
  DagreLayoutValidationError,
  validateDagreLayoutInput,
  validateDagreLayoutOutput,
  validateDagreLayoutWorkerResponse,
  type DagreLayoutInput,
} from './index';
import {
  computeDagreLayout,
  dagreEdgeSettings,
  dagreGraphSettings,
} from './compute';
import { handleDagreLayoutWorkerRequest } from './worker-runtime';

declare const structuredClone: <Value>(value: Value) => Value;

const structureInput: DagreLayoutInput = {
  mode: 'structure',
  nodes: [
    { id: 'a', width: 100, height: 60 },
    { id: 'b', width: 80, height: 40 },
    { id: 'c', width: 70, height: 50 },
  ],
  edges: [
    { id: 'hierarchy', source: 'a', target: 'b', kind: 'hierarchy' },
    { id: 'reference', source: 'a', target: 'c', kind: 'reference' },
  ],
};

describe('plain Dagre layout', () => {
  it('computes exact deterministic structure and focus coordinates', () => {
    const structure = computeDagreLayout(structureInput);
    const focus = computeDagreLayout({ ...structureInput, mode: 'focus' });

    expect(computeDagreLayout(structureInput)).toEqual(structure);
    expect(structure.positions).toEqual([
      { id: 'a', x: 50, y: 28 },
      { id: 'b', x: 97, y: 170 },
      { id: 'c', x: 28, y: 292 },
    ]);
    expect(focus.positions).toEqual([
      { id: 'a', x: 28, y: 47.5 },
      { id: 'b', x: 220, y: 82 },
      { id: 'c', x: 392, y: 28 },
    ]);
    expect(structure.positions[0]!.y).toBeLessThan(structure.positions[1]!.y);
    expect(focus.positions[0]!.x).toBeLessThan(focus.positions[1]!.x);
  });

  it('retains the established graph and edge configuration', () => {
    expect(dagreGraphSettings('structure')).toEqual({
      rankdir: 'TB',
      ranker: 'network-simplex',
      nodesep: 48,
      ranksep: 82,
      marginx: 28,
      marginy: 28,
    });
    expect(dagreGraphSettings('focus')).toMatchObject({
      rankdir: 'LR',
      nodesep: 38,
      ranksep: 92,
    });
    expect(dagreGraphSettings('local-structured')).toEqual({
      rankdir: 'LR',
      ranker: 'network-simplex',
      nodesep: 22,
      ranksep: 58,
      marginx: 20,
      marginy: 20,
    });
    expect(dagreEdgeSettings('hierarchy')).toEqual({ minlen: 1, weight: 8 });
    expect(dagreEdgeSettings('reference')).toEqual({ minlen: 2, weight: 1 });
  });

  it('computes Local Structured through the same clone-safe worker protocol', () => {
    const input: DagreLayoutInput = {
      ...structureInput,
      mode: 'local-structured',
    };
    const request = structuredClone({
      protocolVersion: DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
      requestId: 13,
      kind: 'layout' as const,
      input,
    });
    const response = handleDagreLayoutWorkerRequest(request, () => 1);

    expect(response.kind).toBe('success');
    if (response.kind === 'success') {
      expect(response.output).toEqual(computeDagreLayout(input));
      expect(response.output.positions[0]!.x).toBeLessThan(
        response.output.positions[1]!.x,
      );
    }
  });

  it('supports empty input and fixed node dimensions', () => {
    expect(
      computeDagreLayout({ mode: 'structure', nodes: [], edges: [] }),
    ).toEqual({ positions: [] });
    const output = computeDagreLayout({
      mode: 'structure',
      nodes: [{ id: 'wide', width: 400, height: 40 }],
      edges: [],
    });
    expect(output.positions).toEqual([{ id: 'wide', x: 28, y: 28 }]);
  });

  it('validates unique IDs, topology, finite coordinates, and exact coverage', () => {
    expect(() =>
      validateDagreLayoutInput({
        mode: 'structure',
        nodes: [
          { id: 'a', width: 10, height: 10 },
          { id: 'a', width: 10, height: 10 },
        ],
        edges: [],
      }),
    ).toThrow(DagreLayoutValidationError);
    expect(() =>
      validateDagreLayoutInput({
        mode: 'structure',
        nodes: [{ id: 'a', width: 10, height: 10 }],
        edges: [
          { id: 'edge', source: 'a', target: 'missing', kind: 'reference' },
        ],
      }),
    ).toThrow(/existing nodes/);
    expect(() =>
      validateDagreLayoutOutput(structureInput, {
        positions: [{ id: 'a', x: Number.NaN, y: 0 }],
      }),
    ).toThrow(/finite coordinates/);
    expect(() =>
      validateDagreLayoutOutput(structureInput, {
        positions: [{ id: 'a', x: 0, y: 0 }],
      }),
    ).toThrow(/cover every input node/);
  });

  it('keeps requests and responses structured-cloneable and worker-equal', () => {
    let clock = 0;
    const request = structuredClone({
      protocolVersion: DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
      requestId: 7,
      kind: 'layout' as const,
      input: structureInput,
    });
    const response = handleDagreLayoutWorkerRequest(request, () => ++clock);
    const cloned = structuredClone(response);

    expect(response.kind).toBe('success');
    expect(
      validateDagreLayoutWorkerResponse(cloned, 7, structureInput),
    ).toEqual(response);
    if (response.kind === 'success') {
      expect(response.output).toEqual(computeDagreLayout(structureInput));
    }
    expect(JSON.stringify(response)).not.toContain('function');
  });

  it('serializes invalid input as an explicit failure', () => {
    const response = handleDagreLayoutWorkerRequest(
      {
        protocolVersion: DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: 9,
        kind: 'layout',
        input: { mode: 'structure', nodes: [{ id: 'a' }], edges: [] },
      },
      () => 1,
    );
    expect(response).toMatchObject({
      requestId: 9,
      kind: 'failure',
      code: 'invalid-input',
    });
  });

  it('distinguishes a malformed envelope from invalid layout input', () => {
    const response = handleDagreLayoutWorkerRequest(
      {
        protocolVersion: DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION + 1,
        requestId: 11,
        kind: 'layout',
        input: structureInput,
      },
      () => 1,
    );
    expect(response).toMatchObject({
      requestId: 11,
      kind: 'failure',
      code: 'invalid-request',
    });
  });
});
