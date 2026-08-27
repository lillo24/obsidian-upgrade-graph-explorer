import { describe, expect, it } from 'vitest';

import { inspectEntity } from './entity-inspection';
import { inspectionFixture } from './test-fixture';
import { createInspectionWorkspace } from './workspace';

describe('subtree relationship inspection', () => {
  it('includes descendant-authored outgoing references across every status', () => {
    const inspection = inspectEntity(
      createInspectionWorkspace(inspectionFixture()),
      'doc-alpha',
    );

    expect(
      new Set(
        inspection.outgoingReferences.map(
          ({ occurrence }) => occurrence.status,
        ),
      ),
    ).toEqual(new Set(['resolved', 'unresolved', 'ambiguous', 'invalid']));
    expect(inspection.outgoingReferences).toHaveLength(7);
    expect(
      inspection.outgoingReferences.every(({ sourceIsDescendant }) =>
        Boolean(sourceIsDescendant),
      ),
    ).toBe(true);
  });

  it('derives resolved backlinks into descendants and retains duplicate occurrences', () => {
    const inspection = inspectEntity(
      createInspectionWorkspace(inspectionFixture()),
      'doc-alpha',
    );

    expect(
      inspection.backlinks.map(({ occurrence }) => occurrence.referenceId),
    ).toEqual(['r-alpha-internal', 'r-beta-back-one', 'r-beta-back-two']);
    expect(
      inspection.backlinks.every(({ targetIsDescendant }) =>
        Boolean(targetIsDescendant),
      ),
    ).toBe(true);
    expect(
      inspection.backlinks.every(
        ({ occurrence }) => occurrence.status === 'resolved',
      ),
    ).toBe(true);
  });

  it('keeps ambiguous candidate mentions separate and counts one occurrence once', () => {
    const inspection = inspectEntity(
      createInspectionWorkspace(inspectionFixture()),
      'doc-beta',
    );

    expect(inspection.ambiguousCandidateMentions).toHaveLength(1);
    expect(
      inspection.ambiguousCandidateMentions[0]?.relevantCandidates.map(
        ({ entityId }) => entityId,
      ),
    ).toEqual(['beta-target', 'beta-deep']);
    expect(
      inspection.backlinks.map(({ occurrence }) => occurrence.referenceId),
    ).toEqual([
      'r-alpha-overview-beta',
      'r-alpha-nested-beta',
      'r-alpha-block-beta-embed',
    ]);
    expect(
      inspection.backlinks.some(
        ({ occurrence }) => occurrence.referenceId === 'r-alpha-ambiguous',
      ),
    ).toBe(false);
  });
});
