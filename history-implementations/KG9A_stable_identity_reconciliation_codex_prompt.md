# KG9A — Stable Identity Reconciliation + Private Identity Catalog

**Task type:** durable identity foundation / source-neutral reconciliation / local private state

## Why KG9 is split

The roadmap milestone “KG9 — Persistence + stable identity” contains two materially different responsibilities:

1. **KG9A — stable identity**: make canonical entity/reference IDs survive normal source edits and renames conservatively.
2. **KG9B — persisted explorer view state**: persist disclosure/filter/focus/viewport state against those stable IDs.

Do **not** implement both in one change. Stable identity must exist first; otherwise persisted disclosure/navigation state would be keyed to IDs that KG4 explicitly says are transient.

KG9A should finish the identity foundation and leave the roadmap milestone **in progress**, with KG9B as the next sub-gate.

---

# Goal

Implement app-owned stable identity for canonical snapshots without polluting Markdown source or coupling identity to Obsidian/runtime/rendering layers.

The target pipeline becomes:

```text
Markdown workspace
   ↓
KG3 parser/adapter
   ↓
KG4 resolver
   ↓
transient canonical KnowledgeSnapshot
   ↓
KG9A source-neutral identity reconciliation
   ↓
stable-ID KnowledgeSnapshot
   ↓
KG5 diagnostic report / KG6 projection / KG8 inspection
```

The defining behavior is:

```text
same logical entity after ordinary edits
        → keep stable canonical ID

uncertain match
        → allocate a new ID

never:
uncertain match
        → silently reuse the wrong identity
```

Correctly **refusing** to preserve identity is preferable to false continuity.

Do not persist explorer view state yet. That is KG9B.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

KG8 was merged through PR #10 at merge commit:

`a5e838f4177d767adb438e3bf134f28f77c092e8`

The current roadmap says:

```text
KG8 — complete
KG9 — next: persistence + stable identity
```

Current canonical IDs are explicitly transient.

`packages/resolver-obsidian/src/ids.ts` currently derives IDs from:

```text
document  → workspace ID + path
section   → workspace ID + path + heading start offset
block     → workspace ID + path + marker offset + block ID
reference → workspace ID + path + reference start offset
```

and documents that they are not durable across edits/renames.

KG4 already exposes a `SnapshotIdProvider` seam, but that provider receives only low-level source locators:

```ts
documentId({ workspaceId, path })
sectionId({ workspaceId, path, headingOffset })
blockId({ workspaceId, path, markerOffset, blockId })
referenceId({ workspaceId, path, sourceOffset })
```

KG8 now depends heavily on canonical `EntityId` for search navigation, breadcrumbs, disclosure reveal, backlinks, ambiguity candidates, and graph selection/navigation intent. KG9A should make those entity IDs suitable for later persisted view state.

---

# Architectural refinement: reconcile after KG4 resolution

Earlier architecture left open the possibility that KG9 would simply inject a durable `SnapshotIdProvider` into KG4.

After KG1–KG8, a **post-resolution source-neutral reconciliation layer is preferable**.

Why:

- durable matching needs hierarchy and complete canonical relationships, not merely `path + offset`;
- KG4 should remain the source-specific Obsidian resolver;
- identity continuity is an application concern, not Obsidian link-resolution semantics;
- a post-resolution layer can compare canonical snapshots without Markdown/Obsidian ASTs;
- the result remains a normal schema-v1 `KnowledgeSnapshot`;
- future source adapters can use the same identity layer.

Preferred architecture:

```text
KG4 transient snapshot
       ↓
stable-identity package
       ↓
remapped stable snapshot
```

The existing KG4 `SnapshotIdProvider` may remain for deterministic assembly/testing. Do not remove it merely because stable identity is implemented downstream.

If actual implementation evidence makes a pre-resolution design materially cleaner, stop and explain why before changing this architectural direction.

Because this is an expensive long-term decision, KG9A should add an ADR documenting the final identity boundary.

---

# Required first step

Before editing:

1. sync latest `main`;
2. verify the working tree is clean;
3. read:
   - `AGENTS.md`;
   - `docs/ARCHITECTURE.md`;
   - `docs/ROADMAP.md`;
   - relevant ADRs;
   - `packages/core/src/model/*`;
   - `packages/resolver-obsidian/src/ids.ts`;
   - `packages/resolver-obsidian/src/types.ts`;
   - `packages/resolver-obsidian/README.md`;
   - `packages/diagnostics-obsidian/README.md`;
   - `tools/vault-diagnostics/src/*`;
   - `tools/vault-diagnostics/README.md`;
   - KG5–KG8 benchmark code;
4. inspect current report-generation ordering;
5. inspect current workspace-ID behavior;
6. follow the repository branch/PR/merge/cleanup workflow.

If repository evidence contradicts this prompt, preserve the latest explicit architecture and report the discrepancy.

---

# Package ownership

Create a source-neutral package, likely:

```text
packages/stable-identity/
```

with a package name approximately:

```text
@icarus-graph-explorer/stable-identity
```

Preferred production dependency direction:

```text
stable-identity
  → core
```

It must not import adapter/resolver/diagnostics/view-projection/explorer-inspection/renderer packages, React, filesystem APIs, Tauri, Graphology, or Sigma.

This package owns:

- versioned identity-catalog contracts;
- catalog validation;
- source-neutral canonical matching/reconciliation;
- stable ID allocation;
- canonical ID remapping;
- reconciliation diagnostics/summary.

It does **not** own reading/writing the catalog file, Markdown parsing, Obsidian behavior, or explorer view state.

Filesystem persistence belongs to the outer tool now and a platform adapter later.

Add the usual lightweight import-boundary enforcement.

---

# Stable identity catalog

Define a versioned plain-data catalog, conceptually:

```ts
interface StableIdentityCatalog {
  readonly schemaVersion: 1;
  readonly workspaceId: WorkspaceId;
  readonly nextEntitySequence: number;
  readonly nextReferenceSequence: number;
  readonly entities: readonly StableEntityObservation[];
  readonly references: readonly StableReferenceObservation[];
}
```

The exact representation is for Codex to refine.

The catalog must store only the source-neutral observations needed to reconcile the next canonical snapshot.

Do not turn it into a graph database, renderer cache, Markdown source archive, or saved-view store.

Avoid storing the entire previous `KnowledgeSnapshot` merely because it is convenient unless implementation proves a smaller observation catalog is materially worse.

The catalog is private application data. Paths/titles/raw targets may still be sensitive even without source body text.

## Catalog rules

The catalog must:

- be runtime validated;
- have an explicit schema version;
- reject malformed/corrupt state rather than silently resetting;
- reject workspace-ID mismatch unless an explicit reset is requested;
- use deterministic ordering for JSON diffs/tests;
- JSON-round-trip cleanly;
- contain no absolute filesystem path;
- contain no Markdown source body text;
- contain no renderer/view state.

Unknown future schema versions must fail safely.

---

# Stable ID allocation

Stable IDs are app-owned opaque identifiers.

Do not derive new stable IDs from current path, heading title, or source offset. Those are matching evidence, not identity.

A simple source-neutral allocation policy is sufficient, for example:

```text
stable:<workspace-id>:entity:<sequence>
stable:<workspace-id>:reference:<sequence>
```

or collision-safe tuple equivalents.

UUIDs with an injected deterministic test factory are also acceptable.

Avoid a new UUID dependency.

If sequence allocation is used, counters live in the catalog and allocated values are never reused within the catalog.

Do not make application logic depend on the textual ID format.

---

# Workspace identity

View persistence in KG9B will be keyed by workspace identity.

Current diagnostic CLI defaults:

```text
workspace ID = vault root basename
```

That is acceptable for transient diagnostics but weak for persistence because two vaults can share a basename and a root-folder rename changes the ID.

For a **persistent identity catalog**:

## New catalog

If the user explicitly supplies:

```text
--workspace-id <id>
```

use it.

Otherwise generate one opaque stable workspace ID once and store it in the identity catalog.

Node 24 can generate the UUID in the outer CLI. The pure stable-identity package must not depend on Node crypto APIs.

## Existing catalog

Reuse its stored workspace ID.

If an explicit `--workspace-id` conflicts with the existing catalog, fail unless the user explicitly resets identity state.

## Non-persistent diagnostic run

If no identity store is used, the existing transient workspace-ID behavior may remain.

Do not derive stable workspace identity from an absolute local path.

---

# Reconciliation contract

A useful public API is conceptually:

```ts
reconcileStableIdentity({
  previousCatalog,
  snapshot,
}): StableIdentityReconciliationResult
```

The result should provide:

```text
stable KnowledgeSnapshot
updated StableIdentityCatalog
reconciliation summary/diagnostics
```

Do not mutate the transient snapshot or previous catalog.

A failure in reconciliation/catalog invariants must not return a success-shaped stable snapshot.

---

# Reconciliation diagnostics

Expose a small source-neutral aggregate summary such as:

```text
documents: reusedExact / reusedStrong / allocatedNew / ambiguousNotReused
sections:  ...
blocks:    ...
references: ...
retiredFromPrevious: ...
```

Useful warning categories:

```text
ambiguous identity match — allocated new ID
catalog observation inconsistent
stable ID collision
invalid remapped snapshot
```

These are identity diagnostics, not KG4 resolution diagnostics.

The CLI may print aggregate counts under `--verbose` but should not print private titles/paths by default.

---

# Matching philosophy

Stable identity reconciliation must be **conservative and staged**.

Use strong deterministic evidence first.

Never use:

- fuzzy typo similarity;
- arbitrary Levenshtein thresholds;
- AI/embedding similarity;
- “nearest candidate wins” without strong uniqueness;
- input-array order as a semantic tie-breaker.

If two previous entities are plausible matches for one current entity:

```text
do not guess
→ allocate a new ID
```

One old identity must never be reused by two current entities.

---

# Document identity matching

## Stage 1 — exact path

If one previous document observation has the same normalized workspace-relative path, reuse its stable ID.

This preserves identity through body edits, heading/source-offset shifts, reference changes, and ordinary edits where the file stays at the same path.

## Stage 2 — unique strong structural fingerprint

For an unmatched current document whose path changed, derive a source-neutral canonical fingerprint that ignores IDs, source offsets, and document path, and uses enough graph-visible structure to be meaningful, for example:

```text
ordered section hierarchy/titles/levels
canonical entity-kind structure
authored reference kinds/raw targets in structural/source order
```

Exact fingerprint design is for Codex to refine.

If exactly one unmatched previous document has the same strong fingerprint and the match is one-to-one, reuse its stable document ID.

This supports file rename/move when graph-visible content remains sufficiently unchanged.

If the fingerprint is duplicated/ambiguous, allocate a new ID.

## No fuzzy document matching in KG9A

A rename combined with a major graph-structural rewrite may receive a new ID. That is acceptable.

---

# Section identity matching

Sections need to survive source-offset shifts. Do **not** use heading start offset as primary stable identity.

Within a successfully matched stable document, use staged evidence.

## Stage 1 — stable structural address

Prefer exact source-neutral structural evidence approximately equivalent to:

```text
matched stable parent identity
+ section title
+ same-title sibling occurrence/structural order
+ section level where useful
```

This should survive body edits, insertion of lines before the heading, changed absolute offsets, and edits inside sibling bodies.

Do not treat title alone as globally unique.

## Stage 2 — unique strong context/subtree fingerprint

For unmatched sections, support conservative rename/move continuity when there is strong unique evidence.

Possible source-neutral evidence includes:

```text
child section title/shape signature
outgoing authored reference signature
neighbor structural context
section level / descendant structure
```

The fingerprint used to preserve identity across a heading rename should avoid relying solely on the section's own title.

Require a unique one-to-one strong match. If evidence is weak or duplicated, allocate a new ID.

## Cross-parent moves

A uniquely fingerprinted section may retain identity across a move to another parent if the implemented evidence is unambiguous.

Do not make cross-parent matching a requirement if it forces unsafe heuristics.

Document exactly which move/rename cases are supported after tests.

---

# Duplicate headings

Duplicate headings are legal.

Example:

```text
# Parent
## Details
## Details
```

Do not let title equality collapse identities.

Use parent identity + structural occurrence/context and refuse reuse when edits make the mapping ambiguous.

---

# Block identity

Schema v1 block entities currently preserve only the explicit marker span, not the textual Obsidian block-ID value.

Because KG9A is source-neutral, do not reach back into the Obsidian adapter solely for block identity.

Use conservative canonical evidence such as:

```text
matched stable parent
source order / ordinal among block children
exact previous locator as secondary evidence
```

At current real-vault scale blocks are rare.

If a block moves/duplicates such that identity is uncertain, allocate a new stable block ID.

Do not modify schema v1 merely to improve block matching.

---

# Reference identity

Canonical references also have IDs.

Reference continuity is useful for future incremental deltas, but wrong continuity is less acceptable than allocating a new reference ID.

Reconcile **after entity IDs have been matched/remapped**.

Build a stable semantic reference signature from facts such as:

```text
stable source entity ID
kind: link/embed
rawTarget
resolution status
stable resolved target ID
or stable ambiguous candidate set
```

## Unique signature

If one unmatched previous and one current reference share the same strong semantic signature, reuse the stable ReferenceId.

This survives source-offset shifts.

## Duplicate identical occurrences

If several references share the same semantic signature, do not blindly reuse by occurrence ordinal after offsets changed.

Safe strategies include exact source offset if unchanged or another deterministic unique criterion that cannot cross-assign. Otherwise allocate new IDs for ambiguous duplicate occurrences.

No persisted edge selection exists yet, so conservative reallocation is acceptable.

---

# Remapping the canonical snapshot

After one-to-one matches are decided:

1. assign stable entity IDs;
2. remap section/block `parentId`;
3. remap canonical reference `sourceEntityId`;
4. remap resolved `targetEntityId`;
5. remap ambiguous `candidateEntityIds`;
6. assign/remap `ReferenceId`;
7. preserve paths, spans, titles, levels, raw targets, resolution statuses/reasons;
8. preserve canonical deterministic ordering;
9. run existing core runtime validation.

The stable snapshot should remain schema version 1.

---

# Semantic invariance

Identity reconciliation changes only opaque IDs and references to those IDs.

For a successful reconciliation:

```text
strip IDs from transient snapshot
==
strip IDs from stable snapshot
```

semantically.

Add a strong regression test/helper for this invariant.

Identity must not alter hierarchy shape, source paths/spans, titles/levels, reference raw targets/kinds, resolution status/reason, or candidate membership except ID translation.

---

# Catalog observations

Build the next catalog from the **stable** snapshot and deterministic observations needed by the matcher.

Entity observations likely need:

```text
stable ID
kind
previous path
parent stable ID if any
previous source order/offset
section title/level where applicable
strong structural/context fingerprint(s)
```

Reference observations likely need:

```text
stable ReferenceId
stable source entity ID
kind
raw target
stable resolution signature
previous source offset/order
```

Do not store React Flow position, projection IDs, selection, filters, search text, or source body text.

---

# Deleted identities

KG9A does not need sophisticated tombstone history.

When an entity/reference disappears, it may be reported as retired from the previous catalog and omitted from the next catalog.

Do not implement historical identity resurrection.

If an entity is deleted and recreated later, receiving a new ID is acceptable.

---

# Identity catalog filesystem owner

`packages/stable-identity` must remain filesystem-free.

The current development-only filesystem owner is:

```text
tools/vault-diagnostics
```

Add the private catalog file adapter there.

Preferred workflow:

```text
load/create catalog
   ↓
parse/resolve
   ↓
reconcile stable identity
   ↓
construct diagnostic report from stable snapshot
   ↓
write report
   ↓
atomically write updated catalog
```

Do not update the catalog before all required snapshot/report validation succeeds.

---

# CLI identity-store behavior

Add an explicit option approximately:

```text
--identity-store <path>
```

and an explicit reset option approximately:

```text
--reset-identity
```

Exact naming may follow existing CLI style.

## Default with `--out`

For the normal private-report workflow, defaulting to an identity catalog adjacent to the output report is sensible, for example:

```text
output/diagnostics/icarus-report.json
output/diagnostics/icarus-report.identity.json
```

or a similarly clear ignored/private path.

This makes repeated report generation automatically preserve IDs.

## No output path

If the command only prints a transient diagnostic run and no identity-store path is supplied, existing transient behavior may remain. Do not unexpectedly write state.

## Catalog inside vault

Do **not** put application identity metadata inside the user's Markdown vault by default.

Prefer rejecting an identity-store path located inside the selected vault root.

This project previously chose:

> Obsidian is an input format, not where application UI state should be stored.

Preserve that principle.

---

# Atomic catalog write

Use a safe file-replacement pattern in the Node tool:

```text
serialize validated next catalog
→ write temporary sibling
→ close
→ rename/replace final
```

A failed run must not leave the previous catalog silently truncated.

No heavy atomic-write dependency should be necessary.

---

# Corrupt catalog behavior

If the catalog exists but JSON/schema/workspace/invariant validation fails:

```text
fail explicitly
```

Do not silently delete/reset it.

The user can use the explicit reset action.

Reset should clearly report that identity continuity is being discarded.

---

# Diagnostic report integration

The KG5 report schema does not need to contain the identity catalog.

The report should simply embed the **stable-ID canonical snapshot**.

Keep the catalog private and separate.

Compatibility probes and diagnostic read models must be constructed **after** identity stabilization so any `ReferenceId`, `EntityId`, or candidate ID already uses stable IDs.

Preferred ordering:

```text
KG4 resolve
→ KG9A stabilize snapshot
→ KG5 diagnostics/probes/report
```

---

# Sample-report determinism

The committed synthetic browser report must remain reproducible.

Do not make sample generation depend on a random persistent identity file.

Use either existing deterministic transient IDs for the committed sample or an in-memory deterministic identity allocator used only for sample fixtures.

Do not commit a runtime identity catalog merely to regenerate the sample.

---

# Benchmark integration

Extend the existing opt-in benchmark harness with identity evidence.

Measure at least:

```text
cold identity assignment
warm identity reconciliation
```

for small and medium synthetic profiles.

Warm reconciliation should use a deterministic synthetic “normal edit” revision, for example offset shifts plus inserted structure.

Record:

```text
entities
references
reused/new identity counts
elapsed time
```

No CI timing budget.

---

# Required stable-identity scenarios

## A. Unchanged snapshot

All stable IDs reused.

## B. Body/offset shift before heading

Insert non-structural content before existing headings/links so source offsets change.

Expected: document/section IDs remain stable; unique references remain stable where safe.

## C. Insert new heading before existing sibling

Existing section IDs remain stable. New section gets a new ID.

## D. Edit section body without graph-visible identity change

Section ID remains stable.

## E. Document rename/move with unchanged unique structural fingerprint

Document stable ID remains the same; safely matched descendants remain stable.

## F. Two structurally identical documents renamed

Ambiguous mapping must not guess. Allocate new IDs/report non-reuse.

## G. Heading rename with strong unique context

If the implemented context fingerprint gives unique strong evidence, preserve ID.

If the implementation deliberately does not support this safely, document the limitation and assert new identity rather than adding fuzzy matching.

## H. Duplicate heading titles

Existing duplicates remain distinct; insertion/reordering must not arbitrarily swap IDs.

## I. Section move

Preserve only if unique strong evidence safely supports it; otherwise new ID.

## J. Deleted section

Its ID is not reused by unrelated new content.

## K. Block source-offset shift

Preserve only when conservative canonical evidence is sufficient.

## L. Unique reference offset shift

Semantic reference remains stable when unique.

## M. Duplicate identical references

Do not arbitrarily swap IDs after source changes.

## N. Resolution target remap

Resolved reference points to the correct stable target.

## O. Ambiguous candidates

All candidate IDs are remapped correctly.

## P. JSON round trip

Catalog and stable snapshot validate after JSON serialization.

## Q. Semantic invariance

Reconciliation changes only IDs.

## R. Determinism

Same previous catalog + same transient snapshot → same stable result/catalog.

## S. Catalog corruption

Fails explicitly.

## T. Workspace mismatch

Fails explicitly unless reset/reinitialization is explicitly requested outside the pure package.

---

# Real Icarus validation

Do not modify the real Icarus vault to test renames.

Use the ignored real-report workflow only for safe continuity checks.

## First persistent run

Generate the real ignored report with a new private identity catalog.

Record aggregate stable entities/references, new IDs allocated, and reconciliation time.

## Second unchanged run

Regenerate from the same vault/catalog.

Expected:

```text
all currently present safely matchable entity IDs reused
no spurious entity identity churn
```

Reference duplicates may follow the documented conservative policy.

## Report comparison

Ignore volatile timing fields.

Verify stable canonical entity IDs remain identical.

Do not commit the report, catalog, private paths/titles, or comparison dumps.

---

# Privacy

The identity catalog is private.

It may contain workspace ID, stable IDs, paths, section titles, structural fingerprints, and raw reference targets/signatures depending on the final design.

Therefore:

- store it only in ignored/app-local paths;
- never commit real catalogs;
- never print full catalog content in normal CLI output;
- do not log private paths/titles by default;
- do not include it in the browser report;
- do not upload it;
- do not write it into Markdown/frontmatter.

Repository privacy scan must confirm no real catalog/private vault observations were committed.

---

# No explorer view persistence yet

Explicitly do **not** persist:

- `ViewProjectionState`;
- disclosure;
- filters;
- focus root;
- viewport;
- graph selection;
- search query;
- inspector state.

KG9A provides the stable IDs KG9B needs.

Do not add LocalStorage or IndexedDB in KG9A.

---

# No manual positions / pins yet

KG7 intentionally keeps nodes non-draggable.

There is currently no evidence-backed manual-position interaction to persist.

Do not introduce pinning or dragging solely because the old roadmap said KG9 “may” persist them.

Named saved views can also remain deferred unless KG9B evidence says they are necessary.

---

# No source schema modification

Default:

```text
core schema v1 remains unchanged
```

Opaque IDs already allow durable app-owned identity.

Do not add source UUID frontmatter, hidden Markdown anchors, identity fields to canonical entities, or source-body hashes solely for KG9A.

Identity is application-owned state outside Markdown.

---

# No source-content hash dependency

Because reconciliation happens over canonical snapshots, do not make correctness depend on full Markdown body hashes.

This is intentional:

- canonical graph identity should survive body edits that do not alter graph-visible structure;
- source text is not available at the source-neutral canonical boundary;
- future adapters should not need identical raw Markdown.

Structural fingerprints are matching evidence, not content-addressed identity.

---

# Reconciliation complexity

Build indexes once.

Avoid scanning every previous entity for every current entity when simple partitions can reduce candidates.

Useful partitions include kind, exact path, parent stable identity, title, fingerprint, and reference semantic signature.

Expected complexity should be approximately linear plus bounded candidate matching.

Do not add Graphology or workers.

---

# ADR

KG9A should add an ADR because the identity boundary is expensive to reverse.

Record at least:

1. stable identity is app-owned and stored outside Markdown;
2. KG4 still assembles a transient correct snapshot;
3. source-neutral reconciliation remaps IDs after resolution;
4. matching is conservative; ambiguity creates new identity;
5. identity catalog is private local state;
6. no fuzzy/semantic matching in the foundation;
7. future KG10 deltas and KG9B view persistence consume stable IDs.

---

# Skills

No new repository-local skill is required for KG9A.

Do not install database, IndexedDB, Tauri, graph, or state-management skills.

---

# Scope

## In scope

- source-neutral stable-identity package;
- versioned identity catalog + runtime validation;
- conservative document/section/block/reference reconciliation;
- stable ID allocation;
- canonical snapshot remapping;
- semantic-invariance validation;
- reconciliation diagnostics/summary;
- development runner identity-store integration;
- stable opaque workspace identity for persistent runs;
- explicit reset;
- atomic private catalog writes;
- reject/default-away-from vault-local identity state;
- diagnostics/probe generation after stable identity;
- deterministic sample strategy;
- synthetic revision tests;
- real ignored Icarus unchanged-run continuity validation;
- identity benchmark evidence;
- ADR;
- docs/roadmap reconciliation;
- PR/CI/merge/cleanup.

## Explicitly out of scope

Do not implement browser LocalStorage, IndexedDB, persisted `ViewProjectionState`, persisted viewport, saved views, pins/manual positions, node dragging, selection/search/inspector persistence, Tauri, product folder access, incremental workspace deltas, file watching, source write-back, frontmatter UUIDs, fuzzy/AI identity matching, tombstone history, cloud sync, Graphology, workers, or performance budgets.

Do not begin KG9B automatically.

---

# Suggested implementation sequence

1. Inspect current ID/resolver/runner contracts.
2. Define catalog + reconciliation result contracts.
3. Implement catalog validation and stable ID allocation.
4. Implement entity observations/fingerprints.
5. Implement staged document reconciliation.
6. Implement staged section reconciliation.
7. Implement conservative block reconciliation.
8. Remap canonical entity IDs/hierarchy.
9. Reconcile/remap references after entity mapping.
10. Validate semantic invariance + final snapshot.
11. Build next catalog.
12. Integrate Node private catalog adapter.
13. Reorder report generation: resolve → stabilize → diagnostics/probes → report.
14. Add synthetic revision fixtures/tests.
15. Run real unchanged-vault continuity validation.
16. Extend benchmark harness.
17. Add ADR + reconcile docs.
18. PR → CI → merge → post-merge CI → cleanup.

---

# Validation commands

Run focused + repository checks, equivalent to:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/stable-identity typecheck
pnpm exec vitest run packages/stable-identity

pnpm --filter @icarus-graph-explorer/resolver-obsidian typecheck
pnpm exec vitest run packages/resolver-obsidian

pnpm --filter @icarus-graph-explorer/diagnostics-obsidian typecheck
pnpm exec vitest run packages/diagnostics-obsidian

pnpm --filter <vault-diagnostics-package> typecheck
pnpm exec vitest run tools/vault-diagnostics

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
git diff --check
```

Also run:

```text
small identity benchmark
medium identity benchmark
real persistent Icarus report run #1
real persistent Icarus report run #2
```

Compare stable entity IDs between the two real runs.

Do not expose private paths in the final report.

PR CI and post-merge main CI should pass.

---

# Exit gate

KG9A is complete only when:

1. A source-neutral stable-identity package exists.
2. It depends only inward on core.
3. Stable identity is app-owned and not written into Markdown.
4. A versioned private identity catalog exists.
5. Catalog validation rejects malformed/incompatible state.
6. Persistent workspace identity is stable and opaque.
7. New stable IDs are not derived from current path/title/offset.
8. KG4 can continue producing its transient correct snapshot.
9. Identity reconciliation runs after canonical resolution.
10. Exact-path documents preserve identity.
11. Unique strong document rename/move cases can preserve identity.
12. Ambiguous document rename cases do not guess.
13. Section IDs survive ordinary offset shifts.
14. Inserting a heading does not churn all later section IDs.
15. Duplicate headings do not collapse into one identity.
16. Heading rename/move behavior is explicitly conservative and tested.
17. Blocks never use source-specific hidden evidence.
18. Unique safe references can preserve IDs across offset shifts.
19. Ambiguous duplicate references are not arbitrarily cross-assigned.
20. Parent/source/target/candidate IDs are remapped consistently.
21. Stable reconciliation changes only opaque IDs, not canonical meaning.
22. Final stable snapshot passes core validation.
23. Catalog JSON is deterministic/round-trippable.
24. Reconciliation is deterministic.
25. Runner can load/create a private identity catalog.
26. Runner does not write identity metadata inside the vault by default.
27. Corrupt catalog fails explicitly.
28. Reset is explicit rather than automatic.
29. Catalog update is written safely only after a successful run.
30. Diagnostics/probes use stable IDs.
31. Committed synthetic sample remains deterministic.
32. Synthetic revision tests cover normal edits and ambiguous non-reuse.
33. Two unchanged real Icarus runs reuse stable entity IDs.
34. No real catalog/report/private observations are committed.
35. Identity benchmark evidence is collected without budgets.
36. ADR documents the stable-identity boundary.
37. Architecture/roadmap docs are reconciled.
38. KG9 is marked **in progress**, not fully complete.
39. KG9B/view persistence is explicitly next.
40. Existing KG1–KG8 tests remain green.
41. PR CI passes.
42. Post-merge main CI passes.
43. Branch cleanup is complete and worktree is clean.

Do not begin KG9B.

---

# Final report

Report:

## 1. Summary

What stable identity capability now exists.

## 2. Architecture decision

Explain:

```text
KG4 transient canonical snapshot
→ source-neutral stable reconciliation
→ stable canonical snapshot
```

and why this was chosen over low-level `SnapshotIdProvider` matching directly.

## 3. Stable-identity package

Public entry points, dependencies, and catalog contract.

## 4. Stable workspace identity

First-run/existing-catalog behavior and CLI `--workspace-id` interaction.

## 5. Matching policy

Documents, sections, blocks, and references; explicitly state what survives and what intentionally receives new identity.

## 6. Ambiguity policy

Cases where continuity is refused.

## 7. Snapshot remapping

Confirm parent/source/target/candidate IDs are translated and source semantics remain identical.

## 8. Identity catalog

Versioning, private contents, location, atomic write, corruption/reset behavior.

## 9. Diagnostic-runner integration

Exact pipeline ordering and CLI options/defaults.

## 10. Real-vault continuity evidence

Aggregate only: entity/reference counts, reused/new counts, unchanged second-run churn, timing.

## 11. Synthetic revision evidence

List continuity/non-continuity cases covered.

## 12. Performance evidence

Small/medium cold/warm identity timings; no budget claims.

## 13. Dependencies

List anything added. Expected external dependency count should ideally remain zero.

## 14. Tests / validation

Every command actually run, test counts, build, real runs, PR CI, post-merge CI.

## 15. Privacy

Confirm no catalog/report/private vault observation was committed.

## 16. ADR / documentation reconciliation

State the roadmap status:

```text
KG9 identity foundation complete
KG9 view persistence pending
```

## 17. Deviations / warnings

Surface rename cases that intentionally lose identity, duplicate-heading/reference limits, workspace-ID limitations, catalog-size/performance concerns, and anything blocking KG9B.

## 18. KG9B handoff

State exactly what view persistence can now rely on:

- stable workspace ID for persistent diagnostic runs;
- stable canonical entity IDs across supported normal edits;
- conservative identity reset on uncertain matches;
- browser-visible reports already contain stable IDs;
- disclosure/filter/focus state can now be stored safely against entity IDs;
- search/inspector selection should remain transient by default;
- viewport persistence should prefer semantic stable-entity anchoring over raw renderer coordinates;
- manual positions/pins still have no interaction to persist.

Do not implement KG9B automatically.
