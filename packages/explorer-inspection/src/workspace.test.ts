import { describe, expect, it } from 'vitest';

import { describeEntity, describeReference } from './descriptors';
import { inspectionFixture } from './test-fixture';
import { createInspectionWorkspace } from './workspace';

describe('inspection workspace and descriptors', () => {
  it('indexes one validated snapshot in deterministic hierarchy/source order', () => {
    const workspace = createInspectionWorkspace(inspectionFixture());

    expect(workspace.children('doc-alpha').map(({ id }) => id)).toEqual([
      'alpha-overview',
      'alpha-duplicate',
    ]);
    expect(workspace.descendants('doc-alpha').map(({ id }) => id)).toEqual([
      'alpha-overview',
      'alpha-nested',
      'alpha-block',
      'alpha-duplicate',
    ]);
    expect(workspace.references()).toHaveLength(9);
    expect(
      workspace.referencesFrom('alpha-nested').map(({ id }) => id),
    ).toEqual([
      'r-alpha-nested-beta',
      'r-alpha-internal',
      'r-alpha-unresolved',
      'r-alpha-ambiguous',
      'r-alpha-invalid',
    ]);
  });

  it('creates navigable breadcrumbs for documents, skipped levels, duplicates, and blocks', () => {
    const workspace = createInspectionWorkspace(inspectionFixture());
    const document = describeEntity(workspace, 'doc-alpha');
    const nested = describeEntity(workspace, 'alpha-nested');
    const duplicate = describeEntity(workspace, 'alpha-duplicate');
    const block = describeEntity(workspace, 'alpha-block');

    expect(document.displayName).toBe('Alpha');
    expect(document.breadcrumb).toEqual([
      {
        entityId: 'doc-alpha',
        kind: 'document',
        label: 'alpha/Alpha.md',
      },
    ]);
    expect(nested.breadcrumb.map(({ label }) => label)).toEqual([
      'alpha/Alpha.md',
      'Overview',
      'Nested Detail',
    ]);
    expect(duplicate.breadcrumb.map(({ entityId }) => entityId)).toEqual([
      'doc-alpha',
      'alpha-duplicate',
    ]);
    expect(block.displayName).toBe('Block at line 8');
    expect(block.breadcrumb.at(-1)).toMatchObject({
      entityId: 'alpha-block',
      kind: 'block',
    });
    expect(nested.sourceProvenance).toBe('alpha/Alpha.md · L5:C1–L5:C5');
  });

  it('describes exact canonical reference occurrences without source snippets', () => {
    const workspace = createInspectionWorkspace(inspectionFixture());
    const resolved = describeReference(workspace, 'r-alpha-nested-beta');
    const ambiguous = describeReference(workspace, 'r-alpha-ambiguous');

    expect(resolved).toMatchObject({
      referenceId: 'r-alpha-nested-beta',
      kind: 'link',
      rawTarget: 'Target#Target',
      status: 'resolved',
      resolution: {
        status: 'resolved',
        target: { entityId: 'beta-target' },
      },
    });
    expect(resolved.sourceProvenance).toBe('alpha/Alpha.md · L6:C3–L6:C7');
    expect(ambiguous.resolution).toMatchObject({
      status: 'ambiguous',
      reason: 'Several target headings match.',
    });
    expect(
      ambiguous.resolution.status === 'ambiguous'
        ? ambiguous.resolution.candidates.map(({ entityId }) => entityId)
        : [],
    ).toEqual(['beta-target', 'beta-deep', 'gamma-target']);
    expect(JSON.parse(JSON.stringify(ambiguous))).toEqual(ambiguous);
    expect(JSON.stringify(ambiguous)).not.toContain('snippet');
  });

  it('fails loudly for invalid snapshots and missing identities', () => {
    expect(() =>
      createInspectionWorkspace({
        ...inspectionFixture(),
        entities: [],
      }),
    ).toThrow(/invalid canonical snapshot/u);

    const workspace = createInspectionWorkspace(inspectionFixture());
    expect(() => workspace.requireEntity('missing')).toThrow(
      /missing entity "missing"/u,
    );
    expect(() => workspace.requireReference('missing')).toThrow(
      /missing reference "missing"/u,
    );
  });
});
