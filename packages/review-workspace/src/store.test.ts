import { describe, expect, it } from 'vitest';

import {
  DEFAULT_COMPILER_POLICY,
  DEFAULT_REVIEW_LIMITS,
  DEFAULT_REVIEW_TEMPLATES,
} from '@icarus-graph-explorer/ai-review';

import { MemoryReviewHistoryStore } from './memory-store';
import type { ReviewHistoryEntry, ReviewPreparationRecord } from './types';
import {
  parseReviewHistoryEntryJson,
  serializeReviewHistoryEntry,
} from './validation';

function preparation(
  id = 'preparation-1',
  revision = 1,
): ReviewPreparationRecord {
  return {
    schemaVersion: 1,
    id,
    revision,
    createdAt: '2026-09-13T08:00:00.000Z',
    updatedAt: `2026-09-13T08:00:0${revision}.000Z`,
    title: 'Synthetic prepared review',
    workspace: { id: 'synthetic-workspace', label: 'Synthetic Vault' },
    source: {
      mode: 'supplied-material',
      selectedPaths: ['notes/example.md'],
      materials: [
        {
          id: 'source-1',
          relativePath: 'notes/example.md',
          kind: 'source',
          content: '# Synthetic material',
          provenance: { kind: 'supplied', label: 'test fixture' },
        },
      ],
      completeness: 'complete',
      missingMaterial: [],
      omissions: [],
    },
    additionalRequest: '',
    templates: DEFAULT_REVIEW_TEMPLATES,
    limits: DEFAULT_REVIEW_LIMITS,
    compilerPolicy: DEFAULT_COMPILER_POLICY,
    origin: {
      kind: 'duplicated-run',
      capturedAt: '2026-09-13T08:00:00.000Z',
    },
  };
}

function entry(record = preparation()): ReviewHistoryEntry {
  return { schemaVersion: 1, kind: 'preparation', preparation: record };
}

describe('review workspace history', () => {
  it('saves model-optional preparations with explicit revisions and conflicts', async () => {
    const store = new MemoryReviewHistoryStore();
    const first = await store.save(entry(), 'missing');
    expect(first.status).toBe('saved');
    if (first.status !== 'saved') return;
    const revised = preparation('preparation-1', 2);
    expect(await store.save(entry(revised), first.descriptor)).toMatchObject({
      status: 'saved',
      summary: { state: 'prepared', workspaceId: 'synthetic-workspace' },
    });
    expect(await store.save(entry(), first.descriptor)).toMatchObject({
      status: 'conflict',
    });
  });

  it('deep-validates bounded preparation imports without fake model settings', () => {
    const source = serializeReviewHistoryEntry(entry());
    expect(parseReviewHistoryEntryJson(source)).toEqual(entry());
    const malformed = JSON.parse(source) as {
      preparation: ReviewPreparationRecord;
    };
    malformed.preparation = {
      ...malformed.preparation,
      source: {
        ...malformed.preparation.source,
        selectedPaths: ['C:\\private\\secret.md'],
      },
    };
    expect(() =>
      parseReviewHistoryEntryJson(JSON.stringify(malformed)),
    ).toThrow(/relative and contained/);
  });
});
