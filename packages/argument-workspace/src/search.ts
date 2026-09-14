import { contentFingerprint } from './canonical';
import type {
  ArgumentLibrary,
  ArgumentRecordKind,
  IndexCandidate,
  SnapshotDescriptor,
} from './types';

interface SearchField {
  readonly name: string;
  readonly value: string;
  readonly weight: number;
}

interface DescriptiveIndexEntry {
  readonly kind: ArgumentRecordKind;
  readonly id: string;
  readonly revision: number;
  readonly title: string;
  readonly topicIds: readonly string[];
  readonly archived: boolean;
  readonly fields: readonly SearchField[];
}

export interface DescriptiveIndex {
  readonly descriptor: SnapshotDescriptor;
  readonly entries: readonly DescriptiveIndexEntry[];
}

export interface DescriptiveIndexPage {
  readonly candidates: readonly IndexCandidate[];
  readonly nextCursor?: string;
}

function normalized(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replaceAll('…', '...')
    .replace(/\s+/gu, ' ')
    .trim();
}

function queryTerms(query: string): readonly string[] {
  const value = normalized(query);
  if (value === '') return [];
  const lexical = value
    .split(/[^\p{L}\p{N}.=<>+\-/]+/gu)
    .map((term) => term.replace(/^\.+|\.+$/gu, ''))
    .filter((term) => term !== '');
  return [...new Set([value, ...lexical])];
}

function fields(
  values: readonly [name: string, value: string | undefined, weight: number][],
): readonly SearchField[] {
  return values.flatMap(([name, value, weight]) =>
    value === undefined || value === ''
      ? []
      : [{ name, value: normalized(value), weight }],
  );
}

function topicMemberships(library: ArgumentLibrary): {
  readonly axioms: ReadonlyMap<string, readonly string[]>;
  readonly counters: ReadonlyMap<string, readonly string[]>;
} {
  const axioms = new Map<string, string[]>();
  const counters = new Map<string, string[]>();
  for (const topic of library.topics) {
    for (const id of topic.axiomIds) {
      const values = axioms.get(id) ?? [];
      values.push(topic.id);
      axioms.set(id, values);
    }
    for (const id of topic.counterArgumentIds) {
      const values = counters.get(id) ?? [];
      values.push(topic.id);
      counters.set(id, values);
    }
  }
  return {
    axioms: new Map(
      [...axioms].map(([id, values]) => [id, [...values].sort()] as const),
    ),
    counters: new Map(
      [...counters].map(([id, values]) => [id, [...values].sort()] as const),
    ),
  };
}

export function buildDescriptiveIndex(
  library: ArgumentLibrary,
  descriptor: SnapshotDescriptor,
): DescriptiveIndex {
  const memberships = topicMemberships(library);
  const entries: DescriptiveIndexEntry[] = [];
  for (const topic of library.topics) {
    entries.push({
      kind: 'topic',
      id: topic.id,
      revision: topic.revision,
      title: topic.title,
      topicIds: [topic.id],
      archived: topic.archived,
      fields: fields([
        ['title', topic.title, 12],
        ['summary', topic.summary, 7],
        ['aliases', topic.retrieval.aliases.join(' '), 8],
        ['keywords', topic.retrieval.keywords.join(' '), 6],
        ['phrases', topic.retrieval.phrases.join(' '), 9],
      ]),
    });
  }
  for (const axiom of library.axioms) {
    entries.push({
      kind: 'axiom',
      id: axiom.id,
      revision: axiom.revision,
      title: axiom.title,
      topicIds: memberships.axioms.get(axiom.id) ?? [],
      archived: axiom.archived,
      fields: fields([
        ['title', axiom.title, 12],
        ['statement', axiom.statement, 10],
        ['explanation', axiom.explanation, 6],
        ['scope', axiom.scope, 6],
        ['supportingReasoning', axiom.supportingReasoning, 5],
        ['aliases', axiom.retrieval.aliases.join(' '), 8],
        ['keywords', axiom.retrieval.keywords.join(' '), 6],
        ['phrases', axiom.retrieval.phrases.join(' '), 9],
      ]),
    });
  }
  for (const counter of library.counterArguments) {
    entries.push({
      kind: 'counter-argument',
      id: counter.id,
      revision: counter.revision,
      title: counter.title,
      topicIds: memberships.counters.get(counter.id) ?? [],
      archived: counter.archived,
      fields: fields([
        ['title', counter.title, 12],
        ['challengedClaim', counter.challengedClaim, 10],
        ['observation', counter.observation, 9],
        ['response', counter.response.explanation, 7],
        ['boundary', counter.response.boundary, 5],
        ['reopeningCondition', counter.response.reopeningCondition, 5],
        ['aliases', counter.retrieval.aliases.join(' '), 8],
        ['keywords', counter.retrieval.keywords.join(' '), 6],
        ['phrases', counter.retrieval.phrases.join(' '), 9],
      ]),
    });
  }
  return {
    descriptor,
    entries: entries.sort((left, right) => {
      const kindOrder = { topic: 0, axiom: 1, 'counter-argument': 2 } as const;
      return (
        kindOrder[left.kind] - kindOrder[right.kind] ||
        left.id.localeCompare(right.id)
      );
    }),
  };
}

interface CursorValue {
  readonly version: 1;
  readonly snapshotFingerprint: string;
  readonly queryFingerprint: string;
  readonly includeArchived: boolean;
  readonly offset: number;
}

function cursor(value: CursorValue): string {
  return encodeURIComponent(JSON.stringify(value));
}

function parseCursor(value: string): CursorValue | undefined {
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed) ||
      Reflect.get(parsed, 'version') !== 1 ||
      typeof Reflect.get(parsed, 'snapshotFingerprint') !== 'string' ||
      typeof Reflect.get(parsed, 'queryFingerprint') !== 'string' ||
      typeof Reflect.get(parsed, 'includeArchived') !== 'boolean' ||
      !Number.isSafeInteger(Reflect.get(parsed, 'offset')) ||
      Number(Reflect.get(parsed, 'offset')) < 0
    ) {
      return undefined;
    }
    return parsed as CursorValue;
  } catch {
    return undefined;
  }
}

export function readDescriptiveIndex(
  index: DescriptiveIndex,
  options: {
    readonly query: string;
    readonly limit: number;
    readonly includeArchived: boolean;
    readonly cursor?: string;
  },
): DescriptiveIndexPage | { readonly error: string } {
  const terms = queryTerms(options.query);
  const queryFingerprint = contentFingerprint({
    query: normalized(options.query),
  }).value;
  let offset = 0;
  if (options.cursor !== undefined) {
    const decoded = parseCursor(options.cursor);
    if (
      decoded === undefined ||
      decoded.snapshotFingerprint !==
        index.descriptor.contentFingerprint.value ||
      decoded.queryFingerprint !== queryFingerprint ||
      decoded.includeArchived !== options.includeArchived
    ) {
      return {
        error:
          'Cursor does not belong to this snapshot, query, or archive policy.',
      };
    }
    offset = decoded.offset;
  }
  const ranked = index.entries
    .filter((entry) => options.includeArchived || !entry.archived)
    .flatMap((entry): readonly IndexCandidate[] => {
      if (terms.length === 0) {
        return [
          {
            kind: entry.kind,
            id: entry.id,
            revision: entry.revision,
            title: entry.title,
            topicIds: entry.topicIds,
            score: 0,
            matchedFields: [],
          },
        ];
      }
      const matchedFields = new Set<string>();
      let score = 0;
      for (const field of entry.fields) {
        const matches = terms.filter((term) => field.value.includes(term));
        if (matches.length > 0) {
          matchedFields.add(field.name);
          score += field.weight * matches.length;
          if (field.value === normalized(options.query))
            score += field.weight * 2;
        }
      }
      return score === 0
        ? []
        : [
            {
              kind: entry.kind,
              id: entry.id,
              revision: entry.revision,
              title: entry.title,
              topicIds: entry.topicIds,
              score,
              matchedFields: [...matchedFields].sort(),
            },
          ];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.kind.localeCompare(right.kind) ||
        left.id.localeCompare(right.id),
    );
  if (offset > ranked.length)
    return { error: 'Cursor offset exceeds the result set.' };
  const candidates = ranked.slice(offset, offset + options.limit);
  const nextOffset = offset + candidates.length;
  return {
    candidates,
    ...(nextOffset >= ranked.length
      ? {}
      : {
          nextCursor: cursor({
            version: 1,
            snapshotFingerprint: index.descriptor.contentFingerprint.value,
            queryFingerprint,
            includeArchived: options.includeArchived,
            offset: nextOffset,
          }),
        }),
  };
}
