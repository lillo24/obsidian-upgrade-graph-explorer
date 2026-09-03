# HIER1 — Focus Schematic Semantic Model + Quality Harness

**Task type:** source-neutral architecture foundation / semantic model / strict validation / synthetic fixtures / benchmark and layout-quality harness

## Goal

Define the **semantic contract** for the future root-centric Focus Hierarchy before changing production layout.

HIER1 should answer:

```text
What does the Focus schematic contain?
Why is every File present?
Which side(s) of the focused File can it occupy?
Which references explain its Focus path?
Which references are secondary?
Which visible Headings/Blocks belong to each File module?
Which diagnostics belong to each File?
Which Obsidian folder does each File belong to?
How will later Dagre/custom prototypes be measured consistently?
```

The output should be a deterministic, strictly validated, JSON-serializable model that is independent of:

```text
React
React Flow
Sigma
Dagre
layout coordinates
Tauri
filesystem APIs
Obsidian runtime APIs
saved positions
```

Create a quality harness that later HIER2 layout prototypes must use.

HIER1 must **not** replace or alter the production Focus Hierarchy renderer.

Production after HIER1 remains:

```text
Focus projection
→ current flat React Flow mapping
→ current local-structured Dagre worker
→ HIER0 collision-safe adoption
```

HIER2 will compare layout strategies. HIER3 will be the first possible production modular-layout integration.

---

# Current repository baseline

Repository:

`lillo24/icarus-graph-explorer`

Current `main` at plan-writing time:

```text
c51688284ff69e065b734ddcfe803c8b7944185f
```

This includes:

```text
HIER0
→ All + Hierarchy hidden by default
→ Focus + Hierarchy remains normal
→ dimension-aware immediate seed
→ collision-safe diagnostic placement
→ compact duplicate File disambiguation

NETWORKPOLISH1
→ source-folder Network Explorer
→ Focus Network lines retained at all LODs

SPATIAL1A
→ source-neutral exact-folder anchor foundation
→ automatic All-Network positions remain separate from displayed translations
```

At plan-writing time there are no open pull requests. Check again before creating the task branch and before merge.

HIER0 merged as:

```text
PR #55
deb375ccb4dc75a4434e97cce71c11e3e9643d0e
```

The detailed baseline evidence is in:

```text
docs/HIER0_VALIDATION.md
```

HIER0 established zero overlap for the current seed/adopted/fallback geometry and must not regress.

---

# User-owned and parallel work

Before editing:

1. inspect current `main`;
2. inspect all open PRs and registered worktrees;
3. use an isolated HIER1 branch/worktree;
4. preserve unrelated user modifications and untracked files;
5. do not modify parallel SPATIAL1 behavior;
6. if another branch merges during HIER1, integrate latest `main` before final validation.

Current `docs/ROADMAP.md` exists on `main` again and may be updated normally in HIER1.

Do not rewrite `AGENTS.md` except unavoidable repository-formatting changes that preserve its instruction text exactly.

---

# Accepted product semantics

The target Focus Hierarchy is:

> A root-centric explanation of how the focused File's internal structure connects to the internal structure of nearby Files.

Future spatial meaning:

```text
left
→ references flowing toward the focused File

center
→ focused File module

right
→ references flowing outward from the focused File

horizontal distance
→ directed reference-hop distance

vertical grouping
→ source folder as a soft preference

inside each module
→ File / Heading / Block hierarchy
```

HIER1 models those semantics but does not position anything.

---

# Current Focus-projection semantics

Current `projectLocalView(...)` already uses the correct two-pass behavior:

```text
1. establish a fixed document-level Focus neighborhood;
2. project detailed visible endpoints only inside that neighborhood.
```

This prevents Heading disclosure from changing which Files belong to Focus.

Current relevant APIs include:

```text
ProjectionWorkspace
ViewProjectionState
ViewProjection
projectLocalView(...)
containingDocumentEntityId(...)
```

Internally, `projectFocusedDocumentNeighborhood(...)` currently derives:

```text
root document
document-level Focus distance
allowed diagnostic references
document-only Focus projection
```

but not all of this is exposed as a public serializable contract.

HIER1 must reuse this source of truth.

Do **not** reimplement Focus traversal in the new package.

---

# Architecture decision

Add a new package, preferably:

```text
packages/focus-schematic
```

with package name:

```text
@icarus-graph-explorer/focus-schematic
```

Exact name may change only if a clearly better current repository convention exists.

Runtime dependencies:

```text
@icarus-graph-explorer/core
@icarus-graph-explorer/view-projection
```

External runtime dependencies:

```text
zero
```

Forbidden production dependencies:

```text
React
React DOM
React Flow
Sigma
Graphology
Dagre
Tauri
Node filesystem
Obsidian packages
adapter-obsidian
resolver-obsidian
diagnostics runner
spatial-overrides registry
presentation-overrides
web app
```

Enforce this with the repository's dependency-boundary linting.

The package owns:

```text
Focus Schematic semantic model
model construction
strict runtime validation
deterministic serialization-compatible ordering
semantic summary metrics
future layout-candidate contract
layout-quality evaluation
layout-stability comparison
```

It does not own:

```text
projection membership
canonical truth
rendering
layout backend
worker transport
UI state
saved views
manual positions
```

---

# 1. Generic folder-key ownership

SPATIAL1A currently defines:

```text
WorkspaceFolderKey
isNormalizedWorkspaceFolderKey(...)
workspaceFolderKeyFromPath(...)
```

inside `packages/spatial-overrides`.

Those semantics are generic workspace-path semantics, not manual-override semantics.

HIER1 must not:

```text
depend on spatial-overrides merely to identify folders
```

and must not create a second subtly different folder-key implementation.

Preferred correction:

```text
core
└─ owns WorkspaceFolderKey
   ├─ exact normalized workspace-relative folder path
   ├─ "." for workspace root
   ├─ isNormalizedWorkspaceFolderKey(...)
   └─ workspaceFolderKeyFromPath(...)

spatial-overrides
└─ imports/re-exports the core helper for compatibility

focus-schematic
└─ imports it from core
```

This is a generic additive core utility, not a canonical Folder entity.

Requirements:

- preserve SPATIAL1A public imports through re-export where currently exposed;
- preserve its schema and stored values;
- no circular dependency;
- root folder remains `.`;
- no absolute path support;
- no new canonical entity kind.

If current repository evidence makes core ownership clearly inappropriate, stop and document the architectural blocker before creating a duplicate helper.

---

# 2. Public document-neighborhood seam

HIER1 needs both:

```text
A. detailed Focus projection
B. document-only neighborhood graph
```

The detailed projection alone is insufficient because QUERY1/entity-kind/text filtering may remove an intermediate File or precise reference edge while the fixed Focus neighborhood still retains its semantic hop distance.

Expose one narrow public view-projection seam that reuses the existing internal neighborhood computation.

Conceptually:

```ts
interface FocusedDocumentNeighborhoodDescription {
  readonly rootDocumentEntityId: EntityId;
  readonly focus: {
    readonly direction: 'incoming' | 'outgoing' | 'both';
    readonly hops: 1 | 2 | 3;
  };
  readonly documentProjection: ViewProjection;
  readonly documentDistances: readonly {
    readonly documentEntityId: EntityId;
    readonly distance: number;
  }[];
  readonly allowedDiagnosticReferenceIds: readonly ReferenceId[];
  readonly issues: readonly ProjectionIssue[];
}

describeFocusedDocumentNeighborhood(
  workspace,
  state,
): FocusedDocumentNeighborhoodDescription
```

Exact name/shape may follow package conventions.

Hard requirements:

- one source of truth with current `projectFocusedDocumentNeighborhood`;
- no second BFS/filter implementation;
- deterministic plain arrays in the public description;
- document-only nodes/edges remain projection types;
- no semantic change to `projectLocalView`;
- current Focus projection tests remain green;
- no production caller is forced to recompute this description unless it requests it.

HIER1 may use a convenience builder that obtains this description itself because it is not yet on the production render path.

HIER3 should later be able to pass a precomputed description to avoid duplicate Focus-neighborhood work.

---

# 3. Public creation API

Preferred conceptual entry point:

```ts
createFocusSchematicModel({
  workspace,
  state,
  projection,
  neighborhood?,
}): FocusSchematicModel
```

Inputs:

```text
workspace
→ current validated ProjectionWorkspace

state
→ current ViewProjectionState with Focus

projection
→ detailed projection produced by projectLocalView(...)

neighborhood
→ optional prepared document-neighborhood description
```

Behavior:

- Focus is required;
- projection must validate against the workspace;
- if `neighborhood` is absent, derive it through the public view-projection seam;
- if supplied, validate it against workspace/state/projection;
- fail explicitly on structural contradiction;
- return no partial success-shaped model.

Provide an overload or separate pure builder if that makes the prepared-neighborhood path cleaner.

Do not make the public API renderer-specific.

---

# 4. Model schema

Add:

```ts
export const FOCUS_SCHEMATIC_MODEL_SCHEMA_VERSION = 1 as const;
```

The model must use:

```text
plain objects
plain arrays
strings/numbers/booleans/null
```

No persisted/public:

```text
Map
Set
class instances
functions
undefined fields
DOM objects
renderer node objects
layout coordinates
```

Conceptual top-level contract:

```ts
interface FocusSchematicModel {
  readonly schemaVersion: 1;
  readonly rootModuleId: EntityId;
  readonly focus: FocusSchematicFocus;
  readonly modules: readonly FocusSchematicModule[];
  readonly folders: readonly FocusSchematicFolder[];
  readonly relationships: readonly FocusSchematicRelationship[];
  readonly internalReferences: readonly FocusSchematicInternalReference[];
  readonly diagnostics: readonly FocusSchematicDiagnostic[];
  readonly parentCandidates: readonly FocusSchematicParentCandidate[];
  readonly issues: readonly FocusSchematicIssue[];
}
```

Exact decomposition may differ, but every required semantic category below must remain explicit.

---

# 5. File modules

Create exactly one module for each document in the fixed document-level Focus neighborhood.

Module identity:

```text
module ID = stable canonical document EntityId
```

Do not allocate new random IDs.

Conceptual module:

```ts
interface FocusSchematicModule {
  readonly id: EntityId;
  readonly documentEntityId: EntityId;
  readonly sourcePath: WorkspacePath;
  readonly folderKey: WorkspaceFolderKey;

  readonly presentation:
    | 'visible-content'
    | 'visible-context'
    | 'filtered';

  readonly documentProjectionNodeId: ProjectionNodeId | null;
  readonly visibleEntityNodeIds: readonly ProjectionNodeId[];
  readonly hierarchyEdgeIds: readonly ProjectionEdgeId[];
  readonly internalReferenceIds: readonly string[];
  readonly diagnosticIds: readonly ProjectionNodeId[];

  readonly focusDistance: 0 | 1 | 2 | 3;
  readonly incomingDistance: 0 | 1 | 2 | 3 | null;
  readonly outgoingDistance: 0 | 1 | 2 | 3 | null;
  readonly placement: FocusSchematicPlacement;
}
```

## Presentation states

### `visible-content`

At least one detailed projected entity in the module has:

```text
role = content
```

### `visible-context`

The module has projected entity nodes, but they are context-only.

Typical example:

```text
filtered Focus root retained as stable context
```

### `filtered`

The File is part of the fixed document neighborhood but has no detailed projected entity node after QUERY1/text/kind filtering.

Filtered modules are included for:

```text
path semantics
directed distances
backbone evidence
quality metrics
```

They are **not** a requirement to render later.

This lets HIER2 measure path gaps caused by filtered intermediate Files instead of losing the underlying explanation.

---

# 6. Module membership

For every detailed projected entity node:

```text
document
section
block
```

resolve its containing canonical document through `ProjectionWorkspace`.

Assign it to exactly one module.

Requirements:

- entity `sourcePath` must equal module document `sourcePath`;
- document node belongs to its own module;
- sections/blocks retain source order;
- module node order is deterministic and independent of projection input order;
- projected hierarchy edges must stay inside one module;
- a hierarchy edge crossing modules is a hard invariant failure;
- every visible projected entity appears exactly once.

Recommended visible-node ordering:

```text
canonical source path
source line/column/offset
entity kind
EntityId / ProjectionNodeId tie-break
```

Reuse existing source-order logic where practical.

Do not store Markdown body text.

---

# 7. Active folder records

Derive active exact-folder records from module folder keys.

Conceptual contract:

```ts
interface FocusSchematicFolder {
  readonly key: WorkspaceFolderKey;
  readonly depth: number;
  readonly parentKey: WorkspaceFolderKey | null;
  readonly directModuleIds: readonly EntityId[];
  readonly containsRootModule: boolean;
}
```

Requirements:

- root folder `.` has depth 0 and parent null;
- nested folders use exact normalized paths;
- records are deterministic;
- no canonical Folder entities;
- no fake graph edges;
- no layout coordinates;
- root module's folder is explicitly identifiable;
- filtered modules still contribute to semantic folder membership;
- no SPATIAL1A saved anchors are applied.

The model should expose enough information for HIER2 to test:

```text
root folder central band
same-folder module adjacency
folder ancestry
```

without committing any placement.

---

# 8. Document-level relationships

Build the semantic document graph from the **document-neighborhood projection**, not from only the final detailed edges.

Create one deterministic relationship per ordered module pair:

```text
source module
→ target module
```

Aggregate complete canonical reference provenance.

Conceptual relationship:

```ts
interface FocusSchematicRelationship {
  readonly id: string;
  readonly sourceModuleId: EntityId;
  readonly targetModuleId: EntityId;
  readonly documentProjectionEdgeIds: readonly ProjectionEdgeId[];
  readonly referenceIds: readonly ReferenceId[];
  readonly visibleEndpointGroups: readonly FocusSchematicEndpointGroup[];

  readonly incomingPathForModuleIds: readonly EntityId[];
  readonly outgoingPathForModuleIds: readonly EntityId[];
  readonly selectedBackboneForModuleIds: readonly EntityId[];
  readonly secondary: boolean;
}
```

Requirements:

- only resolved cross-document references create module relationships;
- authored source→target direction is preserved;
- duplicate/aggregated references retain exact sorted ReferenceIds;
- relationship IDs are deterministic and private-safe;
- input order does not affect output;
- same-module references do not create macro relationships;
- unresolved/ambiguous/invalid references become diagnostics, not File relationships;
- one reference ID cannot be claimed by two conflicting relationships.

A relationship may carry both incoming-path and outgoing-path roles in reciprocal/cyclic neighborhoods.

---

# 9. Precise visible endpoint groups

The document relationship explains File-level topology.

The detailed projection may expose more precise endpoints:

```text
Heading A → File B
Heading A → Heading B
Block → File
```

Preserve these as endpoint groups without making them relationship identity.

Conceptual type:

```ts
interface FocusSchematicEndpointGroup {
  readonly projectedEdgeId: ProjectionEdgeId;
  readonly sourceProjectionNodeId: ProjectionNodeId;
  readonly targetProjectionNodeId: ProjectionNodeId;
  readonly referenceIds: readonly ReferenceId[];
  readonly sourcePrecision: 'document' | 'section' | 'block';
  readonly targetPrecision: 'document' | 'section' | 'block';
}
```

Requirements:

- only detailed resolved reference edges between the two modules qualify;
- exact projected endpoints are retained;
- groups are sorted deterministically;
- reference IDs remain exact;
- references present in the document relationship but absent from detailed endpoint groups are retained as hidden/rolled-up provenance rather than lost;
- later HIER2/HIER4 can use these groups for Heading-port alignment;
- HIER1 creates no coordinates/ports.

Expose summary fields such as:

```text
preciselyRepresentedReferenceCount
documentOnlyReferenceCount
```

through the quality report rather than duplicating them in every model object unless useful.

---

# 10. Internal references

References whose source and target resolve to the same document belong inside a File module.

Preserve:

1. visible detailed same-module reference edges;
2. collapsed `internalReferenceIds` already carried by projected entity nodes;
3. complete canonical ReferenceIds without duplication.

Conceptual contract:

```ts
interface FocusSchematicInternalReference {
  readonly id: string;
  readonly moduleId: EntityId;
  readonly referenceIds: readonly ReferenceId[];
  readonly visibleEndpointGroups: readonly FocusSchematicEndpointGroup[];
  readonly collapsedOwnerNodeIds: readonly ProjectionNodeId[];
}
```

Internal references:

```text
do not affect module-to-module distance
do not become macro self-loops
remain available for future internal module routing/inspection
```

Every internal ReferenceId should be accounted exactly once.

---

# 11. Diagnostics

Every visible projected diagnostic target must belong to exactly one source File module.

Conceptual type:

```ts
interface FocusSchematicDiagnostic {
  readonly id: ProjectionNodeId;
  readonly ownerModuleId: EntityId;
  readonly status: 'unresolved' | 'ambiguous' | 'invalid';
  readonly rawTarget: string;
  readonly reasons: readonly string[];
  readonly referenceIds: readonly ReferenceId[];
  readonly sourceProjectionNodeIds: readonly ProjectionNodeId[];
  readonly candidateDocumentEntityIds: readonly EntityId[];
  readonly candidateVisibleModuleIds: readonly EntityId[];
}
```

Ownership rule:

```text
incoming detailed diagnostic edges
→ inspect their source projected nodes
→ all sources must belong to the same File module
```

If a source-scoped diagnostic unexpectedly spans multiple modules:

```text
hard failure
```

Ambiguous candidates:

- map each candidate entity to its containing document;
- deduplicate/sort document IDs;
- preserve candidates outside the Focus neighborhood;
- distinguish all candidate documents from currently visible candidate modules;
- do not fabricate modules for external candidates;
- do not change resolver ambiguity.

Diagnostics remain local semantic evidence. They do not participate in directed File distances.

---

# 12. Directed distances

For each module, compute over the resolved document relationship graph:

```text
incomingDistance
= shortest authored directed path:
  module → root

outgoingDistance
= shortest authored directed path:
  root → module
```

Use breadth-first traversal over deterministic adjacency indexes.

Root:

```text
incomingDistance = 0
outgoingDistance = 0
focusDistance = 0
```

Non-root distances are bounded to current Focus hops:

```text
1 | 2 | 3 | null
```

Validate against KG6 neighborhood distance:

## Focus direction = incoming

```text
focusDistance = incomingDistance
```

## Focus direction = outgoing

```text
focusDistance = outgoingDistance
```

## Focus direction = both

```text
focusDistance = min(non-null incomingDistance, outgoingDistance)
```

If these disagree:

```text
hard invariant failure
```

Do not infer direction from screen position.

---

# 13. Placement semantics without coordinates

HIER1 should describe **allowed/preferred placement**, not position anything.

Conceptual contract:

```ts
interface FocusSchematicPlacement {
  readonly allowedSides: readonly (
    | 'center'
    | 'left'
    | 'right'
  )[];
  readonly preferredSide: 'center' | 'left' | 'right' | null;
  readonly rankMagnitude: 0 | 1 | 2 | 3;
  readonly preferredSignedRank: -3 | -2 | -1 | 0 | 1 | 2 | 3 | null;
  readonly reason:
    | 'root'
    | 'incoming-only'
    | 'outgoing-only'
    | 'shorter-incoming'
    | 'shorter-outgoing'
    | 'equal-mutual';
}
```

Rules:

## Root

```text
allowed = center
preferred = center
signed rank = 0
```

## Incoming only

```text
allowed = left
preferred = left
rank = -incomingDistance
```

## Outgoing only

```text
allowed = right
preferred = right
rank = +outgoingDistance
```

## Both, unequal

```text
shorter incoming
→ left

shorter outgoing
→ right
```

## Both, equal

```text
allowed = left + right
preferred = null
preferredSignedRank = null
reason = equal-mutual
```

Do not add an arbitrary lexical left/right decision in HIER1.

HIER2 layout prototypes should resolve equal mutual placement while balancing crossings/column load, using the same model.

This preserves semantic uncertainty rather than hiding it.

---

# 14. Focus-path eligibility

For each cross-module relationship `A → B`:

## Outgoing path relation

It is eligible to explain `B` when:

```text
outgoingDistance(A) = d - 1
outgoingDistance(B) = d
```

Record:

```text
B ∈ outgoingPathForModuleIds
```

## Incoming path relation

It is eligible to explain `A` when:

```text
incomingDistance(A) = d
incomingDistance(B) = d - 1
```

Record:

```text
A ∈ incomingPathForModuleIds
```

A relationship can be eligible for both in a cyclic/mutual graph.

If neither condition applies:

```text
secondary = true
```

Secondary examples:

```text
same-hop cross-link
alternative long path
left↔right cross-link
cycle edge that does not reduce distance
relation among already-reached modules
```

This classification is semantic and must not depend on layout coordinates.

---

# 15. Deterministic parent/backbone candidates

For each non-root module and each allowed side, list relationships that move one hop toward the root.

Conceptual candidate:

```ts
interface FocusSchematicParentCandidate {
  readonly moduleId: EntityId;
  readonly side: 'left' | 'right';
  readonly parentModuleId: EntityId;
  readonly relationshipId: string;
  readonly endpointSpecificity: number;
  readonly referenceCount: number;
  readonly sameFolder: boolean;
  readonly selected: boolean;
}
```

Direction:

## Left/incoming child module `A`

Candidate relationship:

```text
A → parent
incomingDistance(parent) = incomingDistance(A) - 1
```

## Right/outgoing child module `B`

Candidate relationship:

```text
parent → B
outgoingDistance(parent) = outgoingDistance(B) - 1
```

Candidate ranking, descending where applicable:

```text
1. precise visible structural endpoint evidence;
2. total canonical reference count;
3. same exact folder;
4. deterministic source-path / relationship-ID tie-break.
```

Do not use display title as identity.

## Selection policy

For modules with one unambiguous preferred side:

```text
select the highest-ranked candidate on that side
```

For equal-mutual modules:

```text
retain ranked candidates for both sides
selected = false
```

HIER2 chooses the side and final backbone for those modules.

Hard requirement:

Every non-root module must have at least one valid parent candidate for every semantically allowed path side, unless a documented supported model issue explains why not.

Do not use secondary relationships as hidden arbitrary parents.

---

# 16. Filtered path intermediates

Because the model contains all neighborhood documents, a selected Focus path may include a module with:

```text
presentation = filtered
```

This is supported.

Record nonfatal model issues such as:

```text
visible module path crosses filtered intermediate
visible relationship has only document-level endpoint evidence
equal-mutual side requires layout decision
ambiguous candidate outside Focus neighborhood
```

Suggested issue codes:

```text
filtered-path-intermediate
document-only-endpoint
equal-mutual-side
external-ambiguous-candidate
```

Exact names may follow conventions.

Do not:

- render filtered modules in HIER1;
- alter QUERY1;
- automatically insert ghost nodes;
- drop path evidence;
- classify supported filtering as invalid.

The HIER2 decision report should use these counts to decide how prototypes visually explain gaps.

---

# 17. Strict runtime validation

Add:

```ts
validateFocusSchematicModel(
  workspace,
  state,
  projection,
  value,
): FocusSchematicModelValidationResult
```

or an equally strict contract.

Validate exact shapes and at least:

## Top level

- supported schema version;
- exact fields;
- JSON-safe values;
- deterministic unique IDs;
- root module exists exactly once;
- focus state matches input.

## Modules

- one per neighborhood document;
- document EntityId exists and is a document;
- source path matches canonical document;
- folder key matches source path;
- presentation classification matches detailed projection;
- visible entity nodes exist and are unique;
- every visible entity belongs to exactly one module;
- root distance/placement is correct;
- non-root distances/ranks are bounded and coherent.

## Folders

- valid exact folder keys;
- root folder semantics;
- direct module membership exact;
- each module appears in one direct folder record;
- parent/depth consistent.

## Hierarchy

- every detailed hierarchy edge accounted exactly once;
- both endpoints belong to same module;
- no cross-module hierarchy.

## Relationships

- ordered distinct source/target modules;
- exact complete ReferenceIds;
- references resolve to those documents canonically;
- no duplicate provenance across relationships;
- path-role equations hold;
- secondary flag consistent;
- selected backbone references a valid candidate.

## Internal references

- same document only;
- no macro self-loop;
- no duplicate ReferenceIds.

## Diagnostics

- visible diagnostic node exists;
- source ownership exactly one module;
- exact status/reference IDs;
- candidate document mapping valid;
- no duplicate diagnostic ownership.

## Coverage

Every detailed projection node/edge and relevant document-neighborhood reference must be accounted for in one supported category.

Validation failure returns issues and no accepted partial model.

Creation should validate before returning success.

---

# 18. Deterministic ordering

Canonicalize every public array.

Recommended ordering:

```text
modules
→ sourcePath, document EntityId

folders
→ "." first, then folder key

visible entity nodes
→ canonical source order

relationships
→ source module path, target module path, relationship ID

ReferenceIds
→ canonical source/reference order or stable ID order

diagnostics
→ owner module path, source position, diagnostic ID

parent candidates
→ module path, side, ranking, relationship ID

issues
→ code, subject ID
```

Shuffling:

```text
snapshot entity order
snapshot reference order
projection node order
projection edge order
```

must produce byte-for-byte equal serialized model output.

Add permutation tests.

---

# 19. Model summary / quality report

Add a deterministic pure summary:

```ts
summarizeFocusSchematicModel(model): FocusSchematicModelSummary
```

Suggested fields:

```text
moduleCount
visibleContentModuleCount
visibleContextModuleCount
filteredModuleCount

folderCount
rootFolderModuleCount

visibleEntityNodeCount
visibleHierarchyEdgeCount

crossModuleRelationshipCount
internalReferenceCount
canonicalReferenceCount

incomingOnlyModuleCount
outgoingOnlyModuleCount
unequalMutualModuleCount
equalMutualModuleCount

focusPathRelationshipCount
secondaryRelationshipCount
selectedBackboneCount
unresolvedBackboneModuleCount

preciseEndpointReferenceCount
documentOnlyEndpointReferenceCount
filteredPathIntermediateCount

diagnosticCount
unresolvedDiagnosticCount
ambiguousDiagnosticCount
invalidDiagnosticCount
externalAmbiguousCandidateCount
```

This report must not include:

```text
titles
raw targets
source paths
folder names
private IDs
```

when emitted through committed benchmark evidence.

Runtime model objects can contain workspace-relative paths; aggregate reports cannot.

---

# 20. Future layout-candidate contract

HIER2 needs all layout strategies to return the same comparable shape.

Define a renderer-independent candidate contract now.

Conceptually:

```ts
interface FocusSchematicLayoutCandidate {
  readonly modelSchemaVersion: 1;
  readonly rootModuleId: EntityId;

  readonly modules: readonly {
    readonly moduleId: EntityId;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];

  readonly nodes: readonly {
    readonly projectionNodeId: ProjectionNodeId;
    readonly moduleId: EntityId;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];

  readonly routes: readonly {
    readonly relationshipId: string;
    readonly points: readonly {
      readonly x: number;
      readonly y: number;
    }[];
  }[];
}
```

Coordinate convention:

```text
x/y = top-left
positive x = right
positive y = down
finite numbers only
```

HIER1 does not need to generate a production candidate.

Provide strict validation so HIER2 prototypes cannot omit modules/nodes silently.

The candidate may allow:

```text
routes = []
```

for strategies that have not implemented edge routing. Quality metrics should mark routing as unavailable rather than fabricate success.

---

# 21. Layout-quality evaluator

Add:

```ts
evaluateFocusSchematicLayout(
  model,
  candidate,
): FocusSchematicLayoutQuality
```

This is a source-neutral deterministic metric harness.

Required metrics:

## Hard correctness

```text
moduleOverlapPairs
nodeOverlapPairs
nodeOutsideModuleIds
missingModuleIds
missingVisibleNodeIds
unexpectedModuleIds
unexpectedNodeIds
nonFiniteGeometryCount
```

Use positive-area rectangle overlap with configurable clearance.

Do not import React Flow geometry.

## Root / directional meaning

```text
rootCenterOffsetX
rootCenterOffsetY
leftSideViolationModuleIds
rightSideViolationModuleIds
rankOrderViolationModuleIds
```

Rules:

- left-only modules must have centerX < root centerX;
- right-only modules must have centerX > root centerX;
- larger hop rank should not be closer to root than a nearer rank, within documented tolerance;
- equal-mutual modules are not side violations on either side.

## Compactness

```text
totalBoundsWidth
totalBoundsHeight
totalBoundsArea
aspectRatio
emptyAreaRatio when meaningful
```

## Folder coherence

At minimum:

```text
sameFolderAdjacencyRatio
rootFolderCenterOffset
meanSameFolderVerticalDistance
```

Define the formulas precisely and test them with hand-authored layouts.

These are soft metrics, not correctness failures.

## Relationship readability

For routes when supplied:

```text
focusPathCrossingCount
secondaryCrossingCount
edgeNodeIntersectionCount
```

When routes are absent, optionally evaluate straight module-center segments under an explicitly named approximation field.

Do not mix approximate and route-aware counts silently.

## Heading alignment

When a visible endpoint group uses a section/block:

```text
meanAttachmentAlignmentError
p95AttachmentAlignmentError
attachmentSampleCount
```

The exact first version may use source/target node center Y until explicit ports exist.

Document that this is a proxy for future port alignment.

---

# 22. Layout-stability evaluator

Add a separate pure comparison:

```ts
compareFocusSchematicLayouts({
  beforeModel,
  beforeLayout,
  afterModel,
  afterLayout,
}): FocusSchematicStabilityQuality
```

Compare only stable module IDs present in both models.

Required:

```text
rootCenterDisplacement
medianSharedModuleDisplacement
p95SharedModuleDisplacement
maximumSharedModuleDisplacement
sharedModuleCount
addedModuleCount
removedModuleCount
```

Support a caller-supplied or derived set of:

```text
unaffected module IDs
```

for future expansion/live-update tests.

Do not normalize away root movement silently. Report both raw and root-relative displacement if useful.

Use deterministic percentile definitions.

---

# 23. Hand-authored quality-harness tests

Because HIER1 does not generate layouts, validate the evaluator with small explicit candidates.

Examples:

## Perfect two-sided layout

```text
A → Root → B

A left
Root center
B right
zero overlaps
```

## Side violation

Place incoming `A` on right and verify exact violation.

## Rank violation

Place hop-2 module closer than hop-1.

## Module/node overlap

Verify exact pair IDs.

## Folder coherence

Create two layouts with same semantics and prove the grouped one scores better.

## Crossing

Two macro routes cross in one candidate and not in another.

## Alignment

One target aligns with source Heading Y; another is far away.

## Stability

Expand one module while unrelated modules remain fixed versus full shuffle.

The harness must distinguish these cases reliably before HIER2 depends on it.

---

# 24. Synthetic semantic fixtures

Build deterministic source-neutral fixtures covering at least:

## F1 — simple directed

```text
A → Root → B
```

Expected:

```text
A left rank 1
Root center
B right rank 1
```

## F2 — incoming fan

```text
A ─┐
B ─┼→ Root
C ─┘
```

## F3 — outgoing fan

```text
Root → A
     → B
     → C
```

## F4 — mixed two-sided

```text
A → Root → B
C → Root → D
```

## F5 — multi-hop

```text
A → B → Root → C → D
```

Expected signed rank eligibility:

```text
A -2
B -1
Root 0
C +1
D +2
```

## F6 — unequal mutual

A File can reach and be reached from Root with different shortest distances.

Expected preferred side = shorter direction.

## F7 — equal mutual

```text
Root ↔ A
```

Expected:

```text
allowed left/right
preferred null
equal-mutual issue/metric
candidates on both sides
```

## F8 — cycles and same-hop secondary links

Verify shortest distances and secondary classification.

## F9 — Heading-specific references

Several root Headings connect to distinct Files.

Verify precise endpoint groups and candidate specificity.

## F10 — expanded neighbor module

Neighbor File has visible nested Headings and Blocks.

Verify one module and internal hierarchy ownership.

## F11 — exact folders

Same-folder Files appear on both sides, nested folder keys, root folder.

## F12 — duplicate File names

Different folders, stable module IDs, no title-based identity.

## F13 — diagnostics

Unresolved, ambiguous, invalid, multiple sources in one module, external candidates.

## F14 — filtered path intermediate

```text
Root → Hidden A → Visible B
```

A belongs to the fixed neighborhood but is absent from detailed projection.

Verify:

```text
A module presentation = filtered
B retains distance/path evidence
quality issue recorded
```

## F15 — path/status filters

Verify model follows the exact neighborhood produced by KG6 rather than rebuilding broader connectivity.

## F16 — hub stress

One root with hundreds/thousands of one-hop Files across folders.

## F17 — input permutation

Shuffled input produces identical model JSON.

## F18 — live semantic revision

Stable document IDs across supported Heading edits/moves retain module identity.

Use existing test builders where possible.

Do not create private-looking committed names.

---

# 25. End-to-end workspace fixtures

Programmatic model tests are necessary but not sufficient.

Add at least one small committed Markdown workspace fixture that flows through:

```text
Markdown parser
→ Obsidian adapter
→ resolver
→ stable/canonical snapshot as appropriate
→ ProjectionWorkspace
→ Focus projection
→ Focus Schematic model
```

It should cover:

```text
incoming and outgoing direct links
one two-hop path
Headings
two folders
one unresolved or ambiguous target
```

Keep it synthetic/private-safe.

Do not make HIER1 depend at runtime on parser/resolver packages. Those may be test/tool dependencies only.

A representative JSON model fixture is useful if it remains small and readable.

If used:

```text
generation must be deterministic
golden must contain synthetic names only
```

---

# 26. Benchmark harness

Add a repeatable benchmark command, preferably:

```bash
pnpm benchmark:focus-schematic -- --profile small
pnpm benchmark:focus-schematic -- --profile medium
pnpm benchmark:focus-schematic -- --profile hub
```

Implement under the existing diagnostics benchmark owner:

```text
tools/vault-diagnostics
```

Measure separately:

```text
focused document-neighborhood description
detailed Focus projection
model construction
model validation
summary/quality report
serialization
total
```

If a prepared neighborhood is supplied, report that path separately so HIER2/HIER3 can understand duplicate-work cost.

Profiles should include:

## Small

Representative ordinary Focus graph:

```text
tens of File modules
hundreds of visible entities
hundreds of references
mixed folders/diagnostics
```

Use enough repeats for median/p95.

## Medium

Large but plausible hub Focus:

```text
hundreds of modules
thousands of entities/references
```

## Hub / stress

Pathological bounded Focus:

```text
about 1,000 modules
large one-hop fan
mixed reciprocal/secondary edges
many folders
```

The benchmark is evidence, not a CI timing gate.

---

# 27. Performance and complexity

Target architecture:

```text
indexes
→ O(nodes + edges + references)

BFS distances
→ O(modules + relationships)

candidate classification
→ O(relationships + sorting within bounded candidate groups)

validation
→ O(model size + deterministic sorting)
```

Do not implement:

```text
for each module:
  scan every projection edge
```

or:

```text
for each reference:
  repeatedly walk the entire canonical parent chain without memoization
```

Build/cache:

```text
projectionNodeById
moduleByProjectionNodeId
documentIdByEntityId
relationships by source/target
forward/reverse module adjacency
references by ID
```

within one model-build workspace.

No persistent cache yet.

No worker yet.

Because HIER1 is not on the production path, performance results inform HIER2/HIER3 rather than force premature optimization.

---

# 28. Privacy

The model contains local workspace-relative paths and raw diagnostic targets at runtime because the renderer will eventually need them.

Committed benchmark/report evidence must include only:

```text
aggregate counts
timings
synthetic fixture values
deterministic hashes that cannot reveal names
```

Do not commit:

```text
real vault paths
titles
folder names
raw targets
model JSON from a private vault
screenshots/topology of a private vault
```

Optional private real-vault validation may report aggregate counts only.

No network upload.

---

# 29. Production integration boundary

HIER1 must not import `focus-schematic` from:

```text
GraphExplorer
LocalStructuredGraphView
renderer-reactflow production mapping
Dagre worker
desktop app
```

Allowed consumers in HIER1:

```text
package tests
fixture generation
vault-diagnostics benchmark
documentation
```

A development-only comparison command is acceptable if it does not alter production UI or bundle.

Production bundle size should remain unchanged except for incidental shared type/build metadata; ideally the new package is not included in the web build graph at all.

Add a test/dependency scan proving no production web import.

---

# 30. HIER0 compatibility

HIER1 must preserve:

```text
All + Hierarchy experimental gating
Focus + Hierarchy normal availability
HIER0 collision-safe seed
collision-safe adopted diagnostics
fallback geometry
compact duplicate labels
layout fingerprint version
current Dagre worker behavior
```

Do not modify HIER0 geometry except a narrowly required test export.

No new user-facing controls.

No graphical behavior change.

No release-native manual QA should be required for a non-production semantic package, but the normal web/desktop build must remain healthy.

---

# 31. SPATIAL1 compatibility

SPATIAL1A is now merged.

Keep these concepts distinct:

```text
Focus Schematic folder metadata
→ automatic semantic grouping input

SPATIAL1 folder anchors
→ explicit user-authored All-Network display translations
```

HIER1 must not apply or persist SPATIAL1 anchors.

The only intended shared concept is exact normalized folder identity, preferably through core.

Do not implement SPATIAL1B.

---

# 32. Documentation and ADR

Add:

```text
packages/focus-schematic/README.md
docs/HIER1_VALIDATION.md
```

Update:

```text
docs/ARCHITECTURE.md
docs/ROADMAP.md
tests/fixtures/workspaces/README.md
tools/vault-diagnostics/README.md
root README/package map as needed
```

Add a durable ADR, likely:

```text
docs/decisions/0017-focus-schematic-semantic-model-before-layout.md
```

The ADR should record:

1. Focus Hierarchy is modeled as File modules, not a flat renderer graph.
2. The semantic model is separate from layout backend and renderer.
3. Incoming/outgoing distances come from authored reference direction.
4. Equal mutual placement remains explicitly unresolved until layout.
5. Folder keys are automatic metadata, not semantic edges or SPATIAL anchors.
6. Detailed endpoints enrich document-level relationships.
7. Layout prototypes must use the shared quality harness.
8. HIER1 does not change production rendering.

Do not claim two-stage Dagre, compound Dagre, or custom layout has been selected. That is HIER2.

---

# 33. Roadmap update

Current `ROADMAP.md` exists and may be updated.

Add a focused derived-presentation track or concise section:

```text
HIER — Focus Schematic redesign
HIER0 — experimental gate + collision baseline — Complete
HIER1 — semantic model + quality harness — Complete after merge
HIER2 — Dagre prototype bake-off — Next
HIER3+ — production integration / folders / routing / stability — Later
```

Do not mark HIER2 implemented.

Do not reorder KG14 or SPATIAL1.

---

# Suggested implementation sequence

## Phase 1 — repository and seams

1. Sync latest `main`.
2. Inspect open PRs/worktrees and preserve unrelated state.
3. Re-read HIER0 validation and current Focus projection code.
4. Add generic core folder-key ownership and preserve SPATIAL1A re-exports.
5. Add the public serializable focused-document-neighborhood seam.
6. Prove current `projectLocalView` behavior is unchanged.

## Phase 2 — model contract

7. Create `packages/focus-schematic`.
8. Define schema-v1 types.
9. Add strict validator skeleton.
10. Build module/folder indexes.
11. Add module visibility classification.
12. Add hierarchy/internal-reference ownership.
13. Add document relationships and precise endpoint groups.
14. Add diagnostics and ambiguous candidate mapping.
15. Add directed incoming/outgoing distances.
16. Add placement eligibility/preference semantics.
17. Add Focus-path/secondary classification.
18. Add deterministic parent candidates/backbone selection.
19. Add nonfatal model issues.
20. Canonicalize output ordering.
21. Validate before returning.

## Phase 3 — quality harness

22. Add model summary.
23. Add layout-candidate schema/validation.
24. Add layout-quality evaluator.
25. Add stability evaluator.
26. Test evaluator against hand-authored good/bad layouts.
27. Add deterministic model serialization/hash evidence.

## Phase 4 — fixtures and performance

28. Add F1–F18 programmatic fixtures.
29. Add at least one real synthetic Markdown-to-model integration fixture.
30. Add representative small golden JSON only if it improves clarity.
31. Add `benchmark:focus-schematic`.
32. Run small/medium/hub profiles.
33. Add aggregate-only optional real-vault smoke if available and private-safe.

## Phase 5 — integration and documentation

34. Add dependency-boundary linting.
35. Prove no production web import.
36. Update package maps/architecture/roadmap.
37. Add ADR 0017.
38. Add HIER1 validation report.
39. Archive this exact prompt.
40. Run full validation.
41. Open PR and pass CI.
42. Integrate latest `main` if another branch landed.
43. Re-run affected checks.
44. Merge, verify post-merge CI, clean only HIER1 worktree/branches.
45. Stop. Do not start HIER2 automatically.

---

# Validation commands

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/core typecheck
pnpm exec vitest run packages/core/src

pnpm --filter @icarus-graph-explorer/view-projection typecheck
pnpm exec vitest run packages/view-projection

pnpm --filter @icarus-graph-explorer/spatial-overrides typecheck
pnpm exec vitest run packages/spatial-overrides

pnpm --filter @icarus-graph-explorer/focus-schematic typecheck
pnpm exec vitest run packages/focus-schematic

pnpm benchmark:focus-schematic -- --profile small
pnpm benchmark:focus-schematic -- --profile medium
pnpm benchmark:focus-schematic -- --profile hub

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Also run existing relevant regression benchmarks:

```bash
pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:performance -- --profile small
```

No new CI timing thresholds.

---

# Required tests

## Folder-key extraction

```text
root path → .
nested path → exact folder
invalid paths rejected
SPATIAL1A imports/behavior remain compatible
```

## Neighborhood seam

```text
same root/modules/distances as current internal Focus pass
path/status filter behavior unchanged
QUERY1/text/kind filters remain detailed-pass-only
JSON round trip
deterministic ordering
```

## Model creation

```text
Focus required
root Heading/Block normalizes to document
one module per neighborhood document
filtered module retained semantically
visible nodes assigned exactly once
hierarchy cannot cross modules
all projected edges accounted
all relevant ReferenceIds accounted
```

## Distances / placement

```text
incoming-only
outgoing-only
both unequal
both equal
cycles
multi-hop
focus direction incoming/outgoing/both
distance mismatch rejected
```

## Relationships / backbone

```text
path-role equations
same-hop secondary
cross-side secondary
precise endpoint preference
reference-count preference
same-folder tie-break
deterministic final tie-break
equal mutual remains unselected
every unambiguous non-root gets one selected parent
```

## Diagnostics

```text
unresolved
invalid
ambiguous
same-module multi-source
cross-module source contradiction rejected
external candidate preserved
```

## Internal references

```text
visible same-module edge
collapsed internalReferenceIds
no duplicate provenance
no macro self-loop
```

## Validation

```text
unknown schema
extra/missing fields
duplicate IDs
wrong folder
wrong path
wrong module ownership
missing root
invalid distance
invalid placement
invalid backbone
duplicate reference provenance
JSON round trip
```

## Determinism

```text
shuffle canonical entities
shuffle canonical references
shuffle projection nodes
shuffle projection edges
→ identical model JSON
```

## Quality harness

```text
perfect layout
side violation
rank violation
overlap
node outside module
folder coherence comparison
crossing comparison
alignment comparison
stability comparison
missing routes explicitly reported
```

## Performance

```text
small
medium
hub
no repeated whole-edge scan per module
```

---

# Exit gate

HIER1 is complete only when:

1. a dedicated source-neutral Focus Schematic package exists.
2. it depends at runtime only on core and view-projection.
3. it has no renderer/layout/platform/filesystem dependency.
4. no external dependency is added.
5. generic folder-key semantics have one neutral owner.
6. SPATIAL1A folder-key API remains compatible.
7. Focus Schematic does not depend on spatial-overrides.
8. a public document-neighborhood description reuses current KG6 semantics.
9. current `projectLocalView` behavior remains unchanged.
10. model schema version 1 exists.
11. model output is plain JSON-serializable data.
12. one module exists per fixed-neighborhood document.
13. module IDs use stable canonical document IDs.
14. all visible entities belong to exactly one module.
15. filtered neighborhood documents remain representable.
16. hierarchy edges stay within modules.
17. exact folders are derived without canonical Folder entities.
18. root folder is explicit.
19. cross-module references preserve authored direction.
20. complete ReferenceId provenance is retained.
21. precise detailed endpoint groups are retained separately.
22. same-module references do not become macro self-loops.
23. collapsed internal references are preserved.
24. every visible diagnostic has one source module.
25. ambiguous candidate documents are preserved.
26. incoming distances are correct.
27. outgoing distances are correct.
28. KG6 focusDistance consistency is validated.
29. root placement semantics are center/rank 0.
30. incoming-only placement semantics are left.
31. outgoing-only placement semantics are right.
32. unequal mutual uses the shorter direction.
33. equal mutual remains explicitly unresolved left/right.
34. Focus-path relationships are derived from distance equations.
35. secondary relationships are explicit.
36. parent candidates are deterministic.
37. unambiguous modules receive one selected backbone parent.
38. equal-mutual modules do not receive an arbitrary selected side.
39. supported filter/path gaps become nonfatal explicit issues.
40. strict runtime validation covers exact shapes and full ownership.
41. invalid input never returns partial success.
42. output ordering is canonical.
43. input permutations produce byte-identical model JSON.
44. model summary is aggregate/private-safe.
45. future layout-candidate contract exists.
46. candidate validation is strict.
47. layout-quality evaluator reports overlap.
48. layout-quality evaluator reports side/rank violations.
49. layout-quality evaluator reports compactness.
50. layout-quality evaluator reports folder coherence.
51. layout-quality evaluator distinguishes route-aware/approximate crossings.
52. layout-quality evaluator reports alignment proxy.
53. stability evaluator reports root/shared-module displacement.
54. F1–F18 semantic scenarios are covered.
55. at least one Markdown-to-model integration fixture exists.
56. small benchmark completes.
57. medium benchmark completes.
58. hub benchmark completes.
59. model construction avoids per-module whole-edge rescans.
60. committed evidence contains no private vault identifiers.
61. no production GraphExplorer/renderer import is added.
62. production Focus Hierarchy behavior is unchanged.
63. HIER0 collision guarantees remain green.
64. All + Hierarchy remains experimental.
65. Focus + Hierarchy remains normally available.
66. Network behavior remains unchanged.
67. SPATIAL1 behavior remains unchanged.
68. QUERY1/Saved Filters/Visual Groups remain unchanged.
69. current view-state schemas remain unchanged.
70. ADR records model-before-layout policy.
71. HIER1 validation report exists.
72. roadmap marks HIER0/HIER1 correctly and HIER2 next.
73. exact prompt is archived.
74. focused tests pass.
75. full `pnpm check` passes.
76. desktop check/build pass.
77. relevant benchmarks pass.
78. PR CI passes.
79. post-merge CI passes.
80. unrelated user work remains untouched.
81. HIER1 branch/worktree cleanup completes.
82. HIER2 is not started automatically.

---

# Final report

## 1. Summary

State what semantic model and quality harness were added.

## 2. Package boundary

Dependencies, forbidden imports, production non-integration.

## 3. Neighborhood seam

How HIER1 reuses KG6 document-neighborhood semantics without reimplementing Focus.

## 4. File modules

Membership, visible/context/filtered states, folders and internal hierarchy.

## 5. Relationships

Document-level provenance, detailed endpoint groups, internal references and diagnostics.

## 6. Directional semantics

Incoming/outgoing distances, placement eligibility and equal-mutual behavior.

## 7. Focus paths / backbone

Candidate ranking, selected parents and secondary relationships.

## 8. Validation / determinism

Strict invariants, permutation evidence and serialization.

## 9. Quality harness

Candidate schema, overlap/direction/folder/crossing/alignment/stability metrics.

## 10. Fixtures

F1–F18 plus Markdown integration fixture.

## 11. Performance

Small/medium/hub phase timings and complexity evidence.

## 12. Privacy

Aggregate-only evidence and no production/private output.

## 13. Compatibility

Confirm unchanged:

```text
HIER0 renderer
All-Hierarchy gate
Focus projection
Network
SPATIAL1
QUERY1
Visual Groups
persistence schemas
```

## 14. Files changed

Important package, view-projection seam, benchmark, tests and docs.

## 15. Dependencies

Expected external additions:

```text
zero
```

## 16. Deviations / unresolved decisions

Especially:

```text
equal-mutual side placement
filtered-path visual treatment
layout backend
explicit edge routing
```

These must remain HIER2 decisions.

## 17. Follow-up

State:

```text
HIER1 complete
HIER2 — Dagre prototype bake-off — next
```

Do not implement HIER2 automatically.
