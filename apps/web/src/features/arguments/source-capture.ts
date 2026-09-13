import {
  parseObsidianDocument,
  type ParsedObsidianDocument,
} from '@icarus-graph-explorer/adapter-obsidian';
import {
  canonicalJson,
  contentFingerprint,
  type LinkedTheorySourceProvider,
  type LinkedTheorySourceProviderResult,
  type SourcePosition,
  type SourceSpan,
  type TheorySourceReference,
} from '@icarus-graph-explorer/argument-workspace';
import { isNormalizedWorkspacePath } from '@icarus-graph-explorer/core';
import type { VaultSourceInventory } from '@icarus-graph-explorer/source-provider-tauri';

export const ARGUMENT_SOURCE_CAPTURE_LIMITS = Object.freeze({
  selectedReferences: 24,
  capturedFiles: 16,
  perFileCharacters: 1_000_000,
  totalCapturedCharacters: 4_000_000,
  concurrentReads: 4,
});

export const FULL_DOCUMENT_SOURCE_VERSION_NAMESPACE =
  'icarus-full-document-sha256-canonical-json-v1' as const;

export type ArgumentSourceAcquisition = 'live' | 'captured';
export type ArgumentSourceAcquisitionState =
  'ready' | 'catching-up' | 'updating' | 'resyncing' | 'paused' | 'dirty';

export interface ArgumentSourceCandidateInput {
  readonly sourceSessionId: string;
  readonly sourceSpaceId: string;
  readonly displayName: string;
  readonly acquisition: ArgumentSourceAcquisition;
  readonly acquisitionState: ArgumentSourceAcquisitionState;
  readonly runtimeRevision: number;
  readonly inventory: VaultSourceInventory;
  readonly observedAt: string;
}

export interface ArgumentSourceIdentity {
  readonly sourceSessionId: string;
  readonly sourceSpaceId: string;
  readonly displayName: string;
  readonly acquisition: ArgumentSourceAcquisition;
  readonly acquisitionState: ArgumentSourceAcquisitionState;
  readonly runtimeRevision: number;
  readonly sourceGeneration: number;
  readonly observedAt: string;
}

export interface ArgumentSourceAvailableView {
  readonly status: 'available' | 'bound';
  readonly generation: number;
  readonly source: ArgumentSourceIdentity;
  readonly freshReadAvailable: boolean;
  readonly message: string;
}

export type ArgumentSourceAccessView =
  | {
      readonly status: 'unavailable';
      readonly generation: number;
      readonly message: string;
    }
  | ArgumentSourceAvailableView;

export type ArgumentSourceBindResult =
  | { readonly status: 'bound'; readonly source: ArgumentSourceIdentity }
  | { readonly status: 'unavailable' | 'stale'; readonly message: string };

export type ArgumentSourceCaptureResult =
  | { readonly status: 'ok'; readonly capture: ArgumentSourceCapture }
  | {
      readonly status: 'unavailable' | 'wrong-binding' | 'limit-exceeded';
      readonly message: string;
    };

export interface ArgumentSourceAccess {
  state(): ArgumentSourceAccessView;
  subscribe(listener: () => void): () => void;
  bindCurrent(expectedGeneration: number): ArgumentSourceBindResult;
  disconnect(): void;
  capture(
    references: readonly TheorySourceReference[],
  ): ArgumentSourceCaptureResult;
}

export interface ArgumentSourceAccessHost extends ArgumentSourceAccess {
  publishCommittedSource(input: ArgumentSourceCandidateInput): void;
  reportOnly(message?: string): void;
}

interface CapturedDocument {
  readonly path: string;
  readonly source: string;
  readonly sourceVersion: string;
  parsed?: ParsedObsidianDocument;
  lineStarts?: readonly number[];
}

interface Candidate extends Omit<ArgumentSourceCandidateInput, 'inventory'> {
  readonly sourceGeneration: number;
  readonly documentsByPath: ReadonlyMap<string, string>;
}

function validIdentity(value: string, label: string): void {
  if (value.trim() === '') throw new Error(`${label} must not be empty.`);
}

function ready(
  input: Pick<ArgumentSourceCandidateInput, 'acquisition' | 'acquisitionState'>,
): boolean {
  return input.acquisition === 'captured' || input.acquisitionState === 'ready';
}

function safeView(
  generation: number,
  candidate: Candidate,
  bound: boolean,
): ArgumentSourceAvailableView {
  const freshReadAvailable = ready(candidate);
  const source: ArgumentSourceIdentity = {
    sourceSessionId: candidate.sourceSessionId,
    sourceSpaceId: candidate.sourceSpaceId,
    displayName: candidate.displayName,
    acquisition: candidate.acquisition,
    acquisitionState: candidate.acquisitionState,
    runtimeRevision: candidate.runtimeRevision,
    sourceGeneration: candidate.sourceGeneration,
    observedAt: candidate.observedAt,
  };
  const stateLabel =
    candidate.acquisition === 'captured'
      ? 'one-shot captured source'
      : `${candidate.acquisitionState} live source`;
  return {
    status: bound ? 'bound' : 'available',
    generation,
    source,
    freshReadAvailable,
    message: freshReadAvailable
      ? `${candidate.displayName} is available as a ${stateLabel}.`
      : `${candidate.displayName} is ${candidate.acquisitionState}; fresh source reads are unavailable until a committed snapshot is ready.`,
  };
}

function failure(
  status: Exclude<LinkedTheorySourceProviderResult['status'], 'ok'>,
  message: string,
): LinkedTheorySourceProviderResult {
  return { status, message };
}

function sourceVersion(source: string): string {
  return `${FULL_DOCUMENT_SOURCE_VERSION_NAMESPACE}:${contentFingerprint(source).value}`;
}

function lineStarts(source: string): readonly number[] {
  const result = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source.charCodeAt(index) === 10) result.push(index + 1);
  }
  return result;
}

function positionAt(
  source: string,
  starts: readonly number[],
  offset: number,
): SourcePosition {
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (starts[middle]! <= offset) low = middle + 1;
    else high = middle - 1;
  }
  const lineIndex = Math.max(0, high);
  return {
    line: lineIndex + 1,
    column: offset - starts[lineIndex]! + 1,
    offset: Math.min(offset, source.length),
  };
}

function knownOffsets(span: SourceSpan): { start: number; end: number } {
  const start = span.start.offset;
  const end = span.end.offset;
  if (start === undefined || end === undefined) {
    throw new Error('Parsed source span is missing UTF-16 offsets.');
  }
  return { start, end };
}

function safeEnd(
  source: string,
  start: number,
  passageEnd: number,
  maximum: number,
): number {
  let end = Math.min(passageEnd, start + maximum);
  if (
    end < source.length &&
    end > start &&
    /[\uD800-\uDBFF]/u.test(source[end - 1]!) &&
    /[\uDC00-\uDFFF]/u.test(source[end]!)
  ) {
    end -= 1;
  }
  return end;
}

interface SectionMatch {
  readonly titleChain: readonly string[];
  readonly span: SourceSpan;
}

function sectionMatches(
  parsed: ParsedObsidianDocument,
): readonly SectionMatch[] {
  const matches: SectionMatch[] = [];
  const visit = (
    sections: ParsedObsidianDocument['structure']['sections'],
    parents: readonly string[],
  ) => {
    for (const section of sections) {
      const titleChain = [...parents, section.title];
      matches.push({ titleChain, span: section.span });
      visit(section.children, titleChain);
    }
  };
  visit(parsed.structure.sections, []);
  return matches;
}

function headingSegments(heading: string): readonly string[] | undefined {
  const segments = heading.split('#');
  return segments.every((segment) => segment.trim() !== '')
    ? segments
    : undefined;
}

function resolveHeading(
  document: CapturedDocument,
  heading: string,
):
  | { readonly status: 'ok'; readonly span: SourceSpan }
  | { readonly status: 'unresolved' | 'ambiguous'; readonly message: string } {
  const segments = headingSegments(heading);
  if (segments === undefined) {
    return {
      status: 'unresolved',
      message: 'The registered heading selector is malformed.',
    };
  }
  document.parsed ??= parseObsidianDocument({
    path: document.path,
    source: document.source,
  });
  const matches = sectionMatches(document.parsed).filter(({ titleChain }) => {
    if (titleChain.length < segments.length) return false;
    const suffix = titleChain.slice(titleChain.length - segments.length);
    return suffix.every((title, index) => title === segments[index]);
  });
  if (matches.length === 0) {
    return {
      status: 'unresolved',
      message: `No exact heading section matches ${JSON.stringify(heading)} in ${document.path}.`,
    };
  }
  if (matches.length > 1) {
    return {
      status: 'ambiguous',
      message: `Multiple heading sections match ${JSON.stringify(heading)} in ${document.path}.`,
    };
  }
  return { status: 'ok', span: matches[0]!.span };
}

function sameLocator(
  left: TheorySourceReference,
  right: TheorySourceReference,
): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

/** Immutable, bounded source capture. It retains no absolute vault root. */
export class ArgumentSourceCapture {
  readonly provenance: ArgumentSourceIdentity;
  readonly provider: LinkedTheorySourceProvider;

  constructor(
    provenance: ArgumentSourceIdentity,
    documents: ReadonlyMap<string, CapturedDocument>,
    references: ReadonlyMap<string, TheorySourceReference>,
    unavailable: ReadonlyMap<string, LinkedTheorySourceProviderResult>,
  ) {
    this.provenance = Object.freeze({ ...provenance });
    this.provider = {
      sourceSpaceId: provenance.sourceSpaceId,
      read: async (request) => {
        const registered = references.get(request.sourceReferenceId);
        if (registered === undefined) {
          return failure(
            'denied',
            'This source-reference ID was not selected for the bounded capture.',
          );
        }
        if (!sameLocator(registered, request.locator)) {
          return failure(
            'denied',
            'The registered locator changed after this source capture was created.',
          );
        }
        const unavailableResult = unavailable.get(request.sourceReferenceId);
        if (unavailableResult !== undefined) return unavailableResult;
        if (request.locator.block !== undefined) {
          return failure(
            'unsupported',
            'Block source reads are unsupported because the current parser establishes only the marker span, not the complete owning block.',
          );
        }
        const document = documents.get(request.locator.path);
        if (document === undefined) {
          return failure(
            'source-missing',
            `The exact registered Markdown path ${JSON.stringify(request.locator.path)} is not present in this capture.`,
          );
        }
        if (
          request.requireExactVersion &&
          request.expectedSourceVersion !== document.sourceVersion
        ) {
          return failure(
            'version-unavailable',
            'The exact requested full-document version is not retained in this capture.',
          );
        }
        let span: SourceSpan;
        if (request.locator.heading !== undefined) {
          let resolved;
          try {
            resolved = resolveHeading(document, request.locator.heading);
          } catch (error: unknown) {
            return failure(
              'unsupported',
              `The captured Markdown could not be parsed safely: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
          if (resolved.status !== 'ok') {
            return failure(
              resolved.status === 'unresolved'
                ? 'heading-unresolved'
                : 'heading-ambiguous',
              resolved.message,
            );
          }
          span = resolved.span;
        } else {
          try {
            document.parsed ??= parseObsidianDocument({
              path: document.path,
              source: document.source,
            });
            span = document.parsed.structure.span;
          } catch (error: unknown) {
            return failure(
              'unsupported',
              `The captured Markdown could not be parsed safely: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
        const offsets = knownOffsets(span);
        const end = safeEnd(
          document.source,
          offsets.start,
          offsets.end,
          request.maxCharacters,
        );
        const complete = end === offsets.end;
        document.lineStarts ??= lineStarts(document.source);
        return {
          status: 'ok',
          sourceSpaceId: provenance.sourceSpaceId,
          location: {
            path: document.path,
            ...(request.locator.heading === undefined
              ? {}
              : { heading: request.locator.heading }),
            span: {
              start: span.start,
              end: positionAt(document.source, document.lineStarts, end),
            },
          },
          text: document.source.slice(offsets.start, end),
          sourceVersion: document.sourceVersion,
          complete,
          omissions: complete
            ? []
            : [
                `Source passage was clipped to ${request.maxCharacters} UTF-16 characters.`,
              ],
          observedAt: provenance.observedAt,
        };
      },
    };
  }
}

/** Application-owned authorization and committed-inventory capture boundary. */
export class ArgumentSourceAccessSession implements ArgumentSourceAccessHost {
  readonly #listeners = new Set<() => void>();
  readonly #inventoryIndexes = new WeakMap<
    VaultSourceInventory,
    ReadonlyMap<string, string>
  >();
  #generation = 0;
  #candidate: Candidate | undefined;
  #boundSessionId: string | undefined;
  #view: ArgumentSourceAccessView = {
    status: 'unavailable',
    generation: 0,
    message:
      'Source content unavailable. Open an authorized local vault to enable registered source reads.',
  };

  state = (): ArgumentSourceAccessView => this.#view;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  #publish(view: ArgumentSourceAccessView): void {
    this.#view = view;
    for (const listener of this.#listeners) listener();
  }

  #documentsByPath(
    inventory: VaultSourceInventory,
  ): ReadonlyMap<string, string> {
    const existing = this.#inventoryIndexes.get(inventory);
    if (existing !== undefined) return existing;
    const created = new Map(
      inventory.markdownDocuments.map((document) => [
        document.path,
        document.source,
      ]),
    );
    this.#inventoryIndexes.set(inventory, created);
    return created;
  }

  publishCommittedSource(input: ArgumentSourceCandidateInput): void {
    validIdentity(input.sourceSessionId, 'Source session ID');
    validIdentity(input.sourceSpaceId, 'Source-space ID');
    validIdentity(input.displayName, 'Source display name');
    if (
      !Number.isSafeInteger(input.runtimeRevision) ||
      input.runtimeRevision < 0
    )
      throw new Error(
        'Source runtime revision must be a non-negative integer.',
      );
    if (!Number.isFinite(Date.parse(input.observedAt)))
      throw new Error('Source observation time must be an ISO timestamp.');
    const previousSessionId = this.#candidate?.sourceSessionId;
    this.#generation += 1;
    const candidate: Candidate = {
      sourceSessionId: input.sourceSessionId,
      sourceSpaceId: input.sourceSpaceId,
      displayName: input.displayName,
      acquisition: input.acquisition,
      acquisitionState: input.acquisitionState,
      runtimeRevision: input.runtimeRevision,
      observedAt: input.observedAt,
      sourceGeneration: this.#generation,
      documentsByPath: this.#documentsByPath(input.inventory),
    };
    this.#candidate = candidate;
    if (previousSessionId !== input.sourceSessionId) {
      this.#boundSessionId = undefined;
    }
    this.#publish(
      safeView(
        this.#generation,
        candidate,
        this.#boundSessionId === candidate.sourceSessionId,
      ),
    );
  }

  reportOnly(
    message = 'Source content unavailable in report-only mode. Load an authorized local vault to read registered sources.',
  ): void {
    this.#generation += 1;
    this.#candidate = undefined;
    this.#boundSessionId = undefined;
    this.#publish({
      status: 'unavailable',
      generation: this.#generation,
      message,
    });
  }

  bindCurrent(expectedGeneration: number): ArgumentSourceBindResult {
    const candidate = this.#candidate;
    if (candidate === undefined) {
      return { status: 'unavailable', message: this.#view.message };
    }
    if (expectedGeneration !== this.#view.generation) {
      return {
        status: 'stale',
        message: 'The selected source changed before it could be bound.',
      };
    }
    this.#boundSessionId = candidate.sourceSessionId;
    const view = safeView(this.#generation, candidate, true);
    this.#publish(view);
    return {
      status: 'bound',
      source: view.source,
    };
  }

  disconnect(): void {
    const candidate = this.#candidate;
    this.#boundSessionId = undefined;
    if (candidate !== undefined) {
      this.#publish(safeView(this.#generation, candidate, false));
    }
  }

  capture(
    references: readonly TheorySourceReference[],
  ): ArgumentSourceCaptureResult {
    const candidate = this.#candidate;
    if (candidate === undefined) {
      return { status: 'unavailable', message: this.#view.message };
    }
    if (this.#boundSessionId !== candidate.sourceSessionId) {
      return {
        status: 'wrong-binding',
        message:
          'Confirm “Use selected vault for theory sources” before reading registered locators.',
      };
    }
    if (!ready(candidate)) {
      return {
        status: 'unavailable',
        message:
          'Fresh source content is unavailable while acquisition is not at a committed state.',
      };
    }
    const uniqueReferences = [
      ...new Map(
        references.map((reference) => [reference.id, reference]),
      ).values(),
    ];
    if (
      uniqueReferences.length >
      ARGUMENT_SOURCE_CAPTURE_LIMITS.selectedReferences
    ) {
      return {
        status: 'limit-exceeded',
        message: `A capture may select at most ${ARGUMENT_SOURCE_CAPTURE_LIMITS.selectedReferences} registered source references.`,
      };
    }
    const selected = new Map(
      uniqueReferences.map((reference) => [reference.id, reference]),
    );
    const documents = new Map<string, CapturedDocument>();
    const unavailable = new Map<string, LinkedTheorySourceProviderResult>();
    let capturedCharacters = 0;
    for (const reference of uniqueReferences) {
      if (!isNormalizedWorkspacePath(reference.path)) {
        unavailable.set(
          reference.id,
          failure(
            'denied',
            'The registered locator is not a safe normalized workspace-relative path.',
          ),
        );
        continue;
      }
      if (!reference.path.toLowerCase().endsWith('.md')) {
        unavailable.set(
          reference.id,
          failure(
            'unsupported',
            'Only captured Markdown documents can be read as theory sources.',
          ),
        );
        continue;
      }
      const source = candidate.documentsByPath.get(reference.path);
      if (source === undefined) {
        unavailable.set(
          reference.id,
          failure(
            'source-missing',
            `The exact registered Markdown path ${JSON.stringify(reference.path)} is absent from the authorized inventory.`,
          ),
        );
        continue;
      }
      if (source.length > ARGUMENT_SOURCE_CAPTURE_LIMITS.perFileCharacters) {
        unavailable.set(
          reference.id,
          failure(
            'denied',
            `The registered file exceeds the ${ARGUMENT_SOURCE_CAPTURE_LIMITS.perFileCharacters}-character capture limit.`,
          ),
        );
        continue;
      }
      if (!documents.has(reference.path)) {
        if (
          documents.size >= ARGUMENT_SOURCE_CAPTURE_LIMITS.capturedFiles ||
          capturedCharacters + source.length >
            ARGUMENT_SOURCE_CAPTURE_LIMITS.totalCapturedCharacters
        ) {
          unavailable.set(
            reference.id,
            failure(
              'denied',
              'The bounded source capture reached its file or total-character limit.',
            ),
          );
          continue;
        }
        documents.set(reference.path, {
          path: reference.path,
          source,
          sourceVersion: sourceVersion(source),
        });
        capturedCharacters += source.length;
      }
    }
    const source: ArgumentSourceIdentity = {
      sourceSessionId: candidate.sourceSessionId,
      sourceSpaceId: candidate.sourceSpaceId,
      displayName: candidate.displayName,
      acquisition: candidate.acquisition,
      acquisitionState: candidate.acquisitionState,
      runtimeRevision: candidate.runtimeRevision,
      sourceGeneration: candidate.sourceGeneration,
      observedAt: candidate.observedAt,
    };
    return {
      status: 'ok',
      capture: new ArgumentSourceCapture(
        source,
        documents,
        selected,
        unavailable,
      ),
    };
  }
}
