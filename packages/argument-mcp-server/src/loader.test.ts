import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { serializeArgumentLibrary } from '@icarus-graph-explorer/argument-workspace';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ARGUMENT_LIBRARY_PATH_ENV,
  ArgumentLibraryLoader,
  resolveArgumentLibraryPath,
} from './loader';
import { createSyntheticLibrary } from './test-fixture';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'icarus-argument-mcp-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('ArgumentLibraryLoader', () => {
  it('uses the configured path before platform defaults', () => {
    const result = resolveArgumentLibraryPath({
      env: {
        [ARGUMENT_LIBRARY_PATH_ENV]: 'fixtures/library-v2.json',
        LOCALAPPDATA: 'C:\\ignored',
      },
      platform: 'win32',
      workingDirectory: 'C:\\workspace',
    });

    expect(result).toEqual({
      status: 'resolved',
      path: resolve('C:\\workspace', 'fixtures/library-v2.json'),
    });
  });

  it('derives Tauri-compatible defaults for supported desktop platforms', () => {
    expect(
      resolveArgumentLibraryPath({
        env: { LOCALAPPDATA: 'C:\\Users\\test\\AppData\\Local' },
        platform: 'win32',
      }),
    ).toMatchObject({
      status: 'resolved',
      path: expect.stringContaining('com.icarus.graph-explorer'),
    });
    expect(
      resolveArgumentLibraryPath({
        env: {},
        platform: 'darwin',
        homeDirectory: '/Users/test',
      }),
    ).toEqual({
      status: 'resolved',
      path: join(
        '/Users/test',
        'Library',
        'Application Support',
        'com.icarus.graph-explorer',
        'argument-workspace',
        'library-v2.json',
      ),
    });
    expect(
      resolveArgumentLibraryPath({
        env: { XDG_DATA_HOME: '/data' },
        platform: 'linux',
        homeDirectory: '/home/test',
      }),
    ).toEqual({
      status: 'resolved',
      path: join(
        '/data',
        'com.icarus.graph-explorer',
        'argument-workspace',
        'library-v2.json',
      ),
    });
  });

  it('loads strict UTF-8 schema-v2 data through the domain reader', async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, 'library-v2.json');
    const { library } = createSyntheticLibrary();
    await writeFile(path, serializeArgumentLibrary(library), 'utf8');

    const loaded = await new ArgumentLibraryLoader({
      libraryPath: path,
    }).load();

    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded') return;
    expect(loaded.snapshot.descriptor.libraryId).toBe('library-mcp-test');
    expect(loaded.reader.searchIndex({ query: 'units' }).status).toBe('ok');
  });

  it.each([
    {
      name: 'missing',
      prepare: async (path: string) => path,
      expected: 'library-missing',
    },
    {
      name: 'non-file',
      prepare: async (path: string) => mkdir(path),
      expected: 'library-unreadable',
    },
    {
      name: 'invalid UTF-8',
      prepare: async (path: string) =>
        writeFile(path, Uint8Array.of(0xc3, 0x28)),
      expected: 'invalid-utf8',
    },
    {
      name: 'invalid JSON',
      prepare: async (path: string) => writeFile(path, '{broken', 'utf8'),
      expected: 'invalid-json',
    },
    {
      name: 'invalid schema',
      prepare: async (path: string) =>
        writeFile(path, JSON.stringify({ schemaVersion: 1 }), 'utf8'),
      expected: 'invalid-library',
    },
    {
      name: 'future schema',
      prepare: async (path: string) =>
        writeFile(path, JSON.stringify({ schemaVersion: 3 }), 'utf8'),
      expected: 'future-schema',
    },
  ])(
    'classifies $name without returning file contents',
    async ({ prepare, expected }) => {
      const directory = await temporaryDirectory();
      const path = join(directory, 'library-v2.json');
      await prepare(path);

      const loaded = await new ArgumentLibraryLoader({
        libraryPath: path,
      }).load();

      expect(loaded).toMatchObject({ status: 'error', code: expected });
      expect(JSON.stringify(loaded)).not.toContain(path);
      expect(JSON.stringify(loaded)).not.toContain('{broken');
    },
  );

  it('rejects files over the configured read bound', async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, 'library-v2.json');
    await writeFile(path, '{}', 'utf8');

    await expect(
      new ArgumentLibraryLoader({
        libraryPath: path,
        maxLibraryBytes: 1,
      }).load(),
    ).resolves.toMatchObject({
      status: 'error',
      code: 'library-too-large',
    });
  });
});
