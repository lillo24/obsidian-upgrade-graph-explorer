import { describe, expect, it } from 'vitest';

import { ArgumentLibraryAuthoringService } from './authoring';
import { captureArgumentLibrarySnapshot, sameSnapshot } from './canonical';
import { editAxiom, responseStaleness } from './library';
import { ArgumentLibraryRepository } from './storage';
import {
  createNeutralArgumentLibrary,
  deterministicRuntime,
} from './test-fixture';
import type {
  ArgumentLibrary,
  ArgumentLibraryStore,
  SnapshotDescriptor,
} from './types';

describe('Argument Library authoring service', () => {
  it('commits explicit response reassessment through the expected-snapshot repository', async () => {
    let snapshot = captureArgumentLibrarySnapshot(
      editAxiom(
        createNeutralArgumentLibrary(),
        'AX-NEUTRAL',
        { statement: 'Comparison requires explicitly compatible units.' },
        deterministicRuntime('stale-service'),
      ),
    );
    const store: ArgumentLibraryStore = {
      async load() {
        return { status: 'loaded', snapshot };
      },
      async save(
        library: ArgumentLibrary,
        expected: SnapshotDescriptor | 'missing',
      ) {
        if (
          expected === 'missing' ||
          !sameSnapshot(expected, snapshot.descriptor)
        ) {
          return { status: 'conflict', message: 'changed' };
        }
        snapshot = captureArgumentLibrarySnapshot(library);
        return { status: 'saved', snapshot };
      },
    };
    const repository = new ArgumentLibraryRepository(store);
    const opened = await repository.open();
    if (opened.status !== 'ready') throw new Error('Fixture failed to open.');
    const service = new ArgumentLibraryAuthoringService(
      repository,
      deterministicRuntime('reassess-service'),
    );
    expect(
      responseStaleness(
        opened.snapshot.library,
        opened.snapshot.library.counterArguments[0]!,
      ).stale,
    ).toBe(true);

    const result = await service.reassessResponse(
      opened.snapshot.descriptor,
      'CA-NEUTRAL',
    );

    expect(result.status).toBe('committed');
    if (result.status !== 'committed') return;
    expect(
      responseStaleness(
        result.snapshot.library,
        result.snapshot.library.counterArguments[0]!,
      ).stale,
    ).toBe(false);
  });
});
