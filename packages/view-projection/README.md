# View Projection

Status: **STABLE — disclosure, Focus, and bounded Local semantics are pure-test-backed.**

This source-neutral package turns canonical `KnowledgeSnapshot` truth plus
temporary renderer-independent view state into the visible graph consumed by
KG7. It owns structural disclosure, endpoint roll-up, aggregation, focus
slicing, and filters. It does not own parsing, Obsidian behavior, source access,
layout, rendering, interaction state persistence, or graph analytics.

```text
canonical KnowledgeSnapshot + ViewProjectionState
  → ProjectionWorkspace runtime indexes
  → ViewProjection plain data
  → KG7 renderer/layout
```

The only workspace dependency is `@icarus-graph-explorer/core`. Production
imports from source-specific packages, renderer/UI libraries, platform APIs,
and filesystem APIs are mechanically rejected by ESLint.

## File map

```text
src/
  types.ts             State, node, edge, issue, and validation contracts.
  workspace.ts         Validated canonical hierarchy/reference runtime indexes.
  ids.ts               Deterministic collision-safe projected tuple IDs.
  disclosure.ts        Structural visibility and stale-state diagnostics.
  base-projection.ts   Endpoint routing, hierarchy, aggregation, and provenance.
  filter-plan.ts       Once-per-call canonical/query/status filter preparation.
  candidate-eligibility.ts Direct DISC1 canonical candidate retention and ancestor closure.
  slicing.ts           Reference-hop focus and stable-scan post-focus filters.
  instrumentation.ts   Optional aggregate-only phase and operation evidence.
  validation.ts        Deserialized-output and cross-record invariant checks.
  presets.ts           Generic structural-depth and compatibility state helpers.
  reveal.ts            Canonical-target disclosure helper for navigation.
  focused-documents.ts Shared containing-document, filtered neighborhood, and detail-retention helpers.
  focused-detail.ts    Shared bounded Focus detail with root-scoped automatic depth.
  local.ts             Document-root normalization and the Focus projection entry point.
  structure.ts         Full Hierarchy projection plus compatibility Focus routing.
  project.ts           Public orchestration and one-call snapshot wrapper.
  index.ts             Intentional public surface.
  test-fixture.ts      Neutral canonical fixture shared only by package tests.
  *.test.ts            Disclosure, projection, focus/filter, and validation tests.
```

`workspace.ts` validates the snapshot before indexing it. `project.ts` runs
disclosure/roll-up/aggregation, then focus, then filters, and validates the
finished output before returning it.

## Public contract

```ts
const workspace = createProjectionWorkspace(snapshot);
const projection = projectView(workspace, state);

// Convenient when indexes will not be reused:
const oneOff = projectSnapshot(snapshot, state);

// Reveal one hidden canonical entity without renderer-specific logic:
const revealedState = revealEntityInViewState(workspace, state, entityId);
```

`ProjectionWorkspace` contains derived runtime maps and memoized descendant
lookups. It is not canonical, persisted, renderer-specific, or required to
serialize. `ViewProjection` contains only plain nodes, edges, and issues and
survives a JSON round trip.

Projected entity nodes supply the canonical entity ID/kind, path, start line,
section title when available, disclosure metadata, internal reference IDs,
content/context role, and focus distance represented as `number | null`.
Projection-only reference-target nodes retain unresolved, ambiguous, or invalid
status, raw target, exact reference IDs, canonical ambiguity candidates, and
distinct reason strings. Hierarchy edges connect visible entity ancestors to
descendants. Reference edges aggregate equal visible source/target/status groups
and retain every exact canonical `ReferenceId`.

## Structural disclosure

`defaultDepth` uses the shared `StructuralDepth` values `0 | 1 | 2 | 3`.
Depth 0 shows files/documents only; depths 1, 2, and 3 automatically show that
many canonical section-tree generations. Structural generations follow
parent/child hierarchy, not Markdown heading numbers, so an H1 → H3 → H5 chain
is fully eligible at depth 3. Expanding a visible entity may reveal descendants
beyond the baseline one parent at a time. A collapsed entity remains visible
but hides all descendants and takes precedence over expansion/default depth.

Optional `maxSectionLevel` is a separate literal Markdown heading ceiling using
canonical `SectionEntity.level`. It applies to both default depth and explicit
expansion, so an H2 cannot appear under an H1-only ceiling even when its parent
is expanded. Omitting the field preserves the prior unlimited behavior. Hidden
heading endpoints continue through the same nearest-visible-ancestor roll-up
and aggregation path as collapsed structural content.

Blocks are conservative: `includeBlocks` must be true **and** the block's
visible parent must be explicitly expanded. Blocks are never a structural
generation, and default depth alone never reveals them. Collapsed disclosure
metadata reports the number of descendant entity
nodes that one explicit Expand action can reveal under the current structural
and entity-filter constraints. It is the one-action visible delta, not total
canonical subtree size. Preserved expanded descendant IDs can therefore make a
reopened branch reveal more than its immediate children.

Candidate IDs stay projection-internal. The ordinary unfiltered path counts a
single indexed structural traversal. Path, entity-kind, and QUERY1 filters use
one prepared canonical predicate and derive candidate eligibility directly
from the union of visible and one-action candidate entities, followed by
ancestor closure inside that same universe. They do not build or filter a
second hypothetical graph. Projected-text filters retain the conservative
hypothetical projection fallback because raw diagnostic targets and projected
labels are not canonical entity fields. Reference-status filtering does not
change entity revealability. Because expansion can non-locally change reference endpoint
roll-up and Focus reachability in the generic one-pass `projectView`, that
low-level Focus path still suppresses speculative Expand metadata. Product
Structure uses `projectStructureView`: it establishes document reachability
first, so its second detailed pass can expose truthful one-action Expand counts
without changing the fixed file neighborhood. Exact Collapse affordances and
explicit expanded/collapsed intent remain preserved when Blocks, heading
limits, filters, or Focus temporarily remove an affordance.

`revealEntityInViewState` opens and uncollapses the target's ancestor chain. It
also enables blocks when the target is a block and minimally widens an existing
heading ceiling to include the target and its structural section ancestors. It
deliberately leaves focus and filters unchanged: application navigation owns
exiting focus and widening only filters that conflict with an explicit target.

Unknown expanded/collapsed IDs and expand/collapse conflicts produce sorted,
non-fatal projection issues. A missing or structurally hidden focus root returns
an empty projection with an explicit issue instead of crashing or returning a
plausible unrelated neighborhood.

## Endpoint roll-up and aggregation

Source and resolved target routing are independent. A hidden precise endpoint
climbs the canonical parent chain to its nearest structurally visible ancestor.
The route is memoized per projection pass, then references are processed once.
Filters never rerun this routing, so excluding a node cannot fabricate a new
rolled relationship.

Resolved references with equal projected source/target/status become one edge.
If both endpoints route to the same entity node, no reference self-loop is
emitted; the exact IDs are stored in that node's `internalReferenceIds`.

Non-resolved occurrences use projection-only target nodes—never fake canonical
documents. Their aggregation key includes projected source, status, raw target,
and sorted candidate set. Equivalent occurrences from one visible source can
aggregate, while identical target text from different visible sources stays
separate. JSON-tuple IDs and sorted arrays make output independent of canonical
input array order.

## Focus semantics

Focus starts from one already-visible canonical entity and performs a 1–3 hop
BFS over projected **reference** edges only. Direction may be incoming,
outgoing, or both. Structural ancestors are then added as `context` without
consuming hops; `ancestors-and-children` additionally retains direct visible
structural children as context. Reference-reached entities remain `content`
with their shortest distance.

Synthetic diagnostic targets may appear at distance one through their edge but
are traversal terminals. Context nodes carry no distance or internal reference
provenance and do not pull unrelated reference edges into the neighborhood.

## Focus projection semantics

Outside Focus, Hierarchy depth remains global across every eligible visible
document. Inside Focus, Network and Hierarchy consume the same projection.
`projectFocusedDetailView` first normalizes the exact file/heading/block Focus
root to its containing document and establishes a documents-only reference
neighborhood. Path and reference-status constraints are applied before that
bounded hop traversal; text, entity-kind, and QUERY1 filters remain part of the
later detailed pass.

The stable Focus root file is always retained as structural context even when
those later content filters exclude documents or match no currently disclosed
descendant. Filters still decide visible content and relationships; they cannot
erase the anchor required by both Focus renderers and Focus navigation.

The detailed pass sets ordinary automatic depth to zero and applies the stored
depth only to a projection-only set of detail document IDs—today the one Focus
root document. Depths 0/1/2/3 therefore retain the same file IDs while revealing
zero through three canonical section generations beneath the root. Neighbor
documents remain collapsed until manually expanded; manual collapse retains
precedence. Blocks still require both the Blocks opt-in and a genuinely manual
parent expansion, so root-scoped automatic depth cannot reveal them by itself.
Visible headings may take over precise reference endpoints without changing the
precomputed document neighborhood.

## Focus state normalization

`deriveLocalProjectionState` normalizes a document, section, or block target to
its stable containing document. It reuses KG6 `focus.rootEntityId`, hop count,
direction, disclosure depth/IDs, and filters. Fresh Focus entry is an
application concern: All Network enters at depth 0 and All Hierarchy inherits
its current depth, while both clear previous manual disclosure overrides.

`projectLocalView` delegates to that shared Focus detail contract. This prevents
revealing a heading from admitting an unrelated vault region and ensures both
renderers show identical nodes and edges. It emits ordinary validated
`ViewProjection` data—no Focus canonical model, renderer traversal, folder
relation, or copied source truth.

## Filter semantics

Filters are prepared once, then run after structural projection and focus.
They combine across configured dimensions and never mutate or reroute
canonical relationships. Normal filtering scans the already sorted nodes and
edges in input order, filters existing hierarchy edges, and reuses unchanged
node/edge objects; it does not reconstruct or resort graph topology:

- `pathPrefixes` accepts normalized workspace-relative exact paths/folder
  prefixes; invalid prefixes produce issues and never broaden a match.
- `text` is case-insensitive over projected source paths, section titles, and
  raw synthetic targets only. It never searches Markdown body text.
- `entityKinds` selects matching content entities; required visible ancestors
  remain as `context`.
- `query` stores canonical QUERY1 text. `projectView` parses it once and reuses
  that expression for the visible and DISC1 candidate passes. Predicates use
  canonical paths and section titles; invalid external strings fail closed with
  an `invalid-query` issue.
- `referenceStatuses` removes nonmatching edges, clears excluded resolved
  internal provenance, and removes orphan synthetic targets.

Resolved edges survive entity filtering only when both endpoints remain content
matches. A matching synthetic raw target may retain its eligible source as
context, but it cannot cross an excluded path/kind/focus boundary. Structural
context never pulls unrelated references.

## Validation and provenance

`validateViewProjection(workspace, unknownValue)` checks plain shapes,
deterministic ordering, unique node/edge IDs, canonical entity/reference
membership, non-negative actionable reveal counts, endpoints, entity-only
hierarchy edges, non-self reference edges,
diagnostic candidates/provenance, focus metadata, and source-scoped tuple IDs.
Sorted-array and sorted-ID invariants are checked with linear adjacent scans;
this avoids validation-only array copies and sorts without relaxing any
accepted or rejected shape.

For every relationship that survives disclosure/focus/filter policy, its
canonical reference appears exactly once in a projected reference edge or an
entity's internal reference IDs. Synthetic nodes mirror their incoming edge IDs
so a renderer can inspect the target without accessing canonical data; that
mirror is metadata for the same diagnostic path, not a second relationship.

The implementation uses ordinary maps/sets, memoized ancestor routing, one-pass
aggregation, and bounded BFS. `projectView` accepts an optional runtime-only,
aggregate instrumentation seam; ordinary product callers omit it and no path,
query, ID, or source content is retained. The KG5 synthetic harness measures
small/medium index, disclosure, focus, and filter scenarios without enforcing
timing budgets. `pnpm benchmark:query-projection` adds phase distributions,
deterministic operation counts, and the repeated A → B → C → Clear → A query
sequence. Its output is investigative and belongs under ignored
`output/performance/`.

## KG7 handoff

KG7 can treat `ViewProjection` as the complete visible relationship model. It
does not need canonical data to choose roll-up endpoints, aggregate edges,
interpret expand/collapse, find focus neighborhoods, apply supported filters,
or distinguish diagnostic targets. KG7 still owns layout, visual mapping,
interaction, selection, and renderer adaptation.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/view-projection typecheck
pnpm exec vitest run packages/view-projection
```
