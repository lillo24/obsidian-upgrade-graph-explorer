import { describe, expect, it } from 'vitest';

import representativeSnapshot from '../../../../tests/fixtures/model/representative.snapshot.json';

import type { AddressableEntity } from './entities';
import type { Reference } from './references';
import type { KnowledgeSnapshot } from './snapshot';
import type { SourceLocation, SourceSpan } from './source';
import {
  type SnapshotValidationIssueCode,
  validateKnowledgeSnapshot,
} from './validation';

function span(
  startLine = 1,
  startColumn = 1,
  endLine = 2,
  endColumn = 1,
): SourceSpan {
  return {
    start: { line: startLine, column: startColumn },
    end: { line: endLine, column: endColumn },
  };
}

function source(path = 'A.md', sourceSpan = span()): SourceLocation {
  return { path, span: sourceSpan };
}

function snapshot(
  entities: readonly AddressableEntity[] = [
    { id: 'document-a', kind: 'document', source: source() },
  ],
  references: readonly Reference[] = [],
): KnowledgeSnapshot {
  return {
    schemaVersion: 1,
    workspace: { id: 'workspace' },
    entities,
    references,
  };
}

function expectIssue(value: unknown, code: SnapshotValidationIssueCode): void {
  const result = validateKnowledgeSnapshot(value);
  expect(result.valid).toBe(false);
  if (!result.valid) {
    expect(result.issues.map((issue) => issue.code)).toContain(code);
  }
}

describe('validateKnowledgeSnapshot', () => {
  it('accepts the representative fixture and every explicit resolution state', () => {
    const result = validateKnowledgeSnapshot(representativeSnapshot);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(
        result.value.references.map((reference) => reference.resolution.status),
      ).toEqual([
        'resolved',
        'resolved',
        'unresolved',
        'ambiguous',
        'invalid',
        'resolved',
      ]);
      expect(result.value.references[0]?.sourceEntityId).toBe('document-a');
      expect(
        result.value.entities.filter(
          (entity) => entity.kind === 'section' && entity.title === 'Details',
        ),
      ).toHaveLength(2);
      expect(
        result.value.entities.some((entity) => entity.kind === 'block'),
      ).toBe(true);
    }
  });

  it('accepts skipped heading levels and duplicate or empty titles', () => {
    const entities: AddressableEntity[] = [
      { id: 'document-a', kind: 'document', source: source() },
      {
        id: 'section-top',
        kind: 'section',
        parentId: 'document-a',
        title: '',
        level: 1,
        source: source(),
      },
      {
        id: 'section-detail-a',
        kind: 'section',
        parentId: 'section-top',
        title: 'Details',
        level: 3,
        source: source(),
      },
      {
        id: 'section-detail-b',
        kind: 'section',
        parentId: 'section-top',
        title: 'Details',
        level: 2,
        source: source(),
      },
    ];

    expect(validateKnowledgeSnapshot(snapshot(entities)).valid).toBe(true);
  });

  it.each([
    ['missing parent', 'missing-parent', 'absent'],
    ['self parent', 'self-parent', 'section-child'],
  ] as const)('reports a %s', (_label, code, parentId) => {
    const entities: AddressableEntity[] = [
      { id: 'document-a', kind: 'document', source: source() },
      {
        id: 'section-child',
        kind: 'section',
        parentId,
        title: 'Child',
        level: 2,
        source: source(),
      },
    ];

    expectIssue(snapshot(entities), code);
  });

  it('reports every member of a hierarchy cycle', () => {
    const entities: AddressableEntity[] = [
      { id: 'document-a', kind: 'document', source: source() },
      {
        id: 'section-a',
        kind: 'section',
        parentId: 'section-b',
        title: 'A',
        level: 2,
        source: source(),
      },
      {
        id: 'section-b',
        kind: 'section',
        parentId: 'section-a',
        title: 'B',
        level: 3,
        source: source(),
      },
    ];
    const result = validateKnowledgeSnapshot(snapshot(entities));

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.issues.filter((issue) => issue.code === 'hierarchy-cycle'),
      ).toHaveLength(2);
    }
  });

  it('rejects a block parent and a descendant from another source path', () => {
    const entities: AddressableEntity[] = [
      { id: 'document-a', kind: 'document', source: source() },
      {
        id: 'block-a',
        kind: 'block',
        parentId: 'document-a',
        source: source(),
      },
      {
        id: 'section-child',
        kind: 'section',
        parentId: 'block-a',
        title: 'Child',
        level: 2,
        source: source('B.md'),
      },
    ];
    const result = validateKnowledgeSnapshot(snapshot(entities));

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining(['invalid-parent-kind', 'source-path-mismatch']),
      );
    }
  });

  it.each([0, 7])('rejects heading level %i', (level) => {
    expectIssue(
      snapshot([
        { id: 'document-a', kind: 'document', source: source() },
        {
          id: 'section-a',
          kind: 'section',
          parentId: 'document-a',
          title: 'A',
          level,
          source: source(),
        },
      ]),
      'invalid-heading-level',
    );
  });

  it('rejects a nested section whose heading level does not increase', () => {
    expectIssue(
      snapshot([
        { id: 'document-a', kind: 'document', source: source() },
        {
          id: 'section-a',
          kind: 'section',
          parentId: 'document-a',
          title: 'A',
          level: 2,
          source: source(),
        },
        {
          id: 'section-b',
          kind: 'section',
          parentId: 'section-a',
          title: 'B',
          level: 2,
          source: source(),
        },
      ]),
      'invalid-heading-parent-level',
    );
  });

  it('rejects duplicate and empty identities plus duplicate document paths', () => {
    const value = snapshot(
      [
        { id: 'document-a', kind: 'document', source: source() },
        { id: 'document-a', kind: 'document', source: source() },
        { id: '', kind: 'document', source: source('B.md') },
      ],
      [
        {
          id: 'reference-a',
          kind: 'link',
          sourceEntityId: 'document-a',
          rawTarget: 'A',
          sourceSpan: span(),
          resolution: { status: 'resolved', targetEntityId: 'document-a' },
        },
        {
          id: 'reference-a',
          kind: 'embed',
          sourceEntityId: 'document-a',
          rawTarget: 'A',
          sourceSpan: span(),
          resolution: { status: 'unresolved' },
        },
      ],
    );
    const result = validateKnowledgeSnapshot(value);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining([
          'duplicate-entity-id',
          'duplicate-reference-id',
          'duplicate-document-path',
          'invalid-id',
        ]),
      );
    }
  });

  it('rejects empty workspace and reference identities', () => {
    expectIssue({ ...snapshot(), workspace: { id: ' ' } }, 'invalid-id');
    expectIssue(
      {
        ...snapshot(),
        references: [
          {
            id: '',
            kind: 'link',
            sourceEntityId: 'document-a',
            rawTarget: 'A',
            sourceSpan: span(),
            resolution: { status: 'resolved', targetEntityId: 'document-a' },
          },
        ],
      },
      'invalid-id',
    );
  });

  it('rejects missing reference sources and resolution targets', () => {
    const references: Reference[] = [
      {
        id: 'reference-a',
        kind: 'link',
        sourceEntityId: 'absent-source',
        rawTarget: 'Missing',
        sourceSpan: span(),
        resolution: { status: 'resolved', targetEntityId: 'absent-target' },
      },
      {
        id: 'reference-b',
        kind: 'link',
        sourceEntityId: 'document-a',
        rawTarget: 'Maybe',
        sourceSpan: span(),
        resolution: {
          status: 'ambiguous',
          candidateEntityIds: ['document-a', 'absent-candidate'],
        },
      },
    ];
    const result = validateKnowledgeSnapshot(snapshot(undefined, references));

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.issues.filter(
          (issue) => issue.code === 'missing-resolution-target',
        ),
      ).toHaveLength(2);
      expect(result.issues.map((issue) => issue.code)).toContain(
        'missing-reference-source',
      );
    }
  });

  it('requires at least two distinct ambiguous candidates', () => {
    const oneCandidate = {
      ...snapshot(),
      references: [
        {
          id: 'reference-a',
          kind: 'link',
          sourceEntityId: 'document-a',
          rawTarget: 'A',
          sourceSpan: span(),
          resolution: {
            status: 'ambiguous',
            candidateEntityIds: ['document-a'],
          },
        },
      ],
    };
    const duplicateCandidates = {
      ...oneCandidate,
      references: [
        {
          ...oneCandidate.references[0],
          resolution: {
            status: 'ambiguous',
            candidateEntityIds: ['document-a', 'document-a'],
          },
        },
      ],
    };

    expectIssue(oneCandidate, 'invalid-ambiguous-candidates');
    expectIssue(duplicateCandidates, 'duplicate-ambiguous-candidate');
  });

  it.each([
    { status: 'resolved', targetEntityId: 'document-a', reason: 'extra' },
    { status: 'unresolved', targetEntityId: 'document-a' },
    {
      status: 'ambiguous',
      candidateEntityIds: ['document-a', 'document-b'],
      targetEntityId: 'document-a',
    },
    { status: 'invalid', reason: 'bad', targetEntityId: 'document-a' },
  ])('rejects contradictory resolution shape $status', (resolution) => {
    expectIssue(
      {
        ...snapshot(),
        references: [
          {
            id: 'reference-a',
            kind: 'link',
            sourceEntityId: 'document-a',
            rawTarget: 'A',
            sourceSpan: span(),
            resolution,
          },
        ],
      },
      'unexpected-field',
    );
  });

  it('requires invalid resolutions to explain the failure', () => {
    expectIssue(
      {
        ...snapshot(),
        references: [
          {
            id: 'reference-a',
            kind: 'link',
            sourceEntityId: 'document-a',
            rawTarget: '',
            sourceSpan: span(),
            resolution: { status: 'invalid' },
          },
        ],
      },
      'missing-field',
    );
  });

  it.each([
    '/A.md',
    'C:/Users/example/A.md',
    'folder\\A.md',
    'folder/../A.md',
    'folder/./A.md',
    'folder//A.md',
  ])('rejects non-canonical workspace path %s', (path) => {
    expectIssue(
      snapshot([{ id: 'document-a', kind: 'document', source: source(path) }]),
      'invalid-workspace-path',
    );
  });

  it.each([
    {
      start: { line: 0, column: 1 },
      end: { line: 1, column: 1 },
    },
    {
      start: { line: 1, column: 0 },
      end: { line: 1, column: 1 },
    },
    {
      start: { line: 2, column: 1 },
      end: { line: 1, column: 1 },
    },
    {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 2 },
    },
    {
      start: { line: 1, column: 1, offset: 2 },
      end: { line: 1, column: 2, offset: 1 },
    },
    {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 1, offset: 1 },
    },
  ])('rejects invalid source span %#', (invalidSpan) => {
    expectIssue(
      snapshot([
        {
          id: 'document-a',
          kind: 'document',
          source: { path: 'A.md', span: invalidSpan },
        },
      ]),
      invalidSpan.start.line < 1 || invalidSpan.start.column < 1
        ? 'invalid-source-point'
        : 'invalid-source-span',
    );
  });

  it('accepts spans with omitted offsets and UTF-16-unit offsets', () => {
    const entities: AddressableEntity[] = [
      { id: 'document-a', kind: 'document', source: source() },
      {
        id: 'document-emoji',
        kind: 'document',
        source: source('emoji.md', {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 3, offset: 2 },
        }),
      },
    ];

    expect(validateKnowledgeSnapshot(snapshot(entities)).valid).toBe(true);
  });

  it('rejects unsupported versions and fields outside canonical shapes', () => {
    expectIssue(
      { ...snapshot(), schemaVersion: 2 },
      'unsupported-schema-version',
    );
    expectIssue({ ...snapshot(), generatedAt: 'volatile' }, 'unexpected-field');
  });
});
