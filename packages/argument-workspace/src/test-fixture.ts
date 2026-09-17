import {
  attachAnsweringAxiom,
  createAxiom,
  createArgument,
  createCounterArgument,
  createEmptyArgumentLibrary,
  createTopic,
  promoteArgumentToCurrent,
  setTopicMembership,
  updateCounterArgumentResponse,
} from './library';
import type { ArgumentLibrary, ArgumentRuntime } from './types';

export function deterministicRuntime(prefix = 'test'): ArgumentRuntime {
  let id = 0;
  let second = 0;
  return {
    createId: (kind) => `${prefix}-${kind}-${++id}`,
    now: () => `2026-01-01T00:00:${String(second++).padStart(2, '0')}.000Z`,
  };
}

/** Neutral public fixture. The user's private pilot library is never committed. */
export function createNeutralArgumentLibrary(): ArgumentLibrary {
  const runtime = deterministicRuntime();
  let library = createEmptyArgumentLibrary(runtime, 'library-neutral');
  library = createTopic(
    library,
    {
      id: 'T-NEUTRAL',
      title: 'Measurement Boundaries',
      summary: 'How comparisons depend on a shared unit and scope.',
      retrieval: {
        keywords: ['measurement', 'scope', '3.14...'],
        phrases: ['a familiar approximation initially seems inconsistent'],
      },
      reviewState: 'accepted',
    },
    runtime,
  );
  library = createAxiom(
    library,
    {
      id: 'AX-NEUTRAL',
      title: 'Comparable quantities use compatible units',
      statement: 'A direct numerical comparison requires compatible units.',
      explanation:
        'Convert both quantities into a compatible representation first.',
      scope: 'Direct comparisons of measured quantities.',
      retrieval: { aliases: ['unit compatibility'], keywords: ['units'] },
      sourceReferences: [
        {
          id: 'SRC-NEUTRAL',
          sourceSpaceHint: 'authorized-space',
          path: 'Theory/Measurement.md',
          heading: 'Units',
          label: 'Measurement units',
          originalWikilink: '[[Measurement#Units]]',
          role: 'basis',
          recordedVersion: {
            sourceVersion: 'v1',
            fingerprintScope: 'heading',
          },
        },
      ],
      reviewState: 'accepted',
    },
    runtime,
  );
  library = createCounterArgument(
    createArgument(
      library,
      {
        id: 'AR-NEUTRAL',
        title: 'Compatibility precedes contradiction testing',
        premises: [
          {
            id: 'P-NEUTRAL-AXIOM',
            kind: 'axiom',
            axiomId: 'AX-NEUTRAL',
            reliedOnRevision: library.axioms.find(
              ({ id }) => id === 'AX-NEUTRAL',
            )!.revision,
          },
          {
            id: 'P-NEUTRAL-TEXT',
            kind: 'text',
            text: 'The compared measurements use different dimensions.',
          },
        ],
        reasoning:
          'A numeric difference alone is not a contradiction when the quantities are not directly comparable.',
        conclusion:
          'Compatibility must be established before unequal measurements can support a contradiction claim.',
        retrieval: { keywords: ['compatibility', 'reasoning'] },
        reviewState: 'accepted',
      },
      runtime,
    ),
    {
      id: 'CA-NEUTRAL',
      title: 'Different numbers imply a contradiction',
      observation: 'A length and a duration can have different numeric values.',
      challengedClaim:
        'Therefore any two unequal measurements contradict each other.',
      target: {
        kind: 'argument',
        argumentId: 'AR-NEUTRAL',
        part: { kind: 'conclusion' },
      },
      retrieval: {
        keywords: ['contradiction'],
        phrases: ['an approximation initially seems inconsistent'],
      },
      reviewState: 'accepted',
    },
    runtime,
  );
  library = attachAnsweringAxiom(library, 'CA-NEUTRAL', 'AX-NEUTRAL', runtime);
  library = updateCounterArgumentResponse(
    library,
    'CA-NEUTRAL',
    {
      explanation:
        'The comparison does not establish a contradiction until units and scope agree.',
      outcome: 'inapplicable-under-stated-scope',
      boundary: 'The observations remain valid individually.',
      reopeningCondition:
        'Reopen if the quantities are shown to use compatible units.',
    },
    runtime,
  );
  library = setTopicMembership(
    library,
    'T-NEUTRAL',
    'axiom',
    'AX-NEUTRAL',
    true,
    runtime,
  );
  library = setTopicMembership(
    library,
    'T-NEUTRAL',
    'argument',
    'AR-NEUTRAL',
    true,
    runtime,
  );
  library = promoteArgumentToCurrent(
    library,
    'T-NEUTRAL',
    'AR-NEUTRAL',
    runtime,
  );
  return setTopicMembership(
    library,
    'T-NEUTRAL',
    'counter-argument',
    'CA-NEUTRAL',
    true,
    runtime,
  );
}
