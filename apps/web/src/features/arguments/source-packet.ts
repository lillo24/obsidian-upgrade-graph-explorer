import {
  canonicalJson,
  contentFingerprint,
  createKnowledgeReader,
  formatTheorySourceLocator,
  type ArgumentBundle,
  type ArgumentLibrarySnapshot,
  type ArgumentRecordKind,
  type ContentFingerprint,
  type ReadLinkedTheorySourceResult,
  type SourceReferenceRole,
  type TheorySourceReference,
} from '@icarus-graph-explorer/argument-workspace';

import { formatArgumentBundle } from './context-export';
import {
  ARGUMENT_SOURCE_CAPTURE_LIMITS,
  type ArgumentSourceCapture,
  type ArgumentSourceIdentity,
} from './source-capture';

export const ARGUMENT_SOURCE_PACKET_VERSION = 1 as const;
export const ARGUMENT_SOURCE_PACKET_LIMITS = Object.freeze({
  perPassageCharacters: 64_000,
  totalPassageCharacters: 256_000,
});

export interface SourceReferenceOrigin {
  readonly recordKind: Extract<
    ArgumentRecordKind,
    'axiom' | 'argument' | 'counter-argument'
  >;
  readonly recordId: string;
  readonly sourceReferenceId: string;
  readonly role: SourceReferenceRole;
  readonly locator: TheorySourceReference;
}

export interface SourcePacketSuccess {
  readonly origins: readonly SourceReferenceOrigin[];
  readonly receipts: readonly {
    readonly sourceReferenceId: string;
    readonly receipt: Extract<
      ReadLinkedTheorySourceResult,
      { status: 'ok' }
    >['value']['receipt'];
  }[];
  readonly result: Extract<ReadLinkedTheorySourceResult, { status: 'ok' }>;
}

export interface SourcePacketFailure {
  readonly origin: SourceReferenceOrigin;
  readonly result: Exclude<ReadLinkedTheorySourceResult, { status: 'ok' }>;
}

export interface ArgumentSourcePacket {
  readonly packetVersion: typeof ARGUMENT_SOURCE_PACKET_VERSION;
  readonly library: ArgumentBundle['snapshot'];
  /** The original core bundle and receipt remain byte-for-byte representable here. */
  readonly coreBundle: ArgumentBundle;
  readonly coreBundleReceipt: ArgumentBundle['receipt'];
  readonly sourceCapture: ArgumentSourceIdentity;
  readonly selectedSources: readonly SourceReferenceOrigin[];
  readonly sourceResults: {
    readonly successes: readonly SourcePacketSuccess[];
    readonly failures: readonly SourcePacketFailure[];
  };
  readonly sourceInclusion: {
    readonly status:
      'not-requested' | 'complete' | 'incomplete' | 'unavailable';
    readonly requested: number;
    readonly successful: number;
    readonly failed: number;
  };
  readonly omissions: readonly string[];
  readonly warnings: readonly string[];
  readonly packetFingerprint: ContentFingerprint;
}

export interface ArgumentSourcePacketExport {
  readonly packet: ArgumentSourcePacket;
  readonly label: string;
  readonly text: string;
  readonly structured: string;
}

export function sourceOrigins(
  bundle: ArgumentBundle,
): readonly SourceReferenceOrigin[] {
  return [
    ...bundle.axioms.flatMap((record) =>
      record.sourceReferences.map((locator) => ({
        recordKind: 'axiom' as const,
        recordId: record.id,
        sourceReferenceId: locator.id,
        role: locator.role,
        locator,
      })),
    ),
    ...bundle.arguments.flatMap((record) =>
      record.sourceReferences.map((locator) => ({
        recordKind: 'argument' as const,
        recordId: record.id,
        sourceReferenceId: locator.id,
        role: locator.role,
        locator,
      })),
    ),
    ...bundle.counterArguments.flatMap((record) =>
      record.sourceReferences.map((locator) => ({
        recordKind: 'counter-argument' as const,
        recordId: record.id,
        sourceReferenceId: locator.id,
        role: locator.role,
        locator,
      })),
    ),
  ];
}

async function mapConcurrent<T, U>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T) => Promise<U>,
): Promise<readonly U[]> {
  const result = new Array<U>(values.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < values.length) {
      const index = next;
      next += 1;
      result[index] = await operation(values[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () =>
      worker(),
    ),
  );
  return result;
}

function sourceResultKey(
  result: Extract<ReadLinkedTheorySourceResult, { status: 'ok' }>,
): string {
  return canonicalJson({
    sourceSpaceId: result.value.sourceSpaceId,
    location: result.value.location,
    sourceVersion: result.value.sourceVersion,
    text: result.value.text,
  });
}

export async function buildArgumentSourcePacket(
  bundle: ArgumentBundle,
  capture: ArgumentSourceCapture,
  retainedLibrary: ArgumentLibrarySnapshot,
): Promise<ArgumentSourcePacket> {
  const selectedSources = sourceOrigins(bundle);
  const references = [
    ...new Map(
      selectedSources.map((origin) => [
        origin.sourceReferenceId,
        origin.locator,
      ]),
    ).values(),
  ];
  const reader = createKnowledgeReader(retainedLibrary, {
    sourceProvider: capture.provider,
  });
  const perPassageBudget = Math.min(
    ARGUMENT_SOURCE_PACKET_LIMITS.perPassageCharacters,
    Math.max(
      1,
      Math.floor(
        ARGUMENT_SOURCE_PACKET_LIMITS.totalPassageCharacters /
          Math.max(1, references.length),
      ),
    ),
  );
  const results = await mapConcurrent(
    references,
    ARGUMENT_SOURCE_CAPTURE_LIMITS.concurrentReads,
    async (reference) =>
      reader.readLinkedTheorySource({
        sourceReferenceId: reference.id,
        maxCharacters: perPassageBudget,
        expectedSnapshot: bundle.snapshot,
      }),
  );
  const originsById = new Map<string, readonly SourceReferenceOrigin[]>();
  for (const origin of selectedSources) {
    originsById.set(origin.sourceReferenceId, [
      ...(originsById.get(origin.sourceReferenceId) ?? []),
      origin,
    ]);
  }
  const successByPayload = new Map<string, SourcePacketSuccess>();
  const failures: SourcePacketFailure[] = [];
  for (const [index, result] of results.entries()) {
    const reference = references[index]!;
    const origins = originsById.get(reference.id) ?? [];
    if (result.status === 'ok') {
      const key = sourceResultKey(result);
      const prior = successByPayload.get(key);
      successByPayload.set(key, {
        result: prior?.result ?? result,
        origins: [...(prior?.origins ?? []), ...origins],
        receipts: [
          ...(prior?.receipts ?? []),
          {
            sourceReferenceId: reference.id,
            receipt: result.value.receipt,
          },
        ],
      });
    } else {
      failures.push(...origins.map((origin) => ({ origin, result })));
    }
  }
  const successes = [...successByPayload.values()];
  const incomplete = successes.some(({ result }) => !result.value.complete);
  const sourceInclusion = {
    status:
      selectedSources.length === 0
        ? ('not-requested' as const)
        : failures.length === selectedSources.length
          ? ('unavailable' as const)
          : failures.length > 0 || incomplete
            ? ('incomplete' as const)
            : ('complete' as const),
    requested: selectedSources.length,
    successful: selectedSources.length - failures.length,
    failed: failures.length,
  };
  const omissions = [
    ...failures.map(
      ({ origin, result }) =>
        `${origin.sourceReferenceId}: ${
          'message' in result ? result.message : result.status
        }`,
    ),
    ...successes.flatMap(({ origins, result }) =>
      result.value.omissions.map(
        (message) => `${origins[0]?.sourceReferenceId ?? 'source'}: ${message}`,
      ),
    ),
  ];
  const warnings = results.flatMap((result, index) =>
    result.status === 'ok' && result.value.freshness === 'changed'
      ? [
          `${references[index]?.id ?? 'source'} changed from its recorded full-file baseline; no argument verdict was changed.`,
        ]
      : [],
  );
  const unsigned = {
    packetVersion: ARGUMENT_SOURCE_PACKET_VERSION,
    library: bundle.snapshot,
    coreBundle: bundle,
    coreBundleReceipt: bundle.receipt,
    sourceCapture: capture.provenance,
    selectedSources,
    sourceResults: { successes, failures },
    sourceInclusion,
    omissions,
    warnings,
  };
  return {
    ...unsigned,
    packetFingerprint: contentFingerprint(unsigned),
  };
}

function sourceFence(value: string): string {
  const longest = Math.max(
    0,
    ...[...value.matchAll(/`+/gu)].map((match) => match[0].length),
  );
  return '`'.repeat(Math.max(3, longest + 1));
}

export function formatArgumentSourcePacket(
  packet: ArgumentSourcePacket,
): ArgumentSourcePacketExport {
  const core = formatArgumentBundle(packet.coreBundle).text.trimEnd();
  const sections = [
    '# Source-aware argument context packet',
    '',
    `Packet fingerprint: ${packet.packetFingerprint.value}`,
    `Source inclusion: ${packet.sourceInclusion.status} (${packet.sourceInclusion.successful}/${packet.sourceInclusion.requested})`,
    `Source capture: ${packet.sourceCapture.displayName} / ${packet.sourceCapture.sourceSpaceId} / generation ${packet.sourceCapture.sourceGeneration}`,
    '',
    '## Original core argument bundle',
    '',
    'The following readable core bundle retains its original “theory sources not read” declaration and receipt. Source acquisition is recorded separately below.',
    '',
    core,
    '',
    '## Linked theory source acquisitions',
  ];
  for (const success of packet.sourceResults.successes) {
    const payload = success.result.value;
    const fence = sourceFence(payload.text);
    sections.push(
      '',
      `### ${success.origins.map(({ sourceReferenceId }) => sourceReferenceId).join(', ')}`,
      '',
      ...success.origins.map(
        (origin) =>
          `- ${origin.recordKind} ${origin.recordId}: ${formatTheorySourceLocator(origin.locator)} [${origin.role}]`,
      ),
      '',
      `Resolved path: ${payload.location.path}${payload.location.heading === undefined ? '' : `#${payload.location.heading}`}`,
      `Observed full-document version: ${payload.sourceVersion ?? 'unavailable'}`,
      `Returned excerpt fingerprint: ${payload.contentFingerprint.value}`,
      `Freshness: ${payload.freshness}`,
      `Complete: ${payload.complete ? 'yes' : 'no'}`,
      `Observed: ${payload.observedAt}`,
      '',
      `${fence}markdown`,
      payload.text,
      fence,
      '',
      'Source consultation receipt:',
      '',
      JSON.stringify(success.receipts, null, 2),
    );
  }
  if (packet.sourceResults.failures.length > 0) {
    sections.push('', '## Source gaps', '');
    for (const failure of packet.sourceResults.failures) {
      sections.push(
        `- ${failure.origin.sourceReferenceId} (${formatTheorySourceLocator(failure.origin.locator)}): ${failure.result.status}${
          'message' in failure.result ? ` — ${failure.result.message}` : ''
        }`,
      );
    }
  }
  if (packet.warnings.length > 0) {
    sections.push(
      '',
      '## Warnings',
      '',
      ...packet.warnings.map((value) => `- ${value}`),
    );
  }
  if (packet.omissions.length > 0) {
    sections.push(
      '',
      '## Omissions',
      '',
      ...packet.omissions.map((value) => `- ${value}`),
    );
  }
  sections.push(
    '',
    '## Packet envelope',
    '',
    JSON.stringify(
      {
        packetVersion: packet.packetVersion,
        library: packet.library,
        sourceCapture: packet.sourceCapture,
        sourceInclusion: packet.sourceInclusion,
        packetFingerprint: packet.packetFingerprint,
      },
      null,
      2,
    ),
  );
  return {
    packet,
    label:
      packet.sourceInclusion.status === 'complete'
        ? 'Source-aware argument context; complete source inclusion'
        : `Source-aware argument context; ${packet.sourceInclusion.status} source inclusion`,
    text: `${sections.join('\n')}\n`,
    structured: `${JSON.stringify(packet, null, 2)}\n`,
  };
}
