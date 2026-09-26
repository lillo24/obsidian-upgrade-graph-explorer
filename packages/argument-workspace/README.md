# Argument Workspace Core

This package owns the source-neutral, versioned Argument Library and its two
separate application surfaces: mutation-oriented authoring and immutable,
snapshot-bound reading. It does not extend the canonical Markdown graph and it
has no UI, renderer, vault, platform, agent, or model dependency.

## Folder map

- `types.ts` defines Topic, Context, Axiom, Argument, Counter-Argument, Proposal, source locator,
  persistence, snapshot, bundle, source-read, and receipt contracts.
- `validation.ts` strictly validates schema-v7 libraries and legacy-v1/v2/v3/v4/v5/v6 migration
  input, portable relative locators, global record/source-reference identities,
  and relationship/dependency integrity.
- `canonical.ts` owns canonical JSON, browser/worker/Node-neutral SHA-256,
  content descriptors, cloning, and immutable snapshot capture.
- `library.ts` owns pure record creation/editing, membership, Current promotion,
  response, archive/review mutations, revision increments, memoized direct and
  transitive Argument dependency staleness, stale-response detection, explicit
  reassessment, and confirmed full-file source-baseline recording.
- `contexts.ts` resolves the single-parent Context chain, deterministic
  effective-Axiom union, and per-Argument background provenance without
  entering the inference dependency graph.
- `proposals.ts` validates and appends non-canonical AI proposals and owns the
  atomic human accept/reject transformations into canonical history.
- `storage.ts` serializes expected-snapshot commits and adopts data only after a
  store confirms persistence.
- `authoring.ts` exposes the mutation-only human service and the narrower
  proposal-submission-only service over that repository.
- `serialization.ts` owns lossless schema-v7 JSON parsing/export, deterministic
  schema-v1/v2/v3/v4/v5/v6 migration, non-mutating historical validation, import preview,
  collision checks, and merge preparation.
- `insert.ts` owns strict `argument-workspace-insert-v1` parsing, whole-payload
  reference and promotion resolution, revision-pin normalization, non-mutating
  preview, and construction of one snapshot-bound additive candidate.
- `search.ts` builds one deterministic descriptive index per snapshot and owns
  snapshot/query-bound pagination cursors.
- `bundle.ts` assembles the bounded argumentative and background closure for
  Topic, Context, Axiom, Argument, or Counter-Argument reads.
- `reader.ts` exposes the read-only facade, validates callable inputs, dispatches
  registered source reads, and creates consultation receipts.
- `markdown.ts` owns the canonical readable source-locator formatter and purely
  exports compact Obsidian-oriented Markdown files; it never writes a vault.
- `test-fixture.ts` is a neutral public structural fixture. Private theory data
  is deliberately absent from the package and tests.

## Schema and revisions

Schema v7 stores one library identity/revision; canonical arrays of Topics,
Contexts, Axioms, Arguments, and Counter-Arguments; and a separate `proposals`
Mailbox. Every canonical record has a stable ID, independent
record revision, human review state, archive state, and timestamps. Topic
membership is by ID. An Argument has scoped stable-ID Examples; ordered
stable-ID authored-text, Axiom-reference, prior-Argument-conclusion, or
prior-Argument-premise dependencies; optional reasoning; a required
conclusion; optional Boundary/Invariance prose; explicit attack/support
relations; retrieval metadata; sources; and an optional predecessor. Premises
may identify the local Examples that ground them. Referenced premises and
relations retain the target Argument revision relied upon. Topics may expose
one non-archived member as `currentArgumentId`; explicit promotion requires an
accepted Argument and records the prior Current as its predecessor without
deleting history. The pointer means Current, not true or proven.

A Context is an ordered Axiom group with its own title, optional description,
retrieval metadata, and at most one parent Context. Effective Axioms are the
root-to-parent inherited sequence followed by direct Axioms, de-duplicated by
first occurrence. Descriptive metadata is not inherited. Missing parents,
self-parenting, and parent cycles are invalid. Arguments attach Contexts by
stable `contextIds`; they do not pin a Context revision. Context Axioms are
background only: they are not premises, do not participate in Argument
dependency-cycle validation, and do not affect premise staleness or explicit
premise revision pins.

Counter-Arguments retain observation text separately from the inference being
challenged, may target a Topic claim, Axiom, another Counter-Argument, or a
whole Argument/premise/reasoning/conclusion, and store their response in the
same record. A response has a multi-valued outcome, application explanation,
boundary/reopening text, and answering Axiom IDs plus the Axiom revisions used
for that assessment.

Mailbox Proposals are append-only AI suggestions, not framework knowledge and
not a sixth canonical record kind. A pending Proposal distinguishes review
intent (`new`, `attack`, `support`, `refine`, `extend`, `add-boundary`, or
`supersede`), an exact optional Argument/part/revision target, typed text/Axiom/
Argument dependencies, optional ordered reasoning steps, and drafting source
observations. Source observations retain repository/file/version provenance but
are never inference premises implicitly. The Proposal also stores why it may be
novel or unresolved and the exact library descriptor plus record revisions
consulted. Submission requires that consultation snapshot and every structured
dependency revision still match. Exact retries are idempotent; payloads and
lists are bounded. A Proposal may also carry bounded `softExplanationMarkdown`
for human review. It remains only in Proposal history and is never parsed or
copied into canonical premises, reasoning, sources, conclusions, relations, or
records during acceptance or rejection. Proposals are excluded from canonical search, bundles,
Markdown export, Topic membership, Current, and canonical create/edit APIs.

Only a human resolution can change Proposal status. Acceptance atomically
creates an accepted canonical Argument and records the resulting ID; rejection
atomically creates an accepted canonical Counter-Argument/Audit with a
non-`unanswered` response outcome and records that ID. Attack, supersession,
Topic membership, and Current promotion remain separate explicit choices.
Cancelling or failing either transaction leaves the Proposal pending.

Attack/support and supersession are independent: neither creates, implies, or
promotes the other. Relation cycles are allowed as debate structure and are
not included in inference-cycle validation.

Human review state, Current status, recorded argumentative outcome, structural
staleness, and live source freshness are separate values. Direct premise
staleness records a referenced Axiom or Argument revision mismatch. Inherited
premise staleness follows only the acyclic inference graph: a reused conclusion
inherits any stale source premise, while a reused specific premise inherits only
that premise's staleness. Structured causes retain every dependency path and
root revision mismatch. Attack/support relations, supersession, membership,
Current, review, and archive state do not propagate into inference staleness;
relation revision staleness remains a separate diagnostic.

Staleness evaluation is derived and never edits Arguments. Editing a referenced
Axiom or Argument does not change dependent text, reasoning, conclusion, review
state, or Current status. `reassessArgumentPremises` rejects an Argument while
any inherited premise staleness remains, so review proceeds explicitly from
upstream support to downstream conclusions. `reassessArgumentPremises` and
`reassessArgumentRelations` are the only operations that advance their
respective relied-on revisions after explicit review. Self-reference, dangling
local Example links, missing source premises, and Argument premise/supersession
cycles are rejected. Removing a referenced Example is rejected instead of
leaving a dangling ID.

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

Valid schema-v1 through schema-v6 JSON are accepted only through strict
deterministic migrations:
record content/revisions/timestamps remain unchanged, each Topic receives an
empty `argumentIds`, the library receives an empty `arguments`, and no Current
pointer or theory content is invented. V2 Arguments receive empty `examples`
and `relations`; premises and every existing ID, revision, timestamp, review
state, membership, Current pointer, and supersession link remain unchanged.
No Example provenance or Counter-Argument conversion is inferred. V3 receives
an empty `contexts` collection and each Argument receives empty `contextIds`;
no grouping or attachment is inferred. Browser data stays under its established
profile key and is rewritten as v7 only after a successful save. V4 receives
only an empty `proposals` array; no candidate content or decision is inferred.
V5 Proposals migrate deterministically: legacy premise hints become text
premises, explicit suggested Axiom IDs become revision-pinned Axiom premises,
and no reference is inferred from prose. Targeted legacy Proposals use the
explicit `unspecified` intent so migration never invents an attack. Desktop load
prefers `library-v7.json`, then migrates a valid v6, v5, v4, v3, v2, or v1 file
atomically while retaining the source file as a recoverable copy.
V6 Proposals remain semantically unchanged and receive no generated Soft
Explanation; the optional field is simply absent.

## Authoring and interchange

`ArgumentLibraryAuthoringService` supports all five canonical record kinds, Topic
membership, explicit Current promotion, Example and relation mutations,
Context parent/direct-Axiom authoring and Argument Context attachment,
Argument premise/relation reassessment,
answering-Axiom attach/detach, response updates/reassessment, source-version
baseline recording, archive/restore, human review/reopen, and validated merge
imports, and human Proposal resolution. All calls take an expected snapshot
descriptor and return an explicit commit/conflict/failure.
`ArgumentProposalSubmissionService` exposes only bounded Proposal submission;
it cannot create or modify canonical records. Canonical `pending-review`
Arguments and Counter-Arguments remain ordinary human-authored records and are
distinct from Mailbox Proposals. Acceptance never promotes automatically unless
the human resolution explicitly requests promotion.

Canonical authoring stores the proposition being evaluated directly (for
example, `X is Y`). Revisability is represented structurally by human review,
supersession, audit history, and explicit Current selection; authoring does not
mechanically hedge every claim or add a truth/confidence field.

JSON is the authoritative lossless interchange. Exact export/import reproduces
the descriptor. Historical JSON may be validated and opened in an isolated
reader without mutating the editable store. Import preview distinguishes exact
idempotence, merge/replace readiness, and same-ID/different-content conflicts.
Merges keep the local lineage and advance its revision.

Insert JSON is a separate additive authoring format rather than a partial
library snapshot. Its preview assigns canonical timestamps/revisions, resolves
omitted reference pins against the final in-memory candidate, validates all
same-payload and existing-record references together, and returns that complete
candidate for one expected-snapshot repository commit. See
[`docs/ARGUMENT_WORKSPACE_INSERT_JSON.md`](../../docs/ARGUMENT_WORKSPACE_INSERT_JSON.md).

Markdown export returns `{path, text}[]`. It writes one file per reusable record
under `topics/`, `contexts/`, `axioms/`, `arguments/`, or `counter-arguments/`;
Topic, Context, premise, and response files link to reusable records instead of duplicating
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
Argument Examples/premises/reasoning/conclusions/Boundary text and relation
targets, and Context title/description/retrieval metadata. Context member-Axiom
prose is deliberately not flattened into the Context index. It
preserves authored text and useful numeric
and operator tokens. Search candidates report score and matched fields, never a
new verdict. Proposal prose is deliberately absent from the reader index and
bundle closure.

Bundle closure is deliberately bounded. A Topic includes its direct Axioms and
Counter-Arguments plus only its Current Argument and that Argument's premise
dependencies; it does not expand every historical member. An Argument includes
resolved premise identities and source-premise provenance, Examples, outgoing
relations and direct targets, direct/inherited premise cause paths, separate
relation staleness, Topic/Current
memberships, predecessor/successor context, and directly targeting
Counter-Arguments with their complete responses, plus attached Context chains,
effective background Axioms, and `viaContextIds` provenance. A direct Context
read includes the selected Context, ancestors, and direct/inherited/effective
Axioms but never reverse-expands every attaching Argument. Relation targets are included
directly but their debate networks are not recursively expanded. A
Counter-Argument includes memberships, structured
target chain, response, and answering Axioms. An Axiom includes memberships and
directly targeting/answering objections with their responses and answering
Axioms. Membership context does not recursively expand every sibling of a
shared record. Traversal is deterministic, deduplicated, cycle-safe, and
bounded. Archive/review/stale warnings are disclosed. A
record/depth limit that would split required context returns `limit-exceeded`
with omissions rather than a success-shaped partial bundle. `theorySources:
not-read` distinguishes library completeness from live source acquisition.

Every successful index/bundle/source response has a contract-v5 receipt with
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
