import { readFileSync } from 'node:fs';

import {
  parseObsidianDocument,
  type ParsedObsidianDocument,
} from '@icarus-graph-explorer/adapter-obsidian';
import {
  validateKnowledgeSnapshot,
  type AddressableEntity,
  type BlockEntity,
  type DocumentEntity,
  type KnowledgeSnapshot,
  type Reference,
  type SectionEntity,
} from '@icarus-graph-explorer/core';
import { describe, expect, it } from 'vitest';

import {
  resolveObsidianWorkspace,
  type SnapshotIdProvider,
  type WorkspaceResolutionResult,
} from './index';

const fixtureFiles = {
  basic: ['A.md', 'B.md'],
  ambiguous: ['Source.md', 'Target.md', 'folder-a/Note.md', 'folder-b/Note.md'],
  headings: ['Source.md', 'Target.md'],
  blocks: ['Source.md', 'Target.md'],
  paths: [
    'Target.md',
    'folder space/Target Note.md',
    'folder-b/Note.md',
    'nested/Source.md',
  ],
  attachments: ['Source.md'],
} as const;

type FixtureName = keyof typeof fixtureFiles;

function fixtureDirectory(name: FixtureName): string {
  const suffix: Record<FixtureName, string> = {
    basic: 'resolution-basic',
    ambiguous: 'resolution-ambiguous-files',
    headings: 'resolution-headings',
    blocks: 'resolution-blocks',
    paths: 'resolution-paths',
    attachments: 'resolution-attachments',
  };
  return suffix[name];
}

function parsedFixture(name: FixtureName): readonly ParsedObsidianDocument[] {
  return fixtureFiles[name].map((path) => {
    const source = readFileSync(
      new URL(
        `../../../tests/fixtures/workspaces/${fixtureDirectory(name)}/input/${path}`,
        import.meta.url,
      ),
      'utf8',
    );
    return parseObsidianDocument({ path, source });
  });
}

function success(result: WorkspaceResolutionResult): KnowledgeSnapshot {
  if (!result.ok) {
    throw new Error(
      `Expected successful resolution: ${JSON.stringify(result.diagnostics)}`,
    );
  }
  return result.snapshot;
}

function documentEntity(
  snapshot: KnowledgeSnapshot,
  path: string,
): DocumentEntity {
  const entity = snapshot.entities.find(
    (candidate): candidate is DocumentEntity =>
      candidate.kind === 'document' && candidate.source.path === path,
  );
  if (entity === undefined) {
    throw new Error(`Expected document entity for ${path}.`);
  }
  return entity;
}

function sectionEntities(
  snapshot: KnowledgeSnapshot,
  path: string,
  title: string,
): readonly SectionEntity[] {
  return snapshot.entities.filter(
    (entity): entity is SectionEntity =>
      entity.kind === 'section' &&
      entity.source.path === path &&
      entity.title === title,
  );
}

function reference(snapshot: KnowledgeSnapshot, index: number): Reference {
  const value = snapshot.references[index];
  if (value === undefined) {
    throw new Error(`Expected reference at index ${index}.`);
  }
  return value;
}

function entityById(
  snapshot: KnowledgeSnapshot,
  id: string,
): AddressableEntity {
  const entity = snapshot.entities.find((candidate) => candidate.id === id);
  if (entity === undefined) {
    throw new Error(`Expected entity ${id}.`);
  }
  return entity;
}

function resolveFixture(
  name: FixtureName,
  documents: readonly ParsedObsidianDocument[] = parsedFixture(name),
): WorkspaceResolutionResult {
  return resolveObsidianWorkspace({
    workspaceId: 'synthetic-workspace',
    documents,
  });
}

describe('resolveObsidianWorkspace', () => {
  it('assembles documents/sections and preserves every file-link occurrence', () => {
    const snapshot = success(resolveFixture('basic'));
    const target = documentEntity(snapshot, 'B.md');

    expect(
      snapshot.entities.filter(({ kind }) => kind === 'document'),
    ).toHaveLength(2);
    expect(
      snapshot.entities.filter(({ kind }) => kind === 'section'),
    ).toHaveLength(3);
    expect(snapshot.references).toHaveLength(5);
    expect(snapshot.references.map(({ resolution }) => resolution)).toEqual(
      Array.from({ length: 5 }, () => ({
        status: 'resolved',
        targetEntityId: target.id,
      })),
    );
    expect(new Set(snapshot.references.map(({ id }) => id)).size).toBe(5);
  });

  it('assigns preamble, section-body, nested-heading, and nested-body owners', () => {
    const snapshot = success(resolveFixture('basic'));
    const sourceDocument = documentEntity(snapshot, 'A.md');
    const root = sectionEntities(snapshot, 'A.md', 'Root')[0];
    const nested = sectionEntities(snapshot, 'A.md', 'Nested [[B]]')[0];

    expect(root).toBeDefined();
    expect(nested).toBeDefined();
    expect(
      snapshot.references.map(({ sourceEntityId }) => sourceEntityId),
    ).toEqual([
      sourceDocument.id,
      sourceDocument.id,
      root?.id,
      nested?.id,
      nested?.id,
    ]);
    expect(nested?.parentId).toBe(root?.id);
  });

  it('exposes duplicate basenames while path and heading evidence narrow safely', () => {
    const snapshot = success(resolveFixture('ambiguous'));
    const folderA = documentEntity(snapshot, 'folder-a/Note.md');
    const target = documentEntity(snapshot, 'Target.md');
    const alpha = sectionEntities(snapshot, 'folder-a/Note.md', 'Alpha')[0];

    const bareNoteResolution = reference(snapshot, 0).resolution;
    expect(bareNoteResolution).toMatchObject({
      status: 'ambiguous',
    });
    expect(
      bareNoteResolution.status === 'ambiguous'
        ? bareNoteResolution.candidateEntityIds.map(
            (id) => entityById(snapshot, id).source.path,
          )
        : [],
    ).toEqual(['folder-a/Note.md', 'folder-b/Note.md']);
    expect(reference(snapshot, 1).resolution).toEqual({
      status: 'resolved',
      targetEntityId: folderA.id,
    });
    expect(reference(snapshot, 2).resolution).toEqual({
      status: 'resolved',
      targetEntityId: folderA.id,
    });
    expect(reference(snapshot, 3).resolution).toEqual({
      status: 'resolved',
      targetEntityId: alpha?.id,
    });
    expect(reference(snapshot, 4).resolution.status).toBe('unresolved');
    expect(reference(snapshot, 5).resolution).toEqual({
      status: 'resolved',
      targetEntityId: target.id,
    });
    expect(reference(snapshot, 6).resolution.status).toBe('unresolved');
  });

  it('resolves same/cross-file headings and exact structural heading paths', () => {
    const snapshot = success(resolveFixture('headings'));
    const local = sectionEntities(snapshot, 'Source.md', 'Local')[0];
    const details = sectionEntities(snapshot, 'Target.md', 'Details');
    const parentB = sectionEntities(snapshot, 'Target.md', 'Parent B')[0];
    const parentBDetails = details.find(
      (section) => section.parentId === parentB?.id,
    );

    expect(reference(snapshot, 0).resolution).toEqual({
      status: 'resolved',
      targetEntityId: local?.id,
    });
    expect(reference(snapshot, 1).resolution).toMatchObject({
      status: 'ambiguous',
      candidateEntityIds: expect.arrayContaining(details.map(({ id }) => id)),
    });
    expect(reference(snapshot, 2).resolution).toEqual({
      status: 'resolved',
      targetEntityId: parentBDetails?.id,
    });
    expect(reference(snapshot, 3).resolution.status).toBe('unresolved');
  });

  it('creates marker-backed blocks and resolves unique, duplicate, and missing IDs', () => {
    const snapshot = success(resolveFixture('blocks'));
    const blocks = snapshot.entities.filter(
      (entity): entity is BlockEntity => entity.kind === 'block',
    );
    const targetSection = sectionEntities(snapshot, 'Target.md', 'Blocks')[0];
    const localBlock = blocks.find(({ source }) => source.path === 'Source.md');
    const uniqueBlock = blocks.find(
      ({ source }) =>
        source.path === 'Target.md' &&
        source.span.start.offset !== undefined &&
        source.span.start.offset < 40,
    );

    expect(blocks).toHaveLength(4);
    expect(reference(snapshot, 0).resolution).toEqual({
      status: 'resolved',
      targetEntityId: localBlock?.id,
    });
    expect(reference(snapshot, 1).resolution).toEqual({
      status: 'resolved',
      targetEntityId: uniqueBlock?.id,
    });
    expect(reference(snapshot, 2).resolution).toMatchObject({
      status: 'ambiguous',
    });
    expect(reference(snapshot, 3).resolution.status).toBe('unresolved');
    expect(
      blocks
        .filter(({ source }) => source.path === 'Target.md')
        .every(({ parentId }) => parentId === targetSection?.id),
    ).toBe(true);
    expect(
      blocks.every((block) => block.source.span.start.offset !== undefined),
    ).toBe(true);
  });

  it('handles relative paths, traversal, and Markdown percent decoding', () => {
    const result = resolveFixture('paths');
    const snapshot = success(result);
    const note = documentEntity(snapshot, 'folder-b/Note.md');
    const rootTarget = documentEntity(snapshot, 'Target.md');
    const spaceHeading = sectionEntities(
      snapshot,
      'folder space/Target Note.md',
      'Section One',
    )[0];

    expect(reference(snapshot, 0).resolution).toEqual({
      status: 'resolved',
      targetEntityId: note.id,
    });
    expect(reference(snapshot, 1).resolution).toMatchObject({
      status: 'invalid',
    });
    expect(reference(snapshot, 2).resolution).toEqual({
      status: 'resolved',
      targetEntityId: rootTarget.id,
    });
    expect(reference(snapshot, 3).resolution).toEqual({
      status: 'resolved',
      targetEntityId: note.id,
    });
    expect(reference(snapshot, 4).rawTarget).toBe(
      '../folder%20space/Target%20Note.md#Section%20One',
    );
    expect(reference(snapshot, 4).resolution).toEqual({
      status: 'resolved',
      targetEntityId: spaceHeading?.id,
    });
    expect(reference(snapshot, 5).resolution).toMatchObject({
      status: 'invalid',
    });
    expect(
      result.ok
        ? result.diagnostics.filter(({ code }) => code === 'invalid-target')
        : [],
    ).toHaveLength(2);
  });

  it('keeps non-Markdown embeds as unsupported unresolved references', () => {
    const result = resolveFixture('attachments');
    const snapshot = success(result);

    expect(reference(snapshot, 0)).toMatchObject({
      kind: 'embed',
      rawTarget: 'image.png',
      resolution: {
        status: 'unresolved',
        reason: 'Non-Markdown targets are not represented in schema v1.',
      },
    });
    expect(result.ok ? result.diagnostics[0]?.code : undefined).toBe(
      'unsupported-target',
    );
  });

  it('is deterministic, input-order independent, immutable, and JSON-valid', () => {
    const documents = parsedFixture('ambiguous');
    const before = JSON.stringify(documents);
    const first = success(resolveFixture('ambiguous', documents));
    const second = success(
      resolveFixture('ambiguous', [...documents].reverse()),
    );

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(documents)).toBe(before);
    expect(validateKnowledgeSnapshot(first).valid).toBe(true);
    expect(
      validateKnowledgeSnapshot(JSON.parse(JSON.stringify(first))).valid,
    ).toBe(true);
  });

  it('fails without a partial snapshot for duplicate paths or invalid spans', () => {
    const documents = parsedFixture('basic');
    const duplicate = resolveObsidianWorkspace({
      workspaceId: 'workspace',
      documents: [
        documents[0] as ParsedObsidianDocument,
        documents[0] as ParsedObsidianDocument,
      ],
    });
    expect(duplicate).toMatchObject({ ok: false });
    expect(duplicate.diagnostics.map(({ code }) => code)).toContain(
      'duplicate-document-path',
    );
    expect(duplicate).not.toHaveProperty('snapshot');

    const original = documents[0] as ParsedObsidianDocument;
    const invalid: ParsedObsidianDocument = {
      ...original,
      references: [
        {
          ...original.references[0]!,
          sourceSpan: {
            start: { line: 99, column: 1, offset: 999 },
            end: { line: 99, column: 2, offset: 1000 },
          },
        },
      ],
    };
    const invalidResult = resolveObsidianWorkspace({
      workspaceId: 'workspace',
      documents: [invalid],
    });
    expect(invalidResult).toMatchObject({ ok: false });
    expect(invalidResult.diagnostics.map(({ code }) => code)).toContain(
      'invalid-source-structure',
    );
  });

  it('fails explicitly for an empty workspace ID and generated ID collisions', () => {
    const documents = parsedFixture('basic');
    const empty = resolveObsidianWorkspace({ workspaceId: ' ', documents });
    expect(empty).toMatchObject({ ok: false });
    expect(empty.diagnostics[0]?.code).toBe('invalid-workspace-id');

    const colliding: SnapshotIdProvider = {
      documentId: () => 'same',
      sectionId: () => 'same',
      blockId: () => 'same',
      referenceId: () => 'same',
    };
    const collision = resolveObsidianWorkspace({
      workspaceId: 'workspace',
      documents,
      idProvider: colliding,
    });
    expect(collision).toMatchObject({ ok: false });
    expect(collision.diagnostics.map(({ code }) => code)).toContain(
      'id-collision',
    );
    expect(collision).not.toHaveProperty('snapshot');
  });

  it('forwards non-fatal adapter diagnostics beside a valid snapshot', () => {
    const document = parseObsidianDocument({
      path: 'Warning.md',
      source: '---\naliases: [broken\n---\n# Valid\n[[Missing]]',
    });
    const result = resolveObsidianWorkspace({
      workspaceId: 'workspace',
      documents: [document],
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'adapter-diagnostic',
          relatedCode: 'malformed-frontmatter',
          fatal: false,
        }),
        expect.objectContaining({ code: 'unresolved-target', fatal: false }),
      ]),
    );
  });
});
