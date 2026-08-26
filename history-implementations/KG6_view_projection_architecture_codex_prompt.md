# KG6 — Renderer-Independent View Projection Architecture

**Task type:** core graph-view architecture / projection semantics / pure transformation layer

## Goal

Implement the renderer-independent projection layer that turns canonical KG1 source truth into a graph-shaped **view model** suitable for KG7.

KG6 is where the explorer should formally answer:

- which canonical entities are visible right now;
- which structural descendants are collapsed;
- where references point when their exact canonical endpoints are hidden;
- how several precise references aggregate into one visible edge;
- how unresolved / ambiguous / invalid references are represented without inventing canonical source entities;
- how a selected local/focus neighborhood is extracted;
- how view filters operate without mutating source truth;
- which data the renderer receives versus which data remains canonical.

The core contract is:

```text
KnowledgeSnapshot
    +
renderer-independent projection/view state
    ↓
ViewProjection
    ├─ visible entity nodes
    ├─ synthetic diagnostic target nodes
    ├─ structural hierarchy edges
    ├─ aggregated reference edges
    ├─ exact underlying ReferenceIds
    ├─ collapsed/internal reference provenance
    └─ projection diagnostics/issues
```

KG6 must **not** implement a graph renderer.

Do not add React Flow, Sigma, Graphology, layout engines, persistence, Tauri, or source access.

The projection must remain:

- source-neutral;
- renderer-neutral;
- deterministic;
- immutable with respect to canonical input;
- JSON-serializable at its output boundary;
- efficient enough for repeated interactive recomputation;
- testable without React.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

KG5 was merged through PR #6 at:

`08d993136a353011013b13b601c024b3fbb00412`

The current architecture now provides:

```text
KG1 canonical model
KG2 Markdown structure
KG3 Obsidian syntax
KG4 workspace resolution
KG5 validated diagnostic workflow
```

The canonical `KnowledgeSnapshot` currently contains:

```ts
interface KnowledgeSnapshot {
  readonly schemaVersion: 1;
  readonly workspace: WorkspaceDescriptor;
  readonly entities: readonly AddressableEntity[];
  readonly references: readonly Reference[];
}
```

Canonical entity kinds:

```ts
type EntityKind = 'document' | 'section' | 'block';
```

Canonical references retain:

```text
sourceEntityId
rawTarget
sourceSpan
kind: link | embed
resolution:
  resolved
  unresolved
  ambiguous
  invalid
```

KG4 guarantees:

- exact document/section hierarchy;
- conservative marker-backed block entities;
- one canonical reference per source occurrence;
- exact source ownership;
- explicit candidate IDs for ambiguous references;
- no arbitrary guessed resolution.

KG5 real-vault validation confirmed that this source model is sufficient to derive endpoint roll-up without changing canonical truth.

Current real-vault evidence:

```text
195 Markdown documents
714 sections
1 explicit block
438 references
388 resolved
49 unresolved
1 ambiguous
0 invalid
```

Current core theory graph-interest subset:

```text
105 documents
440 sections
349 references
```

Performance evidence is small enough that correctness and clean architecture still dominate. KG5 synthetic medium:

```text
500 documents
4,000 sections
16,000 references
```

completed parse/adapt, resolution, and diagnostic report construction comfortably on the current development machine. These measurements are evidence only, not budgets.

The roadmap marks KG6 as:

> Renderer-independent granularity, collapse/endpoint roll-up, aggregated provenance, focus-neighborhood, and supported filter contracts.

---

# Plugin-research decisions already accepted

A prior plugin research pass compared ideas from Node Tree Graph, Folders to Graph, Clew, Juggl, ExcaliBrain, Advanced Graph View, Strange New Worlds, and related tools.

KG6 should integrate the architectural lessons that survived review:

## Adopt now

- explicit structural collapse semantics;
- nearest-visible-ancestor endpoint roll-up;
- aggregated projected edges retaining exact underlying reference IDs;
- renderer-independent focus / ego projection;
- renderer-independent filters;
- synthetic representations for unresolved / ambiguous / invalid targets;
- pure graph/projection logic with deterministic tests;
- worker-ready serializable boundaries.

## Do not implement now

- graph renderer;
- physics/layout;
- hover behavior;
- saved state;
- semantic similarity;
- PageRank / communities / centrality;
- typed semantic relationships;
- Dataview integration;
- 3D;
- large settings panels;
- source editing.

Important rule:

> Plugin behavior may inform projection semantics, but canonical truth must remain the Icarus source-neutral KG1 model.

If implementation work inspects plugin source, respect its license. Do not copy GPL/AGPL implementation into this repository without an explicit licensing decision.

---

# Required first step

Before editing:

1. sync and inspect the actual latest `main`;
2. verify the working tree is clean;
3. read:
   - `AGENTS.md`;
   - `docs/ARCHITECTURE.md`;
   - `docs/ROADMAP.md`;
   - relevant ADRs;
   - `packages/core/src/model/*`;
   - `packages/diagnostics-obsidian/README.md`;
   - `packages/resolver-obsidian/README.md`;
   - the KG5 synthetic benchmark/tool code;
   - current package/lint patterns;
4. inspect whether any repository-owned wording makes a stronger projection decision than this prompt;
5. follow the repository branch/PR/merge/cleanup workflow.

If a real architectural contradiction is found, surface it rather than silently choosing one side.

---

# Package ownership

A new source-neutral package is justified.

Preferred direction:

```text
packages/view-projection/
```

with a package name approximately:

```text
@icarus-graph-explorer/view-projection
```

Dependency direction:

```text
view-projection
    → core
```

It should **not** depend on:

- adapter-obsidian;
- resolver-obsidian;
- diagnostics-obsidian;
- React;
- React DOM;
- React Flow;
- Sigma;
- Graphology;
- Tauri;
- Node filesystem APIs;
- browser filesystem APIs;
- apps/web.

This package owns generic transformation from canonical source truth into renderer-independent visible graph truth.

Add the same lightweight mechanical import-boundary protection already used elsewhere if it fits the existing ESLint setup.

Do not add an external graph library.

---

# Important conceptual separation

KG6 introduces three distinct layers that must not be conflated.

## 1. Canonical truth

Existing KG1 data:

```text
Document
Section
Block
Reference
resolution state
source provenance
```

Never mutated by projection.

## 2. Projection/view state

Temporary application intent such as:

```text
structural disclosure
focus root / hop depth
filters
include blocks
```

This is renderer-independent.

KG9 may persist some of this later.

## 3. Projected graph

Derived visible graph:

```text
projected entity nodes
synthetic diagnostic target nodes
hierarchy edges
aggregated reference edges
```

This is not canonical truth and should be safe to recreate at any time.

The renderer must not decide which canonical endpoint a hidden section rolls up to. That belongs here.

---

# Projection workspace/index seam

Repeated expand/collapse/focus interactions should not require repeatedly rediscovering the canonical hierarchy from arrays.

Create a small derived runtime index/workspace object.

Conceptually:

```ts
const projectionWorkspace = createProjectionWorkspace(snapshot);
const result = projectView(projectionWorkspace, state);
```

The exact API may differ.

The projection workspace may internally contain ordinary runtime Maps/Sets such as:

```text
entityById
childrenByParentId
parentByEntityId
referencesBySource
incomingResolvedReferences
documentByEntity
```

These maps are derived runtime indexes only.

They must not:

- be stored in `KnowledgeSnapshot`;
- become renderer-specific;
- be required to serialize;
- contain React/Graphology objects.

The **projected output**, however, should remain plain serializable data.

If a one-call API is also convenient for tests, a small wrapper is acceptable.

---

# Projection output

The exact names should follow repository conventions, but the result needs a clear renderer-independent graph shape.

A reasonable direction is:

```ts
interface ViewProjection {
  readonly nodes: readonly ProjectedNode[];
  readonly edges: readonly ProjectedEdge[];
}

type ProjectedNode =
  | ProjectedEntityNode
  | ProjectedReferenceTargetNode;

type ProjectedEdge =
  | ProjectedHierarchyEdge
  | ProjectedReferenceEdge;
```

Do not expose renderer coordinates, dimensions, styles, handles, DOM IDs, React components, or layout positions.

---

# Projected entity nodes

A canonical visible entity should produce one projected node.

Conceptually:

```ts
interface ProjectedEntityNode {
  readonly id: ProjectionNodeId;
  readonly kind: 'entity';
  readonly entityId: EntityId;
  readonly entityKind: EntityKind;
  readonly hasHiddenChildren: boolean;
  readonly hiddenDescendantCount: number;
  readonly internalReferenceIds: readonly ReferenceId[];
  readonly role: 'content' | 'context';
  readonly focusDistance?: number;
}
```

Naming/shape may differ.

### Why hidden-child metadata belongs here

KG7 needs to know whether an expand affordance is meaningful without rediscovering hierarchy itself.

`hiddenDescendantCount` can later support simple collapsed-state cues or weighting without making renderer code canonical-structure-aware.

Do not add renderer styling decisions.

### Internal references

If exact source and target roll up to the **same visible node**, do not emit a noisy self-loop by default.

Instead retain those canonical `ReferenceId`s on that visible entity node as:

```text
internalReferenceIds
```

or an equivalent projection-level provenance field.

This preserves source truth while keeping a collapsed document-level view readable.

Do not delete or deduplicate the canonical references.

---

# Synthetic diagnostic target nodes

Unresolved, ambiguous, and invalid canonical references have no single resolved canonical target.

KG7 still needs something visual to represent them.

Do not create fake `DocumentEntity` values.

Instead KG6 should provide **projection-only synthetic target nodes**.

Conceptually:

```ts
interface ProjectedReferenceTargetNode {
  readonly id: ProjectionNodeId;
  readonly kind: 'reference-target';
  readonly status: 'unresolved' | 'ambiguous' | 'invalid';
  readonly rawTarget: string;
  readonly referenceIds: readonly ReferenceId[];
  readonly candidateEntityIds?: readonly EntityId[];
}
```

The actual shape may be refined.

Rules:

- synthetic nodes never enter `KnowledgeSnapshot`;
- synthetic nodes cannot become structural parents;
- unresolved and invalid nodes have no canonical target;
- ambiguous nodes preserve the exact candidate entity IDs from canonical resolution;
- renderer styling belongs to KG7;
- projection output should contain enough information that KG7 does not need to reinterpret resolver semantics.

## Synthetic target aggregation

Do not necessarily create one synthetic node for every occurrence.

A useful conservative aggregation key is approximately:

```text
visible projected source node
+ resolution status
+ raw target
+ candidate set when ambiguous
```

This allows repeated hidden section references that roll to one visible document and point to the same unresolved raw target to share one synthetic visual target.

Do not aggregate unresolved targets globally across unrelated source contexts: relative target semantics can differ between source documents.

Every synthetic target node must retain all exact underlying `ReferenceId`s.

---

# Projected hierarchy edges

Structural hierarchy is derived from canonical parent relationships.

Create a projected hierarchy edge between visible canonical entity nodes where appropriate.

Direction:

```text
parent → child
```

Do not represent canonical containment as source `Reference`.

Hierarchy edges are projection structure.

If filtering/focus removes an intermediate canonical node while retaining a descendant as context/content, connect the descendant to the **nearest visible structural ancestor** and make that behavior explicit/tested.

Do not create hierarchy edges to synthetic diagnostic target nodes.

---

# Projected reference edges

Resolved references whose projected source and target are different visible nodes should produce reference edges.

Several precise canonical references may collapse into one visible edge.

Conceptually:

```ts
interface ProjectedReferenceEdge {
  readonly id: ProjectionEdgeId;
  readonly kind: 'reference';
  readonly sourceNodeId: ProjectionNodeId;
  readonly targetNodeId: ProjectionNodeId;
  readonly status: ReferenceResolutionStatus;
  readonly referenceIds: readonly ReferenceId[];
}
```

For a normal resolved edge:

```text
status = resolved
targetNode = visible canonical entity
```

For unresolved / ambiguous / invalid:

```text
targetNode = synthetic projection node
```

Aggregate only references whose **projected** semantics are the same.

Do not lose underlying `ReferenceId`s because KG8 must later explain why every projected edge exists.

Reference ID arrays must be deterministic and de-duplicated.

---

# Structural disclosure model

Do not build a user-facing H1/H2/H3 settings system.

Use tree disclosure.

The projection state should support both:

```text
documents-only
documents + top-level sections
progressively expanded selected hierarchies
```

without baking Markdown heading numbers into visibility behavior.

A useful generic disclosure model is conceptually:

```ts
interface StructuralDisclosureState {
  readonly defaultDepth: 0 | 1;
  readonly expandedEntityIds: readonly EntityId[];
  readonly collapsedEntityIds: readonly EntityId[];
  readonly includeBlocks: boolean;
}
```

This is guidance, not mandatory naming.

## Structural depth

Use **canonical tree depth**, not Markdown heading level.

Example with skipped levels:

```text
Document
  H1
    H3
```

still has structural depths:

```text
Document = 0
H1       = 1
H3       = 2
```

## Default depth

`0`:

```text
documents only
```

`1`:

```text
documents + direct section children
```

Do not create arbitrary depth 1–20 controls just because the algorithm could.

Later explicit expansion handles deeper hierarchy.

## Expanded state

Expanded document/section:

```text
reveal its immediate structural children
```

Expansion can recursively expose descendants when several ancestors are expanded.

## Collapsed state

Collapsed wins over:

- default depth;
- expanded state.

This lets a global “top sections” view still collapse one document.

If an entity appears in both expanded and collapsed collections:

```text
collapsed wins
```

and the projection may return a non-fatal view-state issue.

## Blocks

Default:

```text
includeBlocks = false
```

because marker-backed blocks are much finer granularity and currently rare.

When enabled, make their visibility rules simple and documented.

A reasonable behavior is:

```text
block visible only when its parent is visible and expanded
```

unless current tree/disclosure implementation suggests a cleaner equivalent.

Do not expose every canonical block in document-only mode.

---

# Nearest-visible-ancestor endpoint roll-up

This is the most important KG6 requirement.

For each canonical entity, structural disclosure determines whether it has a visible projected entity node.

For a reference endpoint that is structurally hidden:

```text
exact canonical endpoint
      ↓
parent
      ↓
parent
      ↓
nearest visible canonical ancestor
```

Use the first visible canonical ancestor.

This applies independently to:

- source endpoint;
- resolved target endpoint.

Example:

```text
A.md
  H1
    H2
      reference → B.md / H1 / H2
```

Documents-only projection:

```text
A.md → B.md
```

Expanded source document, collapsed target document:

```text
A.md / H1 or H2 → B.md
```

depending on exact visible source depth.

Canonical ownership remains unchanged.

## Missing visible ancestor

A canonical document is normally a visible structural root when it remains in projection scope.

If filters/focus remove the entire document context and no visible ancestor exists:

```text
endpoint cannot be projected
```

The associated edge should be omitted from that filtered/focused view.

Do not roll across documents to unrelated nodes.

---

# Important filter rule: filters do not rewrite structural roll-up

Distinguish:

```text
hidden because structurally collapsed
```

from:

```text
removed because the user filtered it out
```

Roll-up exists to preserve precision when **structural detail is collapsed**.

A filter should not magically redirect an excluded entity's edge to some other node merely to keep the edge visible.

Recommended pipeline:

```text
canonical snapshot
    ↓
structural disclosure + endpoint roll-up + aggregation
    ↓
optional focus slice
    ↓
view filtering / required structural context
    ↓
final projection
```

If implementation evidence suggests a slightly different ordering, preserve this semantic rule:

> filtering must not fabricate relationships from data the filter explicitly excluded.

Document the exact ordering.

---

# Focus / ego projection

KG7 should be able to switch from broad structural exploration to a selected local neighborhood without renderer-specific graph analysis.

KG6 should therefore support a focus mode.

Important simplification:

> Focus should operate on the already rolled/aggregated projected reference graph, not by inventing a second source-resolution algorithm.

This means a collapsed document can be focused as a document-level node and its section-owned references naturally appear through roll-up.

Conceptually:

```ts
interface FocusState {
  readonly rootEntityId: EntityId;
  readonly maxReferenceHops: 1 | 2 | 3;
  readonly direction: 'incoming' | 'outgoing' | 'both';
  readonly hierarchyContext: 'ancestors' | 'ancestors-and-children';
}
```

Names may differ.

Do not allow arbitrary 20-hop focus in the initial contract.

## Focus traversal

Traverse:

```text
projected reference edges
```

not hierarchy edges.

Hierarchy is context.

Synthetic unresolved/ambiguous/invalid targets may appear at distance 1 but must not be traversed beyond themselves.

## Focus context

After determining focus content nodes:

- retain the focused root;
- retain N-hop reference neighbors;
- include enough structural ancestor context to understand where canonical entity nodes live;
- optionally include direct structural children according to the chosen hierarchy-context policy.

Mark hierarchy-only additions as:

```text
role = context
```

rather than pretending they were reference-neighborhood matches.

Record:

```text
focusDistance = 0, 1, 2, 3
```

for actual focus content nodes where useful.

## Hidden focus root

KG7 will initially focus visible nodes, so focus roots should normally already exist in the base structural projection.

If callers request a canonical entity hidden by disclosure:

- either return a clear projection issue;
- or provide a documented helper to derive disclosure that reveals its ancestor chain.

Do not silently change canonical state.

Avoid overbuilding hidden-search navigation in KG6; KG8 owns richer search/navigation behavior.

---

# View filters

KG6 should implement a small set of high-value filters already accepted by the roadmap.

Do not add tag/property filters yet.

The current canonical/adapter model does not generically expose them.

Supported filter concepts:

```text
path
text/title
entity kind
reference resolution status
```

Keep them renderer-independent.

A reasonable shape:

```ts
interface ProjectionFilters {
  readonly pathPrefixes?: readonly WorkspacePath[];
  readonly text?: string;
  readonly entityKinds?: readonly EntityKind[];
  readonly referenceStatuses?: readonly ReferenceResolutionStatus[];
}
```

Refine as needed.

## Path filter

Match canonical entity source paths.

Case behavior is a **view search/filter policy**, not Obsidian resolver policy.

A case-insensitive UI-oriented filter is acceptable as long as it does not alter canonical target resolution.

Use normalized workspace paths.

## Text filter

KG6 does not have source text.

Match only data actually available in canonical/projected truth, such as:

- document path;
- section title;
- unresolved raw target for synthetic nodes.

Do not claim full content search.

KG8 can later provide richer search/navigation.

## Entity-kind filter

If a matching section/block requires structural ancestors for understandable hierarchy:

- keep required ancestors as `context` nodes;
- do not treat the context ancestor as a content match.

## Resolution-state filter

Filter projected reference relationships by:

```text
resolved
unresolved
ambiguous
invalid
```

If a synthetic diagnostic target loses all reference edges due to filtering:

```text
remove the orphan synthetic target node
```

Do not leave meaningless ghosts.

## Search versus global navigation

Document this distinction:

```text
KG6 text filter = filter the current projection/view
KG8 search      = find/navigate canonical entities, including currently hidden ones
```

Do not make KG6's simple projection filter a full search engine.

---

# Filter / context closure

After filtering visible canonical entity nodes, preserve enough ancestors to keep their structural context.

Example:

```text
Document
  Section A
    Section B   ← text match
```

Filtered graph may retain:

```text
Document       role=context
Section A      role=context
Section B      role=content
```

Do not show unrelated siblings merely because an ancestor is retained.

Hierarchy edges should connect the resulting visible chain.

Reference edges should only survive according to the explicitly documented filter semantics; context nodes should not pull in unrelated references just because they remain structurally visible.

This distinction between:

```text
content node
context-only node
```

should be explicit in projection data.

---

# Synthetic target behavior under filters/focus

Synthetic unresolved/ambiguous/invalid nodes are reference evidence.

They should exist only if at least one surviving projected reference edge points to them.

They do not independently pass path/entity-kind filtering because they are not canonical source entities.

Text filtering may match their `rawTarget` if the current filter semantics allow it.

Do not allow a ghost node to keep an otherwise excluded source branch alive.

---

# Ambiguous candidate handling

Do not render ambiguous canonical references as if they were resolved edges to every candidate.

That would visually imply several true relationships.

Instead:

```text
source visible node
      ↓
synthetic ambiguous target node
```

The synthetic node preserves:

```text
candidateEntityIds[]
```

KG7/KG8 can later reveal candidates.

This preserves uncertainty.

Do not roll ambiguous candidates to visible ancestors and silently collapse them into one apparently resolved target.

If a future UX chooses to preview candidates, that remains separate from canonical/projection certainty.

---

# Unresolved / invalid behavior

Unresolved:

```text
synthetic target with rawTarget + reason/provenance via ReferenceIds
```

Invalid:

```text
synthetic target with rawTarget + invalid status
```

Do not infer missing filenames.

Do not create source files.

Do not attempt attachment modeling.

KG5 already confirmed many unsupported attachment references exist and remain intentionally outside schema v1.

---

# Deterministic IDs and ordering

Projection IDs are not canonical IDs.

They only need deterministic identity for a given projection so KG7 can efficiently update renderer nodes.

Create collision-safe deterministic IDs without a new hash dependency unless needed.

A JSON-tuple encoding or similarly unambiguous scheme is acceptable.

Conceptual examples:

```text
entity node:
["entity", entityId]

synthetic target:
["reference-target", sourceProjectionNodeId, status, rawTarget, candidateIds]

hierarchy edge:
["hierarchy", parentProjectionNodeId, childProjectionNodeId]

reference edge:
["reference", sourceProjectionNodeId, targetProjectionNodeId, status]
```

Do not let delimiter-containing filenames/entity IDs create collisions.

Ordering should be deterministic independent of Map insertion accidents.

Exact ordering may follow source structural order and stable source/target/status keys if that best matches existing repository conventions.

---

# View-state validation / stale IDs

KG9 will eventually persist view state across source changes.

KG6 should not crash if its renderer-independent state contains stale IDs.

Return small non-fatal projection issues for cases such as:

```text
unknown expanded entity
unknown collapsed entity
unknown focus root
same entity both expanded and collapsed
```

Do not create a large diagnostics framework.

A missing focus root may prevent focus mode specifically, but should fail cleanly rather than throwing an opaque exception.

Canonical snapshot invalidity is different: callers should pass a valid snapshot.

---

# Projection output validation

The projected graph will become a major architecture boundary between KG6 and KG7.

Add lightweight runtime invariant validation or assertions for projection output.

At minimum verify:

- projected node IDs unique;
- projected edge IDs unique;
- every edge endpoint exists;
- entity projected nodes point to existing canonical entities;
- underlying reference IDs exist;
- underlying reference ID arrays have no duplicates;
- hierarchy edges do not target synthetic nodes;
- synthetic ambiguous candidates exist in canonical snapshot;
- synthetic nodes have at least one underlying reference;
- focus distances are valid;
- context/content role combinations are coherent;
- no self-loop reference edge is emitted if internal refs are represented on nodes;
- JSON round trip preserves projected truth.

Do not add a large schema dependency unless it clearly reduces complexity.

---

# Important provenance invariant

Every visible reference relationship must remain explainable.

For a projected aggregated edge:

```text
ProjectedReferenceEdge.referenceIds[]
```

must allow KG8 to recover every precise canonical source occurrence.

For an internal rolled-up relationship:

```text
ProjectedEntityNode.internalReferenceIds[]
```

must preserve the same provenance.

For a synthetic target node:

```text
referenceIds[]
```

must preserve the source occurrences responsible for the visual diagnostic target.

No graph-view optimization may throw away the provenance needed to answer:

> Why is this node/edge here?

This is one of the project's main advantages over ordinary graph tools.

---

# Resolved reference roll-up examples

## Example 1 — document-only

Canonical:

```text
A.md
  Section A1
    ref-1 → B.md / B2

B.md
  Section B1
    Section B2
```

Visible:

```text
A.md
B.md
```

Projected:

```text
A.md ──ref-1──→ B.md
```

## Example 2 — one source expanded

Visible:

```text
A.md
  Section A1

B.md
```

Projected:

```text
Section A1 ──ref-1──→ B.md
```

## Example 3 — aggregation

Canonical:

```text
A/A1 → B/B1
A/A2 → B/B2
A/A3 → B/B2
```

Documents only:

```text
A.md ── referenceIds [r1,r2,r3] ──→ B.md
```

One projected edge.

## Example 4 — internal collapse

Canonical:

```text
A/A1 → A/A2
```

Documents only:

```text
A.md
  internalReferenceIds = [r1]
```

No noisy self-loop edge.

---

# Synthetic diagnostic examples

## Unresolved

Canonical:

```text
A/A1 → rawTarget "Missing"
status = unresolved
```

Documents only:

```text
A.md → [synthetic unresolved "Missing"]
```

## Ambiguous

Canonical:

```text
A/A1 → rawTarget "Note"
status = ambiguous
candidates = [folder-a/Note.md, folder-b/Note.md]
```

Projected:

```text
A.md → [synthetic ambiguous "Note"]
```

The synthetic node retains candidate canonical IDs.

Do not render fake resolved edges to every candidate.

## Invalid

Canonical:

```text
A/A1 → rawTarget "../outside"
status = invalid
```

Projected:

```text
A.md → [synthetic invalid "../outside"]
```

---

# Focus examples

Base document projection:

```text
A → B
B → C
B → D
D → E
```

Focus:

```text
root = B
hops = 1
direction = both
```

Content:

```text
A
B
C
D
```

`E` absent.

Focus distance:

```text
B = 0
A/C/D = 1
```

If those nodes are sections, preserve required document/section ancestors as context.

With `hops = 2`, E may appear if traversal reaches it through D.

Hierarchy edges must not count as reference hops.

---

# Filtering examples

## Entity kind

If:

```text
entityKinds = ['section']
```

sections are content matches.

Required document/ancestor nodes may remain:

```text
role = context
```

Do not treat document references as matching solely because the document is retained for context.

## Resolution status

If:

```text
referenceStatuses = ['unresolved', 'ambiguous']
```

resolved reference edges disappear.

Canonical snapshot remains unchanged.

Orphan synthetic nodes disappear.

## Text

If:

```text
text = "value"
```

match only currently projected data such as:

- section titles;
- document paths;
- raw synthetic targets.

Do not inspect source Markdown body text.

---

# Granularity helpers / presets

The core projection contract can remain small while exposing a few convenience constructors/presets.

Useful helpers may include equivalents of:

```text
documentOnlyProjectionState()
topLevelSectionProjectionState()
```

Do not add a large settings object or 20 presets.

These helpers should just produce ordinary projection state.

KG7 can choose good defaults.

---

# Performance integration

KG5 established the benchmark harness.

KG6 should extend it with projection timings.

Do not introduce pass/fail timing budgets.

Measure at least representative operations:

```text
projection workspace/index construction
documents-only projection
top-level-section projection
expanded hierarchy projection
1-hop focus projection
resolution-state filter projection
```

Use the existing deterministic synthetic workload generator.

At minimum exercise:

```text
small
medium
```

locally.

A large workload can remain opt-in.

Record counts:

```text
canonical entities
canonical references
projected nodes
projected edges
aggregated reference groups
synthetic diagnostic targets
```

Benchmark output should remain concise.

Do not benchmark React or layout in KG6.

Do not introduce workers.

---

# Performance implementation posture

Avoid obvious quadratic behavior.

Build canonical indexes once.

Endpoint routing should not repeatedly climb the hierarchy from scratch for every reference if a simple memoized visible-ancestor map can make it near-linear.

A good conceptual strategy:

```text
canonical entities
   ↓
visibility calculation
   ↓
memoized route-to-visible-node per entity
   ↓
single reference pass
   ↓
edge aggregation maps
```

Focus extraction:

```text
projected adjacency index
   ↓
small BFS up to max 3 hops
```

Filters should operate on the projected read model, not repeatedly rescan original Markdown source.

Do not prematurely optimize beyond clear data structures.

No Rust/WASM.

---

# Testing strategy

Use focused pure tests.

Prefer synthetic canonical snapshots rather than involving KG3/KG4 unless one integration fixture is useful.

## Required scenarios

### A. Documents only
All documents visible, descendants hidden.

### B. Top-level sections
Direct document sections visible; nested sections remain hidden.

### C. Progressive expansion
Expand document → section → subsection one level at a time.

### D. Collapse override
Collapsed entity hides descendants even if broader state would reveal them.

### E. Hidden descendant metadata
`hasHiddenChildren` and hidden descendant count remain correct.

### F. Blocks
Blocks hidden by default and exposed according to documented rule.

### G. Source roll-up
Reference source hidden in nested section routes to nearest visible source ancestor.

### H. Target roll-up
Resolved target hidden in nested section routes to nearest visible target ancestor.

### I. Edge aggregation
Several precise resolved references with the same projected endpoints become one edge retaining all underlying IDs.

### J. Internal rolled-up reference
Source/target becoming one projected node is retained as internal provenance without self-loop edge.

### K. Unresolved synthetic target
Correct synthetic node/edge, raw target, reference provenance.

### L. Ambiguous synthetic target
Candidate IDs preserved; no fake resolved edges to candidates.

### M. Invalid synthetic target
Status/provenance retained.

### N. Synthetic aggregation
Repeated equivalent unresolved occurrences aggregate without cross-context corruption.

### O. Focus 1 hop
Correct local neighborhood.

### P. Focus 2/3 hops
Correct bounded BFS.

### Q. Directional focus
Incoming/outgoing/both behave correctly.

### R. Focus hierarchy context
Required ancestors retained as context, not counted as reference hops.

### S. Diagnostic target focus
Synthetic target may appear but does not expand traversal.

### T. Path filter
Only intended projected paths remain, with required context.

### U. Text filter
Matches available projected label data only.

### V. Entity-kind filter
Matched entities remain content; required ancestors remain context.

### W. Resolution filter
Edges/states filtered correctly; orphan synthetic nodes removed.

### X. Filter does not reroute excluded relationships
No fabricated roll-up due solely to filter removal.

### Y. Stale expanded/collapsed IDs
Non-fatal issue, deterministic projection.

### Z. Unknown focus root
Clear failure/issue rather than crash.

### AA. Determinism
Same snapshot + state → byte-equivalent JSON projection.

### AB. Input array order
Equivalent canonical content should not produce arbitrary relationship/ID changes due to Map insertion order.

### AC. JSON round trip
Projected output survives stringify/parse and validation.

### AD. Canonical immutability
Projection does not mutate input snapshot/state.

### AE. Provenance coverage
Every canonical reference that contributes to the current projected graph is represented exactly once in one of:

```text
projected reference edge
internal reference IDs
synthetic reference-target path
```

except references deliberately excluded by focus/filter policy.

This test is particularly important.

---

# Benchmark fixture integration

Do not contaminate generic projection tests with private Icarus data.

Extend the existing deterministic synthetic workload system if it is clean to do so.

If the KG5 benchmark currently produces parsed/resolved snapshots internally, reuse its generator boundaries rather than generating a second incompatible synthetic-vault system.

Keep projection package tests runnable without filesystem access.

---

# No renderer / layout

KG6 output should be immediately usable by a renderer, but should know nothing about renderer implementation.

Do not introduce:

```text
x/y coordinates
node width/height
React Flow Node
React Flow Edge
handles
ports
SVG paths
Pixi objects
Sigma Graph
Graphology Graph
force simulation
ELK/Dagre layout
```

KG7 owns renderer adaptation and layout selection.

---

# No view-state persistence yet

KG6 defines state **shape/semantics**, not persistence.

Do not add:

- LocalStorage persistence;
- IndexedDB;
- URL state;
- saved views;
- stable ID reconciliation.

KG9 owns persistence/stable identity.

KG6 should merely keep its state plain and renderer-independent so KG9 can persist it later.

---

# No UI implementation requirement

Do not replace the KG5 diagnostic UI with a fake graph.

No major web UI changes are required for KG6.

A tiny developer-only projection summary/example is acceptable only if it materially improves validation, but prefer pure tests and benchmark output.

KG7 will integrate the projection into the actual graph UI.

Do not add projection controls to the diagnostic explorer unless there is a strong testability reason.

---

# Skills

No new repository-local agent skill is required for KG6.

The existing React/web-design/browser skills are not central to this pure package.

Do not install renderer, graph analytics, Tauri, deployment, or database skills.

KG7 should re-evaluate renderer-specific skills when React Flow is actually introduced.

---

# Documentation updates

After implementation, reconcile repository-owned docs.

Likely:

```text
packages/view-projection/README.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
README.md
eslint.config.*
tools/vault-diagnostics/README.md
```

Potentially add/update an ADR if KG6 makes an expensive long-term projection decision not already covered.

Do not create ADRs for small type names.

## `packages/view-projection/README.md`

Document clearly:

- package ownership;
- canonical vs state vs projection separation;
- public entry points;
- derived runtime index;
- disclosure;
- endpoint roll-up;
- aggregation;
- internal references;
- synthetic unresolved/ambiguous/invalid target nodes;
- focus semantics;
- filter semantics;
- deterministic ordering;
- provenance invariant;
- performance posture;
- KG7 handoff.

## Architecture

The architecture should make explicit:

```text
canonical snapshot
+ renderer-independent state
→ projection
→ renderer
```

and state that endpoint roll-up/aggregation are projection responsibilities.

## Roadmap

Mark KG6 complete only after its tests/benchmark/documentation gate passes.

Keep KG7 next.

Do not expand KG7 into analytics/style work.

---

# Scope

## In scope

- inspect KG5/KG4 current state;
- new source-neutral view-projection package;
- derived canonical hierarchy/reference indexes;
- renderer-independent disclosure state;
- document-only/top-section/progressive hierarchy visibility;
- collapse semantics;
- block visibility policy;
- nearest-visible-ancestor endpoint routing;
- resolved edge aggregation;
- internal collapsed-reference provenance;
- synthetic unresolved/ambiguous/invalid target nodes;
- aggregated provenance;
- focus/ego projection;
- incoming/outgoing/both focus traversal;
- hierarchy context roles;
- path/text/entity-kind/resolution filters;
- context-node closure;
- stale view-state issues;
- deterministic projected IDs/order;
- projection output validation;
- JSON serializability;
- benchmark harness projection phases;
- docs/roadmap reconciliation;
- branch/PR/CI/merge/cleanup.

## Explicitly out of scope

Do not implement:

- React Flow;
- Sigma;
- Graphology;
- Pixi;
- layout algorithms;
- graph positions;
- graph styling;
- hover interactions;
- graphical inspector;
- backlink UI;
- source snippets;
- open-in-Obsidian;
- Tauri;
- local folder access;
- file watching;
- persistence;
- stable identities across edits;
- incremental workspace deltas;
- tags/properties filtering;
- semantic relations;
- centrality/community analytics;
- pathfinding;
- source editing;
- attachment canonical entities;
- performance budgets;
- workers.

Do not begin KG7 automatically.

---

# Suggested implementation sequence

1. Inspect current contracts.
2. Define projection state/nodes/edges/issues before algorithms.
3. Build reusable canonical indexes.
4. Implement structural visibility.
5. Implement memoized visible-ancestor routing.
6. Project hierarchy.
7. Project resolved/internal/non-resolved references.
8. Aggregate edges and synthetic targets.
9. Implement focus slicing.
10. Implement filters/context closure.
11. Validate projection output.
12. Extend benchmark harness.
13. Reconcile docs.
14. Validate → PR → merge → post-merge CI → cleanup.

---

# Validation commands

Run repository standard checks plus focused projection tests.

Expected equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/view-projection typecheck
pnpm exec vitest run packages/view-projection

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
git diff --check
```

Run the projection benchmark locally on at least:

```text
small
medium
```

profiles.

If the benchmark command is still:

```bash
pnpm benchmark:pipeline
```

extend it rather than creating unnecessary competing benchmark entry points.

No timing threshold should fail CI.

If the web app is intentionally untouched, browser QA is not a KG6 gate.

PR CI and post-merge main CI must pass before reporting completion.

---

# Exit gate

KG6 is complete only when:

1. A source-neutral `view-projection` package exists.
2. It depends inward on core only.
3. Canonical snapshot and projection state remain immutable inputs.
4. Projection output is renderer-independent plain data.
5. Documents-only projection works.
6. Top-level-section projection works without heading-number assumptions.
7. Progressive expansion works.
8. Collapse overrides broader disclosure.
9. Hidden-child metadata is available for KG7 expand affordances.
10. Blocks follow a documented conservative visibility rule.
11. Hidden source endpoints roll to nearest visible ancestors.
12. Hidden resolved target endpoints roll independently to nearest visible ancestors.
13. Several precise references aggregate into one visible edge with all underlying `ReferenceId`s.
14. References that roll to one visible node remain available as internal provenance rather than noisy self-loops.
15. Unresolved references create projection-only synthetic targets.
16. Ambiguous references remain uncertain and preserve candidate IDs rather than becoming fake candidate edges.
17. Invalid references remain distinguishable.
18. Equivalent diagnostic occurrences can aggregate without cross-source-context mistakes.
19. Focus mode supports bounded 1–3 hop reference neighborhoods.
20. Incoming/outgoing/both focus semantics are tested.
21. Hierarchy context does not count as reference hops.
22. Filters support path, projected text/title, entity kind, and resolution state.
23. Filter-required ancestors are marked as context.
24. Filtering does not fabricate roll-up relationships from excluded data.
25. Stale view-state IDs do not crash projection.
26. Projected IDs/order are deterministic.
27. Projection output validates and JSON-round-trips.
28. Every surviving visible relationship retains exact canonical provenance.
29. No renderer/layout/state-persistence dependency is introduced.
30. Existing KG1–KG5 tests remain green.
31. Synthetic benchmark harness includes projection measurements.
32. No CI timing budgets are introduced.
33. Architecture/roadmap docs reflect implemented projection semantics.
34. PR CI and post-merge main CI pass.
35. Feature branch cleanup is complete and working tree is clean.

Do not begin KG7.

---

# Final report

Report:

## 1. Summary
Public projection entry point(s) and visible graph contract available to KG7.

## 2. Package boundary
Confirm `view-projection → core` and absence of renderer/platform/source-specific dependencies.

## 3. Projection contracts
Describe projection state, entity nodes, synthetic target nodes, hierarchy edges, reference edges, and issues.

## 4. Structural disclosure
Explain default depths, expansion, collapse precedence, block policy, hidden-child metadata.

## 5. Endpoint roll-up
Explain nearest-visible-ancestor algorithm for source and target.

## 6. Aggregation / provenance
Explain projected aggregation, internal references, exact `ReferenceId` preservation, and deterministic IDs.

## 7. Non-resolved states
Explain unresolved / ambiguous / invalid synthetic-node semantics and why they remain projection-only.

## 8. Focus projection
Explain root, hop depth, direction, hierarchy context, and synthetic-target handling.

## 9. Filters
Explain exact path/text/entity-kind/resolution semantics and context-node behavior.

## 10. Validation/invariants
Describe projection runtime validation and provenance-coverage tests.

## 11. Performance evidence
Report small/medium benchmark figures for projection index construction, document projection, top-level projection, expanded projection, focus projection, and filter projection. No performance guarantee should be inferred.

## 12. Dependencies
List anything added. Expected: ideally no external runtime graph dependency.

## 13. Files changed
Important package/docs/benchmark changes.

## 14. Documentation reconciliation
State whether accepted plugin-research guidance or earlier roadmap wording had to be refined.

## 15. Deviations / warnings
Report any projection semantic decision that changed after actual implementation evidence. Surface any major renderer-facing ambiguity before KG7.

## 16. KG7 handoff
State precisely what React Flow/layout code can now assume:

- canonical data never needs to be inspected to decide roll-up semantics;
- all visible nodes/edges are supplied by projection;
- expand/collapse state has renderer-independent meaning;
- aggregated edges retain provenance;
- diagnostic synthetic nodes are clearly typed;
- focus/local graph extraction already exists;
- filters are projection-level;
- renderer only needs layout, interaction, selection, and visual mapping.

Do not implement KG7 automatically.
