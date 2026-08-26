import { readFileSync } from 'node:fs';

import {
  parseObsidianDocument,
  type ParsedObsidianDocument,
} from '@icarus-graph-explorer/adapter-obsidian';
import { resolveObsidianWorkspace } from '@icarus-graph-explorer/resolver-obsidian';
import { describe, expect, it } from 'vitest';

import {
  buildObsidianDiagnosticReport,
  createDiagnosticLookups,
  generateSyntheticWorkspace,
  summarizeDiagnosticReport,
  validateObsidianDiagnosticReport,
} from './index';

const SAMPLE_MARKDOWN = [
  'Case Target.md',
  'Source.md',
  'Target.md',
  'folder-a/Note.md',
  'folder-b/Note.md',
] as const;

const SAMPLE_RESOURCES = [
  'assets/image.png',
  'one/logo.png',
  'two/logo.png',
] as const;

function sampleDocuments(): readonly ParsedObsidianDocument[] {
  return SAMPLE_MARKDOWN.map((path) =>
    parseObsidianDocument({
      path,
      source: readFileSync(
        new URL(
          `../../../tests/fixtures/workspaces/diagnostic-sample/input/${path}`,
          import.meta.url,
        ),
        'utf8',
      ),
    }),
  );
}

function sampleReport() {
  const documents = sampleDocuments();
  const resolved = resolveObsidianWorkspace({
    workspaceId: 'diagnostic-sample',
    documents,
  });
  if (!resolved.ok) {
    throw new Error(JSON.stringify(resolved.diagnostics));
  }
  return buildObsidianDiagnosticReport({
    snapshot: resolved.snapshot,
    diagnostics: resolved.diagnostics,
    documents,
    nonMarkdownPaths: SAMPLE_RESOURCES,
  });
}

describe('Obsidian diagnostic reports', () => {
  it('builds a deterministic runtime-valid JSON report without source text', () => {
    const first = sampleReport();
    const second = sampleReport();
    const serialized = JSON.stringify(first);
    const validation = validateObsidianDiagnosticReport(JSON.parse(serialized));

    expect(first).toEqual(second);
    expect(validation.valid).toBe(true);
    expect(serialized).not.toContain('Synthetic target.');
    expect(first.sourceInventory).toEqual({
      markdownFileCount: 5,
      nonMarkdownFileCount: 3,
    });
  });

  it('keeps compatibility clues separate from canonical resolution truth', () => {
    const report = sampleReport();
    const codes = report.probes.map(({ code }) => code);

    expect(codes).toEqual(
      expect.arrayContaining([
        'case-only-file-match',
        'case-only-heading-match',
        'attachment-present-unmodeled',
        'attachment-not-found',
        'attachment-match-ambiguous',
      ]),
    );
    for (const probe of report.probes) {
      const reference = report.snapshot.references.find(
        ({ id }) => id === probe.referenceId,
      );
      expect(reference?.resolution.status).toBe('unresolved');
    }
  });

  it('derives stable counts and readable hierarchy/candidate labels', () => {
    const report = sampleReport();
    const summary = summarizeDiagnosticReport(report);
    const lookups = createDiagnosticLookups(report.snapshot);
    const nested = report.snapshot.entities.find(
      (entity) => entity.kind === 'section' && entity.title === 'Nested',
    );

    expect(summary).toMatchObject({
      documents: 5,
      blocks: 3,
      references: 8,
      resolved: 1,
      unresolved: 6,
      ambiguous: 1,
    });
    expect(
      nested === undefined ? undefined : lookups.labelByEntityId.get(nested.id),
    ).toContain('Overview / Nested');
    expect(
      [...lookups.labelByEntityId.values()].some((label) =>
        label.includes('Block: Source.md / marker at line'),
      ),
    ).toBe(true);
  });

  it('rejects malformed or contradictory report envelopes', () => {
    const report = sampleReport();
    const invalid = {
      ...report,
      schemaVersion: 2,
      sourceInventory: { ...report.sourceInventory, markdownFileCount: 999 },
      probes: [
        {
          code: 'made-up-probe',
          referenceId: 'missing-reference',
          message: '',
          candidatePaths: ['../outside-vault.png'],
        },
      ],
      diagnostics: report.diagnostics.map((diagnostic, index) =>
        index === 0
          ? { ...diagnostic, sourcePath: 'C:/private/source.md' }
          : diagnostic,
      ),
    };
    const result = validateObsidianDiagnosticReport(invalid);

    expect(result.valid).toBe(false);
    expect(result.valid ? [] : result.issues.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        '$.schemaVersion',
        '$.sourceInventory.markdownFileCount',
        '$.probes[0].code',
        '$.probes[0].referenceId',
        '$.probes[0].message',
        '$.probes[0].candidatePaths[0]',
        '$.diagnostics[0].sourcePath',
      ]),
    );
  });

  it('generates configurable deterministic workspaces for pipeline smoke runs', () => {
    const config = {
      documentCount: 4,
      sectionsPerDocument: 3,
      nestedDepth: 2,
      resolvedReferencesPerSection: 1,
      unresolvedReferencesPerSection: 1,
      ambiguousReferencesPerSection: 1,
    } as const;
    const sources = generateSyntheticWorkspace(config);
    const documents = sources.map(parseObsidianDocument);
    const resolved = resolveObsidianWorkspace({
      workspaceId: 'synthetic-benchmark',
      documents,
    });

    expect(sources).toEqual(generateSyntheticWorkspace(config));
    expect(sources).toHaveLength(4);
    expect(resolved.ok).toBe(true);
    expect(resolved.ok ? resolved.snapshot.references : []).toHaveLength(36);
  });
});
