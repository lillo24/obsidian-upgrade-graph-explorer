import { describe, expect, it } from 'vitest';

import {
  captureArgumentLibrarySnapshot,
  contentFingerprint,
  createAxiom,
  createCounterArgument,
  createEmptyArgumentLibrary,
  createKnowledgeReader,
  createTopic,
  editAxiom,
  editCounterArgument,
  setTopicMembership,
  type ArgumentLibrary,
  type ArgumentRuntime,
} from '@icarus-graph-explorer/argument-workspace';

import { ArgumentSourceAccessSession } from './source-capture';
import {
  buildArgumentSourcePacket,
  formatArgumentSourcePacket,
  sourceOrigins,
} from './source-packet';

function runtime(): ArgumentRuntime {
  let id = 0;
  let second = 0;
  return {
    createId: (kind) => `packet-${kind}-${++id}`,
    now: () => `2026-05-01T00:00:${String(second++).padStart(2, '0')}.000Z`,
  };
}

function neutralLibrary(clock = runtime()): ArgumentLibrary {
  let library = createEmptyArgumentLibrary(clock, 'library-neutral');
  library = createTopic(
    library,
    {
      id: 'T-NEUTRAL',
      title: 'Measurement boundaries',
      summary: 'How comparisons depend on shared units.',
    },
    clock,
  );
  library = createAxiom(
    library,
    {
      id: 'AX-NEUTRAL',
      title: 'Compatible units',
      statement: 'Direct comparison requires compatible units.',
      supportingReasoning: 'Representations must preserve the same quantity.',
      sourceReferences: [
        {
          id: 'SRC-NEUTRAL',
          sourceSpaceHint: 'authorized-space',
          path: 'Theory/Measurement.md',
          heading: 'Units',
          label: 'Measurement units',
          role: 'basis',
          recordedVersion: {
            sourceVersion: 'v1',
            fingerprintScope: 'file',
          },
        },
      ],
    },
    clock,
  );
  library = createCounterArgument(
    library,
    {
      id: 'CA-NEUTRAL',
      title: 'Numeric mismatch',
      observation: 'Neutral observation.',
      challengedClaim: 'Unequal numerals establish a contradiction.',
      target: { kind: 'topic-claim', topicId: 'T-NEUTRAL' },
      response: {
        answeringAxioms: [{ axiomId: 'AX-NEUTRAL', reliedOnRevision: 1 }],
        explanation: 'Neutral response.',
        outcome: 'inapplicable-under-stated-scope',
        boundary: 'The measurements remain independently meaningful.',
      },
    },
    clock,
  );
  library = setTopicMembership(
    library,
    'T-NEUTRAL',
    'axiom',
    'AX-NEUTRAL',
    true,
    clock,
  );
  return setTopicMembership(
    library,
    'T-NEUTRAL',
    'counter-argument',
    'CA-NEUTRAL',
    true,
    clock,
  );
}

describe('source-aware argument context packets', () => {
  it('preserves the full core exchange, exact source payloads, receipts, gaps, and a verifiable outer fingerprint', async () => {
    const clock = runtime();
    let library = neutralLibrary(clock);
    library = editCounterArgument(
      library,
      'CA-NEUTRAL',
      {
        sourceReferences: [
          {
            id: 'SRC-COUNTER',
            sourceSpaceHint: 'authorized-space',
            path: 'Theory/Measurement.md',
            heading: 'Units',
            label: 'Same units passage',
            role: 'target',
          },
          {
            id: 'SRC-MISSING',
            sourceSpaceHint: 'authorized-space',
            path: 'Theory/Missing.md',
            heading: 'Absent',
            label: 'Missing neutral source',
            role: 'support',
          },
        ],
      },
      clock,
    );
    const retained = captureArgumentLibrarySnapshot(library);
    const bundleResult = createKnowledgeReader(retained).readArgumentBundle({
      kind: 'counter-argument',
      id: 'CA-NEUTRAL',
      maxRecords: 20,
      expectedSnapshot: retained.descriptor,
    });
    if (bundleResult.status !== 'ok') throw new Error(bundleResult.status);
    const origins = sourceOrigins(bundleResult.value);
    expect(origins.map(({ sourceReferenceId }) => sourceReferenceId)).toEqual([
      'SRC-NEUTRAL',
      'SRC-COUNTER',
      'SRC-MISSING',
    ]);

    const access = new ArgumentSourceAccessSession();
    access.publishCommittedSource({
      sourceSessionId: 'packet-session',
      sourceSpaceId: 'authorized-space',
      displayName: 'Neutral source',
      acquisition: 'captured',
      acquisitionState: 'ready',
      runtimeRevision: 7,
      observedAt: '2026-05-01T00:00:00.000Z',
      inventory: {
        markdownDocuments: [
          {
            path: 'Theory/Measurement.md',
            source:
              '# Measurement\n## Units\nExact `source` text with ````` retained.\n',
          },
        ],
        nonMarkdownPaths: [],
      },
    });
    access.bindCurrent(access.state().generation);
    const captured = access.capture(origins.map(({ locator }) => locator));
    if (captured.status !== 'ok') throw new Error(captured.message);

    const packet = await buildArgumentSourcePacket(
      bundleResult.value,
      captured.capture,
      retained,
    );

    expect(packet.coreBundle).toEqual(bundleResult.value);
    expect(packet.coreBundleReceipt).toEqual(bundleResult.value.receipt);
    expect(packet.library.libraryId).toBe('library-neutral');
    expect(packet.sourceCapture.sourceSpaceId).toBe('authorized-space');
    expect(packet.sourceCapture.sourceSpaceId).not.toBe(
      packet.library.libraryId,
    );
    expect(packet.sourceInclusion).toEqual({
      status: 'incomplete',
      requested: 3,
      successful: 2,
      failed: 1,
    });
    expect(packet.sourceResults.successes).toHaveLength(1);
    expect(packet.sourceResults.successes[0]!.origins).toHaveLength(2);
    expect(packet.sourceResults.successes[0]!.receipts).toHaveLength(2);
    expect(packet.sourceResults.successes[0]!.result.value.text).toBe(
      '## Units\nExact `source` text with ````` retained.\n',
    );
    expect(packet.sourceResults.failures[0]!.result.status).toBe(
      'source-missing',
    );
    expect(packet.warnings[0]).toContain('no argument verdict was changed');
    const { packetFingerprint, ...covered } = packet;
    expect(packetFingerprint).toEqual(contentFingerprint(covered));

    const formatted = formatArgumentSourcePacket(packet);
    expect(formatted.text).toContain('Neutral observation.');
    expect(formatted.text).toContain('Neutral response.');
    expect(formatted.text).toContain(
      'Exact `source` text with ````` retained.',
    );
    expect(formatted.text).toContain('``````markdown');
    expect(formatted.text).toContain('SRC-MISSING');
    expect(JSON.parse(formatted.structured)).toEqual(packet);
  });

  it('retains a previewed packet after the source session advances', async () => {
    const retained = captureArgumentLibrarySnapshot(neutralLibrary());
    const result = createKnowledgeReader(retained).readArgumentBundle({
      kind: 'axiom',
      id: 'AX-NEUTRAL',
    });
    if (result.status !== 'ok') throw new Error(result.status);
    const origins = sourceOrigins(result.value);
    const access = new ArgumentSourceAccessSession();
    const publish = (source: string, runtimeRevision: number) =>
      access.publishCommittedSource({
        sourceSessionId: 'retained-session',
        sourceSpaceId: 'authorized-space',
        displayName: 'Neutral source',
        acquisition: 'captured',
        acquisitionState: 'ready',
        runtimeRevision,
        observedAt: `2026-05-01T00:00:0${runtimeRevision}.000Z`,
        inventory: {
          markdownDocuments: [{ path: 'Theory/Measurement.md', source }],
          nonMarkdownPaths: [],
        },
      });
    publish('# Measurement\n## Units\nS1\n', 1);
    access.bindCurrent(access.state().generation);
    const firstCapture = access.capture(origins.map(({ locator }) => locator));
    if (firstCapture.status !== 'ok') throw new Error(firstCapture.message);
    const firstPacket = await buildArgumentSourcePacket(
      result.value,
      firstCapture.capture,
      retained,
    );
    const retainedJson = formatArgumentSourcePacket(firstPacket).structured;

    publish('# Measurement\n## Units\nS2\n', 2);
    const l2 = captureArgumentLibrarySnapshot(
      editAxiom(
        retained.library,
        'AX-NEUTRAL',
        { statement: 'L2 statement.' },
        runtime(),
      ),
    );
    expect(retainedJson).toContain('S1');
    expect(retainedJson).not.toContain('S2');
    expect(retainedJson).toContain(
      'Direct comparison requires compatible units.',
    );
    expect(retainedJson).not.toContain('L2 statement.');
    expect(firstPacket.library).toEqual(retained.descriptor);
    expect(firstPacket.library).not.toEqual(l2.descriptor);
  });
});
