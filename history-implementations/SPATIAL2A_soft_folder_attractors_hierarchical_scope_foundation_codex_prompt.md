# SPATIAL2A — Soft Folder Attractors + Hierarchical Folder-Scope Foundation

**Task type:** spatial-rule domain evolution / dynamic constrained layout / hierarchical folder selection / schema migration / benchmark-gated renderer integration

## Goal

Add the missing **dynamic** spatial behavior without removing the current fixed folder placement.

Current SPATIAL1 behavior is:

```text
automatic layout
→ rigid post-layout translation
→ surrounding graph does not react
```

That remains useful as:

```text
Fixed placement
```

SPATIAL2 adds:

```text
Dynamic pull
```

where a folder scope is softly attracted toward a normalized target while ordinary reference forces continue shaping the graph and connected nodes can react.

Conceptually:

```text
reference-driven ForceAtlas2
+
automatic soft folder prior
+
user-authored invisible folder attractors
=
dynamic spatial layout
```

The user-authored attractor behaves like an invisible heavy point pulling the selected folder scope toward a region. It is **not** a semantic graph node and creates no canonical/reference edge.

SPATIAL2A must establish:

1. a schema-v2 spatial-rule contract preserving v1 fixed placements;
2. two behaviors:
   - `place` — current exact/predictable rigid placement;
   - `pull` — dynamic constrained layout;
3. hierarchical folder scopes:
   - direct Files only;
   - folder subtree;
   - subtree with excluded child subtrees;
4. deterministic rule-membership and overlap semantics;
5. an off-main soft-attractor layout stage;
6. separate automatic, dynamically influenced, and displayed positions;
7. separate memory caches/fingerprints;
8. migration and full regression protection;
9. a development harness for evaluating dynamic pull and nested scopes.

Do **not** implement the final production mode/scope-selection UI in SPATIAL2A.

---

# Milestone split

```text
SPATIAL1
→ fixed exact-folder placement
→ complete

SPATIAL2A
→ schema-v2 spatial rules
→ Dynamic Pull algorithm
→ hierarchical folder scope
→ worker/cache/pipeline foundation
→ migration + harness

SPATIAL2B
→ production interaction:
   Dynamic pull | Fixed placement
   This folder | Folder + subfolders | Custom
→ graph/tree scope selection
→ included cluster highlight / excluded fade
→ rigid immediate drag preview
→ asynchronous dynamic refinement
→ commit/cancel/reset

SAVED1
→ later composition of spatial profiles with saved graph views
```

Do not begin SPATIAL2B automatically.

---

# Current repository baseline

Repository:

`lillo24/icarus-graph-explorer`

Current `main` at plan-writing time:

```text
836c465ea3143e769b7ee1937261b2a43cd80587
```

SPATIAL1B merged through PR #59.

Current spatial architecture:

```text
packages/spatial-overrides
schema v1:
  allNetwork.folderAnchors

automatic positions
→ normalized exact-folder rigid translation
→ displayed positions
```

Current guarantees:

- exact folder path keys;
- root folder `"."`;
- normalized anchors in `[-2, 2]`;
- logical `+x = right`, `+y = down`;
- automatic positions and displayed positions are separate;
- ForceAtlas2/cache use automatic positions only;
- fixed drag preview causes zero KG6/topology/layout work;
- persistence is workspace-scoped and write-before-adopt;
- current production Arrange Folders moves exact folder members only;
- Visual Groups and per-File sizes remain independent.

ADR 0017 explicitly defines the current interaction as rigid exact-folder motion and rejects ForceAtlas2 work during direct drag. SPATIAL2A does not invalidate that decision; it introduces a second behavior with different post-release semantics.

---

# Concurrent work / merge discipline

At plan-writing time:

```text
PR #60
SPACING1B — density-aware Focus camera framing
```

is open and draft.

It should not materially own All-Network spatial rules, but it touches renderer/camera code.

Also preserve any local HIER2 or archive-prompt worktrees.

Before editing:

1. inspect current open PRs and worktrees;
2. do not modify, clean, or delete unrelated task worktrees;
3. if SPACING1B merges, rebase before final browser/Tauri QA;
4. preserve its Focus-camera behavior;
5. if another PR changes `GlobalGraphCanvas`, worker protocols, or spatial persistence, integrate from latest `main` before merge;
6. do not resolve conflicts by discarding newer behavior.

---

# Required first inspection

Read current versions of at least:

```text
AGENTS.md

docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
docs/GLOBAL_RENDERER_DECISION.md
docs/decisions/0016-normalized-folder-spatial-overrides.md
docs/decisions/0017-arrange-folders-direct-manipulation.md

packages/spatial-overrides/*
packages/renderer-sigma/src/types.ts
packages/renderer-sigma/src/settings.ts
packages/renderer-sigma/src/layout.ts
packages/renderer-sigma/src/layout-cache.ts
packages/renderer-sigma/src/spatial.ts
packages/renderer-sigma/src/GlobalGraphCanvas.tsx
packages/renderer-sigma/src/session.ts

apps/web/src/spatial-overrides/*
apps/web/src/persistence/spatial-overrides.ts
apps/web/src/workers/global-layout-worker-client.ts
apps/web/src/workers/global-layout.worker.ts
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/NetworkExplorer.tsx
apps/web/src/network-explorer-folders.ts

packages/presentation-overrides/*
packages/visual-groups/*
tools/global-renderer-spike/*
tools/vault-diagnostics/src/global-renderer-benchmark.ts
```

Verify the installed `graphology-layout-forceatlas2` API/types.

The current public ForceAtlas2 settings expose standard layout parameters, not a general custom external-force callback. Use the repository's existing chunked-layout seam rather than adding a new layout library or pretending a custom hook exists.

Official reference:

- https://graphology.github.io/standard-library/layout-forceatlas2.html

---

# Product model

The spatial product now has two distinct behaviors:

```text
Dynamic pull
→ soft target influence
→ graph rebalances
→ connected/outside nodes can react
→ target is approximate

Fixed placement
→ exact final target
→ current folder scope is translated rigidly
→ surrounding graph does not react
→ target is deterministic
```

Both use normalized target anchors.

Do not call both simply “offset.”

Use these user-facing names in future SPATIAL2B unless later product evidence suggests clearer wording:

```text
Dynamic pull
Fixed placement
```

SPATIAL2A may keep production UI unchanged while establishing these domain terms.

---

# Hard architecture rules

1. References remain the semantic graph.
2. Folder membership remains spatial metadata.
3. Pull constraints create no canonical or projected edges.
4. No synthetic attractor appears in Sigma or Inspector.
5. Base automatic layout remains separately cacheable.
6. Dynamic pull is a derived layout stage, not post-layout rigid translation.
7. Fixed placement remains a post-dynamic-layout rigid stage.
8. Current SPATIAL1 exact fixed placements migrate without loss.
9. Current Arrange Folders production behavior remains fixed/exact until SPATIAL2B.
10. Dynamic pulls apply only to All + Network.
11. Focus Network and Hierarchy remain unchanged.
12. Raw coordinates remain unpersisted.
13. Rule changes never mutate KG6/canonical topology.
14. Heavy dynamic refinement stays off-main.

---

# Three position layers

After SPATIAL2A, keep three explicit layers:

```text
1. baseAutomaticPositions
   existing ForceAtlas2 + automatic folder prior

2. dynamicPositions
   base positions refined by user-authored soft pull rules

3. displayedPositions
   dynamic positions followed by fixed placement rules
```

Pipeline:

```text
projection
→ base automatic layout/cache
→ dynamic soft-attractor worker/cache
→ fixed placement composition
→ Sigma
```

Hard anti-drift rule:

```text
base worker input/cache
≠ dynamic output
≠ displayed fixed-placement output
```

Never feed displayed positions into the base automatic cache.

Never apply a fixed placement twice.

---

# New schema version

Evolve `packages/spatial-overrides` from schema v1 to schema v2.

Preferred conceptual contract:

```ts
export const SPATIAL_OVERRIDE_SCHEMA_VERSION = 2 as const;

export type FolderSpatialBehavior =
  | 'pull'
  | 'place';

export type FolderSpatialScope =
  | {
      readonly kind: 'exact';
    }
  | {
      readonly kind: 'subtree';
      readonly includeRootFiles: boolean;
      readonly excludedSubtrees: readonly WorkspaceFolderKey[];
    };

export interface FolderSpatialRule {
  readonly folderKey: WorkspaceFolderKey;
  readonly behavior: FolderSpatialBehavior;
  readonly scope: FolderSpatialScope;
  readonly anchor: NormalizedFolderAnchor;

  /**
   * Integer product strength for Dynamic Pull.
   * Required only for behavior='pull'.
   */
  readonly strength?: number;
}

export interface SpatialOverrideRegistry {
  readonly schemaVersion: 2;
  readonly workspaceId: WorkspaceId;

  readonly allNetwork: {
    readonly folderRules: readonly FolderSpatialRule[];
  };
}
```

Exact names may differ.

Keep one rule per root `folderKey`.

That means the folder's behavior selector changes its one spatial rule rather than stacking an accidental Pull and Place rule at the same root.

---

# Why one rule per root folder

One current folder arrangement should have one understandable intent:

```text
Theory
→ Dynamic pull toward upper-right
```

or:

```text
Theory
→ Fixed placement at upper-right
```

not two hidden rules competing at the same root.

Parent and child folders may each have rules.

Overlap is resolved through folder specificity, described below.

Do not introduce user-generated opaque rule IDs unless implementation evidence requires them.

---

# Schema-v1 migration

Existing schema-v1 entry:

```ts
{
  folderKey: "Theory",
  anchor: { x: 0.6, y: -0.2 }
}
```

must migrate exactly to:

```ts
{
  folderKey: "Theory",
  behavior: "place",
  scope: { kind: "exact" },
  anchor: { x: 0.6, y: -0.2 }
}
```

Requirements:

- no visible movement after migration;
- no loss of root-folder `"."` rules;
- deterministic migration order;
- current Arrange UI continues to edit fixed/exact rules;
- read v1 and v2;
- serialize/write v2 only;
- do not overwrite stored v1 merely on read if current persistence policy avoids unsolicited writes;
- next successful spatial mutation may persist normalized v2;
- corrupt v1 remains blocked, not guessed.

Add explicit migration result metadata if useful.

---

# Compatibility API for SPATIAL1

Keep compatibility wrappers so current production interaction does not need a rushed redesign.

Conceptually:

```ts
setFolderClusterAnchor(...)
→ set/replace:
   behavior='place'
   scope='exact'

removeFolderClusterAnchor(...)
→ remove the rule rooted at that exact folder

folderClusterAnchorMap(...)
→ return only compatible fixed/exact entries
```

If a non-fixed rule exists for that root through the development harness, current fixed Arrange must not silently misrepresent it.

Preferred interim policy:

```text
current SPATIAL1 Arrange action
→ explicitly converts that root rule to place/exact
```

and documents that this is temporary until SPATIAL2B exposes behavior/scope selection.

No pull rules should be created through ordinary production UI in SPATIAL2A.

---

# Dynamic pull strength

Store Dynamic Pull strength as a bounded integer:

```text
0–100
```

Suggested semantics:

```text
0
→ no pull contribution

50
→ moderate pull

100
→ strong but still soft
```

“Strong” must not mean exact placement.

Validation:

- safe integer;
- required for `behavior='pull'`;
- forbidden/omitted for `behavior='place'`;
- no `NaN`, Infinity, fractional ambiguity, or unknown fields.

Do not reuse automatic `folderCohesion`; that is a global automatic clustering preference, while this is one user-authored rule.

Keep them independent:

```text
automatic folder clustering strength
≠
manual folder pull strength
```

---

# Hierarchical folder scope

Support:

## Exact

```text
This folder only
```

Membership:

```text
Files whose exact folderKey equals rule.folderKey
```

Nested folders are excluded.

This preserves current SPATIAL1 behavior.

## Subtree

```text
Folder + subfolders
```

Membership:

```text
direct Files in root folder
+
all descendant-folder Files
```

## Custom subtree

Use the same `subtree` contract with:

```text
includeRootFiles
excludedSubtrees
```

Example:

```ts
{
  kind: 'subtree',
  includeRootFiles: true,
  excludedSubtrees: [
    'Theory/Language',
    'Theory/Archived'
  ]
}
```

Meaning:

```text
include Theory's direct Files
include descendant folders
except the excluded child subtrees
```

An excluded subtree excludes itself and all descendants.

No re-inclusion below an excluded subtree in schema v2.

That limitation is acceptable for the first hierarchical scope and must be documented.

---

# Direct Files as a selectable unit

`includeRootFiles` represents the loose/direct Files of the selected root folder.

This supports the user's distinction:

```text
move only loose Files in folder_1
```

versus:

```text
move folder_1 plus nested folders
```

Future SPATIAL2B can expose a pseudo-row:

```text
Files directly in folder_1
```

that can be included/deselected separately from child subfolders.

Do not persist individual File IDs in the folder-scope rule.

New Files should inherit the folder rule automatically.

---

# Folder-path relationship helpers

Add source-neutral pure helpers:

```ts
isFolderDescendantOf(candidate, root)

folderDepth(folderKey)

folderScopeIncludesFolder(scopeRoot, scope, candidateFolder)

normalizeExcludedSubtrees(root, excluded)
```

Path comparison must respect segment boundaries.

Example:

```text
Theory/A
is descendant of Theory

Theory-Old
is NOT descendant of Theory
```

Root `"."` subtree covers all normalized folders.

Excluded subtrees must:

- be strict descendants of the rule root;
- be unique;
- be normalized;
- form a minimal antichain.

Reject redundant exclusions such as:

```text
exclude Theory/A
exclude Theory/A/B
```

because excluding `Theory/A` already excludes its descendants.

Deterministically sort exclusions.

---

# Rule-overlap semantics

Parent and child folder rules can overlap.

Use **most-specific matching rule wins per document**.

Example:

```text
Theory
→ pull entire subtree right

Theory/Language
→ place exact folder top-left
```

Files in `Theory/Language` use the child rule.

They are not also pulled by the parent rule.

Files elsewhere under `Theory` use the parent rule.

Specificity:

```text
deeper rule.folderKey wins
```

Because there is one rule per root folder, equal-depth ambiguity should not exist.

This policy avoids accidental double forces and makes child folders natural overrides.

Do not compose parent and child pulls additively in schema v2.

Future additive constraints can be reconsidered only with product evidence.

---

# Resolved membership output

Provide one pure resolver:

```ts
resolveFolderSpatialRules({
  rules,
  folderKeyByNodeKey,
}): ResolvedFolderSpatialRules
```

Output should include:

```text
pull groups
place groups
inactive rules
winning rule by node
membership counts
nonfatal reasons for inactivity if useful
```

A resolved group contains stable node keys but no source labels/body.

Rules absent from the current projection remain inactive, not invalid.

Filters/QUERY1 must not delete stored rules.

---

# Fixed placement with hierarchical scope

Generalize current rigid placement composition to use resolved `place` groups.

For every fixed group:

```text
current group center
→ exact normalized target in base automatic frame
→ shared rigid translation
```

Important:

```text
target frame
=
base automatic graph frame
```

but:

```text
center being translated
=
current dynamic positions
```

This makes Fixed Placement the terminal stage after soft pulls.

When there are no pull rules and scope is exact, output must match SPATIAL1 bit-for-bit within numeric tolerance.

Do not compute the target frame from already-pulled or fixed positions.

---

# Base automatic graph frame

The normalized target for both Pull and Place remains relative to:

```text
baseAutomaticPositions
```

not:

- dynamic positions;
- displayed positions;
- camera;
- viewport;
- Focus projection.

This keeps the user's target meaning stable while the graph reacts.

If base automatic layout changes due topology/settings:

```text
new base frame
→ same normalized targets reinterpret proportionally
```

---

# Soft-attractor layout stage

Create a separate derived layout contract, conceptually:

```text
GlobalSpatialInfluenceLayout
```

Do not put soft rules into the existing base automatic layout cache.

Preferred package ownership:

```text
packages/renderer-sigma
  pure request/result/fingerprint/compute contracts

apps/web/src/workers
  global-spatial-influence.worker.ts
  global-spatial-influence-worker-client.ts
```

or an equally clean internal boundary.

This worker is separate from:

- W1 workspace worker;
- W3 Dagre worker;
- Local Free worker;
- base Global automatic-layout worker.

External runtime dependency additions should remain zero.

---

# Dynamic layout request

Use structured-cloneable plain data.

Conceptually:

```ts
interface GlobalSpatialInfluenceRequest {
  readonly schemaVersion: 1;
  readonly requestId: number;
  readonly iterations: number;

  /**
   * Base automatic positions, never fixed/displayed positions.
   */
  readonly nodes: readonly {
    key: string;
    x: number;
    y: number;
    size: number;
  }[];

  readonly edges: readonly {
    key: string;
    source: string;
    target: string;
    weight: number;
  }[];

  readonly attractors: readonly {
    ruleFolderKey: string;
    memberNodeKeys: readonly string[];
    targetX: number;
    targetY: number;
    strength: number;
  }[];

  readonly globalLayoutSettings: GlobalLayoutSettings;
}
```

Exact types may differ.

Do not send:

- source body;
- absolute paths;
- camera;
- Visual Group styles;
- per-File display size overrides;
- fixed placement rules;
- UI tree state.

Target X/Y are derived graph-space points calculated against the base frame.

---

# Soft-pull algorithm

The desired behavior is not a synthetic semantic node.

Implement a shared centroid attractor interleaved with ordinary ForceAtlas2.

Recommended algorithm:

```text
build graph from base automatic positions
split refinement into bounded chunks

for each chunk:
  1. run a ForceAtlas2 chunk
  2. snapshot each attractor member centroid
  3. calculate centroid → target vector
  4. convert strength into a bounded shared translation
  5. apply the same pull-step translation to all members
  6. continue ForceAtlas2 so connected/outside nodes react

final:
  return dynamically influenced positions
```

The shared translation step preserves current intra-cluster shape at that instant.

ForceAtlas2 between steps can reshape the cluster and move connected nodes, which is the intended dynamic behavior.

Do not pull every member independently toward the target; that would collapse the cluster.

---

# Bounded pull step

The pull step must be stable.

Conceptually:

```text
error = target - currentCentroid

rawDelta =
error × strengthCoefficient × chunkFactor

boundedDelta =
cap rawDelta by a fraction of base graph scale per chunk
```

Requirements:

- deterministic;
- finite;
- no overshoot explosion;
- strength 0 produces no pull;
- strength 100 remains soft;
- no exact-target guarantee;
- no uncontrolled oscillation;
- result independent of input array ordering.

Derive exact coefficient/cap from benchmark evidence.

Document final formula.

---

# Algorithm bake-off

Before selecting production behavior, compare at least:

## Candidate A — interleaved centroid attractor

```text
FA2 chunk
→ centroid pull
→ repeat
```

## Candidate B — move then relax

```text
initial centroid move toward target
→ ordinary FA2 refinement without repeated pull
```

Measure:

- final normalized target error;
- affected-cluster displacement;
- unaffected-node displacement;
- cross-boundary edge-length change;
- mean reference-edge-length change;
- deterministic repeatability;
- wall time;
- visual stability;
- whether connected nodes visibly react.

Expected hypothesis:

```text
A
→ sustained target influence + graph reaction

B
→ often drifts back / behaves like temporary fixed offset
```

Do not choose solely from one screenshot.

Synthetic layout-only anchor nodes are not the default candidate because the current ForceAtlas2 API does not expose a proper pinned external-force primitive, and such nodes could introduce unintended repulsion/graph artifacts.

Do not add a new force library unless both bounded candidates fail and the task stops for review first.

---

# Dynamic layout result

Return:

```text
positions
computeMs
forceAtlasMs
attractorMs
metrics
```

Useful aggregate metrics:

```text
mean target error
max target error
mean affected displacement from base
mean unaffected displacement from base
mean cross-boundary reference length
mean total reference length
```

No folder names in benchmark output.

---

# Dynamic layout cache

Create a bounded memory-only cache separate from the base automatic cache.

Fingerprint includes:

```text
base automatic layout fingerprint/version
base automatic node positions identity/hash if required
semantic edge endpoints/weights
resolved pull-rule membership
pull targets
pull strengths
dynamic algorithm/version/settings
```

Exclude:

- fixed placement rules;
- camera;
- selection;
- labels;
- Visual Groups;
- per-File display size;
- Network Explorer state.

Exact hit:

```text
reuse dynamic positions
→ apply current fixed placements
```

No pull rules:

```text
dynamicPositions = baseAutomaticPositions
→ skip worker/cache
```

---

# Position ownership after integration

`GlobalGraphCanvas` or a nearby orchestration owner should retain:

```text
latestBaseAutomaticPositions
latestDynamicPositions
latestDisplayedPositions
latestSpatialRegistry
```

Lifecycle:

## Base seed/cache

```text
base positions available
→ if pull rules:
     dynamic seed = base positions
     request soft worker
  else:
     dynamic = base
→ apply fixed placements
→ display
```

## Base automatic worker success

```text
store/cache base result
→ cancel stale soft worker
→ rerun soft stage if needed
→ apply fixed placements
```

## Pull-rule change

```text
base positions unchanged
→ cancel old soft request
→ request one latest soft refinement
→ current valid display remains until result
```

## Place-rule change

```text
base unchanged
dynamic unchanged
→ fixed composition only
→ zero layout workers
```

## Dynamic worker success

```text
store dynamic result/cache
→ apply latest fixed rules
→ display
```

Never feed dynamic/displayed positions into the base automatic cache.

---

# Visible behavior while pull recomputes

SPATIAL2A has no final production Pull UI, but define the runtime policy for future use.

When a pull rule changes:

```text
keep the last valid graph visible
→ show nonblocking "Refining spatial pull…"
→ latest worker result settles graph
```

Do not blank the graph.

Do not immediately rigidly jump in the production foundation unless a preview is explicitly supplied by SPATIAL2B.

The development harness may provide optional rigid preview for comparison.

---

# Latest-result-wins

Pull rule edits, scope edits, topology changes, and base-layout updates can supersede each other.

Requirements:

- monotonic request IDs/generation;
- only latest compatible result adopts;
- stale success ignored;
- stale failure ignored;
- disposal rejects late results;
- base automatic change invalidates prior dynamic result;
- fixed-only edits do not restart pull worker;
- workspace/source switch clears dynamic cache/state.

Reuse existing worker-client conventions.

---

# Dynamic failure

If soft-attractor refinement fails:

```text
fall back to base automatic positions
→ still apply fixed placement rules
→ show nonfatal actionable warning
```

Do not corrupt the base cache.

Do not silently reinterpret Pull as Fixed Placement.

Do not persist dynamic output.

---

# Current production Arrange compatibility

SPATIAL2A must leave the current production Arrange interaction working.

Until SPATIAL2B:

```text
Arrange Folders drag
→ writes place/exact rule
→ same rigid behavior as today
```

No new mode selector is exposed yet.

Current:

- spotlight;
- cluster highlighting;
- pointer drag;
- keyboard nudge;
- reset;
- persistence failure handling;

must remain green.

The production user should not encounter a half-built Pull rule editor.

---

# Development harness

Extend the existing private-safe global renderer harness.

Add controls:

```text
Behavior:
  Dynamic Pull
  Fixed Placement

Root folder

Scope:
  This folder only
  Folder + subfolders
  Custom subtree

Include direct Files [on/off]

Excluded subtrees
  generic folder tree / multi-select

Target X
Target Y

Pull strength 0–100

Apply
Reset rule
Reset all
```

Show:

```text
resolved member count
inactive/active
base automatic frame
base centroid
dynamic centroid
target error
affected/unaffected displacement
base layout requests
dynamic layout requests
fixed compositions
```

No production interaction UI in SPATIAL2A.

---

# Hierarchical scope visual fixtures

Create synthetic fixtures with:

```text
Root/
  Loose-A.md
  Loose-B.md

Root/Child-A/
  A1.md
  A2.md

Root/Child-A/Grandchild/
  AG1.md

Root/Child-B/
  B1.md

Other/
  O1.md
```

Include:

- strong references within Root;
- strong cross-folder reference Root/Child-A ↔ Other;
- weak/unlinked Files;
- parent and child spatial rules.

Verify:

## Exact

```text
Root
→ Loose-A / Loose-B only
```

## Subtree

```text
Root
→ Loose Files + Child-A + Grandchild + Child-B
```

## Custom

```text
Root subtree
exclude Root/Child-B
→ Root loose + Child-A + Grandchild
```

## Child override

```text
Root pull subtree
Root/Child-A place exact
→ Child-A exact Files use child rule
→ Grandchild follows parent unless child scope includes it
```

---

# Dynamicity acceptance

A valid Dynamic Pull must visibly demonstrate:

```text
pull Root subtree toward right
→ affected cluster moves toward right
→ strongly connected Other nodes also shift/react
→ reference network is rebalanced
```

It must not merely produce:

```text
affected nodes translated
unaffected nodes exactly unchanged
```

That behavior is Fixed Placement.

Use aggregate metrics plus visual browser harness.

---

# Scope rule persistence

Schema v2 persists declarative scope, not resolved File lists.

Therefore:

```text
new File added under included subtree
→ automatically participates

new File added under excluded subtree
→ remains excluded
```

This is why individual File selection is not part of SPATIAL2A.

Do not persist current visible node keys as rule membership.

---

# Inactive and dormant rules

A rule may be inactive because:

- root folder has no visible members;
- QUERY1/Hide removes members;
- exact root path no longer exists;
- custom exclusions remove all visible members.

Inactive is not corrupt.

Keep it stored.

When matching Files reappear, it reactivates.

Folder rename remains exact-path semantics.

No fuzzy reconciliation.

---

# Rule mutations

Add pure operations:

```ts
setFolderSpatialRule(registry, rule)

removeFolderSpatialRule(registry, folderKey)

clearFolderSpatialRules(registry)

setFolderSpatialBehavior(...)

setFolderSpatialScope(...)

setFolderSpatialTarget(...)

setFolderPullStrength(...)
```

All return immutable deterministic v2 registries.

Compatibility wrappers may remain for fixed exact anchors.

---

# Persistence/session migration

Keep the existing spatial storage key.

Session behavior remains:

```text
durable
session-only
blocked-corrupt
blocked-write-failure
```

Required:

- v1 loads and migrates to v2 in memory;
- v2 loads normally;
- writes serialize v2;
- last confirmed registry remains authoritative;
- no success-shaped failed save;
- workspace isolation;
- Reset saved view remains separate;
- current Reset folder/reset all behavior works through v2.

Do not introduce a second soft-pull storage key.

---

# Fixed-placement overlap semantics

For resolved `place` rules:

```text
most-specific rule wins per File
```

After dynamic layout, group Files by winning place rule and rigidly translate each group to its target.

Do not apply parent and child fixed translations cumulatively.

Do not let application order affect output.

---

# Dynamic-pull overlap semantics

For resolved `pull` rules:

```text
most-specific rule wins per File
```

A File belongs to at most one attractor group.

This avoids:

- double forces;
- order dependence;
- confusing parent/child accumulation.

Parent-wide Pull still includes descendants with no more-specific rule.

Document that additive parent+child pulls are deferred.

---

# Pull and Place together

The pipeline is:

```text
base automatic
→ apply resolved Pull groups dynamically
→ apply resolved Place groups rigidly
```

A File's most-specific spatial rule determines whether it is in a Pull or Place group.

Therefore a child Place rule can opt that child out of a parent Pull.

Likewise a child Pull can opt out of a parent Place.

This is the principal nested-rule override model.

---

# QUERY1 / Hide / live updates

When visible topology changes:

```text
re-resolve rule membership
→ base automatic layout policy runs as usual
→ soft stage runs for visible Pull groups
→ fixed stage runs for visible Place groups
```

Rules remain stored.

Active current SPATIAL1 drag cancellation behavior stays intact.

Live folder move/rename:

- follows exact path identity;
- does not migrate rule;
- old rule becomes dormant;
- new path has no rule unless explicitly created.

---

# Automatic folder prior remains independent

Current automatic folder clustering:

```text
folderClustering
folderCohesion
```

remains a global layout preference.

Manual pull rules are separate user-authored intent.

Pipeline:

```text
base automatic layout
  includes optional automatic folder prior

then
manual pull stage
```

Turning automatic folder clustering Off does not disable manual Pull rules.

Pull strength does not rewrite automatic folder strength.

---

# Visual Groups and size overrides

Remain independent:

```text
Visual Groups
→ style

per-File size overrides
→ display radius

spatial rules
→ positions
```

Per-File display sizes must not alter:

- base automatic frame;
- rule membership;
- pull layout size inputs beyond existing automatic sizes;
- pull cache unexpectedly.

Preserve current VISUAL1B render-only guarantees.

---

# Performance instrumentation

Add aggregate phases/operations:

```text
spatial-rule-resolution
spatial-pull-request
spatial-pull-worker
spatial-pull-forceatlas
spatial-pull-attractor
spatial-pull-cache-hit
spatial-fixed-compose
```

Operation expectations:

## Fixed rule edit

```text
0 KG6
0 topology
0 base automatic layout
0 soft-pull layout unless pull membership/fingerprint changed
1 fixed composition
```

## Pull target/strength/scope edit

```text
0 KG6
0 topology
0 base automatic layout
1 latest soft-pull request
1 final fixed composition
```

## Query/topology change

```text
ordinary base layout policy
then latest soft-pull refinement
then fixed composition
```

No CI timing thresholds.

---

# Performance profiles

Benchmark:

```text
small:
100 documents

medium:
5,000 documents / current medium edges

stress:
10,000 documents / 20,000 edges if safe
```

Pull group sizes:

```text
1
10
100
1,000
subtree containing a large portion of graph
multiple independent rules
```

Measure:

- rule resolution;
- request serialization;
- worker wall time;
- ForceAtlas2 time;
- attractor time;
- result apply;
- main-thread high RAF gap;
- dynamic cache hit;
- base cache reuse;
- fixed-only edit;
- scope change.

Report scale limits honestly.

---

# Correctness tests — schema/migration

Cover:

1. v2 empty registry;
2. v1 exact anchor migration;
3. root `"."` migration;
4. deterministic v2 serialization;
5. pull strength required/validated;
6. strength forbidden for Place;
7. exact scope;
8. subtree scope;
9. includeRootFiles;
10. excluded-subtree validation;
11. redundant exclusions rejected/normalized;
12. invalid non-descendant exclusion;
13. duplicate root rule rejection;
14. unknown fields;
15. workspace mismatch;
16. JSON/structured-clone;
17. immutable mutations;
18. compatibility fixed-anchor API.

---

# Correctness tests — membership

Cover:

1. exact direct Files only;
2. subtree includes descendants;
3. root `"."` subtree;
4. custom exclusion;
5. direct Files excluded while descendants included;
6. segment-safe paths;
7. most-specific child rule wins;
8. parent Pull + child Place;
9. parent Place + child Pull;
10. inactive rule;
11. filter disappearance;
12. rule reactivation;
13. new File automatically inherits subtree;
14. excluded-subtree new File remains excluded;
15. no individual File list persisted.

---

# Correctness tests — pull algorithm

Cover:

1. no attractors equals base within tolerance;
2. strength 0 equals no pull;
3. strength 100 finite;
4. one-node group;
5. degenerate frame;
6. multiple independent groups;
7. input-order independence;
8. deterministic repeated run;
9. centroid target error decreases;
10. shared pull step preserves instantaneous member offsets;
11. subsequent FA2 permits dynamic reshaping;
12. connected outside nodes move/react;
13. unconnected distant nodes react less than connected boundary nodes;
14. strong cross-folder edges remain influential;
15. no exact-target guarantee;
16. no synthetic output nodes;
17. no semantic edge mutation;
18. latest-only response validation.

---

# Correctness tests — pipeline/cache

Cover:

1. base cache unchanged by pull rule;
2. pull cache keyed by rule target/strength/scope;
3. fixed rules excluded from pull fingerprint;
4. Visual Groups excluded;
5. size override excluded;
6. camera excluded;
7. no pull skips worker;
8. pull change reuses base automatic positions;
9. fixed edit reuses dynamic positions;
10. dynamic result followed by fixed target uses base frame;
11. v1 fixed exact output regression;
12. stale soft result ignored;
13. base update invalidates dynamic result;
14. dynamic failure falls back to base;
15. latest fixed rules apply after late valid soft result;
16. workspace switch clears caches;
17. current Arrange fixed drag remains zero-layout.

---

# Browser harness QA

Using generic nested folders:

- switch Pull / Place in harness;
- exact / subtree / custom scope;
- direct Files on/off;
- child-subtree exclusions;
- strength 0/25/50/75/100;
- parent Pull + child Place;
- parent Place + child Pull;
- visibly connected outside nodes react under Pull;
- Fixed Placement leaves surrounding graph unchanged;
- pull/cache status;
- query hide/restore;
- automatic folder clustering On/Off;
- Visual Group / size composition;
- no console errors.

No production SPATIAL2 mode selector yet.

---

# Release/Tauri QA

SPATIAL2A changes production layout plumbing even though Pull editing remains harness-only.

Validate a release build with:

- migrated v1 fixed placements;
- current Arrange Folders fixed behavior;
- fixed drag/reset/reload;
- no layout drift;
- All Network automatic layout;
- QUERY1/Hide;
- Visual Groups;
- per-File sizing;
- Focus/Hierarchy unaffected;
- seeded/prepared v2 Pull registry through a private-safe test harness or controlled local storage, if practical;
- no worker/CSP/module errors.

Physical pointer QA remains required for current fixed Arrange regression if the environment supports it.

---

# Privacy

Persisted v2 data may contain:

```text
workspace ID
exact workspace-relative folder paths
behavior
scope/excluded folder paths
normalized target
strength
schema metadata
```

It must not contain:

- source body;
- absolute path;
- node IDs as resolved membership lists;
- raw graph positions;
- viewport points;
- dynamic worker output;
- telemetry.

Benchmarks use generic folder names and aggregate metrics.

---

# Dependencies

Expected external runtime additions:

```text
zero
```

Reuse:

- graphology;
- graphology-layout-forceatlas2;
- existing worker patterns;
- existing spatial package.

Do not add `graphology-layout-force`, d3-force, ELK, a constraint solver, or another state library in SPATIAL2A.

If the existing ForceAtlas2 chunked approach cannot meet the dynamicity gate, stop and report before changing dependencies.

---

# ADR

Add the next available ADR.

Record:

1. SPATIAL1 Fixed Placement remains supported.
2. SPATIAL2 adds Dynamic Pull as a distinct behavior.
3. schema v2 stores one rule per root folder.
4. v1 anchors migrate to Place + Exact.
5. exact/subtree/custom-excluded scope is declarative.
6. direct Files are controlled separately through `includeRootFiles`.
7. most-specific folder rule wins per File.
8. rule membership never creates graph topology.
9. base automatic, dynamic, and displayed positions are separate.
10. Dynamic Pull uses chunked centroid attraction interleaved with ForceAtlas2.
11. target coordinates are normalized against the base automatic frame.
12. dynamic cache is separate from base cache.
13. Fixed Placement is applied after dynamic refinement.
14. current production Arrange UI remains fixed/exact until SPATIAL2B.
15. SPATIAL2B will add behavior/scope selection and hybrid preview/refinement.
16. no individual File exclusions or additive parent/child forces exist in v2.

---

# Documentation

Update at least:

```text
packages/spatial-overrides/README.md
packages/renderer-sigma/README.md
apps/web/src/spatial-overrides/README.md
apps/web/src/persistence/README.md
apps/web/src/workers/README.md
tools/global-renderer-spike/README.md
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
docs/GLOBAL_RENDERER_DECISION.md
```

Clarify terminology:

```text
Fixed placement
Dynamic pull
automatic folder clustering
```

These are three distinct concepts.

---

# Roadmap

Preserve active KG14 and HIER/SPACING tracks.

Add:

```text
SPATIAL1 — Complete
SPATIAL2 — In progress
SPATIAL2A — Soft-attractor + hierarchical-scope foundation complete
SPATIAL2B — Production interaction refinement next
SAVED1 — Later
```

Do not mark SPATIAL2 complete.

Do not start SAVED1.

---

# Scope

## In scope

- spatial schema v2;
- v1 migration;
- Pull vs Place rule semantics;
- exact/subtree/custom-excluded folder scope;
- direct-Files inclusion switch;
- most-specific rule resolution;
- general fixed-placement scopes;
- separate soft-attractor worker;
- algorithm bake-off;
- chunked centroid pull;
- base/dynamic/display position separation;
- dynamic cache/fingerprint;
- production pipeline support;
- current fixed Arrange compatibility;
- development harness;
- tests/benchmarks/browser/Tauri QA;
- ADR/docs/roadmap;
- prompt archive;
- PR/CI/cleanup.

## Out of scope

Do not implement:

- production Pull/Place selector;
- production nested-scope tree;
- click-to-exclude cluster UI;
- live dynamic refinement during pointer move;
- individual File exclusions;
- individual node movement;
- additive parent+child pull composition;
- collision solving;
- Focus/Hierarchy spatial rules;
- folder rename reconciliation;
- persistent dynamic coordinates;
- Saved Views;
- analytics;
- new force/layout dependency.

---

# Suggested implementation sequence

1. Check SPACING1B and other active worktrees.
2. Sync latest `main`.
3. Define schema-v2 rule/scope types.
4. Implement strict v1→v2 migration.
5. Add folder-scope path helpers.
6. Implement most-specific membership resolver.
7. Generalize fixed composition to resolved scopes/base frame.
8. Add dynamic request/result/fingerprint contracts.
9. Implement Candidate A and B.
10. Benchmark/visually compare candidates.
11. Select and document the soft-attractor algorithm.
12. Add dynamic worker/client/latest-result handling.
13. Add separate dynamic cache.
14. Refactor Global position ownership to base/dynamic/display layers.
15. Integrate v2 persistence/session.
16. Preserve current fixed/exact Arrange UI.
17. Extend development harness.
18. Add operation-count and performance evidence.
19. Run full tests/builds.
20. Browser harness QA.
21. Release Tauri regression QA.
22. Update ADR/docs/roadmap.
23. Archive prompt under `history-implementations/`.
24. PR → CI → merge → post-merge CI → cleanup.
25. Stop before SPATIAL2B.

---

# Validation commands

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/spatial-overrides typecheck
pnpm exec vitest run packages/spatial-overrides

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium
pnpm benchmark:performance -- --profile small

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Also run:

```text
v1→v2 fixed-placement regression
exact/subtree/custom membership matrix
parent/child specificity matrix
dynamic candidate A/B comparison
strength 0/25/50/75/100
connected outside-node reaction metric
base/dynamic/display cache purity oracle
fixed edit → zero worker oracle
pull edit → one soft worker oracle
query hide/restore
live folder add/delete/rename
Visual Group + size composition
current Arrange drag/reset regression
browser nested-scope harness
release Tauri worker/persistence smoke
```

PR CI and post-merge `main` CI must pass.

---

# Exit gate

SPATIAL2A is complete only when:

1. schema v2 exists;
2. v1 registries load deterministically;
3. every v1 anchor becomes Place + Exact;
4. migrated fixed output matches SPATIAL1;
5. v2 writes are deterministic;
6. one rule per root folder is enforced;
7. Pull and Place are distinct validated behaviors;
8. Pull strength is a bounded 0–100 integer;
9. Place rejects Pull-only strength data;
10. exact scope includes direct Files only;
11. subtree scope includes descendants;
12. `includeRootFiles` works;
13. excluded subtrees work;
14. exclusions are normalized and nonredundant;
15. path prefix comparison is segment-safe;
16. root `"."` scope works;
17. rules store no File membership lists;
18. new Files inherit declarative subtree scope;
19. most-specific rule wins;
20. parent Pull + child Place works;
21. parent Place + child Pull works;
22. a File belongs to at most one resolved spatial rule;
23. rule resolution changes no graph edges;
24. inactive rules remain persisted;
25. query hide/restore reactivates exact rules;
26. base automatic positions remain separate;
27. dynamic positions remain separate;
28. displayed positions remain separate;
29. base cache never stores dynamic/displayed positions;
30. dynamic cache never stores fixed output;
31. no Pull rules skips the dynamic worker;
32. Pull edits reuse the base automatic layout;
33. Place edits cause zero layout workers;
34. Dynamic Pull is off-main;
35. soft-attractor worker uses plain structured-clone data;
36. interleaved centroid pull is deterministic and bounded;
37. strength 0 produces no pull;
38. strength 100 remains finite;
39. affected centroid moves toward target;
40. connected outside nodes demonstrably react;
41. Pull is not equivalent to rigid translation;
42. reference topology remains unchanged;
43. no synthetic attractor appears in output;
44. dynamic result is not required to hit target exactly;
45. algorithm bake-off evidence exists;
46. selected algorithm is documented;
47. dynamic cache fingerprint includes resolved Pull intent;
48. fixed rules are excluded from dynamic fingerprint;
49. stale dynamic results cannot adopt;
50. base-layout change invalidates dynamic results;
51. dynamic failure falls back safely to base + fixed;
52. Fixed Placement applies after Dynamic Pull;
53. fixed target remains relative to base automatic frame;
54. current production Arrange remains fixed/exact;
55. current direct drag remains zero-layout;
56. current persistence failures remain safe;
57. production does not expose unfinished Pull UI;
58. development harness can create/test Pull rules;
59. development harness supports nested scopes;
60. automatic folder clustering remains independent;
61. Visual Groups remain style-only;
62. per-File size remains render-only;
63. Focus Network is unchanged;
64. both Hierarchy modes are unchanged;
65. no raw/dynamic coordinates are persisted;
66. no external runtime dependency is added;
67. performance evidence covers small/medium;
68. scale limitations are reported honestly;
69. browser harness QA passes;
70. desktop check/build pass;
71. release Tauri regression smoke passes;
72. docs/ADR/roadmap are reconciled;
73. SPATIAL2A is marked complete / SPATIAL2B next;
74. active unrelated tracks remain intact;
75. prompt is archived;
76. PR CI passes;
77. post-merge CI passes;
78. task branch/worktree cleanup completes.

Do not begin SPATIAL2B automatically.

---

# Final report

## 1. Summary

State what Dynamic Pull foundation now does and how Fixed Placement remains.

## 2. Spatial rule schema

V2 behavior, scope, strength, migration.

## 3. Hierarchical folder scope

Exact, subtree, direct-Files inclusion, exclusions, specificity.

## 4. Position pipeline

```text
base automatic
→ dynamic pull
→ fixed placement
→ display
```

## 5. Pull algorithm

Chunked centroid force, formula, stability bounds.

## 6. Candidate comparison

Interleaved versus move-then-relax evidence.

## 7. Dynamicity evidence

Affected cluster and connected outside-node reaction.

## 8. Cache/worker architecture

Base versus dynamic cache, latest-result-wins.

## 9. Fixed-placement compatibility

V1 migration and current Arrange regression.

## 10. Persistence

V2 durable/session/corrupt/write-failure behavior.

## 11. QUERY1 / live update / folder rename

## 12. Visual Groups / size / automatic folder prior

## 13. Performance

Worker wall time, attractor cost, RAF gap, cache hit.

## 14. Tests / browser / Tauri QA

## 15. Privacy

## 16. Dependencies

Expected external additions: zero.

## 17. Files changed

## 18. ADR / roadmap

Confirm:

```text
SPATIAL1 complete
SPATIAL2 in progress
SPATIAL2A complete
SPATIAL2B next
SAVED1 later
```

## 19. Deviations / warnings

Surface target-error tradeoffs, nested specificity compromises, large-scope cost, v2 migration limitations, or anything SPATIAL2B must account for.

## 20. SPATIAL2B handoff

State that production interaction can rely on:

- Pull vs Place rule types;
- exact/subtree/custom scope;
- declarative exclusions;
- most-specific membership resolution;
- dynamic worker/cache;
- normalized target semantics;
- existing rigid sparse preview;
- fixed placement compatibility;
- persistence transaction.

SPATIAL2B should add:

```text
Behavior:
Dynamic pull | Fixed placement

Scope:
This folder | Folder + subfolders | Custom

Custom:
highlight included nodes
fade unrelated/excluded clusters
click child folders to exclude/include
drag with immediate rigid preview
release to either:
  refine dynamically for Pull
  commit exact final placement for Place
```

Do not implement SPATIAL2B automatically.
