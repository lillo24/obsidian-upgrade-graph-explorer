# Argument Workspace Core

This package owns the source-neutral, versioned Argument Library and its two
separate application surfaces: mutation-oriented authoring and immutable,
snapshot-bound reading. It does not extend the canonical Markdown graph and it
has no UI, renderer, vault, platform, agent, or model dependency.

## Folder map

- `types.ts` defines Topic, Axiom, Counter-Argument, source locator, persistence,
  snapshot, bundle, source-read, and receipt contracts.
- `validation.ts` strictly validates schema-v1 libraries, portable relative
  locators, global record/source-reference identities, and relationship
  integrity.
- `canonical.ts` owns canonical JSON, browser/worker/Node-neutral SHA-256,
  content descriptors, cloning, and immutable snapshot capture.
- `library.ts` owns pure record creation/editing, membership, response,
  archive/review mutations, revision increments, and stale-response detection.
- `storage.ts` serializes expected-snapshot commits and adopts data only after a
  store confirms persistence.
- `authoring.ts` exposes the mutation-only service over that repository.
- `serialization.ts` owns lossless JSON parsing/export, non-mutating historical
  validation, import preview, collision checks, and merge preparation.
- `search.ts` builds one deterministic descriptive index per snapshot and owns
  snapshot/query-bound pagination cursors.
- `bundle.ts` assembles the bounded argumentative closure for Topic, Axiom, or
  Counter-Argument reads.
- `reader.ts` exposes the read-only facade, validates callable inputs, dispatches
  registered source reads, and creates consultation receipts.
- `markdown.ts` purely exports compact Obsidian-oriented Markdown files; it never
  writes a vault.
- `test-fixture.ts` is a neutral public structural fixture. Private theory data
  is deliberately absent from the package and tests.

## Schema and revisions

Schema v1 stores one library identity/revision and arrays of Topics, Axioms, and
Counter-Arguments. Every record has a stable ID, independent record revision,
human review state, archive state, and timestamps. Topic membership is by ID.
Counter-Arguments retain observation text separately from the inference being
challenged, may target a Topic claim, Axiom, or another Counter-Argument, and
store their response in the same record. A response has a multi-valued outcome,
application explanation, boundary/reopening text, and answering Axiom IDs plus
the Axiom revisions used for that assessment.

Human review state, recorded argumentative outcome, response staleness, and
live source freshness are separate values. Editing an answering Axiom makes a
dependent response stale; it does not change the stored outcome.

Every semantic mutation advances the owning record and library revisions.
Reads and source observations do not. A descriptor is
`libraryId + schemaVersion + libraryRevision + contentFingerprint`. The
fingerprint is lowercase SHA-256 over `canonical-json-v1`: object keys sort
lexically, arrays retain their authored/semantic order, strings are unchanged,
and no descriptor, index, read timestamp, or transient source observation is
embedded in the library.

## Persistence and initialization

`ArgumentLibraryStore` is the only storage port. Its load result distinguishes
missing, loaded, corrupt, future-schema, and unreadable state and may preserve
the original serialized value for recovery. Saves require either `missing` or
the exact confirmed descriptor. `ArgumentLibraryRepository` serializes commits,
checks the expected snapshot again, writes before adoption, and leaves its last
confirmed snapshot unchanged after failure.

Initialization is explicit and succeeds only for a missing store. A supplied
seed must already validate through the ordinary schema. An initialized empty or
reset library is persisted as a real library, so reopening never interprets it
as missing and never reseeds it. Reset creates a new library lineage.

Browser storage lives in `apps/web/src/persistence/argument-library.ts` under
one profile-level key, not a graph workspace key. It is intended for prose-sized
records; browser quota is implementation-dependent and quota failures are
returned explicitly without adopting the candidate. Desktop storage lives in
`@icarus-graph-explorer/argument-workspace-tauri` as dedicated app-local JSON
with validated temporary-sibling replacement. Neither adapter stores data in a
vault, graph view state, or workspace identity catalog.

## Authoring and interchange

`ArgumentLibraryAuthoringService` supports Topic/Axiom/Counter-Argument
create/edit, Topic membership, answering-Axiom attach/detach, response updates,
archive/restore, human review/reopen, and validated merge imports. All calls take
an expected snapshot descriptor and return an explicit commit/conflict/failure.

JSON is the authoritative lossless interchange. Exact export/import reproduces
the descriptor. Historical JSON may be validated and opened in an isolated
reader without mutating the editable store. Import preview distinguishes exact
idempotence, merge/replace readiness, and same-ID/different-content conflicts.
Merges keep the local lineage and advance its revision.

Markdown export returns `{path, text}[]`. It writes one file per reusable record
under `topics/`, `axioms/`, or `counter-arguments/`; Topic and response files
link to the single Axiom file instead of duplicating its body. Frontmatter keeps
stable IDs/revisions/review/archive/outcome data, and registered original
wikilinks are preserved. Filenames exclude portable filesystem-reserved
characters and Windows reserved basenames. Importing Markdown and writing these
files to a vault are intentionally out of scope.

## Snapshot reader

`createKnowledgeReader(snapshot, options)` copies and freezes validated content,
verifies its descriptor, builds one index, and returns only:

```ts
listIndex(input?: ListIndexRequest): SnapshotBoundResult<IndexPage>
searchIndex(input: SearchIndexRequest): SnapshotBoundResult<IndexPage>
readArgumentBundle(input: ReadArgumentBundleRequest): ReadArgumentBundleResult
readLinkedTheorySource(input: LinkedTheorySourceReadRequest): Promise<ReadLinkedTheorySourceResult>
exportRetainedSnapshot(): string
```

Readers never follow later authoring changes. A requested descriptor must match
or returns `snapshot-mismatch`; cursors also bind snapshot, normalized query,
archive policy, and offset. Search is deterministic lexical retrieval over
titles, summaries, statements, challenged claims, observations, response text,
aliases, keywords, and phrases. It preserves authored text and useful numeric
and operator tokens. Search candidates report score and matched fields, never a
new verdict.

Bundle closure is deliberately bounded. A Topic includes its direct members and
each included objection's full response/answering Axioms. A Counter-Argument
includes memberships, structured target chain, response, and answering Axioms.
An Axiom includes memberships and directly targeting/answering objections with
their responses and answering Axioms. Membership context does not recursively
expand every sibling of a shared Axiom. Counter-Argument target traversal is
deduplicated and cycle-safe. Archive/review/stale warnings are disclosed. A
record/depth limit that would split required context returns `limit-exceeded`
with omissions rather than a success-shaped partial bundle. `theorySources:
not-read` distinguishes library completeness from live source acquisition.

Every successful index/bundle/source response has a contract-v1 receipt with
the normalized request, exact snapshot, returned record identities/revisions,
source observations when present, completeness/omissions/warnings, and a
SHA-256 payload fingerprint computed without the receipt. The retained snapshot
and actual payload—not their hashes—are what make later reproduction possible.

## Linked sources and downstream composition

The callable source input accepts only a registered source-reference ID,
expected version, and bounded options. The reader resolves the stored portable
locator internally and passes it to an injected `LinkedTheorySourceProvider`
bound by the host to an authorized source space. No provider returns
`provider-unavailable`; missing, unresolved, ambiguous, denied, wrong-binding,
unsupported, provider-error, version-unavailable, and version-mismatch remain
distinct. Success returns exact text, resolved relative location/span, actual
version, excerpt completeness, observation time, content fingerprint, and
freshness against recorded metadata. Source changes never update library
records or outcomes.

Live vault binding, source previews/watchers, AI Review orchestration, model
consent/tool registration, durable review runs, the Arguments overlay, and
Markdown write-back remain outer/later responsibilities. Any AI Review stage or
standalone verifier may wrap the same plain callable facade; this package has no
role or stage concept.
