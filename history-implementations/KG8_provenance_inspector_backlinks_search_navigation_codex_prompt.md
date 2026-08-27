# KG8 — Provenance Inspector, Backlinks, Search + Graph Navigation

**Task type:** exploration UX / source-neutral inspection read model / graph navigation

## Goal

Turn the KG7 structural graph from a visually explorable graph into an **explainable knowledge-navigation tool**.

KG8 should let a user answer:

- What exactly is this document / section / block?
- Where is it in the Markdown source?
- What links originate from this document/section subtree?
- What are the backlinks into it?
- Which links are unresolved or ambiguous?
- Why does this visible aggregated graph edge exist?
- Which exact canonical reference occurrences were rolled into this edge?
- Which precise hidden sections generated a collapsed document-level edge?
- What does an unresolved / ambiguous / invalid target represent?
- What are the ambiguity candidates?
- How can I find a document/heading that is currently hidden?
- How can I jump from search, backlinks, candidates, or breadcrumbs to that entity in the graph?

Target flow:

```text
KnowledgeSnapshot
      +
ViewProjection
      ↓
source-neutral inspection/search indexes
      ↓
selection/search result
      ↓
provenance inspector
      +
navigation/reveal action
      ↓
KG6 disclosure state
      ↓
new ViewProjection
      ↓
KG7 renderer centers/selects target
```

KG8 stays read-only. Do **not** implement source text loading, source editing, Tauri, persistence, stable IDs, or graph analytics.

The defining principle is:

> Every graph relationship should be explainable back to exact canonical source occurrences, while global search/navigation can reveal hidden canonical entities without bypassing KG6 projection semantics.

---

# Current repository evidence

Repository: `lillo24/icarus-graph-explorer`

KG7 is complete on `main` through PR #8 and benchmark follow-up PR #9. Final merge:

`d11d7635e34888ad4b2ee38c61c030feaba1ab49`

Current boundary:

```text
ViewProjection
→ @icarus-graph-explorer/renderer-reactflow
→ deterministic Dagre layout
→ React Flow
```

The renderer owns mapping/layout/visual interaction only. It explicitly does not inspect canonical references or derive projection semantics.

Current web app owns:

```text
report load/reset
ProjectionWorkspace
ViewProjectionState
selection
focus/disclosure controls
secondary KG5 evidence UI
```

No global state library is installed.

The roadmap marks KG8 as next:

> provenance-first inspection, incoming/outgoing references, ambiguity candidates, and search/navigation over projected data.

Before editing, inspect actual current `main`, `AGENTS.md`, architecture/roadmap, core model, view-projection, renderer-reactflow, diagnostics lookups, `graph-state.ts`, `report-view.ts`, and current components. Preserve newer repository-owned decisions if they differ from this prompt.

---

# Canonical/projection evidence

Canonical `Reference` already provides:

```text
id
kind: link | embed
sourceEntityId
rawTarget
sourceSpan
resolution:
  resolved(targetEntityId)
  unresolved(reason?)
  ambiguous(candidateEntityIds[], reason?)
  invalid(reason)
```

Canonical entities provide:

```text
workspace-relative source path
exact SourceSpan
document → section → optional block hierarchy
```

KG6 projected reference edges retain:

```text
referenceIds[]
projected source node
projected target node
resolution status
```

Projected entity nodes retain:

```text
entityId
sourcePath
sourceStartLine
title
internalReferenceIds[]
role
focusDistance
```

Projection-only diagnostic nodes retain:

```text
status
rawTarget
referenceIds[]
candidateEntityIds[]
reasons[]
```

Default assumption: **schema v1 is sufficient**. Do not change canonical schema merely for inspector convenience. If actual work proves essential source truth is missing, stop and report the mismatch before changing KG1.

---

# Real scale / design constraint

Real Icarus validation currently has roughly:

```text
195 Markdown documents
714 sections
1 explicit block
438 references
```

KG7 proved progressive disclosure/focus is necessary; very large fully expanded Dagre layouts are intentionally not a normal workflow.

KG8 should strengthen:

```text
global search
→ targeted reveal
→ center
→ inspect
```

rather than encouraging expand-all.

---

# Main architecture decision: source-neutral inspection

Do not make the primary graph inspector depend on Obsidian diagnostics just because the browser currently loads an Obsidian diagnostic report.

The report supplies `KnowledgeSnapshot`. Main inspection/search should work against:

```text
KnowledgeSnapshot + ViewProjection
```

Create a source-neutral package, likely:

```text
packages/explorer-inspection/
```

with a package name like:

```text
@icarus-graph-explorer/explorer-inspection
```

Recommended dependency direction:

```text
explorer-inspection
  → view-projection
  → core
```

It must not import React, React Flow, Dagre, renderer-reactflow, apps/web, Obsidian adapter/resolver/diagnostics, filesystem APIs, Tauri, Graphology, or Sigma.

Add the same lightweight boundary lint used elsewhere.

No external search dependency should be necessary.

---

# Inspection workspace

Build canonical lookups once per loaded snapshot:

```ts
const inspection = createInspectionWorkspace(snapshot);
```

Runtime indexes may include:

```text
entityById
referenceById
parentByEntityId
childrenByParentId
ancestor/descendant helpers
referencesBySourceEntity
resolvedReferencesByTargetEntity
ambiguousReferencesByCandidateEntity
source-order metadata
normalized search records
```

Maps/Sets are runtime-derived only, not canonical or persisted.

Public inspection/search result objects used by the UI should remain plain deterministic data.

---

# Entity descriptors and breadcrumbs

Create one consistent source-neutral entity descriptor with approximately:

```text
entityId
kind
displayName
sourcePath
sourceSpan
breadcrumb[]
```

Document display: basename/path, without adding canonical title.

Section display: document path + parent/child section breadcrumb.

Block display: neutral source-derived label such as `Block at line N`; schema v1 does not contain Obsidian block-ID text.

Breadcrumb parts retain canonical `EntityId`s so they are navigable.

Source provenance should be formatted from real spans, e.g.:

```text
path/to/file.md · L42:C7–L42:C19
```

Do not fabricate source snippets.

---

# Reference occurrence descriptors

Create one exact descriptor per canonical reference, approximately:

```text
referenceId
kind
source entity descriptor
source span
rawTarget
status
resolved target descriptor OR ambiguous candidate descriptors
reason
```

Every occurrence remains individually inspectable even when several canonical references aggregate into one visible edge.

---

# Entity relationship semantics: subtree, but exact provenance preserved

Canonical ownership is exact, but a visible document/section naturally represents its structural subtree.

Use **subtree semantics** for the main entity relationship inspector:

```text
selected entity + all canonical descendants
```

This matches:

```text
Document = whole file
Section = heading section including nested subsections
```

while every row still shows the exact source/target breadcrumb.

Derive:

```text
Outgoing references from subtree
Resolved backlinks into subtree
Ambiguous candidate mentions of subtree
```

Mark where the exact endpoint is a descendant rather than the selected entity itself.

This avoids a confusing document inspector with zero backlinks when all incoming references target its headings.

---

# Backlinks and ambiguous candidate mentions

**Backlinks** are only canonical resolved references whose resolved target lies in the selected subtree.

Each backlink row shows:

```text
exact source breadcrumb
source path + line/column
raw target
exact target breadcrumb
link/embed
```

Ambiguous references are **not** backlinks.

If an ambiguous reference's candidate set intersects the selected subtree, show it separately under:

```text
Ambiguous candidate mentions
```

If several candidates from the same subtree occur in one ambiguous reference, count the source occurrence once and list relevant candidates.

---

# Outgoing references

For a selected entity subtree, include references whose exact `sourceEntityId` belongs to the subtree.

Include all statuses:

```text
resolved
unresolved
ambiguous
invalid
```

Each row preserves exact source, raw target, resolution/candidates/reason, and source span.

---

# Internal collapsed relationships

Projected entity nodes can contain `internalReferenceIds[]`: exact relationships whose visible endpoints roll into the same projected node.

If selected entity has internal references, show a separate section:

```text
Internal relationships hidden by current collapse
```

Explain:

```text
N references are currently internal to this collapsed node.
Expand sections to expose them as visible graph relationships.
```

List exact canonical occurrences. Do not create self-loops.

---

# Projected edge inspection: “why this edge exists”

Selecting a projected reference edge must explain its exact provenance.

Inspector header:

```text
projected source → projected target
status
aggregated occurrence count
```

Then resolve every `referenceIds[]` entry to canonical occurrence descriptors.

For each resolved occurrence show:

```text
exact canonical source
→ exact canonical target
raw target
source path/span
link/embed
```

If exact endpoints differ from projected endpoints because of collapse, explicitly show that the relationship is currently displayed through visible ancestors.

Do **not** recompute roll-up. Compare canonical exact endpoints with the projected edge endpoints only for explanation.

Hierarchy-edge inspection should show parent/child containment and source locations, with no fake `ReferenceId` provenance.

Diagnostic-edge/node inspection should show status, raw target, reasons, source occurrences, and ambiguity candidates.

Ambiguous candidates are clickable navigation targets but must never be shown as chosen resolutions.

---
# Global canonical search

KG8 search must search the **full canonical snapshot**, not only visible projected nodes.

Searchable fields:

```text
document basename
document path
section title
section breadcrumb
block path/line label
```

Do not search Markdown body text. Do not claim semantic/fuzzy search.

Use deterministic case-insensitive ranking, for example:

1. exact title/basename;
2. title/basename prefix;
3. exact breadcrumb component;
4. title substring;
5. path/breadcrumb substring.

Tie-break by source path then source offset.

Do not add Fuse.js/Lunr/MiniSearch without measured need.

Normal result list should be bounded (roughly 20–50 items).

A simple accessible search input + result buttons is preferable to a complicated custom combobox.

Global search is conceptually different from:

```text
KG6 projection text filter
KG5 secondary evidence search
```

Keep those concepts distinct.

---

# Search/navigation behavior

Selecting a canonical search result should:

1. exit focus if necessary;
2. update KG6 disclosure state so the canonical target is structurally visible;
3. remove collapsed ancestors that prevent visibility;
4. enable blocks if navigating to a block;
5. reproject;
6. find the resulting projected entity node;
7. select it;
8. center it in React Flow without fitting the entire graph;
9. show inspector.

Do not inject hidden React Flow nodes directly.

---

# Renderer-independent reveal helper

KG8 likely exposes a genuine KG6 convenience gap:

> Given a canonical entity, what disclosure state is required to reveal it?

Prefer adding a narrow source-neutral helper to `view-projection`, conceptually:

```ts
revealEntityInViewState(
  workspace,
  state,
  entityId,
): ViewProjectionState
```

Required behavior:

## Document

Ensure structural state does not prevent the root entity from being visible.

## Section

For every structural ancestor:

- remove blocking IDs from `collapsedEntityIds`;
- add ancestors that need to disclose children to `expandedEntityIds`.

The target itself does not need to be expanded simply to become visible.

## Block

- `includeBlocks = true`;
- reveal ancestor chain;
- explicitly expand its visible parent according to KG6 block policy.

The helper may remain disclosure-only; web navigation can exit focus before calling it.

Keep this in KG6 because it is renderer-independent disclosure semantics. Add focused tests.

---

# Navigation from inspector

Use the same shared navigation pipeline for:

```text
breadcrumbs
resolved targets
reference sources
backlink sources
ambiguous candidates
exact endpoints shown in edge provenance
```

Do not implement separate reveal logic in each component.

Global navigation should normally leave focus mode because the target may be outside the current ego graph.

A later explicit “Focus this result” action can be considered, but do not silently change focus root during search navigation.

---

# Graph filters

KG6 already supports path prefixes, entity kinds, reference statuses, and projected text. KG7 intentionally did not expose the full filter UI.

KG8 should expose a **small practical graph-filter surface**.

Required minimum:

## Reference status

Multi-select/toggles:

```text
resolved
unresolved
ambiguous
invalid
```

## Entity content kind

```text
documents
sections
blocks
```

Remember KG6 can retain context ancestors even when their kind is not a content match; UI wording should not falsely claim those context nodes are filtered matches.

## Path scope

Provide a simple path-prefix scope. Do **not** implement Obsidian graph-query syntax.

A good UI may derive top-level folder scopes from canonical document paths. Do not hard-code Icarus folders.

Global search must still find canonical entities outside current graph filters.

---

# Navigation versus filters

Explicit navigation must not appear to succeed while the target remains invisible because of filters.

Choose one deterministic policy.

Preferred:

1. preserve non-conflicting filters;
2. remove only filters that exclude the target;
3. announce that the graph scope was widened.

If that becomes overly complex, clearing all graph filters on explicit navigation is acceptable only if clearly announced and tested.

Do not silently fail or select an invisible entity.

---

# Renderer center request

KG7 currently supports full `fitRequestKey`. KG8 needs a narrow renderer-only operation:

```text
center this projected node
```

after search/backlink navigation.

Add a renderer-specific request, conceptually:

```ts
interface GraphCenterRequest {
  readonly key: number;
  readonly nodeId: ProjectionNodeId;
  readonly zoom?: number;
}
```

`GraphCanvas` may use current React Flow `setCenter` / prepared node coordinates.

Requirements:

- duration 0 / reduced-motion safe;
- no full-graph fit;
- stale node IDs ignored safely;
- selection and centering remain separate concepts;
- ordinary pointer selection should not necessarily auto-center;
- no canonical/inspection logic enters renderer-reactflow.

Center only after the new projection/layout exists; do not center using stale coordinates.

---

# Selection synchronization

Navigation may start from a canonical `EntityId`, while KG7 selection is a projected node ID.

During navigation:

```text
canonical target intent
→ reveal/reproject
→ find ProjectedEntityNode with matching entityId
→ set projected selection
→ center request
```

If an edge/synthetic target disappears after disclosure/filter change, clear stale selection gracefully.

Do not introduce cross-session selection persistence yet.

---

# Main inspector UI

Upgrade KG7's lightweight right panel into a real provenance inspector.

For selected canonical entity show:

## Identity

```text
kind
display name
clickable breadcrumb
source path
source span
content/context role
focus distance when relevant
hidden descendants
```

## Relationship summary

```text
outgoing from subtree
resolved backlinks into subtree
ambiguous candidate mentions
internal collapsed relationships
```

## Relationship lists

Bounded/paginated. Show exact source/target provenance in each row.

For selected reference edge show all exact aggregated occurrences and roll-up explanation.

For hierarchy edge show structural containment only.

For diagnostic target show raw target/status/reasons/occurrences/candidates.

When nothing is selected:

```text
Select a node or edge to inspect its provenance.
Use Find to reveal documents or sections that are not currently visible.
```

---

# Inspector terminology

Use:

```text
Backlinks
```

only for resolved incoming references.

Use:

```text
Ambiguous candidate mentions
```

for unresolved ambiguity evidence.

Use:

```text
Outgoing references
```

for authored links from subtree.

Distinguish `link` vs `embed` from canonical reference kind.

---

# Source text limitation

KG8 report mode has no source Markdown text.

Do not:

- fabricate snippets;
- add source text to the diagnostic report;
- read vault folders from browser;
- add open-in-Obsidian yet.

Show exact:

```text
path
line/column
breadcrumb
raw target
```

Rich source preview/open-source belongs with later product source-provider access (currently KG11).

Make this limitation explicit in UI/docs rather than leaving misleading empty preview areas.

---

# Secondary KG5 evidence

Do not delete KG5 diagnostics/probes.

However, KG8 inspector becomes the primary relationship workflow.

If the old KG5 ReferencesPanel substantially duplicates KG8, demote it under a secondary “Diagnostic evidence” section or reuse low-level helpers where sensible.

Avoid two competing primary reference inspectors.

---

# Search result navigation accessibility

Provide clear programmatic navigation status, e.g.:

```text
Revealed section in file.md.
Path filter cleared to reveal result.
Candidate section revealed.
```

Use an aria-live status region where appropriate.

Camera movement alone is not sufficient feedback.

Search result buttons, breadcrumb links, backlink actions, and candidate actions must be keyboard accessible.

---

# UI layout

Suggested graph-first layout:

```text
┌───────────────────────────────────────────────────────────────┐
│ Icarus Graph Explorer  [Find…] [Filters]        [Load report] │
├───────────────────────────────────────────────┬───────────────┤
│                                               │ Inspector     │
│                                               │ Breadcrumbs   │
│                 GRAPH                         │ Provenance    │
│                                               │ Backlinks     │
│                                               │ Outgoing      │
│                                               │ Candidates    │
├───────────────────────────────────────────────┴───────────────┤
│ graph counts / projection issues / filter summary             │
└───────────────────────────────────────────────────────────────┘
```

On narrow layouts, inspector may stack below or become a drawer/section. Preserve 390 px usability.

Do not let the graph canvas become a tiny widget inside an inspector dashboard.

---

# Inspection package API guidance

Possible public API:

```ts
createInspectionWorkspace(snapshot)

describeEntity(workspace, entityId)
inspectEntity(workspace, entityId)
inspectProjectedNode(workspace, projection, nodeId)
inspectProjectedEdge(workspace, projection, edgeId)

searchEntities(workspace, query, options)
```

Names may differ.

Do not expose internal Maps if clean read-model helpers are sufficient.

Prefer pure functions + immutable/plain result objects over mutable classes.

---

# Roll-up explanation invariant

For each aggregated resolved edge occurrence, inspection can compare:

```text
exact canonical source entity
exact canonical target entity
projected source entity
projected target entity
```

and derive explanation flags such as:

```text
sourceRolledUp
targetRolledUp
```

This is **explanation only**. Never route the reference again in KG8.

---

# Relationship sorting and pagination

Keep rows deterministic:

```text
source path
source span start
reference ID tie-breaker
```

Outgoing can use source order. Backlinks can group/sort by source path + order. Candidate entities use canonical source order.

Default rendered list size should remain bounded, roughly 20–50 per group, with Show more/pagination.

Do not add virtualization unless real evidence requires it.

---
# Performance posture

Extend the existing non-gating benchmark harness with small/medium evidence for:

```text
inspection workspace/index construction
global search query
entity subtree inspection
aggregated edge provenance inspection
```

Record entity/reference/result counts and timings.

No CI thresholds.

At current scales a precomputed normalized search record + deterministic linear query scan is acceptable if measured responsive.

Use `useDeferredValue` in web search if useful.

Do not add a search dependency prematurely.

---

# Skills

No new repository-local skill is required for KG8.

Use existing:

- React best-practices;
- web interface/design guidance;
- browser-control QA.

Do not install search, state-management, Tauri, database, or graph-analytics skills.

Official React Flow docs remain authoritative for viewport centering behavior.

---

# State management

Do not introduce Zustand automatically.

Likely KG8 state remains manageable as:

```text
report
ProjectionWorkspace
InspectionWorkspace
ViewProjectionState
graph selection
search query/open state
filter panel state
navigation request
relationship pagination
```

Use React reducer/state + memoized derivation unless implementation provides concrete evidence otherwise.

KG9 is the right milestone to reconsider persistent app-state architecture.

---

# Required pure tests

## Inspection workspace

- valid canonical indexing;
- hierarchy traversal;
- deterministic descendants;
- references indexed once.

## Breadcrumbs

- document;
- nested section;
- skipped heading levels;
- duplicate titles;
- block.

## Backlinks

- exact target;
- descendant target included in ancestor subtree;
- unresolved excluded;
- ambiguous excluded;
- duplicate source occurrences retained.

## Ambiguous candidate mentions

- candidate inside subtree included;
- one source occurrence counted once even if multiple candidates are inside subtree;
- unrelated candidate excluded.

## Outgoing

- resolved/unresolved/ambiguous/invalid;
- descendant-owned references included.

## Edge provenance

- one reference;
- multiple aggregated refs;
- rolled source;
- rolled target;
- both rolled;
- diagnostic edge;
- hierarchy edge.

## Internal provenance

- internal `ReferenceId`s resolve to exact canonical occurrences.

## Search

- exact filename;
- exact section title;
- prefix;
- substring;
- breadcrumb;
- duplicate titles;
- empty query;
- result limit;
- deterministic ordering.

Public inspection result values used by UI should JSON-round-trip where practical.

---

# Required navigation tests

- nested hidden section reveal;
- collapsed ancestor removal;
- block reveal/includeBlocks;
- search navigation exits focus;
- backlink navigation;
- breadcrumb navigation;
- candidate navigation;
- filter-conflict policy;
- stale entity target;
- resulting projection contains target;
- resulting projected node selected;
- canonical snapshot not mutated.

Renderer center-request tests:

- existing node centers;
- stale node does not crash;
- repeated same request key does not retrigger;
- changed key triggers;
- full fit remains independent;
- selection remains separate from viewport centering.

---

# Browser QA — synthetic report

Validate:

1. Search finds a hidden nested section.
2. Selecting result reveals it.
3. Camera centers on it.
4. Inspector opens.
5. Breadcrumb navigation works.
6. Document inspector shows subtree backlinks/outgoing.
7. Edge inspector lists all aggregated occurrences.
8. Rolled edge explains exact hidden endpoints.
9. Internal-reference badge is explained.
10. Unresolved diagnostic inspection works.
11. Ambiguous candidate list works.
12. Candidate navigation works.
13. Invalid diagnostic inspection works.
14. Backlink source navigation works.
15. Resolution filter changes graph relationships through KG6.
16. Entity/path filter maps to KG6.
17. Global search still finds entities outside current graph filter.
18. Filter-conflict navigation policy is visible/announced.
19. Focus → global search → navigation exits focus correctly.
20. Relationship show-more/pagination works.
21. Search/result actions keyboard accessible.
22. 390 px viewport usable.
23. No console errors/warnings.
24. No source text exposed.

---

# Real Icarus QA

Using ignored local report:

1. Search a document by basename/path.
2. Search a section not initially visible.
3. Reveal nested result.
4. Inspect a document with multiple outgoing references.
5. Inspect backlinks into a document/subtree.
6. Inspect a multi-reference aggregated edge.
7. Confirm exact hidden-section provenance is understandable.
8. Inspect unresolved relationships.
9. Inspect the ambiguous target/candidates.
10. Navigate from candidate/source/backlink.
11. Apply path scope and reference-status filter.
12. Search outside current scope and reveal according to policy.
13. Use focus then global search navigation.
14. Verify inspector/search responsiveness.
15. Verify no private artifact/screenshot becomes tracked.
16. No browser console errors.

Final report should use aggregate behavior/results only, not private note names/headings.

---

# Scope

## In scope

- inspect KG7 merged state;
- new source-neutral inspection/search package;
- canonical entity descriptors and breadcrumbs;
- exact path/span provenance formatting;
- reference occurrence descriptors;
- subtree outgoing references;
- subtree resolved backlinks;
- ambiguous candidate mentions;
- internal-reference provenance;
- projected reference/hierarchy/diagnostic inspection;
- global canonical entity search;
- deterministic ranking;
- renderer-independent reveal helper in KG6 if required;
- shared navigation pipeline;
- renderer node-centering request;
- provenance-first inspector UI;
- compact KG6-backed path/entity/reference-status filters;
- accessible navigation announcements;
- synthetic and real-report browser QA;
- non-gating inspection/search benchmark evidence;
- docs/roadmap reconciliation;
- PR/CI/merge/cleanup.

## Explicitly out of scope

Do not implement:

- Markdown source snippets;
- browser source-file reads;
- open-in-Obsidian;
- Tauri/live vault access;
- source editing/link repair;
- choosing ambiguous resolutions;
- saved views;
- stable identity across edits;
- manual-position persistence;
- IndexedDB;
- incremental workspace updates;
- workers;
- Graphology/Sigma/Pixi;
- alternate renderer;
- pathfinding;
- PageRank/centrality/communities;
- semantic similarity/typed semantic links;
- alias-aware search from Obsidian metadata;
- full-text Markdown search;
- fuzzy typo search;
- performance budgets.

Do not begin KG9 automatically.

---

# Suggested implementation sequence

1. Inspect current core/projection/renderer/web contracts.
2. Define inspection package contracts.
3. Build canonical inspection indexes.
4. Implement breadcrumbs/provenance.
5. Implement subtree outgoing/backlinks/candidate mentions.
6. Implement projected selection/edge provenance.
7. Implement global canonical search.
8. Add KG6 reveal helper if needed.
9. Add web navigation orchestration.
10. Add renderer center request.
11. Upgrade inspector UI.
12. Add global search UI.
13. Add compact KG6-backed filter UI.
14. Browser QA synthetic.
15. Browser QA real ignored report.
16. Extend benchmark harness.
17. Documentation consistency pass.
18. PR → CI → merge → post-merge CI → cleanup.

---

# Dependencies

Expected:

```text
no new external runtime dependency
```

`explorer-inspection` should be implementable with workspace dependencies on `core` / `view-projection` only.

Do not add Fuse.js, Lunr, MiniSearch, Zustand, or Graphology without measured need.

---

# Documentation updates

Likely:

```text
packages/explorer-inspection/README.md
packages/view-projection/README.md        # reveal helper
packages/renderer-reactflow/README.md     # center request
apps/web/README.md
apps/web/src/components/README.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
tools/vault-diagnostics/README.md         # benchmark phases if extended
README.md
eslint.config.*
```

Architecture should record:

```text
KnowledgeSnapshot
  → explorer-inspection

KnowledgeSnapshot + ViewProjectionState
  → view-projection
  → ViewProjection

KnowledgeSnapshot + ViewProjection
  → explorer-inspection
  → provenance/search read models

ViewProjection
  → renderer-reactflow
```

Clarify:

- global search is canonical, not KG6 text filtering;
- backlinks use subtree semantics while retaining exact occurrence ownership;
- ambiguous candidate mentions are separate from backlinks;
- renderer centering is viewport behavior only;
- source text remains unavailable in report mode.

Mark KG8 complete only after real/synthetic navigation gates pass. KG9 becomes next.

---

# Validation commands

Expected equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/explorer-inspection typecheck
pnpm exec vitest run packages/explorer-inspection

pnpm --filter @icarus-graph-explorer/view-projection typecheck
pnpm exec vitest run packages/view-projection

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
git diff --check
```

Run small/medium benchmark if KG8 phases are added.

Run browser QA with synthetic and ignored real Icarus report.

Require PR CI and post-merge main CI.

Do not claim checks that were not run.

---

# Exit gate

KG8 is complete only when:

1. A source-neutral inspection/search boundary exists.
2. It does not depend on Obsidian, React Flow, filesystem, or diagnostics packages.
3. Canonical breadcrumbs are available.
4. Exact source path/span provenance is inspectable.
5. Entity inspection uses subtree semantics without losing exact ownership.
6. Resolved backlinks are derived correctly.
7. Ambiguous candidate mentions remain separate from backlinks.
8. Outgoing references include all statuses.
9. Internal collapsed references are inspectable.
10. Aggregated projected edges expose every underlying canonical occurrence.
11. Rolled-up endpoints are explainable without recomputing roll-up.
12. Hierarchy edges do not fabricate reference provenance.
13. Diagnostic nodes/edges expose occurrences/reasons/candidates.
14. Global search searches hidden canonical entities.
15. Search ranking is deterministic/source-neutral.
16. Search does not claim full-text/fuzzy behavior.
17. A renderer-independent reveal helper can disclose hidden canonical entities.
18. Nested sections reveal through KG6 state, not React Flow hiding hacks.
19. Blocks reveal according to KG6 policy.
20. Search/backlink navigation exits focus when necessary.
21. Breadcrumb/backlink/candidate navigation works.
22. Filter-conflict navigation has deterministic visible behavior.
23. Renderer centers a newly revealed projected node.
24. Centering remains renderer-only viewport behavior.
25. Main selection panel becomes provenance-first inspector.
26. Search UI is keyboard accessible.
27. Graph filters use KG6 state.
28. Global search remains separate from graph filters.
29. Relationship lists remain bounded.
30. No source snippets/text are fabricated or added to report schema.
31. No Tauri/source-provider behavior enters KG8.
32. Synthetic browser QA passes.
33. Real ignored-report QA passes.
34. No unnecessary search/state dependency is added.
35. Existing KG1–KG7 tests remain green.
36. Architecture/roadmap docs are reconciled.
37. PR CI passes.
38. Post-merge main CI passes.
39. Branch cleanup is complete and worktree clean.

Do not begin KG9.

---

# Final report

Report:

## 1. Summary

What KG8 added to graph exploration.

## 2. Inspection architecture

Exact boundary:

```text
KnowledgeSnapshot + ViewProjection
→ explorer inspection/search
→ web inspector
```

## 3. Package dependencies

Confirm absence of source-specific/renderer dependencies in inspection package.

## 4. Entity inspection

Breadcrumbs, path/span provenance, subtree scope, outgoing, backlinks, candidate mentions, internal relationships.

## 5. Edge provenance

Aggregated occurrences, exact source/target, roll-up explanation, hierarchy/diagnostic behavior.

## 6. Search

Searchable fields, ranking, result limit, hidden-entity search, no fuzzy/full-text claims.

## 7. Navigation

Explain:

```text
search/backlink/candidate/breadcrumb
→ exit focus
→ reveal through KG6
→ reproject
→ select
→ renderer center
```

and filter-conflict policy.

## 8. Renderer change

Exact center/navigation request added. Confirm renderer still does not inspect canonical truth.

## 9. Filter UI

Path/entity/status filters mapped to KG6.

## 10. Source limitation

Confirm no source text/snippets/open-in-source.

## 11. Browser QA

Synthetic + private real-report behavior without exposing private details.

## 12. Performance evidence

Inspection index/search/entity/edge timings if measured; no budget claims.

## 13. Dependencies

List any external additions; expected normally none.

## 14. Tests / validation

Every command actually run, test counts, build, browser QA, PR CI, post-merge CI.

## 15. Files changed

Important packages/web/docs only.

## 16. Documentation reconciliation

What changed after implementation evidence.

## 17. Deviations / warnings

Search/inspector scale limits, navigation/filter compromises, missing metadata, anything blocking KG9.

## 18. KG9 handoff

State what persistence/stable-identity work can now observe from real interaction:

- disclosure state worth preserving;
- filter state;
- selected view/focus settings;
- viewport behavior;
- search normally transient;
- inspector selection normally transient unless evidence says otherwise;
- navigation relies on canonical entity identity;
- current IDs remain transient across source edits;
- manual positions still not persisted.

Do not implement KG9 automatically.
