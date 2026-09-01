import type { AddressableEntity } from '@icarus-graph-explorer/core';
import { compileVisualGroups } from '@icarus-graph-explorer/visual-groups';
import type { ViewProjection } from '@icarus-graph-explorer/view-projection';
import { describe, expect, it, vi } from 'vitest';

import {
  deriveProjectionVisualGroupPresentationMap,
  deriveVisualGroupPresentationMap,
  visualGroupEntityIdsForProjection,
} from './presentation';

const source = (path: string) => ({
  path,
  span: {
    start: { line: 1, column: 1 },
    end: { line: 1, column: 2 },
  },
});

const entities: readonly AddressableEntity[] = [
  {
    id: 'document-a',
    kind: 'document',
    source: source('Research/A.md'),
  },
  { id: 'document-b', kind: 'document', source: source('Other/B.md') },
  {
    id: 'section-a',
    kind: 'section',
    parentId: 'document-a',
    title: 'Draft',
    level: 1,
    source: source('Research/A.md'),
  },
];

const projection: Pick<ViewProjection, 'nodes'> = {
  nodes: [
    {
      id: 'projection-document-a',
      kind: 'entity',
      entityId: 'document-a',
      entityKind: 'document',
      sourcePath: 'Research/A.md',
      sourceStartLine: 1,
      title: null,
      revealableDescendantCount: 0,
      internalReferenceIds: [],
      role: 'content',
      focusDistance: null,
    },
    {
      id: 'projection-section-a',
      kind: 'entity',
      entityId: 'section-a',
      entityKind: 'section',
      sourcePath: 'Research/A.md',
      sourceStartLine: 3,
      title: 'Draft',
      revealableDescendantCount: 0,
      internalReferenceIds: [],
      role: 'content',
      focusDistance: null,
    },
    {
      id: 'diagnostic',
      kind: 'reference-target',
      status: 'unresolved',
      rawTarget: 'Missing',
      referenceIds: ['reference'],
      candidateEntityIds: [],
      reasons: [],
    },
  ],
};

function compiledGroups() {
  const result = compileVisualGroups([
    {
      name: 'Research',
      query: 'path:"Research"',
      color: 'violet',
      enabled: true,
    },
    {
      name: 'Draft',
      query: 'title:"Draft"',
      color: 'amber',
      enabled: true,
    },
  ]);
  if (!result.ok) throw new Error(result.issues[0]?.message);
  return result.value;
}

describe('app Visual Group presentation derivation', () => {
  it('collects canonical entity IDs and omits diagnostic nodes', () => {
    expect(visualGroupEntityIdsForProjection(projection)).toEqual([
      'document-a',
      'section-a',
    ]);
  });

  it('evaluates only requested entity IDs and keys primary matches canonically', () => {
    const backing = new Map(entities.map((entity) => [entity.id, entity]));
    const get = vi.fn((id: string) => backing.get(id));
    const lookup: ReadonlyMap<string, AddressableEntity> = {
      entries: () => backing.entries(),
      forEach: backing.forEach.bind(backing),
      get,
      has: backing.has.bind(backing),
      keys: () => backing.keys(),
      size: backing.size,
      values: () => backing.values(),
      [Symbol.iterator]: () => backing[Symbol.iterator](),
    };

    const styles = deriveProjectionVisualGroupPresentationMap(
      projection,
      lookup,
      compiledGroups(),
    );

    expect(get.mock.calls.map(([id]) => id)).toEqual([
      'document-a',
      'section-a',
    ]);
    expect(styles.get('document-a')).toEqual({
      groupName: 'Research',
      color: 'violet',
      accent: '#7c3aed',
    });
    expect(styles.get('section-a')?.groupName).toBe('Research');
    expect(styles.has('document-b')).toBe(false);
    expect(styles.has('diagnostic')).toBe(false);
  });

  it('is renderer-mode independent and fails loudly for a missing canonical ID', () => {
    const lookup = new Map(entities.map((entity) => [entity.id, entity]));
    const groups = compiledGroups();
    const modes = ['structure', 'global', 'local-free', 'local-structured'];
    const results = modes.map(() =>
      deriveVisualGroupPresentationMap(['section-a'], lookup, groups).get(
        'section-a',
      ),
    );
    expect(results.every((result) => result === results[0])).toBe(true);
    expect(() =>
      deriveVisualGroupPresentationMap(['missing'], lookup, groups),
    ).toThrow('missing canonical entity');
  });
});
