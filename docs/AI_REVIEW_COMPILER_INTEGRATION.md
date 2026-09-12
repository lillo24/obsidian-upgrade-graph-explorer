# AI Review / AI Compiler integration contract

## Status and ownership

`packages/ai-review` is a headless orchestration package. It owns immutable review inputs, stage execution/history, run-local evidence, result validation, and exports. It does not own the compiler's Topics, Axioms, Counter-Arguments, responses, statuses, indexes, or durable storage.

The future AI Compiler owns those records and exposes a retained, read-only snapshot through `CompilerProvider.openSnapshot`. A run binds the returned protocol version, snapshot ID, revision, and capabilities before a model receives tools. Tool arguments cannot select another workspace, snapshot, revision, root, or path.

```text
application source capture ── exact text/diffs ──► AI Review run
                                                    │
AI Compiler store ── retained snapshot session ─────┤
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

## Integration checklist for the compiler task

1. Implement `CompilerProvider` against the compiler's real public API without importing compiler storage internals into Review.
2. Guarantee snapshot and linked-source retention for the session lifetime, or return an explicit stale/unavailable envelope.
3. Map compiler records to the minimal Markdown-rich envelope while retaining full Counter-Argument context and omissions.
4. Enforce workspace authorization outside tool arguments.
5. Recheck the managed Agents API/SDK version when implementing transport; no beta payload shape is prescribed here.
6. Add cross-package integration tests using synthetic/non-private records before enabling real user data.

The Soundness and Objectivity case remains compiler-owned. Review contains no special mathematical blacklist, truth rule, or private theory passage for that case.

## Future UI contract (not implemented)

Graph Explorer will own the overlay and source selection: 1–10 commits/files, prompt previews, Integrated/Negative/Positive/Compare tabs, full-width vertical comparison by default, optional horizontal comparison, distinct post-check output, retrieval evidence, and Markdown export. That work must not make review orchestration responsible for graph layout, camera, filters, selection, canvas lifecycle, or shared rendering styles.
