import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

import { writeFolderLab } from './folder-lab';

describe('HIER4A-FIX2 internal layout review lab', () => {
  it('generates a self-contained accessible review surface with required cases', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hier4-folder-lab-'));
    const indexPath = await writeFolderLab(directory);
    const html = await readFile(indexPath, 'utf8');
    expect(html).toContain('HIER4A-FIX2 · Root Module Internal Layout Bakeoff');
    expect(html).toContain('Vertical spine vs Adaptive compass');
    expect(html).toContain('Folder Bands');
    expect(html).toContain('Heading order');
    expect(html).toContain('Document order');
    expect(html).toContain('Crossing optimized');
    expect(html).toContain('Internal layout');
    expect(html).toContain('Current');
    expect(html).toContain('Vertical spine');
    expect(html).toContain('Adaptive compass');
    expect(html).toContain('Folder guides');
    expect(html).toContain('Exception reasons');
    expect(html).toContain('Precise links');
    expect(html).toContain('aria-label="');
    for (const id of [
      'FB4-safe',
      'FB4-topology-tension',
      'FB9',
      'FB16',
      'FB18',
      'DB1',
      'DB2',
      'DB3',
      'DB5',
      'DB6',
      'DB9',
      'DB10',
      'DB11',
      'DB12',
      'DB13',
      'DB14',
      'DB15',
      'DB16',
      'DB17',
      'DB18',
      'DB19',
      'VS1',
      'VS2',
      'VS3',
      'VS4',
      'VS5',
      'VS6',
      'VS7',
      'CP1',
      'CP2',
      'CP3',
      'CP4',
      'CP5',
      'Reroot',
    ])
      expect(html.toLowerCase()).toContain(id.toLowerCase());
    expect(html).not.toMatch(/>25<|>50<|>75<|>100</);
    expect(html).not.toMatch(/https?:\/\//);
    const inlineScript = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    expect(inlineScript).toBeDefined();
    expect(() => new Function(inlineScript!)).not.toThrow();
    const window = new Window();
    const document = window.document;
    document.write(html.replace(/<script>[\s\S]*<\/script>/, ''));
    window.eval(inlineScript!);
    expect(document.querySelectorAll('#scenario option').length).toBe(34);
    expect(document.querySelectorAll('#mode option').length).toBe(2);
    expect(document.querySelectorAll('#heading option').length).toBe(2);
    expect(document.querySelectorAll('#internal option').length).toBe(3);
    expect(document.querySelectorAll('#view option').length).toBe(4);
    expect(document.querySelector('#views svg')).not.toBeNull();
    expect(document.querySelector('#views')?.textContent).not.toContain(
      '["entity"',
    );

    const setControl = (selector: string, value: string) => {
      const element = document.querySelector(selector);
      if (element === null) throw new Error(`Missing lab control ${selector}.`);
      (element as typeof element & { value: string }).value = value;
      element.dispatchEvent(new window.Event('change'));
    };
    setControl('#scenario', 'DB6');
    setControl('#revision', 'hidden');
    expect(document.querySelector('#views')?.textContent).toContain(
      'Filtered bridge',
    );
    expect(document.querySelector('#views')?.textContent).not.toContain(
      'blue/',
    );

    setControl('#scenario', 'DB11');
    setControl('#view', 'selected');
    setControl('#internal', 'current');
    setControl('#heading', 'document-order');
    expect(document.querySelector('#views')?.textContent).toContain(
      'Root balance override',
    );
    expect(document.querySelector('#views')?.textContent).toContain(
      'crossing guard',
    );

    setControl('#heading', 'crossing-optimized');
    expect(document.querySelector('#views')?.textContent).not.toContain(
      'Root balance override',
    );

    setControl('#scenario', 'DB12');
    setControl('#internal', 'current');
    expect(document.querySelector('#views')?.textContent).toContain(
      'Root balance override',
    );
    setControl('#internal', 'vertical-spine');
    expect(document.querySelector('#views')?.textContent).not.toContain(
      'Root balance override',
    );
    expect(document.querySelector('#views')?.textContent).toContain(
      'root branches above/below/left/right 1 / 2 / 0 / 0',
    );

    setControl('#scenario', 'DB19');
    expect(document.querySelector('#views')?.textContent).toContain(
      'Root balance override',
    );
    expect(document.querySelector('#explain')?.textContent).toContain(
      'Source order, hierarchy, ownership, and Markdown are unchanged',
    );
  });
});
