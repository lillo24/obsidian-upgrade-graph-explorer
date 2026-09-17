# Argument Workspace Core

This package owns the source-neutral, versioned Argument Library and its two
separate application surfaces: mutation-oriented authoring and immutable,
snapshot-bound reading. It does not extend the canonical Markdown graph and it
has no UI, renderer, vault, platform, agent, or model dependency.

## Folder map

- `types.ts` defines Topic, Axiom, Argument, Counter-Argument, source locator,
  persistence, snapshot, bundle, source-read, and receipt contracts.
- `validation.ts` strictly validates schema-v2 libraries and legacy-v1 migration
  input, portable relative locators, global record/source-reference identities,
  and relationship/dependency integrity.
- `canonical.ts` owns canonical JSON, browser/worker/Node-neutral SHA-256,
  content descriptors, cloning, and immutable snapshot capture.
- `library.ts` owns pure record creation/editing, membership, Current promotion,
  response, archive/review mutations, revision increments, Argument and
  stale-response detection, explicit reassessment, and confirmed full-file
  source-baseline recording.
- `storage.ts` serializes expected-snapshot commits and adopts data only after a
  store confirms persistence.
- `authoring.ts` exposes the mutation-only service over that repository.
- `serialization.ts` owns lossless schema-v2 JSON parsing/export, deterministic
  schema-v1 migration, non-mutating historical validation, import preview,
  collision checks, and merge preparation.
- `search.ts` builds one deterministic descriptive index per snapshot and owns
  snapshot/query-bound pagination cursors.
- `bundle.ts` assembles the bounded argumentative closure for Topic, Axiom,
  Argument, or Counter-Argument reads.
- `reader.ts` exposes the read-only facade, validates callable inputs, dispatches
  registered source reads, and creates consultation receipts.
- `markdown.ts` owns the canonical readable source-locator formatter and purely
  exports compact Obsidian-oriented Markdown files; it never writes a vault.
- `test-fixture.ts` is a neutral public structural fixture. Private theory data
  is deliberately absent from the package and tests.

## Schema and revisions

Schema v2 stores one library identity/revision and arrays of Topics, Axioms,
Arguments, and Counter-Arguments. Every record has a stable ID, independent
record revision, human review state, archive state, and timestamps. Topic
membership is by ID. An Argument has ordered stable-ID authored-text,
Axiom-reference, or prior-Argument-conclusion premises; optional reasoning; a
required conclusion; retrieval metadata; sources; and an optional predecessor.
Referenced premises retain the record revision relied upon. Topics may expose
one non-archived member as `currentArgumentId`; explicit promotion requires an
accepted Argument and records the prior Current as its predecessor without
deleting history. The pointer means Current, not true or proven.

Counter-Arguments retain observation text separately from the inference being
challenged, may target a Topic claim, Axiom, another Counter-Argument, or a
whole Argument/premise/reasoning/conclusion, and store their response in the
same record. A response has a multi-valued outcome, application explanation,
boundary/reopening text, and answering Axiom IDs plus the Axiom revisions used
for that assessment.

Human review state, Current status, recorded argumentative outcome, structural
staleness, and live source freshness are separate values. Editing a referenced
Axiom or Argument makes dependent premises stale; it does not change their
text, reasoning, conclusion, review state, or Current status.
`reassessArgumentPremises` is the only operation that advances referenced
premise revisions after explicit review. Self-reference, missing dependencies,
and Argument premise/supersession cycles are rejected.

Editing an answering Axiom also makes a dependent response stale; it does not
change the stored outcome.
`reassessCounterArgumentResponse` is the only operation that advances every
attached `reliedOnRevision` to the current Axiom revision while retaining the
recorded explanation and outcome. Reading, ordinary response edits, reopening,
and attachment of an already-attached Axiom do not imply reassessment.

Every semantic mutation advances the owning record and library revisions.
Reads and source observations do not. Explicit `recordTheorySourceVersion`
authoring stores only a compatible source-space hint and namespaced full-file
version metadata; it follows normal record revisions and never changes theory
text, human review, or a recorded outcome. A descriptor is
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

Valid schema-v1 JSON is accepted only through a strict deterministic migration:
record content/revisions/timestamps remain unchanged, each Topic receives an
empty `argumentIds`, the library receives an empty `arguments`, and no Current
pointer or theory content is invented. Browser data stays under its established
profile key and is rewritten as v2 only after a successful save. Desktop load
prefers `library-v2.json`; when only valid `library-v1.json` exists it atomically
writes v2 and retains the v1 file as a recoverable copy.

## Authoring and interchange

`ArgumentLibraryAuthoringService` supports all four record kinds, Topic
membership, explicit Current promotion, Argument-premise reassessment,
answering-Axiom attach/detach, response updates/reassessment, source-version
baseline recording, archive/restore, human review/reopen, and validated merge
imports. All calls take an expected snapshot descriptor and return an explicit
commit/conflict/failure. `pending-review` Arguments and Counter-Arguments are
proposal records; acceptance never promotes automatically.

JSON is the authoritative lossless interchange. Exact export/import reproduces
the descriptor. Historical JSON may be validated and opened in an isolated
reader without mutating the editable store. Import preview distinguishes exact
idempotence, merge/replace readiness, and same-ID/different-content conflicts.
Merges keep the local lineage and advance its revision.

Markdown export returns `{path, text}[]`. It writes one file per reusable record
under `topics/`, `axioms/`, `arguments/`, or `counter-arguments/`; Topic,
premise, and response files link to reusable records instead of duplicating
their bodies. Frontmatter keeps
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
Argument premises/reasoning/conclusions, aliases, keywords, and phrases. It
preserves authored text and useful numeric
and operator tokens. Search candidates report score and matched fields, never a
new verdict.

Bundle closure is deliberately bounded. A Topic includes its direct Axioms and
Counter-Arguments plus only its Current Argument and that Argument's premise
dependencies; it does not expand every historical member. An Argument includes
resolved premise identities, staleness, Topic/Current memberships,
predecessor/successor context, and directly targeting Counter-Arguments with
their complete responses. A Counter-Argument includes memberships, structured
target chain, response, and answering Axioms. An Axiom includes memberships and
directly targeting/answering objections with their responses and answering
Axioms. Membership context does not recursively expand every sibling of a
shared record. Traversal is deterministic, deduplicated, cycle-safe, and
bounded. Archive/review/stale warnings are disclosed. A
record/depth limit that would split required context returns `limit-exceeded`
with omissions rather than a success-shaped partial bundle. `theorySources:
not-read` distinguishes library completeness from live source acquisition.

Every successful index/bundle/source response has a contract-v2 receipt with
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

The web application hosts the local Arguments overlay, explicit live-vault
binding, immutable bounded source capture, plain-text previews, and
source-aware packets as outer consumers. It reuses the application's existing
vault acquisition/live controller; the core remains UI- and watcher-free. AI
Review orchestration, model consent/tool registration, durable review runs,
source history, and Markdown write-back remain outer/later responsibilities.
Any AI Review stage or standalone verifier may wrap the same plain callable
facade; this package has no role or stage concept.
