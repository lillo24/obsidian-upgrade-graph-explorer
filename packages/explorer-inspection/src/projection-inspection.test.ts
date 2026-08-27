import { describe, expect, it } from 'vitest';

import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  projectView,
  topLevelSectionProjectionState,
} from '@icarus-graph-explorer/view-projection';

import {
  inspectProjectedEdge,
  inspectProjectedNode,
} from './projection-inspection';
import { inspectionFixture } from './test-fixture';
import { createInspectionWorkspace } from './workspace';

function contexts() {
  const snapshot = inspectionFixture();
  return {
    inspection: createInspectionWorkspace(snapshot),
    projection: createProjectionWorkspace(snapshot),
  };
}

describe('projected provenance inspection', () => {
  it('explains internal collapsed occurrences without creating self-loops', () => {
    const { inspection, projection } = contexts();
    const view = projectView(projection, documentOnlyProjectionState());
    const alpha = view.nodes.find(
      (node) => node.kind === 'entity' && node.entityId === 'doc-alpha',
    );
    expect(alpha).toBeDefined();

    const result = inspectProjectedNode(inspection, view, alpha?.id ?? '');
    expect(result.kind).toBe('entity');
    expect(
      result.kind === 'entity'
        ? result.internalRelationships.map(({ referenceId }) => referenceId)
        : [],
    ).toEqual(['r-alpha-internal']);
    expect(
      view.edges.some(
        (edge) =>
          edge.kind === 'reference' &&
          edge.sourceNodeId === alpha?.id &&
          edge.targetNodeId === alpha?.id,
      ),
    ).toBe(false);
  });

  it('lists every aggregated occurrence and explains both rolled endpoints', () => {
    const { inspection, projection } = contexts();
    const view = projectView(projection, documentOnlyProjectionState());
    const edge = view.edges.find(
      (candidate) =>
        candidate.kind === 'reference' &&
        candidate.status === 'resolved' &&
        candidate.referenceIds.includes('r-alpha-nested-beta'),
    );
    expect(edge?.kind).toBe('reference');

    const result = inspectProjectedEdge(inspection, view, edge?.id ?? '');
    expect(result.kind).toBe('reference');
    if (result.kind !== 'reference') return;
    expect(
      result.occurrences.map(({ occurrence }) => occurrence.referenceId),
    ).toEqual([
      'r-alpha-overview-beta',
      'r-alpha-nested-beta',
      'r-alpha-block-beta-embed',
    ]);
    expect(
      result.occurrences.every(
        ({ sourceRolledUp, targetRolledUp }) =>
          sourceRolledUp && targetRolledUp,
      ),
    ).toBe(true);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('describes hierarchy containment without reference provenance', () => {
    const { inspection, projection } = contexts();
    const view = projectView(projection, topLevelSectionProjectionState());
    const edge = view.edges.find((candidate) => candidate.kind === 'hierarchy');
    const result = inspectProjectedEdge(inspection, view, edge?.id ?? '');

    expect(result).toMatchObject({
      kind: 'hierarchy',
      parent: { kind: 'document' },
      child: { kind: 'section' },
    });
    expect(JSON.stringify(result)).not.toContain('referenceId');
  });

  it('describes unresolved, ambiguous, and invalid diagnostic nodes and edges', () => {
    const { inspection, projection } = contexts();
    const view = projectView(projection, documentOnlyProjectionState());
    const diagnostics = view.nodes.filter(
      (node) => node.kind === 'reference-target',
    );

    expect(new Set(diagnostics.map(({ status }) => status))).toEqual(
      new Set(['unresolved', 'ambiguous', 'invalid']),
    );
    const ambiguous = diagnostics.find(({ status }) => status === 'ambiguous');
    const nodeResult = inspectProjectedNode(
      inspection,
      view,
      ambiguous?.id ?? '',
    );
    expect(nodeResult).toMatchObject({
      kind: 'diagnostic',
      status: 'ambiguous',
      occurrences: [{ referenceId: 'r-alpha-ambiguous' }],
    });
    expect(
      nodeResult.kind === 'diagnostic'
        ? nodeResult.candidates.map(({ entityId }) => entityId)
        : [],
    ).toEqual(['beta-target', 'beta-deep', 'gamma-target']);

    const diagnosticEdge = view.edges.find(
      (edge) => edge.kind === 'reference' && edge.status === 'ambiguous',
    );
    const edgeResult = inspectProjectedEdge(
      inspection,
      view,
      diagnosticEdge?.id ?? '',
    );
    expect(edgeResult).toMatchObject({
      kind: 'reference',
      status: 'ambiguous',
      projectedTarget: { kind: 'diagnostic' },
    });
  });

  it('fails loudly for stale projected selection identities', () => {
    const { inspection, projection } = contexts();
    const view = projectView(projection, documentOnlyProjectionState());

    expect(() => inspectProjectedNode(inspection, view, 'stale-node')).toThrow(
      /missing node/u,
    );
    expect(() => inspectProjectedEdge(inspection, view, 'stale-edge')).toThrow(
      /missing edge/u,
    );
  });
});
