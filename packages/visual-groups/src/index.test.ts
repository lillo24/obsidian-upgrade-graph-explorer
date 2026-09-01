import type { AddressableEntity } from '@icarus-graph-explorer/core';
import {
  matchesGraphQuery,
  parseGraphQuery,
} from '@icarus-graph-explorer/graph-query';
import { describe, expect, it } from 'vitest';

import {
  assignPrimaryVisualGroupPresentations,
  compileVisualGroups,
  isVisualGroupColor,
  matchingVisualGroupsForEntity,
  MAX_VISUAL_GROUPS,
  resolvePrimaryVisualGroup,
  validateAndCanonicalizeVisualGroupDefinitions,
  VISUAL_GROUP_PALETTE,
  visualGroupPaletteEntry,
  type VisualGroupDefinition,
} from './index';

const source = (path: string) => ({
  path,
  span: {
    start: { line: 1, column: 1 },
    end: { line: 1, column: 2 },
  },
});

const document: AddressableEntity = {
  id: 'document',
  kind: 'document',
  source: source('Research/Release.md'),
};
const section: AddressableEntity = {
  id: 'section',
  kind: 'section',
  parentId: document.id,
  title: 'Draft Plan',
  level: 2,
  source: source('Research/Release.md'),
};
const block: AddressableEntity = {
  id: 'block',
  kind: 'block',
  parentId: section.id,
  source: source('Research/Release.md'),
};

function compiled(definitions: readonly VisualGroupDefinition[]) {
  const result = compileVisualGroups(definitions);
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw new Error(result.issues[0]?.message);
  return result.value;
}

describe('Visual Group definition contract', () => {
  it('canonicalizes names and QUERY1 text while retaining priority order', () => {
    expect(
      validateAndCanonicalizeVisualGroupDefinitions([
        {
          name: '  Research  ',
          query: 'documents or path:Research',
          color: 'teal',
          enabled: true,
        },
      ]),
    ).toEqual({
      valid: true,
      value: [
        {
          name: 'Research',
          query: 'kind:document OR path:"Research"',
          color: 'teal',
          enabled: true,
        },
      ],
      issues: [],
    });
  });

  it.each([
    [
      {
        name: 'Bad',
        query: 'sections documents',
        color: 'teal',
        enabled: true,
      },
      'invalid-query',
    ],
    [
      { name: 'Bad', query: 'documents', color: 'chartreuse', enabled: true },
      'invalid-color',
    ],
    [
      { name: 'Bad', query: 'documents', color: 'blue', enabled: 'yes' },
      'invalid-enabled',
    ],
    [
      { name: ' ', query: 'documents', color: 'blue', enabled: true },
      'invalid-name',
    ],
  ])('rejects malformed definition %j with %s', (definition, code) => {
    const result = validateAndCanonicalizeVisualGroupDefinitions([definition]);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe(code);
  });

  it('rejects duplicate names, extra fields, and the bounded-count overflow', () => {
    expect(
      validateAndCanonicalizeVisualGroupDefinitions([
        { name: 'Alpha', query: 'documents', color: 'blue', enabled: true },
        { name: 'alpha', query: 'sections', color: 'teal', enabled: true },
      ]),
    ).toMatchObject({ valid: false, issues: [{ code: 'duplicate-name' }] });
    expect(
      validateAndCanonicalizeVisualGroupDefinitions([
        {
          name: 'Alpha',
          query: 'documents',
          color: 'blue',
          enabled: true,
          extra: true,
        },
      ]),
    ).toMatchObject({
      valid: false,
      issues: [{ code: 'incompatible-fields' }],
    });
    expect(
      validateAndCanonicalizeVisualGroupDefinitions(
        Array.from({ length: MAX_VISUAL_GROUPS + 1 }, (_, index) => ({
          name: `Group ${index}`,
          query: 'documents',
          color: 'blue',
          enabled: true,
        })),
      ),
    ).toMatchObject({ valid: false, issues: [{ code: 'too-many-groups' }] });
  });

  it('exports a stable named palette without accepting arbitrary CSS', () => {
    expect(VISUAL_GROUP_PALETTE.map(({ token }) => token)).toEqual([
      'teal',
      'blue',
      'violet',
      'magenta',
      'red',
      'orange',
      'amber',
      'green',
    ]);
    expect(isVisualGroupColor('violet')).toBe(true);
    expect(isVisualGroupColor('#fff')).toBe(false);
    expect(visualGroupPaletteEntry('violet')).toMatchObject({
      token: 'violet',
      accent: '#7c3aed',
    });
  });
});

describe('compiled Visual Group matching', () => {
  const definitions: readonly VisualGroupDefinition[] = [
    {
      name: 'Research',
      query: 'path:"Research"',
      color: 'teal',
      enabled: true,
    },
    {
      name: 'Drafts',
      query: 'title:"Draft"',
      color: 'amber',
      enabled: true,
    },
    {
      name: 'Disabled',
      query: 'kind:document',
      color: 'red',
      enabled: false,
    },
  ];

  it('compiles canonical rules once and excludes disabled rules from evaluation', () => {
    const groups = compiled(definitions);
    expect(groups.definitions).toEqual(definitions);
    expect(groups.activeGroupCount).toBe(2);
    expect(resolvePrimaryVisualGroup(document, groups)?.definition.name).toBe(
      'Research',
    );
  });

  it('uses first-enabled-match priority and reverses deterministically', () => {
    const first = compiled(definitions);
    expect(resolvePrimaryVisualGroup(section, first)?.definition.name).toBe(
      'Research',
    );
    const reversed = compiled([definitions[1]!, definitions[0]!]);
    expect(resolvePrimaryVisualGroup(section, reversed)?.definition.name).toBe(
      'Drafts',
    );
  });

  it('returns all enabled matches in priority order', () => {
    expect(
      matchingVisualGroupsForEntity(section, compiled(definitions)).map(
        ({ definition }) => definition.name,
      ),
    ).toEqual(['Research', 'Drafts']);
  });

  it.each([document, section, block])(
    'reuses QUERY1 semantics for $kind entities',
    (entity) => {
      const query =
        entity.kind === 'document'
          ? 'kind:document AND path:"Research"'
          : entity.kind === 'section'
            ? 'kind:section AND level<=2 AND title:"Draft"'
            : 'kind:block AND path:"Release"';
      const parsed = parseGraphQuery(query);
      if (!parsed.valid) throw new Error(parsed.issues[0]?.message);
      const groups = compiled([
        {
          name: 'Match',
          query: parsed.canonical,
          color: 'green',
          enabled: true,
        },
      ]);
      expect(resolvePrimaryVisualGroup(entity, groups) !== undefined).toBe(
        matchesGraphQuery(entity, parsed.expression),
      );
    },
  );

  it('assigns only primary matches by canonical EntityId and rejects duplicates', () => {
    const presentations = assignPrimaryVisualGroupPresentations(
      [document, section, block],
      compiled(definitions),
    );
    expect([...presentations.keys()]).toEqual(['document', 'section', 'block']);
    expect(presentations.get('section')).toEqual({
      groupName: 'Research',
      color: 'teal',
      accent: '#0f766e',
    });
    expect(() =>
      assignPrimaryVisualGroupPresentations(
        [document, document],
        compiled(definitions),
      ),
    ).toThrow('duplicate entity ID');
    const unmatched: AddressableEntity = {
      id: 'unmatched',
      kind: 'block',
      parentId: 'other-section',
      source: source('Other/Notes.md'),
    };
    expect(() =>
      assignPrimaryVisualGroupPresentations(
        [unmatched, unmatched],
        compiled(definitions),
      ),
    ).toThrow('duplicate entity ID');
  });
});
