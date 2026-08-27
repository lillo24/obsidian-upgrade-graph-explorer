import { describe, expect, it } from 'vitest';

import { searchEntities } from './search';
import { inspectionFixture } from './test-fixture';
import { createInspectionWorkspace } from './workspace';

describe('canonical entity search', () => {
  const workspace = createInspectionWorkspace(inspectionFixture());

  it('ranks exact names, prefixes, breadcrumb components, and substrings deterministically', () => {
    const exact = searchEntities(workspace, 'Alpha');
    const prefix = searchEntities(workspace, 'nest');
    const breadcrumb = searchEntities(workspace, 'overview');
    const substring = searchEntities(workspace, 'view');

    expect(exact[0]).toMatchObject({
      entity: { entityId: 'doc-alpha' },
      match: 'exact-name',
    });
    expect(prefix[0]).toMatchObject({
      entity: { entityId: 'alpha-nested' },
      match: 'name-prefix',
    });
    expect(
      breadcrumb.find(({ entity }) => entity.entityId === 'alpha-nested')
        ?.match,
    ).toBe('exact-breadcrumb');
    expect(substring.map(({ entity }) => entity.entityId)).toEqual([
      'alpha-overview',
      'alpha-duplicate',
      'alpha-nested',
      'alpha-block',
    ]);
  });

  it('searches paths and block path/line labels across hidden canonical entities', () => {
    expect(
      searchEntities(workspace, 'beta/').map(({ entity }) => entity.entityId),
    ).toEqual(['doc-beta', 'beta-target', 'beta-deep']);
    expect(searchEntities(workspace, 'block at line 8')[0]).toMatchObject({
      entity: { entityId: 'alpha-block', kind: 'block' },
      match: 'exact-name',
    });
  });

  it('uses source order for duplicate titles and enforces result bounds', () => {
    expect(
      searchEntities(workspace, 'overview').map(
        ({ entity }) => entity.entityId,
      ),
    ).toEqual([
      'alpha-overview',
      'alpha-duplicate',
      'alpha-nested',
      'alpha-block',
    ]);
    expect(searchEntities(workspace, 'target', { limit: 2 })).toHaveLength(2);
    expect(searchEntities(workspace, '')).toEqual([]);
    expect(() => searchEntities(workspace, 'target', { limit: 0 })).toThrow(
      /positive integer/u,
    );
  });
});
