# AI Review / AI Compiler integration contract

## Status and ownership

`packages/ai-review` is a headless orchestration package. It owns immutable review inputs, stage execution/history, run-local evidence, result validation, and exports. It does not own the compiler's Topics, Contexts, Axioms, Arguments, Counter-Arguments, responses, statuses, indexes, or durable storage.

`packages/argument-workspace` owns those records and exposes an immutable,
retained `KnowledgeReader`. The application composition adapter in
`apps/web/src/features/ai-review/argument-compiler-adapter.ts` presents that
reader through `CompilerProvider.openSnapshot`. A run binds the returned
protocol version, snapshot ID, revision, and capabilities before a model
receives tools. Tool arguments cannot select another workspace, snapshot,
revision, root, or path.

```text
application source capture ──► Arguments previews / source-aware packets
             │
             └── strict retained-source adapter ─────────► AI Review run
                                                            │
AI Compiler store ── retained snapshot session ─────────────┤
                                                            ▼
                                  Negative ║ Positive → Integrator → optional post-check
```

Review access is configurable at three fixed placements: both analysis branches, Integrator, and separate post-check. The default is none. When analysis access is on, both branches get the same bound snapshot/capabilities/budgets but separate execution contexts and tool histories. One branch's discoveries are never inserted into the other branch.

## Version 1 session

The public TypeScript contracts live in [`../packages/ai-review/src/types.ts`](../packages/ai-review/src/types.ts). A provider opens an immutable `CompilerSnapshotSession` with:

| Method        | Responsibility                                                                |
| ------------- | ----------------------------------------------------------------------------- |
| `listIndex`   | Return a bounded page of descriptive records and stable IDs.                  |
| `searchIndex` | Return bounded relevant descriptions, never a logical verdict.                |
| `readBundle`  | Return a selected record with its retained argument context and completeness. |
| `readSource`  | Return an authorized linked passage at the retained snapshot revision.        |

A Counter-Argument bundle can be complete only when it retains the objection/example, challenged claim, answering Axioms, recorded response and why it applies, current outcome, scope/boundaries, source-heading links, and explicit missing/dependent material. An incomplete provider response must say `completeness: "incomplete"` and list omissions.

Every envelope carries protocol/snapshot/revision identity, canonical references, completeness, freshness, and a distinct status. `ok` with an empty index result is different from `not-found`, `source-unavailable`, `stale-snapshot`, `unauthorized`, `limit-exceeded`, `cancelled`, or `unavailable`. If a linked source revision is not retained, the provider must return stale/unavailable instead of reading a newer live file.

## Application-owned tool transport

Cloud adapters should expose the four tool definitions from `COMPILER_TOOL_DEFINITIONS`, send normalized provider events to `ReviewEngine`, execute calls through `CompilerToolDispatcher`, and return its envelope to the same provider execution. The adapter may retain a provider session/resumption handle as metadata, but Review does not assume a provider-specific conversation chain.

The dispatcher enforces exact input shapes, available capabilities, per-attempt call/result limits, cancellation, and idempotent delivery by tool-call ID. Conflicting reuse returns an explicit error. Unknown tools and all writes are rejected. Review records arguments/results as run-local artifacts and records canonical IDs/revisions on the attempt; it does not copy them into an editable compiler library or claim that model-reported assessment is verified proof.

Repository/source/model/tool content remains untrusted evidence. It cannot enable compiler access, change placement, add stages, rewrite the source, accept an argument, or edit an Axiom.

## Argument Workspace adapter fit

The two packages deliberately do not import each other. Their current public
contracts require a small application-owned translation:

- `apps/web/src/App.tsx` now publishes only matching committed desktop
  inventories to `ArgumentSourceAccessSession`. A new vault/report source
  session invalidates the Arguments binding; live `catching-up`, `updating`,
  `resyncing`, `paused`, or dirty acquisition states cannot claim a fresh disk
  read. A one-shot open is labeled captured rather than continuously live. App
  also owns and opens one `ArgumentWorkspaceSession`, creates one
  `CompilerProvider`, passes that session into the modal, and supplies the
  provider to the default Review controller. The modal owns neither service.
- `apps/web/src/features/arguments/source-capture.ts` is the current host
  authorization/capture entry point. After explicit “Use selected vault for
  theory sources” confirmation it copies only selected registered Markdown
  files into a bounded immutable `ArgumentSourceCapture`, whose provider
  implements the core `LinkedTheorySourceProvider`. Absolute roots, the
  desktop runtime, arbitrary paths, URLs, attachments, embeds, and unsupported
  block bodies do not cross this boundary. `selectionLimitStatus` reports when
  otherwise selectable references were omitted by per-file, file-count, or
  total-character limits.
- `source-packet.ts` is the current source-aware export entry point. It retains
  the original core `ArgumentBundle` and receipt unchanged, pins one source
  capture, includes successful exact payloads and source consultation receipts,
  records explicit failures/gaps, deduplicates equal
  source-space/location/version/extent/text payloads while preserving origins,
  and adds a version-1 outer fingerprint over every envelope field except the
  fingerprint field itself. The structured export contains the actual argument
  and source payloads.

- `CompilerProvider.openSnapshot` captures the application's current confirmed
  `ArgumentLibrarySnapshot` and constructs one `KnowledgeReader`; it must not
  initialize, seed, repair, or expose `ArgumentLibraryRepository` or
  `ArgumentLibraryAuthoringService`.
- With no requested ID, opening uses the current confirmed snapshot. With a
  requested ID, it uses only an exact current snapshot or an immutable snapshot
  already retained by that provider instance. Missing history returns
  `stale-snapshot`; there is no persistent archive and no latest-snapshot
  fallback. Opened sessions pin both reader and optional source capture.
- Review's `workspaceId` is an authorization/source-capture context. It is not
  the Argument Library's `libraryId`, and an adapter must not derive or replace
  one identity with the other.
- Review's `snapshotId` starts with `argument-library-snapshot-v4:` and appends
  the canonical core descriptor JSON encoded as lowercase hexadecimal UTF-16
  code units. It therefore losslessly contains `libraryId`, schema version,
  library revision, fingerprint algorithm, and SHA-256 content fingerprint.
  Review's `revision` repeats the decimal library revision. Decoding validates
  the exact field set, values, canonical re-encoding, and matching revision;
  malformed requested IDs are `invalid-request`. Neither field contains a
  filesystem root.
- `listIndex`, `searchIndex`, and `readBundle` map directly to the reader's
  bounded operations. The adapter maps returned record IDs/revisions and keeps
  the core consultation receipt in the result artifact rather than flattening
  away snapshot or completeness evidence.
- List and search content retains record kind, ID, title, record revision,
  Topic memberships, score, matched fields, cursor, core snapshot, and receipt.
  The optional Review v1 search `filter` is rejected as `invalid-request`
  because the core reader has no exact filter contract. Bundle content keeps
  the complete structured bounded closure plus the existing readable Markdown
  rendering; the adapter does not derive a verdict.
- Review's `readSource({sourceId})` maps `sourceId` only to the registered
  `sourceReferenceId`. Because Review's v1 tool input carries no source-version
  selector, the Review adapter requests an exact
  recorded version from `readLinkedTheorySource`. Unknown/unretained versions
  become unavailable/stale; newly fetched changed text must not be presented as
  retained historical content. A non-Review overlay may instead show current
  text with the core reader's explicit freshness result.
- `read-source` is advertised only when an already-bound source access matches
  Review's `workspaceId` and can capture the complete registered reference set.
  The adapter never calls `bindCurrent`. A missing source does not disable the
  library-only capabilities. A limit-incomplete capture disables `read-source`
  entirely rather than exposing a convenient subset.
- Captured document versions are
  `icarus-full-document-sha256-canonical-json-v1:<digest>`, computed from the
  exact complete source string with the core canonical fingerprint algorithm.
  They are full-file identities, not Git commits; an unrelated edit in the same
  file therefore reports changed. The core continues to fingerprint the exact
  returned text separately with `fingerprintScope: "returned-excerpt"`.
- The current web limits are 24 selected references, 16 captured Markdown
  files, 1,000,000 UTF-16 characters per file, 4,000,000 captured characters,
  and four concurrent reads. Source-aware packets request at most 64,000
  characters per passage and 256,000 source characters in total. Incomplete
  reads and unavailable/ambiguous/denied/version failures remain explicit and
  never erase the complete argumentative exchange.
- `recordTheorySourceVersion` plus
  `ArgumentWorkspaceSession.recordSourceVersion` is a separate, confirmed
  expected-snapshot authoring transaction. It stores portable source-space and
  full-file version metadata only. Ordinary reads/refreshes/exports are
  read-only; no source body, verdict, review state, reassessment, or theory file
  is changed.
- Contexts are returned as read-only `context` records. Context bundles expose
  parent chains and direct/inherited/effective Axioms; Argument bundles keep
  attached Contexts and effective background Axioms explicitly separate from
  `resolvedPremises`. Context membership is background availability, does not
  pin a Context revision, and is never mapped into Review as an inference
  dependency or staleness cause.
- Argument Examples, premise provenance/reuse, attack/support relations,
  supersession, Boundary/Invariance, and Current remain canonical library data
  behind the existing authoring boundary. Review may read them through the
  bounded bundle but cannot mutate them directly. Compiler guidance should
  store the proposition being evaluated directly (`X is Y`) rather than
  mechanically hedging every sentence; revisability remains structural through
  review, supersession, audit history, and explicit Current selection.
- Abort/cancellation, per-call byte limits, placement, model-visible shaping,
  and saving Review artifacts remain Review/adapter responsibilities. Live
  source acquisition remains the host's authorized source-provider
  responsibility.

## Adapter envelopes and failure mapping

Every successful index, bundle, and source result retains the core
`ConsultationReceipt` in `content`. Review references are derived from the
receipt's returned record IDs and numeric record revisions. Successful source
reads additionally reference the stable source-reference ID at the exact
full-document source version and carry its portable heading when present; an
observation timestamp is never used as a revision.

Core success maps to `ok`; record absence to `not-found`; snapshot mismatch to
`stale-snapshot`; malformed input and ambiguous record IDs to
`invalid-request`; bundle/capture limits to `limit-exceeded`; denied or wrong
bindings to `unauthorized`; and missing sources, missing/mismatched versions,
unresolved/ambiguous headings, and unsupported locators to
`source-unavailable`. Unexpected provider failures map to `unavailable`.
Cancellation is checked before each operation and again before returning a
mapped result, including after the awaited source read. Source passages request
the core's documented 100,000-character maximum; any clipping remains explicit
through `incomplete` plus omissions, while REVIEW1's dispatcher still enforces
the model-visible byte budget.

This is an adapter-shape difference, not a competing knowledge model. No shared
domain type, agent stage, prompt, or review run ID should be added to Argument
Workspace to erase it.

## Implemented integration boundary

The adapter is headless and stage-agnostic. Cross-boundary tests exercise the
real adapter through `ReviewEngine` with compiler access at analyses only,
Integrator only, and post-check only, including separate Negative and Positive
tool histories. No Agent/model transport is introduced here.

The Soundness and Objectivity case remains compiler-owned. Review contains no special mathematical blacklist, truth rule, or private theory passage for that case.

## Future Review UI contract (not implemented)

Graph Explorer will own the overlay and source selection: 1–10 commits/files, prompt previews, Integrated/Negative/Positive/Compare tabs, full-width vertical comparison by default, optional horizontal comparison, distinct post-check output, retrieval evidence, and Markdown export. That work must not make review orchestration responsible for graph layout, camera, filters, selection, canvas lifecycle, or shared rendering styles.

The Arguments overlay's local read-only source previews and source-aware packets
remain independent of that future Review UI. The compiler adapter adds no stage
choice, Agent/model transport, Review UI, source-history archive, or theory
write-back. Managed provider SDK integration remains deferred and must be
checked against the version resolved when that separate transport is built.
