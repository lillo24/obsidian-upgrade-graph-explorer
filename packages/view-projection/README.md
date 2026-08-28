# View Projection

Status: **STABLE — UX3 heading disclosure and KG6 projection semantics are pure-test-backed.**

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
  slicing.ts           Reference-hop focus and post-focus projected filters.
  validation.ts        Deserialized-output and cross-record invariant checks.
  presets.ts           Documents-only and top-level-section state helpers.
  reveal.ts            Canonical-target disclosure helper for navigation.
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

`defaultDepth: 0` shows documents. `defaultDepth: 1` also shows direct document
sections regardless of their Markdown heading number. Expanding a visible
entity reveals its immediate children; recursive disclosure requires each
parent to be expanded. A collapsed entity remains visible but hides all of its
descendants and takes precedence over expansion/default depth.

Optional `maxSectionLevel` is a separate literal Markdown heading ceiling using
canonical `SectionEntity.level`. It applies to both default depth and explicit
expansion, so an H2 cannot appear under an H1-only ceiling even when its parent
is expanded. Omitting the field preserves the prior unlimited behavior. Hidden
heading endpoints continue through the same nearest-visible-ancestor roll-up
and aggregation path as collapsed structural content.

Blocks are conservative: `includeBlocks` must be true **and** the block's
visible parent must be explicitly expanded. Default depth alone never reveals
blocks. Each visible entity reports how many canonical descendants remain
structurally hidden. Filtering does not rewrite that structural disclosure
metadata.

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

## Filter semantics

Filters run after structural projection and focus, combine across configured
dimensions, and never mutate or reroute canonical relationships:

- `pathPrefixes` accepts normalized workspace-relative exact paths/folder
  prefixes; invalid prefixes produce issues and never broaden a match.
- `text` is case-insensitive over projected source paths, section titles, and
  raw synthetic targets only. It never searches Markdown body text.
- `entityKinds` selects matching content entities; required visible ancestors
  remain as `context`.
- `referenceStatuses` removes nonmatching edges, clears excluded resolved
  internal provenance, and removes orphan synthetic targets.

Resolved edges survive entity filtering only when both endpoints remain content
matches. A matching synthetic raw target may retain its eligible source as
context, but it cannot cross an excluded path/kind/focus boundary. Structural
context never pulls unrelated references.

## Validation and provenance

`validateViewProjection(workspace, unknownValue)` checks plain shapes,
deterministic ordering, unique node/edge IDs, canonical entity/reference
membership, endpoints, entity-only hierarchy edges, non-self reference edges,
diagnostic candidates/provenance, focus metadata, and source-scoped tuple IDs.

For every relationship that survives disclosure/focus/filter policy, its
canonical reference appears exactly once in a projected reference edge or an
entity's internal reference IDs. Synthetic nodes mirror their incoming edge IDs
so a renderer can inspect the target without accessing canonical data; that
mirror is metadata for the same diagnostic path, not a second relationship.

The implementation uses ordinary maps/sets, memoized ancestor routing, one-pass
aggregation, and bounded BFS. The KG5 synthetic harness measures small/medium
index, disclosure, focus, and filter scenarios without enforcing timing budgets.

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
