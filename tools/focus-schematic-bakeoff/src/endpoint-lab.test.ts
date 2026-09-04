import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { writeEndpointLab } from './endpoint-lab';

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('HIER3A endpoint review lab', () => {
  it('generates the complete focused, explained, keyboard-accessible review surface', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hier3a-endpoint-lab-'));
    temporaryDirectories.push(directory);
    const indexPath = await writeEndpointLab(directory);
    const html = await readFile(indexPath, 'utf8');

    for (let index = 1; index <= 24; index += 1)
      expect(html).toContain(`EP${index}`);
    for (const id of ['ES3', 'ES4', 'ES5']) expect(html).toContain(id);
    expect(html).toContain('Scenario<select id="scenario"');
    expect(html).toContain('Revision<select id="revision"');
    expect(html).toContain('View<select id="view"');
    expect(html).toContain('Edges<select id="edges"');
    expect(html).toContain('A0 vs A1 side-by-side');
    expect(html).toContain(
      '<option value="precise">Precise endpoints</option>',
    );
    expect(html).toContain('<summary>Advanced details</summary>');
    expect(html).toContain('id="secondary" type="checkbox"');
    expect(html).not.toContain('id="secondary" type="checkbox" checked');
    expect(html).toContain('Authored relationship');
    expect(html).toContain('Root and side expectation');
    expect(html).toContain('What to inspect');
    expect(html).toContain('tabindex=');
    expect(html).toContain('Keyboard-accessible endpoint details');
    expect(html).not.toContain('D0 / A / B / C');
    expect(html).not.toContain('Compound Dagre');
    expect(html).not.toContain('Configuration<select');
  });
});
