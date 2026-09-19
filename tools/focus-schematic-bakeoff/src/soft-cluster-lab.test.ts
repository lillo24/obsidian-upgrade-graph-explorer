import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { writeSoftClusterLab } from './soft-cluster-lab';

describe('HIER4B Soft Folder Clusters lab', () => {
  it('writes a self-contained lab with the required scenarios and controls', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hier4b-lab-'));
    const path = await writeSoftClusterLab(directory);
    const html = await readFile(path, 'utf8');
    expect(html).toContain('HIER4B-SPACING-FIX1 Radial Spread Lab');
    for (let index = 1; index <= 24; index += 1)
      expect(html).toContain(`SC${index}`);
    for (let index = 1; index <= 8; index += 1)
      expect(html).toContain(`AC-S${index}`);
    for (const id of ['SC26', 'SC27', 'SC28', 'SC29'])
      expect(html).toContain(id);
    expect(html).toContain('ROOT · FOLDER-NEUTRAL · FIXED');
    expect(html).toContain('Eligible attraction centroids (root excluded)');
    expect(html).toContain('"groups":{"shared":["B","C"]}');
    expect(html).toContain('Directional Bands reference');
    expect(html).toContain('Soft Clusters');
    expect(html).toContain('Crossing optimized');
    expect(html).toContain('Folder hulls');
    expect(html).toContain('Soft spacing');
    expect(html).toContain('71/72/73');
    expect(html).toContain('display-only radial transform');
  }, 240_000);
});
