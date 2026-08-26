import { describe, expect, it } from 'vitest';

import { documentOnlyProjectionState } from './presets';
import { projectSnapshot } from './project';
import { projectionFixture } from './test-fixture';
import type {
  ProjectedEntityNode,
  ProjectedReferenceEdge,
  ProjectedReferenceTargetNode,
  ViewProjectionState,
} from './types';

describe('endpoint roll-up and provenance', () => {
  it('routes hidden sources and targets independently and aggregates equal visible endpoints', () => {
    const projection = projectSnapshot(
      projectionFixture(),
      documentOnlyProjectionState(),
    );
    const edge = projection.edges.find(
      (candidate): candidate is ProjectedReferenceEdge =>
        candidate.kind === 'reference' &&
        candidate.status === 'resolved' &&
        candidate.referenceIds.includes('r-a-detail-to-b-leaf'),
    );

    expect(edge?.referenceIds).toEqual([
      'r-a-deep-to-b-target',
      'r-a-detail-to-b-leaf',
    ]);
    const endpoints = [edge?.sourceNodeId, edge?.targetNodeId].map((id) =>
      projection.nodes.find((node) => node.id === id),
    );
    expect(endpoints).toEqual([
      expect.objectContaining({ kind: 'entity', entityId: 'doc-a' }),
      expect.objectContaining({ kind: 'entity', entityId: 'doc-b' }),
    ]);
  });

  it('keeps same-node rolled references as internal provenance without a self-loop', () => {
    const projection = projectSnapshot(
      projectionFixture(),
      documentOnlyProjectionState(),
    );
    const document = projection.nodes.find(
      (node): node is ProjectedEntityNode =>
        node.kind === 'entity' && node.entityId === 'doc-a',
    );

    expect(document?.internalReferenceIds).toEqual(['r-a-internal']);
    expect(
      projection.edges.some(
        (edge) =>
          edge.kind === 'reference' && edge.sourceNodeId === edge.targetNodeId,
      ),
    ).toBe(false);
  });

  it('represents every non-resolved state with source-scoped synthetic targets', () => {
    const projection = projectSnapshot(
      projectionFixture(),
      documentOnlyProjectionState(),
    );
    const targets = projection.nodes.filter(
      (node): node is ProjectedReferenceTargetNode =>
        node.kind === 'reference-target',
    );
    const aMissing = targets.find(
      (node) =>
        node.status === 'unresolved' &&
        node.referenceIds.includes('r-a-missing-1'),
    );
    const bMissing = targets.find((node) =>
      node.referenceIds.includes('r-b-missing'),
    );
    const ambiguous = targets.find((node) => node.status === 'ambiguous');
    const invalid = targets.find((node) => node.status === 'invalid');

    expect(aMissing).toMatchObject({
      rawTarget: 'Missing',
      referenceIds: ['r-a-missing-1', 'r-a-missing-2'],
    });
    expect(bMissing?.id).not.toBe(aMissing?.id);
    expect(ambiguous?.candidateEntityIds).toEqual(['doc-b', 'doc-c']);
    expect(invalid).toMatchObject({
      rawTarget: '../Outside',
      reasons: ['Target escapes the workspace.'],
    });
    expect(
      projection.edges.some(
        (edge) =>
          edge.kind === 'reference' &&
          edge.status === 'ambiguous' &&
          projection.nodes.find((node) => node.id === edge.targetNodeId)
            ?.kind === 'entity',
      ),
    ).toBe(false);
  });

  it('preserves every contributing canonical reference exactly once', () => {
    const snapshot = projectionFixture();
    const projection = projectSnapshot(snapshot, documentOnlyProjectionState());
    const represented = projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? node.internalReferenceIds : [],
    );
    represented.push(
      ...projection.edges.flatMap((edge) =>
        edge.kind === 'reference' ? edge.referenceIds : [],
      ),
    );

    expect(represented.sort()).toEqual(
      snapshot.references.map(({ id }) => id).sort(),
    );
    expect(new Set(represented).size).toBe(represented.length);
  });

  it('re-routes exact endpoints as progressively visible nodes appear', () => {
    const state: ViewProjectionState = {
      disclosure: {
        defaultDepth: 1,
        expandedEntityIds: ['a-overview', 'a-detail', 'b-target'],
        collapsedEntityIds: [],
        includeBlocks: false,
      },
    };
    const projection = projectSnapshot(projectionFixture(), state);
    const edge = projection.edges.find(
      (candidate): candidate is ProjectedReferenceEdge =>
        candidate.kind === 'reference' &&
        candidate.referenceIds.includes('r-a-detail-to-b-leaf'),
    );
    const source = projection.nodes.find(
      (node) => node.id === edge?.sourceNodeId,
    );
    const target = projection.nodes.find(
      (node) => node.id === edge?.targetNodeId,
    );

    expect(source).toMatchObject({ entityId: 'a-detail' });
    expect(target).toMatchObject({ entityId: 'b-leaf' });
  });

  it('emits hierarchy edges only between entity nodes', () => {
    const projection = projectSnapshot(projectionFixture(), {
      disclosure: {
        defaultDepth: 1,
        expandedEntityIds: ['a-overview'],
        collapsedEntityIds: [],
        includeBlocks: false,
      },
    });
    const nodes = new Map(projection.nodes.map((node) => [node.id, node]));

    expect(
      projection.edges
        .filter((edge) => edge.kind === 'hierarchy')
        .every(
          (edge) =>
            nodes.get(edge.sourceNodeId)?.kind === 'entity' &&
            nodes.get(edge.targetNodeId)?.kind === 'entity',
        ),
    ).toBe(true);
  });
});
