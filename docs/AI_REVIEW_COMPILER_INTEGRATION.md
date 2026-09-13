# AI Review / AI Compiler integration contract

## Status and ownership

`packages/ai-review` is a headless orchestration package. It owns immutable review inputs, stage execution/history, run-local evidence, result validation, and exports. It does not own the compiler's Topics, Axioms, Counter-Arguments, responses, statuses, indexes, or durable storage.

`packages/argument-workspace` now owns those records and exposes an immutable,
retained `KnowledgeReader`. A composition adapter still needs to present that
reader through `CompilerProvider.openSnapshot`. A run binds the returned
protocol version, snapshot ID, revision, and capabilities before a model
receives tools. Tool arguments cannot select another workspace, snapshot,
revision, root, or path.

```text
application source capture ──► Arguments previews / source-aware packets
             │
             └── future strict retained-source adapter ──► AI Review run
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
  read. A one-shot open is labeled captured rather than continuously live.
- `apps/web/src/features/arguments/source-capture.ts` is the current host
  authorization/capture entry point. After explicit “Use selected vault for
  theory sources” confirmation it copies only selected registered Markdown
  files into a bounded immutable `ArgumentSourceCapture`, whose provider
  implements the core `LinkedTheorySourceProvider`. Absolute roots, the
  desktop runtime, arbitrary paths, URLs, attachments, embeds, and unsupported
  block bodies do not cross this boundary.
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
- Review's `workspaceId` is an authorization/source-capture context. It is not
  the Argument Library's `libraryId`, and an adapter must not derive or replace
  one identity with the other.
- Review's string `snapshotId`/`revision` must losslessly identify the core
  descriptor (`libraryId`, schema version, library revision, and SHA-256 content
  fingerprint), or the host must retain an immutable mapping for the run. Never
  map revision alone and silently open the latest library.
- `listIndex`, `searchIndex`, and `readBundle` map directly to the reader's
  bounded operations. The adapter maps returned record IDs/revisions and keeps
  the core consultation receipt in the result artifact rather than flattening
  away snapshot or completeness evidence.
- Review's `readSource({sourceId})` maps `sourceId` only to the registered
  `sourceReferenceId`. Because Review's v1 tool input carries no source-version
  selector, a historically strict Review adapter should request an exact
  recorded version from `readLinkedTheorySource`. Unknown/unretained versions
  become unavailable/stale; newly fetched changed text must not be presented as
  retained historical content. A non-Review overlay may instead show current
  text with the core reader's explicit freshness result.
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
- Abort/cancellation, per-call byte limits, placement, model-visible shaping,
  and saving Review artifacts remain Review/adapter responsibilities. Live
  source acquisition remains the host's authorized source-provider
  responsibility.

This is an adapter-shape difference, not a competing knowledge model. No shared
domain type, agent stage, prompt, or review run ID should be added to Argument
Workspace to erase it.

## Integration checklist for the compiler task

1. Implement `CompilerProvider` against `KnowledgeReader` without importing
   Argument Workspace storage internals into Review.
2. Guarantee snapshot and linked-source retention for the session lifetime, or return an explicit stale/unavailable envelope.
3. Map compiler records to the minimal Markdown-rich envelope while retaining full Counter-Argument context and omissions.
4. Enforce workspace authorization outside tool arguments.
5. Recheck the managed Agents API/SDK version when implementing transport; no beta payload shape is prescribed here.
6. Add cross-package integration tests using synthetic/non-private records before enabling real user data.

The Soundness and Objectivity case remains compiler-owned. Review contains no special mathematical blacklist, truth rule, or private theory passage for that case.

## Future Review UI contract (not implemented)

Graph Explorer will own the overlay and source selection: 1–10 commits/files, prompt previews, Integrated/Negative/Positive/Compare tabs, full-width vertical comparison by default, optional horizontal comparison, distinct post-check output, retrieval evidence, and Markdown export. That work must not make review orchestration responsible for graph layout, camera, filters, selection, canvas lifecycle, or shared rendering styles.

The Arguments overlay's local read-only source previews and source-aware packets
are implemented independently of that future Review UI. There is still no
`CompilerProvider` adapter, stage choice, model/tool transport, Review run,
source-history archive, or theory write-back. A later Review adapter may reuse
the immutable capture/provider and packet evidence shapes, but it must add
strict retained-version/session mapping and its own cancellation and
model-visible limits without importing Argument Workspace authoring.
