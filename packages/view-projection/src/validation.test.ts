import { describe, expect, it } from 'vitest';

import {
  documentOnlyProjectionState,
  topLevelSectionProjectionState,
} from './presets';
import { projectSnapshot, projectView } from './project';
import { projectionFixture } from './test-fixture';
import type { ViewProjectionState } from './types';
import { validateViewProjection } from './validation';
import { createProjectionWorkspace } from './workspace';

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('projection determinism and validation', () => {
  it('is byte-deterministic for repeated calls and equivalent input array order', () => {
    const snapshot = projectionFixture();
    const reordered = {
      ...snapshot,
      entities: [...snapshot.entities].reverse(),
      references: [...snapshot.references].reverse(),
    };
    const state = topLevelSectionProjectionState();
    const first = JSON.stringify(projectSnapshot(snapshot, state));

    expect(JSON.stringify(projectSnapshot(snapshot, state))).toBe(first);
    expect(JSON.stringify(projectSnapshot(reordered, state))).toBe(first);
  });

  it('survives a JSON round trip and runtime validation', () => {
    const workspace = createProjectionWorkspace(projectionFixture());
    const projection = projectView(workspace, documentOnlyProjectionState());
    const parsed: unknown = JSON.parse(JSON.stringify(projection));
    const validation = validateViewProjection(workspace, parsed);

    expect(validation.valid).toBe(true);
    if (validation.valid) expect(validation.value).toEqual(projection);
  });

  it('rejects missing endpoints, duplicate provenance, and synthetic hierarchy', () => {
    const workspace = createProjectionWorkspace(projectionFixture());
    const projection = projectView(workspace, documentOnlyProjectionState());
    const referenceEdge = projection.edges.find(
      (edge) => edge.kind === 'reference',
    );
    const synthetic = projection.nodes.find(
      (node) => node.kind === 'reference-target',
    );
    expect(referenceEdge).toBeDefined();
    expect(synthetic).toBeDefined();
    if (referenceEdge === undefined || synthetic === undefined) return;

    const invalid = {
      ...projection,
      edges: [
        ...projection.edges,
        {
          ...referenceEdge,
          id: 'duplicate-provenance-edge',
          targetNodeId: 'absent',
        },
        {
          id: 'synthetic-hierarchy',
          kind: 'hierarchy',
          sourceNodeId: synthetic.id,
          targetNodeId: projection.nodes[0]?.id ?? '',
        },
      ],
    };
    const validation = validateViewProjection(workspace, invalid);

    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.issues.map(({ code }) => code)).toEqual(
        expect.arrayContaining([
          'missing-edge-endpoint',
          'duplicate-provenance',
          'invalid-hierarchy-edge',
        ]),
      );
    }
  });

  it('does not mutate frozen canonical snapshot or view state', () => {
    const snapshot = deepFreeze(projectionFixture());
    const state = deepFreeze<ViewProjectionState>({
      ...documentOnlyProjectionState(),
      disclosure: {
        ...documentOnlyProjectionState().disclosure,
        expandedEntityIds: ['doc-a'],
      },
    });

    expect(() => projectSnapshot(snapshot, state)).not.toThrow();
    expect(snapshot.entities[0]?.id).toBe('doc-a');
    expect(state.disclosure.expandedEntityIds).toEqual(['doc-a']);
  });

  it('fails loudly when canonical input is invalid', () => {
    const snapshot = projectionFixture();
    expect(() =>
      createProjectionWorkspace({
        ...snapshot,
        references: [
          {
            ...snapshot.references[0]!,
            sourceEntityId: 'absent',
          },
        ],
      }),
    ).toThrow(/invalid canonical snapshot/u);
  });
});
