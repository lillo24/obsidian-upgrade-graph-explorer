# HIER3A — Precise Cross-File Endpoints + Endpoint-Facing File-Module Lanes

**Task type:** renderer-neutral semantic refinement / internal File-module layout / exact endpoint planning / focused visual lab / HIER3B production prerequisite

## Goal

Refine the selected HIER2 two-stage Dagre strategy so that the **inside of each File module explains the actual cross-file relationship**, rather than always laying out every module as:

```text
File → Heading → deeper Heading
```

regardless of where the connected module sits.

The accepted macro geometry remains:

```text
incoming paths ← focused File → outgoing paths
```

with hop distance encoded horizontally.

HIER3A must add the missing internal semantic grammar:

```text
cross-file reference
→ connects the actual visible File / Heading / Block source
→ to the actual visible File / Heading / Block target

relevant endpoint entity
→ faces the neighbouring macro rank where sensible
```

Examples:

```text
Heading → Heading, one-hop outgoing

[Root File] — [Source Heading] ─────→ [Target Heading] — [Target File]
```

```text
Heading → File

[Root File] — [Source Heading] ─────→ [Target File]
```

```text
File → Heading

[Root File] ────────────────────────→ [Target Heading] — [Target File]
```

```text
multi-hop intermediate module

[parent-side Target Heading] — [Intermediate File] — [child-side Source Heading]
```

The File/Heading hierarchy remains semantically unchanged. Positioning a Heading to the left of its File does **not** mean the Heading owns the File. Quiet hierarchy edges still express containment; directional cross-file arrows express authored references.

HIER3A must produce:

1. a deterministic, strictly validated precise-endpoint plan;
2. a deterministic internal left/center/right lane plan for every visible File module;
3. an endpoint-facing refinement of selected Strategy A;
4. new exact-endpoint quality metrics;
5. a simplified graphical review lab that explains what the user is judging;
6. an explicit user-reviewed decision;
7. a clean HIER3B handoff.

HIER3A remains **outside production rendering**.

Do not modify the current application Hierarchy yet.

---

# Current repository baseline

Repository:

`lillo24/icarus-graph-explorer`

Current `main` at plan-writing time:

```text
e51f52ed11ae8b3a5ff233e4e50a3c1eb268f60c
```

This includes:

```text
HIER0
→ All + Hierarchy hidden behind Experimental
→ current Focus Hierarchy remains normal
→ collision-safe seed, adoption, diagnostics and fallback

HIER1
→ renderer-neutral Focus Schematic model
→ exact visible endpoint groups
→ directional distances, parent candidates and quality harness

HIER2
→ Strategy A selected: stateless two-stage Dagre
→ compact filtered bridge
→ complete routing deferred to HIER5
→ production rendering unchanged

CONVERGENCE1A
→ separate ForceAtlas2 convergence decision work
```

HIER2 merged through PR #64; final validation was recorded through PR #68.

Use as implemented source of truth:

```text
docs/HIER2_LAYOUT_BAKEOFF.md
docs/HIER2_VALIDATION.md
docs/decisions/0018-focus-schematic-layout-strategy.md
packages/focus-schematic/README.md
packages/focus-schematic-layout/README.md
```

Current HIER2 selected API:

```ts
computeFocusSchematicLayout(input)
```

Current implementation:

```text
for each visible File module
→ one fresh LR Dagre hierarchy graph

all resulting module rectangles
→ one fresh LR Dagre macro graph
→ selected parent backbone only
```

Current candidate routes remain empty. Native macro Dagre points are evidence only.

---

# Open and parallel work

At plan-writing time, preserve these open draft PRs:

```text
PR #60 — SPACING1B density-aware Network camera framing
PR #67 — SPATIAL2B dynamic Pull / hierarchical scope editor
```

They concern Network presentation/spatial behavior, not Focus Schematic internal layout.

Rules:

1. sync latest `main` before branching;
2. inspect all open PRs and registered worktrees;
3. use an isolated HIER3A branch/worktree;
4. do not modify, close, merge or reset PR #60/#67;
5. do not copy their unmerged code;
6. avoid production app files unless a test-only import boundary requires a minimal change;
7. integrate latest `main` before final validation if parallel work merges;
8. preserve unrelated user changes, untracked files and `AGENTS.md` instruction text.

`docs/ROADMAP.md` currently exists and may be updated normally after the HIER3A decision.

---

# Accepted HIER2 decisions that HIER3A must not reopen

Do not reopen:

```text
macro strategy
→ stateless two-stage Dagre

filtered intermediary
→ compact anonymous 72 × 40 bridge

Dagre version
→ pinned @dagrejs/dagre 3.1.1

macro planning
→ HIER2 equal-mutual resolver + one selected parent per non-root module

secondary links
→ never influence coordinates

complete explicit routing
→ deferred to HIER5
```

HIER3A changes only the **internal per-File module stage** and the semantic endpoint/attachment output around it.

The macro graph remains:

```text
one variable-size node per File module
+
selected HIER2 backbone
+
stateless fresh Dagre
```

If internal module dimensions change, macro positions may naturally move. Do not add a second macro coordinate policy.

---

# Current missing behavior

HIER1 already preserves, per cross-file relationship:

```text
visibleEndpointGroups
├─ projectedEdgeId
├─ sourceProjectionNodeId
├─ targetProjectionNodeId
├─ sourcePrecision: document | section | block
├─ targetPrecision: document | section | block
└─ exact ReferenceIds
```

But HIER2 currently uses those endpoint groups only for semantic evidence/quality. Internal layout remains uniform LR for every module.

That causes cases such as:

```text
Root module                    right-side target module

File — Source Heading ─────→ File — Target Heading
```

when the exact target Heading would be more legible facing the incoming connection:

```text
File — Source Heading ─────→ Target Heading — File
```

It also underspecifies multi-hop modules, which can simultaneously:

```text
receive a path from the rank nearer the root
and
send a path to the rank farther from the root
```

A whole-module mirror cannot solve that generally.

---

# Important terminology

Keep four concepts separate.

## 1. Authored direction

```text
source → target
```

This comes from the Markdown reference and never changes for layout convenience.

## 2. Signed macro rank

```text
negative rank
→ left of Focus

0
→ focused File module

positive rank
→ right of Focus
```

## 3. Physical attachment side

Where the counterpart module lies relative to this module:

```text
counterpart has smaller signed rank
→ attach on left

counterpart has larger signed rank
→ attach on right
```

This is independent of whether the local endpoint is a reference source or target.

## 4. Internal lane

Where an entity is placed inside its own File module:

```text
left lane
center lane
right lane
```

Do not name physical lanes “incoming” and “outgoing” in the core contract: on the left branch, authored flow and root-relative direction are different from the right branch.

---

# HIER3A decision outcomes

End with exactly one explicit result:

```text
ADOPT_ENDPOINT_FACING_SPLIT_LANES

KEEP_HIER2_UNIFORM_INTERNAL_LAYOUT

HIER3A_BLOCKED_REQUIRES_REDESIGN
```

Expected prior, not forced outcome:

```text
ADOPT_ENDPOINT_FACING_SPLIT_LANES
```

Do not adopt merely because the prompt names it.

A result is accepted only after deterministic tests, performance evidence and user graphical review.

---

# 1. Preserve the HIER2 uniform-internal baseline

The current HIER2 internal module algorithm is historical evidence and a useful comparison baseline.

Preserve it as a development-only strategy:

```text
A0 — HIER2 uniform internal LR
```

Do not overwrite it and make the HIER2 bakeoff irreproducible.

Preferred organization:

```text
focus-schematic-layout
├─ shared input / macro plan / validation
├─ endpoint plan
├─ A0 uniform internal layout        development comparison seam
└─ A1 endpoint-facing split lanes    HIER3A candidate
```

After adoption:

```text
computeFocusSchematicLayout(...)
→ selected A1 endpoint-facing candidate
```

while A0 remains available only to tests/the development lab through a clearly named API or tool adapter.

A0 is **not** the same thing as Classic Focus Hierarchy:

```text
A0
→ modular HIER2 Strategy A with uniform internals

Classic Focus Hierarchy / D0
→ current flat production HIER0 renderer
```

Preserve both distinctions.

---

# 2. New renderer-neutral endpoint plan

Add a strictly validated plain-data contract in:

```text
packages/focus-schematic-layout
```

Conceptually:

```ts
export const FOCUS_SCHEMATIC_ENDPOINT_PLAN_SCHEMA_VERSION = 1 as const;

interface FocusSchematicEndpointPlan {
  readonly schemaVersion: 1;
  readonly rootModuleId: EntityId;
  readonly connections: readonly FocusSchematicEndpointConnection[];
  readonly nodeDemands: readonly FocusSchematicNodeEndpointDemand[];
  readonly summary: FocusSchematicEndpointPlanSummary;
}
```

The exact decomposition may vary, but all semantics below must remain explicit.

The endpoint plan must be:

```text
plain JSON data
deterministically ordered
strictly validated
renderer-independent
layout-coordinate-independent
```

Forbidden fields:

```text
DOM handles
React Flow positions
CSS selectors
callbacks
classes
Maps/Sets
source text snippets
absolute paths
```

---

# 3. Precise cross-file connection records

Create one connection for every HIER1 `visibleEndpointGroup`.

Conceptual shape:

```ts
interface FocusSchematicEndpointConnection {
  readonly id: string;
  readonly relationshipId: string;
  readonly projectedEdgeId: ProjectionEdgeId;
  readonly referenceIds: readonly ReferenceId[];

  readonly sourceModuleId: EntityId;
  readonly targetModuleId: EntityId;

  readonly source: FocusSchematicConnectionEndpoint;
  readonly target: FocusSchematicConnectionEndpoint;

  readonly role:
    | 'selected-backbone'
    | 'focus-path'
    | 'secondary';
}

type FocusSchematicConnectionEndpoint =
  | {
      readonly kind: 'visible-entity';
      readonly projectionNodeId: ProjectionNodeId;
      readonly entityId: EntityId;
      readonly entityKind: 'document' | 'section' | 'block';
      readonly moduleId: EntityId;
      readonly attachmentSide: 'left' | 'right' | 'auto';
    }
  | {
      readonly kind: 'module-anchor';
      readonly moduleId: EntityId;
      readonly reason:
        | 'filtered-module'
        | 'no-visible-document-endpoint';
      readonly attachmentSide: 'left' | 'right' | 'auto';
    };
```

Exact names may follow repository conventions.

Requirements:

- authored source and target never swap;
- exact projected endpoint IDs are retained;
- exact canonical entity IDs are recoverable for future Inspector/snippet work;
- exact ReferenceIds are retained and sorted;
- one visible endpoint group appears exactly once;
- one projected edge cannot map to conflicting relationships;
- connection ID is deterministic and stable for the same projection;
- a Heading-to-Heading link remains Heading-to-Heading;
- Heading-to-File remains Heading-to-File;
- File-to-Heading remains File-to-Heading;
- Block endpoints remain Blocks;
- no hidden Heading is fabricated when disclosure rolled the relation to a visible ancestor;
- no source text is loaded.

The endpoint plan supplies the future ability to hover/select either structural endpoint and retrieve its canonical span through existing workspace/Inspector infrastructure. HIER3A does not implement snippets.

---

# 4. Fallback connection records

A document-level relationship may contain no detailed `visibleEndpointGroup` because:

```text
an intermediate module is filtered
or
detailed projection rolled/removed the endpoint
```

Do not drop that relationship silently.

For every cross-module relationship, account for its complete ReferenceIds through:

```text
one or more precise connections
or
one deterministic fallback connection
```

Fallback priority:

```text
1. visible document projection node
2. deterministic visible structural root when the document card is absent
3. module anchor
```

Module-anchor behavior:

```text
filtered module
→ compact bridge boundary

visible module with no suitable visible document endpoint
→ module boundary with explicit fallback reason
```

Do not invent a canonical entity for a module anchor.

Record aggregate counts:

```text
precise connection count
fallback connection count
precisely represented ReferenceId count
document/module-fallback ReferenceId count
```

---

# 5. Connection role classification

Use existing HIER1/HIER2 semantics.

## Selected backbone

A relationship is selected for at least one non-root module by the HIER2 layout plan.

```text
role = selected-backbone
```

## Other Focus path

The relationship has valid incoming/outgoing path roles but is not the selected parent edge for this connection's role.

```text
role = focus-path
```

## Secondary

```text
relationship.secondary = true
→ role = secondary
```

Priority when a relationship qualifies for more than one presentation role:

```text
selected-backbone
> focus-path
> secondary
```

Secondary connections are preserved for display/provenance but do not influence internal lane assignment or any coordinates.

Add an exact test:

```text
secondary-only change
→ endpoint-facing candidate geometry byte-identical
```

---

# 6. Physical attachment-side derivation

Derive sides only from the finalized HIER2 module plan.

For connection from source module rank `rS` to target module rank `rT`:

```text
rT > rS
→ source attachment right
→ target attachment left

rT < rS
→ source attachment left
→ target attachment right

rT = rS
→ source attachment auto
→ target attachment auto
```

Same-rank connections are normally secondary and must not drive lanes.

This works for both branches:

```text
left incoming branch
Outer File → Inner File → Root

right outgoing branch
Root → Inner File → Outer File
```

Do not derive physical side from:

```text
source vs target alone
incomingDistance alone
outgoingDistance alone
File title/path
current screen coordinate
```

The layout plan is the source of truth.

---

# 7. Direct endpoint demands

For every visible entity endpoint on a non-secondary connection, collect direct physical demands:

```ts
interface FocusSchematicNodeEndpointDemand {
  readonly projectionNodeId: ProjectionNodeId;
  readonly moduleId: EntityId;
  readonly directSides: readonly ('left' | 'right')[];
  readonly sourceConnectionIds: readonly string[];
  readonly targetConnectionIds: readonly string[];
  readonly selectedBackboneConnectionIds: readonly string[];
  readonly focusPathConnectionIds: readonly string[];
}
```

Rules:

- duplicates are deduplicated;
- source/target role remains explicit;
- secondary connections never create a direct demand;
- `auto` attachment creates no left/right demand;
- document endpoints can demand a side for attachment but their node remains in the center lane;
- one entity can demand both sides;
- one entity must never be duplicated to satisfy both sides.

---

# 8. Build the visible hierarchy forest per module

Use:

```text
module.visibleEntityNodeIds
module.hierarchyEdgeIds
projection nodes/edges
```

Build a deterministic hierarchy forest.

Requirements:

- document card is the preferred visible root;
- if document card is absent, use a non-rendered synthetic module-core anchor;
- synthetic core IDs are private to layout and never appear in the candidate;
- projected hierarchy remains acyclic;
- each non-root visible entity has at most one hierarchy parent;
- every visible entity appears exactly once;
- source order remains available;
- cross-module hierarchy is invalid;
- no canonical or projection mutation.

If an unexpected malformed forest appears:

```text
fail explicitly
→ no success-shaped partial module
```

---

# 9. Subtree demand propagation

For every visible hierarchy node, calculate:

```text
subtree demand mask
= direct left/right demands of this node
  OR
  subtree demand masks of visible descendants
```

Possible masks:

```text
none
left
right
both
```

This propagation is deterministic and independent of projection input order.

A common ancestor whose descendants need opposite sides becomes `both`, allowing the hierarchy to split beneath it without duplicating the ancestor.

Example:

```text
Heading A
├─ Target endpoint needed left
└─ Source endpoint needed right

Heading A subtree mask = both
```

---

# 10. Internal lane assignment

Create one strictly validated lane record per visible entity:

```ts
interface FocusSchematicInternalLaneNode {
  readonly projectionNodeId: ProjectionNodeId;
  readonly moduleId: EntityId;
  readonly lane: 'left' | 'center' | 'right';
  readonly directDemand: 'none' | 'left' | 'right' | 'both';
  readonly subtreeDemand: 'none' | 'left' | 'right' | 'both';
  readonly reason:
    | 'document-core'
    | 'left-subtree'
    | 'right-subtree'
    | 'mixed-ancestor'
    | 'neutral-center'
    | 'neutral-inherited';
}
```

Required policy:

## Document

```text
document node
→ center
```

It can expose left/right attachments while remaining one central card.

## Left-only subtree

```text
subtreeDemand = left
→ left lane
```

## Right-only subtree

```text
subtreeDemand = right
→ right lane
```

## Mixed subtree

```text
subtreeDemand = both
→ center lane
```

The shared ancestor remains central and its children can split.

## Completely neutral subtree

```text
subtreeDemand = none
```

Policy:

```text
if parent is left/right
→ inherit that parent lane

if parent is center or synthetic core
→ remain center
```

This keeps unrelated structural material neutral rather than pretending it faces a relationship.

## Invariant

After assignment:

```text
a side-lane node cannot have a child in the opposite side lane
```

A lane transition is permitted only through a center/mixed ancestor.

Validate this explicitly.

---

# 11. Why whole-module mirroring is not a candidate

Do not spend a full strategy track on:

```text
left module  → File then Headings
right module → Headings then File
```

as the final solution.

It handles simple one-hop cases but fails a multi-hop intermediate module that must expose:

```text
parent-facing target endpoint
and
child-facing source endpoint
```

on opposite sides.

A whole-module mirror may appear as a tiny illustrative baseline in the lab if useful, but it must not replace the split-lane requirement or consume substantial implementation scope.

---

# 12. A1 endpoint-facing internal layout

Refine only Strategy A's **internal module stage**.

The macro stage remains selected HIER2 two-stage Dagre.

For every visible module, compose three internal regions:

```text
left side subtrees
center hierarchy spine/core
right side subtrees
```

## Center region

Contains:

```text
document node
mixed-demand ancestors
neutral branches rooted from the center
entities directly demanding both sides
```

Use a fresh deterministic Dagre graph or a smaller deterministic packing appropriate to the hierarchy.

Preferred direction:

```text
TB
```

so neutral/mixed hierarchy can remain under the File/core without falsely choosing left or right.

Do not use physics.

## Left side

For each maximal left-lane subtree:

```text
fresh Dagre
rankdir = RL
actual node dimensions
hierarchy edges only
source-order constraints
```

Parent is nearer the center; descendants unfold left.

## Right side

For each maximal right-lane subtree:

```text
fresh Dagre
rankdir = LR
actual node dimensions
hierarchy edges only
source-order constraints
```

Parent is nearer the center; descendants unfold right.

## Composition

Each maximal side subtree has a center-lane attachment parent.

Compose it by:

1. using the center parent's Y position as preferred anchor;
2. translating the side subtree toward the correct module side;
3. packing same-side subtrees with current hard clearance;
4. preserving source order among otherwise equivalent siblings;
5. using a bounded deterministic sweep, never unbounded iterative optimization;
6. keeping all real nodes unique;
7. excluding synthetic anchors from candidate output;
8. recomputing module bounds from the complete internal geometry;
9. adding existing common module padding and diagnostic reserve.

The exact public-Dagre composition may differ if a cleaner implementation is found, but it must satisfy the same lane/geometry contracts and must not use Dagre private internals.

---

# 13. Internal hierarchy edge preservation

Every current projected hierarchy edge must remain represented between the same projected nodes.

The lane transformation may change geometry, not ownership.

Record a renderer-neutral internal hierarchy attachment suggestion:

```text
center → left child
→ parent left side / child right side

center → right child
→ parent right side / child left side

same-lane hierarchy
→ side appropriate to that lane's Dagre direction

center → center
→ top/bottom or automatic containment attachment
```

This is a suggestion for HIER3B mapping, not full routing.

Do not reverse semantic parent/child direction.

In the lab, render hierarchy lines quietly and without arrowheads so they are not confused with authored cross-file references.

---

# 14. Exact cross-file attachment suggestions

For every precise connection endpoint, derive a node-boundary attachment suggestion:

```ts
interface FocusSchematicEndpointAttachment {
  readonly connectionId: string;
  readonly endpoint: 'source' | 'target';
  readonly kind: 'visible-node' | 'module-anchor';
  readonly projectionNodeId: ProjectionNodeId | null;
  readonly moduleId: EntityId;
  readonly side: 'left' | 'right' | 'auto';
}
```

For left/right sides, use the midpoint of the relevant node rectangle edge in the generated candidate.

For `auto` same-rank secondary connections, choose a deterministic nearest boundary for lab display only:

```text
left/right from counterpart center when unequal X
otherwise top/bottom from relative Y
```

Auto attachments do not affect lanes.

Do not persist coordinates in the endpoint plan itself. Geometry-dependent attachment points may be derived in the computed-layout result.

---

# 15. Computed layout result

Add a narrow renderer-neutral full result for HIER3B adoption.

Conceptually:

```ts
interface FocusSchematicComputedLayout {
  readonly candidate: FocusSchematicLayoutCandidate;
  readonly modulePlan: FocusSchematicLayoutPlan;
  readonly endpointPlan: FocusSchematicEndpointPlan;
  readonly internalLanePlan: FocusSchematicInternalLanePlan;
  readonly attachments: readonly FocusSchematicEndpointAttachmentGeometry[];
  readonly quality: FocusSchematicEndpointLayoutQuality;
}
```

Provide:

```ts
computeFocusSchematicComputedLayout(input)
```

or equivalent.

Keep compatibility:

```ts
computeFocusSchematicLayout(input)
→ returns only selected candidate
```

`computeFocusSchematicLayoutAttempt` may return the richer result/timings while preserving existing fields where practical.

Strictly validate the richer result before success.

This is the future HIER3B worker payload.

Do not include React Flow objects.

---

# 16. Precise endpoint display geometry

The HIER3A lab must draw authored cross-file references between exact endpoint attachments.

Default preview:

```text
source node boundary
→ simple deterministic straight or one-bend exploratory connector
→ target node boundary
```

Requirements:

- arrowhead shows authored source→target direction;
- exact endpoint node identity is visible/inspectable;
- multiple endpoint groups remain distinguishable or truthfully aggregated;
- selected backbone, other Focus path and secondary styles remain distinct;
- approximate module-center edges remain available under Advanced for comparison only;
- native macro Dagre routes remain technical evidence only;
- no claim of final obstacle-aware routing;
- no full route ownership added to HIER1 candidate schema merely for the lab.

Full channel routing, waypoints and obstacle avoidance remain HIER5.

---

# 17. Endpoint-side quality metrics

Add a layout-package quality result, not a competing HIER1 semantic model.

Conceptually:

```ts
interface FocusSchematicEndpointLayoutQuality {
  readonly preciseConnectionCount: number;
  readonly fallbackConnectionCount: number;
  readonly preciseReferenceCoverage: number;

  readonly leftDemandViolationNodeIds: readonly ProjectionNodeId[];
  readonly rightDemandViolationNodeIds: readonly ProjectionNodeId[];
  readonly dualDemandNodeIds: readonly ProjectionNodeId[];
  readonly invalidLaneTransitionEdgeIds: readonly ProjectionEdgeId[];

  readonly obstructedSourceAttachmentConnectionIds: readonly string[];
  readonly obstructedTargetAttachmentConnectionIds: readonly string[];
  readonly ownModuleTraversalConnectionIds: readonly string[];
  readonly endpointNodeOverlapPairs: readonly string[];

  readonly moduleOverlapPairs: readonly string[];
  readonly nodeOverlapPairs: readonly string[];
  readonly nodeOutsideModuleIds: readonly ProjectionNodeId[];

  readonly totalBoundsArea: number;
  readonly meanPreciseEndpointVerticalError: number | null;
  readonly p95PreciseEndpointVerticalError: number | null;
}
```

Exact field names may differ.

## Side-demand violation

For a non-document visible endpoint with only a left demand:

```text
node center X must be left of module core/document center X
```

For right demand: mirror.

A dual-demand entity may remain center and expose both attachments without violation.

A document/core node may remain center regardless of demand.

## Attachment obstruction

The segment from endpoint boundary to its module boundary on the demanded side must not intersect another visible node rectangle in the same module.

This tests whether the cross-file edge can leave/enter without passing through the File or an unrelated Heading.

## Own-module traversal

The first/last connector segment must not cross the interior of its source/target module except through its own endpoint path.

Do not use this metric to pretend all inter-module routing is solved.

---

# 18. Hard gates for A1

A1 is eligible only if every required fixed/generated case passes:

```text
candidate validation success
endpoint/lane-plan validation success
all visible endpoint groups covered exactly once
all exact ReferenceIds retained
all visible entities represented exactly once
no node duplication
no module overlap
no node overlap
no node outside module
no non-finite geometry
no signed-rank violation
root normalized
no invalid lane transition
no single-side endpoint lane violation where structurally satisfiable
no obstructed selected-backbone attachment
secondary-only geometry invariance
cold determinism
input permutation determinism
```

Do not average a hard failure away.

For a structurally unavoidable dual-demand entity:

```text
one center node + two valid attachments
```

is success.

Do not duplicate it to make the metric pass.

---

# 19. Compare A0 and A1

The graphical/metric comparison is now narrow:

```text
A0
→ selected HIER2 macro layout
→ uniform LR internals

A1
→ same selected HIER2 macro layout
→ endpoint-facing split-lane internals
```

Keep exactly the same:

```text
HIER1 semantic model
HIER2 equal-mutual plan
selected parent backbone
filtered bridge
node dimensions
module padding
diagnostic reserve
macro Dagre settings
secondary-edge exclusion
```

Compare:

```text
exact endpoint legibility
endpoint-side violations
attachment obstruction
node/module overlap
area/aspect ratio
hierarchy readability
folder metric preservation
cold determinism
stability
runtime
implementation complexity
```

Do not compare A1 against compound Dagre again. B is already rejected.

Classic D0 may remain available under Advanced as a visual reference, not as the HIER3A competitor.

---

# 20. HIER3A fixture corpus

Add purpose-built endpoint fixtures rather than relying only on HIER2 F1–F18.

Use synthetic/private-safe names.

## EP1 — File → File

```text
Root File → Target File
```

No Heading lane should be invented.

## EP2 — Heading → File

```text
Root Source Heading → Target File
```

Source Heading should face right in a right-side relationship.

## EP3 — File → Heading

```text
Root File → Target Heading in right-side File
```

Target Heading should face left toward Root; Target File remains central in its module.

## EP4 — Heading → Heading

```text
Root Source Heading → Target Heading
```

Both exact Headings face each other.

## EP5 — incoming Heading → root Heading

```text
Left File Source Heading → Root Target Heading
```

Left source Heading faces right; root target Heading faces left.

## EP6 — root two-sided

```text
Incoming Heading → Root Target Heading
Root Source Heading → Outgoing Heading
```

Root module has left and right lanes around one File/core.

## EP7 — right multi-hop

```text
Root Source Heading
→ Middle Target Heading

Middle Source Heading
→ Outer Target Heading
```

Middle module must expose target-facing left and source-facing right lanes.

## EP8 — left multi-hop

```text
Outer Source Heading
→ Middle Target Heading

Middle Source Heading
→ Root Target Heading
```

Middle module again needs both physical sides, with authored direction preserved.

## EP9 — same Heading used on both sides

One visible Heading is both a target from the nearer rank and source toward the farther rank.

Required:

```text
one Heading node
center/mixed lane
left + right attachments
```

## EP10 — mixed nested branch

A common ancestor Heading has one left-demand descendant and one right-demand descendant.

Ancestor stays center; children split.

## EP11 — neutral hierarchy

Several visible Headings have no cross-file endpoint role.

They remain center/neutral and stable.

## EP12 — Blocks

Cover:

```text
Block → File
File → Block
Block → Heading
Heading → Block
Block → Block
```

## EP13 — rolled-up/collapsed target

Canonical target Heading is not visible.

Connect the actual visible projected ancestor/File. Do not generate a ghost Heading.

## EP14 — aggregated precise edge

Several ReferenceIds share one projected endpoint group.

Preserve exact provenance and one truthful connection record.

## EP15 — multiple precise groups in one File-pair relationship

Different Headings in the same two Files connect independently.

Do not collapse them to module center.

## EP16 — same-rank secondary

Precise secondary edge displays but creates zero lane/coordinate change.

## EP17 — equal mutual

Use the HIER2 chosen module side, then derive endpoint-facing sides consistently for both authored directions.

## EP18 — filtered bridge

One endpoint is a compact filtered module anchor; visible endpoint stays precise.

## EP19 — visible document absent

A module contains visible structural content but no visible File card, if KG6 can validly produce this.

Use deterministic synthetic core/fallback behavior.

If current KG6 invariants make it impossible, document and test that precondition rather than fabricating an impossible fixture.

## EP20 — diagnostics reserve

Internal lane geometry still reserves diagnostic space without placing diagnostics as semantic endpoints.

## EP21 — duplicate basenames

Exact endpoint IDs remain distinct despite equal display titles.

## EP22 — large mixed module

One File contains many neutral, left, right and mixed branches.

## EP23 — expansion revision

Depth/branch expansion introduces new neutral or endpoint nodes while retaining stable IDs.

## EP24 — live semantic revision

Reference source/target changes while unrelated module IDs survive.

---

# 21. End-to-end Markdown endpoint fixture

Add at least one committed synthetic Markdown workspace flowing through:

```text
Markdown parser
→ Obsidian adapter
→ resolver
→ canonical snapshot
→ KG6 Focus projection
→ HIER1 Focus Schematic
→ HIER3A endpoint/lane plan
→ A1 layout
```

Cover actual syntax such as:

```md
[[Target]]
[[Target#Heading]]
[[Target#Heading|display]]
[[Target#^block-id]]
```

Place references in:

```text
preamble/File source
Heading-owned source
Block-owned source where supported
```

Assert the resulting exact endpoint connection types.

Do not add private-looking fixture names.

---

# 22. Input permutation / determinism

Shuffle independently:

```text
canonical entities
canonical references
projection nodes
projection edges
model relationships
endpoint groups
node dimensions
```

The validated HIER3A endpoint plan, lane plan and selected A1 candidate must serialize byte-identically after canonical input normalization.

If `nodeDimensions` public input requires sorted order, test both:

```text
validator rejects noncanonical raw input
canonicalized semantically equivalent source produces same output
```

No randomness.

---

# 23. Stability corpus

Reuse HIER2 S1–S10 and add endpoint-specific pairs.

At minimum:

```text
ES1
one Heading gains an outgoing reference

ES2
one Heading loses an endpoint role

ES3
one neutral branch expands

ES4
one multi-hop module gains an outward endpoint branch

ES5
same entity changes from one-sided to dual-demand

ES6
secondary relationship added/removed

ES7
collapsed target becomes precise Heading after disclosure

ES8
Heading stable ID survives title/offset edit
```

Measure:

```text
root displacement
root-relative shared-module displacement
shared-node displacement inside unchanged modules
unaffected-module displacement
lane changes by entity ID
```

Expected hard invariant:

```text
ES6 secondary-only
→ candidate geometry byte-identical
```

Other changes may legitimately resize/reposition affected modules; report rather than hide movement.

---

# 24. Performance

Extend the HIER2 benchmark with distinct phases:

```text
endpoint connection derivation
lane-demand collection
subtree-mask propagation
lane assignment
center layout
left-subtree layouts
right-subtree layouts
module composition/packing
macro Dagre
attachment derivation
endpoint quality evaluation
serialization
total
```

Profiles:

```text
endpoint fixtures
small
medium
500-module hub
large single-module hierarchy
many small modules
```

Compare A0 and A1.

No new CI timing threshold.

Interpretation:

- ordinary Focus target remains Class B, approximately p95 ≤ 250 ms for layout work;
- HIER3B will run the work off-main-thread;
- a moderate increase is acceptable for materially better endpoint semantics;
- a pathological many-subgraph explosion is not acceptable;
- report number of Dagre internal graphs per case;
- report serialized computed-layout size for future worker transport.

If A1 crosses ordinary budgets or creates an excessive number of tiny Dagre calls, optimize composition before adoption or return `HIER3A_BLOCKED_REQUIRES_REDESIGN`.

---

# 25. Simplified HIER3A graphical lab

The HIER2 lab exposed research controls that were not useful for user review.

Create a focused HIER3A lab, preferably:

```bash
pnpm generate:focus-schematic-endpoint-lab -- --out output/hier3a-endpoint-lab
```

Default UI should expose only:

```text
Scenario
Revision          only for before/after scenarios
View              A0 / A1 / side-by-side
Edges             Precise endpoints / hidden
```

Default:

```text
A0 vs A1 side-by-side
Precise endpoints
Secondary off
```

Move technical controls under:

```text
Advanced details
```

Advanced may contain:

```text
module bounds
folder labels
secondary edges
approximate module-center edges
native macro route evidence
quality numbers
```

Do not show B/C configuration controls. HIER2 is finished.

---

# 26. Explain every lab scenario in the lab

When a scenario is selected, show plain-language guidance:

```text
Authored relationship
Root/side expectation
Exact endpoints that should connect
What changed from the comparison revision
What the user should inspect
```

Example:

```text
EP4 — Heading to Heading

Authored:
Root.md > Source heading
→ Target.md > Target heading

Expected:
Source heading faces right.
Target heading faces left.
The File cards remain the module cores.

Check:
The arrow touches those two Heading cards rather than the File/module centers.
```

Signed rank guide:

```text
-2   -1    0   +1   +2
← incoming  Focus  outgoing →
```

Avoid assuming the user knows what “rank”, “filtered policy” or “native route” means.

---

# 27. Lab rendering

Use synthetic SVG/HTML as in HIER2.

Show:

```text
File module bounds
File / Heading / Block shapes
quiet hierarchy containment lines
precise cross-file reference arrows
left/center/right lane guides inside a selected module when Advanced is on
endpoint hover/focus details
```

Hover/focus for a precise edge or endpoint should show synthetic information:

```text
Source.md > Heading A
→ Target.md > Heading B
source/target entity kind
selected backbone / Focus path / secondary
aggregated reference count
attachment side
```

No source text snippet is required.

Keyboard access:

- controls labelled;
- SVG endpoint/edge focus or an adjacent DOM details list;
- no mouse-only information;
- visible focus indicator;
- scenario explanation readable outside SVG.

Generated output remains gitignored.

---

# 28. Graphical review subset

Required user review:

```text
EP3 — File → Heading
EP4 — Heading → Heading
EP5 — incoming Heading → root Heading
EP6 — root two-sided
EP7 — right multi-hop
EP8 — left multi-hop
EP9 — same Heading both sides
EP10 — mixed nested branch
EP12 — Blocks
EP13 — rolled-up endpoint
EP15 — multiple precise groups
EP18 — filtered bridge
EP22 — large mixed module
ES3 / ES4 / ES5 before-after
```

User questions:

1. Is it obvious which exact Heading/Block participates?
2. Do relevant endpoints face the connected macro rank?
3. Does the File remain the conceptual core of its module?
4. Are hierarchy lines distinct from authored reference arrows?
5. Does a multi-hop File read as receiving on one side and sending on the other?
6. Does a dual-purpose Heading remain understandable as one node?
7. Are neutral Headings placed sensibly rather than implying a connection?
8. Is A1 clearly more meaningful than A0 without becoming too wide/tall?
9. Does expansion remain stable enough?
10. Is the filtered bridge still understandable?

Do not finalize the ADR or merge adoption before user review.

---

# 29. Decision protocol

After automated gates and graphical review, record exactly one outcome in:

```text
docs/HIER3A_ENDPOINT_LANES.md
```

## `ADOPT_ENDPOINT_FACING_SPLIT_LANES`

Requirements:

- A1 passes every hard gate;
- user finds exact endpoints and lanes more legible;
- runtime remains acceptable;
- implementation remains bounded/public-Dagre-only;
- no production behavior changed.

Then:

```text
computeFocusSchematicLayout
→ A1 selected non-production layout API
```

A0 remains development-only evidence.

## `KEEP_HIER2_UNIFORM_INTERNAL_LAYOUT`

Use only when A1 adds complexity without clear visual benefit or creates unacceptable instability/area/runtime.

HIER3B would integrate A0 and handle precise endpoint attachments without lane rearrangement.

## `HIER3A_BLOCKED_REQUIRES_REDESIGN`

Use when neither internal policy can represent exact endpoints cleanly under the current candidate/model boundary.

Do not improvise production integration.

---

# 30. Production isolation

HIER3A must not import the selected endpoint-facing layout from:

```text
apps/web
GraphExplorer
LocalStructuredGraphView
renderer-reactflow production mapping
current W3 worker
desktop app
view-state
```

Allowed consumers:

```text
focus-schematic-layout package tests
focus-schematic-bakeoff / endpoint lab
benchmarks
documentation
```

Add/retain a production-boundary test.

Production bundle should remain unaffected.

Ordinary app browser behavior must remain unchanged.

---

# 31. Classic Focus Hierarchy preservation

The current HIER0/D0 Focus Hierarchy remains the production layout throughout HIER3A.

Do not:

```text
hide it
rename it in product UI
change its Dagre input
change its styling
change its W3/cache/fallback behavior
```

HIER3B will integrate the modular preview.

HIER3C will eventually make modular Hierarchy the default and expose the preserved current implementation through:

```text
Settings
→ Graph
→ Experimental
→ Show Classic Focus Hierarchy
```

This remains separate from:

```text
Show All Hierarchy
```

HIER3A must leave the Classic preservation baseline green.

---

# 32. Folder and routing boundaries

Do not implement HIER4 folder bands in HIER3A.

Existing folder metadata and HIER2 macro behavior remain unchanged.

Do not apply:

```text
SPATIAL1/SPATIAL2 anchors
Network folder pulls
manual cluster offsets
```

Do not implement HIER5 routing.

HIER3A may derive exact boundary attachments and simple lab connectors only.

No:

```text
orthogonal channel optimizer
obstacle router
persisted waypoints
edge bundling
manual edge control points
```

---

# 33. HIER1 compatibility

Prefer no HIER1 schema change.

Use existing:

```text
visibleEndpointGroups
module membership
relationship roles
reference provenance
```

A narrow HIER1 fix is acceptable only if prototype use proves a real defect.

Any HIER1 correction requires:

- regression test;
- validation reconciliation;
- documentation note;
- no semantic convenience rewrite.

Do not add physical lane/attachment concepts to the HIER1 semantic model. They belong to layout.

---

# 34. Strict validation

Add validators for:

```text
endpoint plan
internal lane plan
attachment geometry
computed layout result
endpoint quality result where persisted/serialized
```

Validate at least:

## Endpoint plan

- exact shape/schema;
- root/module consistency;
- every visible endpoint group represented once;
- projected edge exists and is a resolved reference edge;
- source/target nodes match HIER1 group exactly;
- entity IDs match projection nodes;
- endpoint belongs to stated module;
- ReferenceIds match;
- role matches relationship/layout plan;
- attachment side follows signed-rank equation;
- fallback coverage exact;
- no duplicate conflicting connection IDs.

## Lane plan

- one record per visible entity node;
- no record for filtered bridge/synthetic anchor;
- document/core center;
- direct/subtree masks correct;
- lane follows policy;
- neutral inheritance correct;
- no side-to-opposite transition;
- deterministic order.

## Geometry

- current HIER1 candidate validation;
- lane node lies on correct side of module core where required;
- dual nodes not duplicated;
- attachments finite and on rectangle boundary;
- attachment references an existing node/module;
- no obstructed selected-backbone endpoint stub;
- root normalized;
- all current 16 px clearance gates retained.

No partial success-shaped output.

---

# 35. Performance architecture for HIER3B

HIER3A must leave one clean future worker payload:

```text
FocusSchematicLayoutInput
→ computeFocusSchematicComputedLayout
→ plain validated result
```

Report:

```text
input serialized bytes
output serialized bytes
endpoint/lane metadata bytes
compute phases
number of internal Dagre invocations
```

Keep the selected algorithm stateless.

No cache in the package.

HIER3B owns:

```text
worker transport
latest-result-wins
cache key
cancellation/stale rejection
fallback/adoption
```

---

# 36. Tests and regression matrix

Required automated coverage includes:

## Semantics

```text
File→File
Heading→File
File→Heading
Heading→Heading
Block combinations
source/target direction preserved
selected-backbone/focus-path/secondary roles
```

## Physical sides

```text
source rank < target rank
source rank > target rank
same-rank auto
left branch
right branch
root left/right
```

## Lanes

```text
left-only subtree
right-only subtree
both-demand ancestor
neutral subtree
neutral inheritance
one dual endpoint node
virtual core
no invalid lane transition
```

## Geometry

```text
center TB hierarchy
left RL subtree
right LR subtree
multiple subtrees one parent
multiple center parents
heterogeneous File/Heading/Block dimensions
module padding
16 px clearance
diagnostic reserve
```

## Endpoint stubs

```text
unobstructed left exit
unobstructed right exit
obstruction detected by oracle
module-anchor attachment
rolled-up endpoint
```

## Invariance

```text
secondary on/off identical geometry
ReferenceId ordering permutation
projection ordering permutation
cold repeated output
A0 baseline reproducible
Classic production untouched
```

## Stability

```text
ES1–ES8
root-relative metrics
unaffected module/node displacement
```

## Performance

```text
small
medium
hub
large single module
many side subtrees
```

---

# 37. Documentation

Add:

```text
docs/HIER3A_ENDPOINT_LANES.md
docs/HIER3A_VALIDATION.md
```

After accepted decision, add an ADR, likely:

```text
docs/decisions/0019-focus-schematic-precise-endpoints-and-internal-lanes.md
```

ADR must record:

1. exact visible endpoint groups remain authored source/target truth;
2. physical attachment side derives from relative signed rank;
3. File modules use left/center/right internal lanes if adopted;
4. mixed ancestors and dual endpoints remain one center node;
5. secondary links do not influence layout;
6. A's macro architecture remains unchanged;
7. full routing remains HIER5;
8. production remains unchanged until HIER3B;
9. Classic remains preserved.

Update:

```text
packages/focus-schematic-layout/README.md
tools/focus-schematic-bakeoff/README.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
root scripts/package maps as needed
```

Do not rewrite ADR 0018 as though HIER2 had already implemented endpoint lanes. Add a forward reference or concise consequence note only if useful.

Archive this exact prompt under:

```text
history-implementations/HIER3A_precise_endpoints_endpoint_facing_internal_lanes_codex_prompt.md
```

---

# 38. Roadmap update

After acceptance/merge:

```text
HIER0 — Complete
HIER1 — Complete
HIER2 — Complete: stateless two-stage Dagre selected
HIER3A — Complete: <decision outcome>
HIER3B — production modular worker + renderer preview — Next
HIER3C — product adoption + Classic preservation — Later
HIER4 — folder-band positioning — Later
HIER5 — explicit routing — Later
```

Do not mark HIER3B started.

Do not reorder KG14/SPATIAL/Network tracks.

---

# Explicitly out of scope

Do not implement:

- production React Flow integration;
- production worker;
- modular/default Hierarchy switch;
- Classic experimental setting;
- changes to current Classic layout;
- HIER4 folder bands;
- HIER5 full routing;
- source snippets;
- Markdown body loading;
- new Inspector UI;
- custom File-module dragging;
- persistence schema changes;
- manual lane editing;
- layout settings exposed to users;
- Dagre upgrade/fork/private internals;
- compound Dagre reopening;
- custom macro coordinate post-pass;
- Network camera/physics/spatial changes;
- PR #60/#67 work.

---

# Suggested implementation sequence

## Phase 1 — baseline and contract

1. Sync latest `main`; inspect open PRs/worktrees.
2. Re-run HIER2 selected-A tests/fixtures.
3. Preserve A0 uniform internal layout as development baseline.
4. Inventory HIER1 endpoint-group invariants.
5. Define endpoint-plan schema/types.
6. Define lane-plan schema/types.
7. Define computed-layout result and validators.
8. Add strict endpoint/fallback accounting.

## Phase 2 — semantic planning

9. Derive connection roles.
10. Derive physical sides from signed ranks.
11. Collect direct endpoint demands.
12. Build hierarchy forest per module.
13. Compute subtree demand masks.
14. Assign left/center/right lanes.
15. Validate no side-to-opposite transition.
16. Add EP1–EP18 semantic tests before geometry.

## Phase 3 — internal A1 geometry

17. Extract/refactor A0 internal stage without changing output.
18. Implement center skeleton layout.
19. Implement maximal left-subtree RL layouts.
20. Implement maximal right-subtree LR layouts.
21. Compose/pack side subtrees deterministically.
22. Recompute module bounds/padding/reserve.
23. Run unchanged HIER2 macro Dagre.
24. Derive exact node/module attachment geometry.
25. Add endpoint-specific quality metrics.
26. Complete EP19–EP24 and stability tests.

## Phase 4 — lab and performance

27. Add precise-endpoint SVG rendering.
28. Add plain-language scenario explanations.
29. Simplify default controls to Scenario / Revision / View / Edges.
30. Move technical controls to Advanced.
31. Add hover/focus endpoint details.
32. Extend benchmark phases/profiles.
33. Compare A0/A1 determinism, geometry, quality, stability and runtime.
34. Generate ignored HIER3A lab.
35. Browser-QA lab and ordinary production app smoke.

## Phase 5 — user decision

36. Present concise review instructions and lab path.
37. Ask the user to review required scenarios.
38. Wait for explicit approval/rejection.
39. Record exact outcome.
40. If adopted, make A1 the selected non-production package API.
41. Keep A0 as development comparison evidence.

## Phase 6 — documentation and merge

42. Write HIER3A decision/validation docs.
43. Add ADR 0019 after accepted decision.
44. Update architecture/roadmap/maps.
45. Archive this exact prompt.
46. Run full validation.
47. Integrate latest `main` if parallel work landed.
48. Re-run affected checks.
49. PR → CI → merge after user authorization.
50. Verify post-merge CI.
51. Remove only HIER3A worktree/branches.
52. Stop. Do not begin HIER3B automatically.

---

# Validation commands

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/focus-schematic typecheck
pnpm exec vitest run packages/focus-schematic

pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout

pnpm --filter @icarus-graph-explorer/focus-schematic-bakeoff typecheck
pnpm exec vitest run tools/focus-schematic-bakeoff

pnpm benchmark:focus-schematic-layout -- --profile fixtures
pnpm benchmark:focus-schematic-layout -- --profile small
pnpm benchmark:focus-schematic-layout -- --profile medium
pnpm benchmark:focus-schematic-layout -- --profile hub
pnpm benchmark:focus-schematic-layout -- --profile stability

pnpm generate:focus-schematic-endpoint-lab -- --out output/hier3a-endpoint-lab

pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:performance -- --profile small

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

If script names differ, add current equivalents and document them.

Heavy hub evidence may stay outside ordinary CI; CI must run a deterministic small smoke.

No new timing threshold.

---

# Browser QA

## Endpoint lab

```text
EP3 File→Heading
→ target Heading left of target File
→ arrow enters exact Heading

EP4 Heading→Heading
→ both exact Headings face each other

EP5 incoming Heading→root Heading
→ left source and root target face each other

EP6 root two-sided
→ root incoming target Heading left
→ root outgoing source Heading right

EP7/EP8 multi-hop
→ intermediate File has two sides
→ direction remains authored

EP9 dual Heading
→ one node, two attachments

EP10 mixed ancestor
→ common ancestor centered
→ children split

EP12 Blocks
→ exact Block cards used

EP13 rolled-up
→ actual visible ancestor used
→ no ghost Heading

EP16 secondary
→ toggle produces no geometry change

EP18 filtered bridge
→ exact visible endpoint + module anchor
```

## Lab usability

- scenario meaning explained in plain language;
- no need to understand HIER2 configuration controls;
- revision shown only when useful;
- precise endpoints default;
- secondary off by default;
- keyboard-accessible details;
- clean console.

## Production smoke

Current application must remain visually unchanged:

```text
All Network
Focus Network
Focus Hierarchy Classic/current
All Hierarchy experimental gate
Search / Inspector / Network Explorer
```

No release-Tauri graphical gate is required for non-production HIER3A, but desktop check/build must pass.

---

# Exit gate

HIER3A is complete only when:

1. latest `main` and open work are inspected.
2. PR #60/#67 and unrelated work remain untouched.
3. HIER2 A0 output remains reproducible.
4. Classic D0 remains distinct and unchanged.
5. an endpoint-plan schema exists.
6. an internal-lane-plan schema exists.
7. a computed-layout result exists.
8. all new outputs are plain JSON data.
9. strict validators exist.
10. every HIER1 visible endpoint group maps exactly once.
11. authored source/target direction is preserved.
12. File→File remains File→File.
13. Heading→File remains Heading→File.
14. File→Heading remains File→Heading.
15. Heading→Heading remains Heading→Heading.
16. Block endpoint combinations remain exact.
17. ReferenceId provenance is complete.
18. fallback relationship provenance is complete.
19. no hidden structural endpoint is fabricated.
20. physical sides derive from signed-rank comparison.
21. same-rank secondary endpoints use auto/display-only behavior.
22. secondary connections create no lane demand.
23. direct endpoint demands are deterministic.
24. hierarchy forest is validated.
25. subtree demand masks are correct.
26. document/core nodes stay center.
27. left-only subtrees use left lane.
28. right-only subtrees use right lane.
29. mixed ancestors use center lane.
30. neutral inheritance follows policy.
31. no side node directly transitions to the opposite lane.
32. one dual endpoint entity remains one node.
33. synthetic anchors never appear in candidate output.
34. A1 uses fresh stateless public Dagre calls only.
35. center region is deterministic.
36. left side is deterministic and hierarchy-correct.
37. right side is deterministic and hierarchy-correct.
38. side-subtree packing is bounded.
39. source order remains stable where supported.
40. current node dimensions remain explicit.
41. current module padding/reserve remain synchronized.
42. selected HIER2 macro graph remains unchanged in semantics.
43. root remains normalized.
44. all visible nodes are contained in one module.
45. module overlaps are zero.
46. node overlaps are zero.
47. current 16 px clearance passes.
48. exact attachment points are finite and on boundaries.
49. selected-backbone endpoint stubs are unobstructed.
50. own source/target module traversal violations are zero or explicitly block adoption.
51. A1 passes HIER2 side/rank hard gates.
52. A1 passes F1–F18 and generated holdouts.
53. EP1–EP24 are covered.
54. at least one Markdown-to-endpoint integration fixture passes.
55. input permutations yield byte-identical output.
56. cold repeated output is byte-identical.
57. secondary-only changes yield byte-identical geometry.
58. ES1–ES8 stability pairs are measured.
59. exact endpoint coverage metrics are reported.
60. fallback coverage metrics are reported.
61. endpoint-side violation metrics are reported.
62. attachment-obstruction metrics are reported.
63. A0/A1 area/stability/runtime are compared.
64. small benchmark passes.
65. medium benchmark passes.
66. hub benchmark passes or safely records timeout/failure.
67. large-single-module benchmark passes.
68. number of Dagre calls is reported.
69. future worker payload size is reported.
70. endpoint lab is generated and gitignored.
71. lab defaults to precise endpoints.
72. lab explains every scenario.
73. technical controls are under Advanced.
74. hierarchy lines and reference arrows are visually distinct.
75. endpoint hover/focus details are available without source text.
76. user reviews the required scenario subset.
77. one explicit HIER3A decision is recorded.
78. user feedback is represented accurately.
79. if A1 is adopted, selected non-production API uses A1.
80. A0 remains development evidence.
81. production imports remain absent.
82. current production Focus Hierarchy remains unchanged.
83. current Classic preservation contract remains green.
84. All + Hierarchy remains experimental.
85. HIER4 folder work is not implemented.
86. HIER5 routing is not implemented.
87. no source snippets are implemented.
88. no persistence schema changes occur.
89. no Dagre upgrade/fork/private internals are used.
90. no new external dependency is added.
91. focused package tests pass.
92. bakeoff/tool tests pass.
93. full `pnpm check` passes.
94. desktop check/build pass.
95. ordinary product browser smoke passes.
96. ADR 0019 records the accepted decision.
97. HIER3A validation/decision docs exist.
98. roadmap identifies HIER3B as next.
99. exact prompt is archived.
100. PR CI passes.
101. post-merge CI passes.
102. task branch/worktree cleanup completes.
103. HIER3B is not started automatically.

---

# Final report

## 1. Summary

State the exact decision:

```text
ADOPT_ENDPOINT_FACING_SPLIT_LANES
KEEP_HIER2_UNIFORM_INTERNAL_LAYOUT
HIER3A_BLOCKED_REQUIRES_REDESIGN
```

## 2. Baseline

A0, selected macro Strategy A, Classic D0 and current main.

## 3. Endpoint plan

Precise/fallback connections, authored direction and provenance.

## 4. Physical-side semantics

Signed-rank rule and secondary handling.

## 5. Lane planning

Direct/subtree demands, mixed ancestors, neutral branches and dual endpoints.

## 6. Internal layout

Center/left/right Dagre composition and bounded packing.

## 7. Exact attachment evidence

Coverage, side violations and obstruction metrics.

## 8. Fixtures

EP1–EP24 and Markdown integration.

## 9. A0 vs A1

Readability, area, stability, runtime and complexity.

## 10. Graphical review

Scenarios reviewed and exact user judgement.

## 11. Performance

Phase timings, Dagre-call counts and worker payload sizes.

## 12. Validation / determinism

Hard gates, permutations and cold output.

## 13. Production compatibility

Confirm no production renderer/UI change.

## 14. Classic preservation

Confirm D0/current HIER0 remains intact for later Experimental exposure.

## 15. Files changed

## 16. Dependencies

Expected external additions:

```text
zero
```

## 17. ADR / roadmap / prompt archive

## 18. Deviations and unresolved work

Especially:

```text
full routing
folder bands
production worker/cache
actual Inspector/snippet interaction
```

## 19. Follow-up

State:

```text
HIER3A complete
HIER3B — production modular worker + renderer preview — next
```

Do not implement HIER3B automatically.
