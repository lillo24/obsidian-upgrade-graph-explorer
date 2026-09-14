import {
  attachAnsweringAxiom,
  createAxiom,
  createCounterArgument,
  createEmptyArgumentLibrary,
  createTopic,
  setTopicMembership,
  updateCounterArgumentResponse,
  type ArgumentLibrary,
  type ArgumentRuntime,
} from '@icarus-graph-explorer/argument-workspace';

export function deterministicRuntime(): ArgumentRuntime {
  let id = 0;
  let second = 0;
  return {
    createId: (kind) => `mcp-test-${kind}-${++id}`,
    now: () => `2026-01-01T00:00:${String(second++).padStart(2, '0')}.000Z`,
  };
}

export function createSyntheticLibrary(): {
  readonly library: ArgumentLibrary;
  readonly runtime: ArgumentRuntime;
} {
  const runtime = deterministicRuntime();
  let library = createEmptyArgumentLibrary(runtime, 'library-mcp-test');
  library = createTopic(
    library,
    {
      id: 'T-MEASUREMENT',
      title: 'Measurement boundaries',
      summary: 'How comparisons depend on compatible units and scope.',
      retrieval: {
        keywords: ['measurement', 'scope'],
        phrases: ['compatible quantities'],
      },
      reviewState: 'accepted',
    },
    runtime,
  );
  library = createAxiom(
    library,
    {
      id: 'AX-UNITS',
      title: 'Comparable quantities use compatible units',
      statement: 'Direct numerical comparisons require compatible units.',
      explanation: 'Convert quantities to a compatible representation first.',
      scope: 'Direct comparisons of measured quantities.',
      supportingReasoning: 'A unit supplies the scale for a magnitude.',
      retrieval: {
        aliases: ['unit compatibility'],
        keywords: ['units'],
      },
      sourceReferences: [
        {
          id: 'SRC-UNITS',
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
    library,
    {
      id: 'CA-CONTRADICTION',
      title: 'Different numbers imply a contradiction',
      observation: 'A length and duration can have different numeric values.',
      challengedClaim:
        'Therefore any two unequal measurements contradict each other.',
      target: { kind: 'topic-claim', topicId: 'T-MEASUREMENT' },
      retrieval: {
        keywords: ['contradiction'],
        phrases: ['different numbers'],
      },
      reviewState: 'accepted',
    },
    runtime,
  );
  library = attachAnsweringAxiom(
    library,
    'CA-CONTRADICTION',
    'AX-UNITS',
    runtime,
  );
  library = updateCounterArgumentResponse(
    library,
    'CA-CONTRADICTION',
    {
      explanation:
        'The comparison is not contradictory until units and scope agree.',
      outcome: 'inapplicable-under-stated-scope',
      boundary: 'The observations remain valid individually.',
      reopeningCondition:
        'Reopen if the quantities are shown to use compatible units.',
    },
    runtime,
  );
  library = setTopicMembership(
    library,
    'T-MEASUREMENT',
    'axiom',
    'AX-UNITS',
    true,
    runtime,
  );
  library = setTopicMembership(
    library,
    'T-MEASUREMENT',
    'counter-argument',
    'CA-CONTRADICTION',
    true,
    runtime,
  );
  return { library, runtime };
}
