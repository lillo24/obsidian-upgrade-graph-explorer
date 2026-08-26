import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { validateObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import { describe, expect, it } from 'vitest';

import { parseDiagnosticCliArguments } from './arguments';
import { discoverVault } from './discovery';
import { writePrivateReport } from './output';
import { buildReportFromSources, runVaultDiagnostics } from './pipeline';

async function temporaryVault(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'icarus-vault-diagnostics-'));
}

describe('vault diagnostic runner', () => {
  it('discovers UTF-8 Markdown recursively while ignoring runtime data, excludes, and symlinks', async () => {
    const vault = await temporaryVault();
    const outside = await temporaryVault();
    await Promise.all([
      mkdir(join(vault, 'notes'), { recursive: true }),
      mkdir(join(vault, '.obsidian'), { recursive: true }),
      mkdir(join(vault, 'node_modules'), { recursive: true }),
      mkdir(join(vault, 'excluded'), { recursive: true }),
      writeFile(join(outside, 'Escape.md'), '# Outside', 'utf8'),
    ]);
    await Promise.all([
      writeFile(join(vault, 'Root.md'), '# Root', 'utf8'),
      writeFile(join(vault, 'notes', 'Nested.md'), '# Nested', 'utf8'),
      writeFile(join(vault, 'notes', 'image.png'), 'resource', 'utf8'),
      writeFile(join(vault, '.obsidian', 'Plugin.md'), '# Hidden', 'utf8'),
      writeFile(
        join(vault, 'node_modules', 'Dependency.md'),
        '# Hidden',
        'utf8',
      ),
      writeFile(join(vault, 'excluded', 'Skip.md'), '# Excluded', 'utf8'),
      symlink(outside, join(vault, 'linked-outside'), 'junction'),
    ]);

    const result = await discoverVault(vault, ['excluded']);

    expect(result.markdownDocuments.map(({ path }) => path)).toEqual([
      'Root.md',
      'notes/Nested.md',
    ]);
    expect(result.nonMarkdownPaths).toEqual(['notes/image.png']);
  });

  it('runs the complete pipeline and writes only the validated report envelope', async () => {
    const vault = await temporaryVault();
    const output = join(vault, 'private-output', 'report.json');
    await writeFile(
      join(vault, 'A.md'),
      '# Heading\n\nPRIVATE BODY TOKEN\n[[B]]',
      'utf8',
    );
    await writeFile(join(vault, 'B.md'), '# Target', 'utf8');

    const run = await runVaultDiagnostics({
      vaultPath: vault,
      workspaceId: 'temporary-vault',
      excludes: [],
    });
    await writePrivateReport(output, run.serializedReport);
    const stored = await readFile(output, 'utf8');

    expect(validateObsidianDiagnosticReport(JSON.parse(stored)).valid).toBe(
      true,
    );
    expect(stored).not.toContain('PRIVATE BODY TOKEN');
    expect(run.summary).toMatchObject({
      documents: 2,
      references: 1,
      resolved: 1,
    });
  });

  it('fails loudly for missing roots and fatal resolver input', async () => {
    await expect(
      discoverVault(join(tmpdir(), 'definitely-missing-icarus-vault'), []),
    ).rejects.toThrow('Vault root does not exist');
    expect(() =>
      buildReportFromSources({
        workspaceId: 'duplicates',
        markdownDocuments: [
          { path: 'Same.md', source: '# First' },
          { path: 'Same.md', source: '# Second' },
        ],
        nonMarkdownPaths: [],
        discoveryReadMs: 0,
      }),
    ).toThrow('Workspace resolution failed');
  });

  it('parses repeatable excludes and never derives identity from an absolute path', () => {
    const repositoryRoot = join(tmpdir(), 'diagnostic-cli-repository-root');
    const parsed = parseDiagnosticCliArguments(
      [
        '--',
        '--vault',
        './synthetic-vault',
        '--exclude',
        'code',
        '--exclude',
        'archive/private',
        '--workspace-id',
        'local-validation',
        '--out',
        'output/diagnostics/report.json',
        '--verbose',
      ],
      repositoryRoot,
    );

    expect(parsed).toMatchObject({
      vaultPath: join(repositoryRoot, 'synthetic-vault'),
      outputPath: join(repositoryRoot, 'output', 'diagnostics', 'report.json'),
      workspaceId: 'local-validation',
      excludes: ['code', 'archive/private'],
      verbose: true,
    });
  });
});
