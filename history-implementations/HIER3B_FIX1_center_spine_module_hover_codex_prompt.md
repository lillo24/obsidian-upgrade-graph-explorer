# HIER3B-FIX1 — Center-Spine Layout + Module-Aware File Hover

**Task type:** focused post-HIER3B production polish / A1 geometry refinement / renderer hover semantics / regression hardening

## Goal

Fix the two defects exposed by real use of the merged HIER3B Modular Preview before Modular Focus Hierarchy becomes the default:

1. **Center/root Heading fan geometry**
   - a File with several visible top-level center-lane Headings can currently place them in one wide horizontal row;
   - for a focused File whose Headings connect to Files on both macro sides, this wastes width and produces avoidable line congestion;
   - replace that center fan with a compact **File-centered vertical spine**: some top-level structural branches above the File, some below, preserving endpoint-aware ordering.

2. **File hover semantics after Heading disclosure**
   - collapsed Heading references roll up to the File, so File hover appears to show everything;
   - once Headings/Blocks are visible, exact references move to those descendants and File hover currently sees only edges directly incident on the File;
   - in Modular Focus Hierarchy, hovering the File card must show **all currently rendered reference relationships owned by that File module**, including visible Heading/Block endpoints;
   - if visible structure is expanded and the File itself also has direct/preamble references, render a quiet separated **direct-File connection ring**:
     - File card hover = all module relationships;
     - ring hover/focus = direct File-only relationships;
     - Heading/Block hover = exact node-only relationships.

Do **not** implement folder clustering or final connection routing in this task.

Those remain:

```text
HIER4
→ folder-band / folder-coherence positioning

HIER5
→ Direct / Electronic / Electronic-Rounded routing
→ explicit channels
→ obstacle avoidance
→ overlapping-edge separation + independent hit targets
```

HIER3C remains blocked until this fix, HIER4, and HIER5 have been reviewed.

---

# Current baseline

Repository:

```text
lillo24/icarus-graph-explorer
```

Current `main` at plan-writing time:

```text
764754220d62f1a18ee8cd3672f914a2c4c2564e
```

Relevant state:

```text
HIER3A
→ A1 endpoint-facing split lanes selected
→ endpoint-aware ordering accepted

HIER3B
→ production Modular Preview merged in PR #73
→ Classic remains default
→ dedicated modular latest-result-wins worker
→ exact File/Heading/Block endpoint rendering
→ exact memory cache
→ module boundaries
→ filtered bridges
→ diagnostics
→ Secondary Links toggle
→ optimized native graphical QA passed

PR #74
→ later unrelated Network camera-neutral work
→ now on main
```

Source-of-truth documents:

```text
docs/HIER3A_ENDPOINT_LANES.md
docs/HIER3A_VALIDATION.md
docs/HIER3B_MODULAR_PRODUCTION_PREVIEW.md
docs/HIER3B_VALIDATION.md
docs/decisions/0019-focus-schematic-precise-endpoints-and-internal-lanes.md
docs/decisions/0020-production-modular-focus-hierarchy-worker-preview.md
packages/focus-schematic-layout/README.md
packages/renderer-reactflow/src/focus-schematic/README.md
```

Before editing:

1. sync latest `main`;
2. inspect open PRs and registered worktrees;
3. use an isolated HIER3B-FIX1 branch/worktree;
4. preserve unrelated user changes and untracked files;
5. do not rewrite `AGENTS.md` instruction text;
6. integrate latest `main` before final QA if parallel work lands.

---

# Accepted architecture that must remain fixed

Do not reopen:

```text
A1 endpoint-facing split lanes
stateless two-stage Dagre
exact File/Heading/Block endpoints
four-sweep macro endpoint ordering
secondary edges = zero geometry influence
compact filtered bridge
dedicated modular worker
latest-result-wins
exact memory cache
Classic independent fallback
semantic viewport preservation
```

Do not:

- change Focus projection semantics;
- change HIER1 relationship semantics;
- add persisted coordinates;
- add physics;
- add folder clustering;
- add explicit routes;
- replace React Flow;
- make Modular default;
- remove Classic;
- change QUERY1 or saved-view semantics.

---

# PART A — File-centered vertical spine

## A1. Current weakness

Selected A1 currently lays all center-lane entities in one Dagre `TB` region.

A File/document parent with several center-lane sibling Headings therefore tends to produce one horizontal sibling rank:

```text
Heading A   Heading B   Heading C   Heading D   Heading E
                         |
                       File
```

That is valid Dagre output but poor schematic geometry.

## A2. Center structural branch

Within a non-filtered module with a visible File/document node, define a **center structural branch** as:

```text
one top-level center-lane child of the File
+
its center-lane descendants until another top-level File child boundary
```

Left/right lane descendants remain handled by the existing endpoint-facing side-subtree machinery.

No entity duplication.

## A3. Activation

Use the File-centered center-spine composition when:

```text
documentProjectionNodeId !== null
AND
center structural branch count >= 2
```

For 0/1 branch and rare synthetic-core cases, preserve current behavior unless a simple equivalent is clearly safer.

## A4. Above/below are not new semantic lanes

Existing semantic lanes stay:

```text
left
center
right
```

The new vertical placement is only a geometry choice:

```text
above File
below File
```

Do not add top/bottom semantic lanes to HIER1/HIER3A contracts.

## A5. Layout each center branch independently

For each center structural branch:

- collect its center-lane nodes;
- lay out that branch with public Dagre only;
- use actual renderer dimensions;
- use `TB`;
- preserve public source-order constraints;
- return one local branch rectangle;
- do not duplicate the File node in each branch graph;
- skip Dagre for a trivial singleton if direct placement is simpler and exact.

Track call counts.

## A6. File is the central anchor

Compose:

```text
above branch stack

       File

below branch stack
```

Align branch rectangles around the File center X.

Primary geometry objective:

```text
module width ≈ max(File width, branch widths, side-wing extents)
```

rather than sum of sibling widths.

## A7. Deterministic above/below partition

For `N >= 2` center branches in source order:

```text
B1, B2, ... BN
```

choose one contiguous cut:

```text
B1...Bk       → above
B(k+1)...BN   → below
```

Evaluate all legal cuts `1 <= k < N`.

Score lexicographically:

1. minimum maximum vertical extent on either side of File;
2. minimum absolute above/below imbalance;
3. minimum total module height;
4. deterministic source-order tie-break.

Include branch heights and existing internal separation.

Do not hard-code a 2/3 split.

For five equal branches the algorithm should naturally choose a balanced 2/3 or 3/2 result deterministically.

## A8. Source order

Within each stack, preserve source order unless later exact endpoint evidence strictly improves crossings.

Preferred tie behavior:

```text
earlier source Heading → visually higher
```

The File intentionally interrupts the total source order.

## A9. Spacing

Reuse existing constants.

Keep at least the current internal node separation between:

```text
above stack ↔ File
File ↔ below stack
```

Keep current module padding, diagnostic reserve, and hard clearance.

## A10. Re-anchor side subtrees

Existing left/right subtrees must attach to the **new final Y position** of their center parent.

Do not use stale pre-spine center geometry.

## A11. Root and non-root modules

Apply the rule generically to visible File modules with multiple center branches, but the focused root is the primary product case.

Regression-test root, left-side, and right-side modules.

## A12. Bounds

After composition:

```text
all real nodes
all side components
File
```

must be inside one recomputed module rectangle.

Preserve current accepted box policy from repository constants.

No overlap, no containment failure.

## A13. Macro semantics unchanged

Do not change:

```text
signed rank
preferred side
equal-mutual resolver
selected parent relationship
backbone
hop distance
```

Only module dimensions/internal node positions change.

## A14. Existing macro endpoint ordering remains authoritative

Expected flow:

```text
center Headings gain useful Y separation
→ exact endpoint Y becomes informative
→ existing macro endpoint-aware ordering aligns external Files
→ crossings fall naturally
```

Do not add another macro layout engine.

## A15. Bounded local center-stack reorder

After macro geometry exists, allow whole center branches to swap **within the same above stack or below stack**.

Never move a branch across the File in this post-pass.

For adjacent swaps, score precise non-secondary Focus-path edges lexicographically:

1. exact endpoint crossing count;
2. adjacent-rank order inversions;
3. endpoint vertical alignment error.

Apply only strict improvements.

Use a fixed small number of forward/backward sweeps, preferably 2.

Repack the same stack after swaps; its total height must remain unchanged, so module bounds remain unchanged.

Secondary edges must not enter the score.

## A16. Source order is final tie-break

Priority:

```text
crossing reduction
> inversion reduction
> endpoint alignment
> source order
```

Do not reorder on equal score.

## A17. Semantic direction unchanged

A Heading above its File is still semantically a child.

Do not reverse:

```text
File → Heading hierarchy
authored reference source → target
```

Only geometry changes.

## A18. Hierarchy handles

If needed, update hierarchy attachment suggestions so:

```text
branch above File → clean top/bottom attachment
branch below File → clean bottom/top attachment
```

Do not add waypoints or route ownership.

## A19. Algorithm/cache revision

This changes selected A1 geometry for identical semantic input.

Add an explicit layout algorithm revision, e.g.:

```ts
FOCUS_SCHEMATIC_LAYOUT_ALGORITHM_VERSION = 2
```

or repository-equivalent.

Include it in:

```text
exact production cache key
worker/config evidence
benchmarks
validation docs
```

Old page-lifetime geometry must not be considered a valid current cache hit.

Keep the strategy identity conceptually A1; this is not a new macro strategy.

## A20. A0 untouched

`computeFocusSchematicUniformLayout(...)` and historical A0 evidence remain unchanged.

---

# Center-spine fixtures

## CS1 — five top-level Headings

Synthetic:

```text
Focus.md
├─ # Alpha
├─ # Beta
├─ # Gamma
├─ # Delta
└─ # Epsilon
```

Headings connect to Files on both macro sides.

Require:

- no single horizontal 5-Heading row;
- at least 2 branches above and 2 below;
- File remains clear structural center;
- zero overlap/containment failure;
- crossings/inversions no worse than old A1;
- center module width <= old A1.

Measure width, height, bounds area, crossings, inversions, vertical error.

## CS2 — outgoing fan

Five center Headings all connect right.

External Files should align with Heading Y order.

## CS3 — mixed two-sided fan

```text
Incoming A → Heading 1
Incoming B → Heading 2

Heading 3 → Outgoing A
Heading 4 → Outgoing B
Heading 5 → Outgoing C
```

Require left/right macro truth + vertical center stack.

## CS4 — nested branches

Top-level Headings contain subheadings/Blocks.

Whole branch remains coherent.

## CS5 — non-root fan

A side File has multiple center branches.

No signed-rank regression.

## CS6 — diagnostics

Center-spine module with diagnostics.

Reserve and collision-safe production placement remain green.

## Stability

Add:

```text
CS-S1 Depth 0 → five Headings
CS-S2 five → six branches
CS-S3 one Heading gains exact reference
CS-S4 secondary-only relationship added
CS-S5 stable-ID title/offset edit
```

Hard invariant:

```text
CS-S4 → byte-identical geometry
```

---

# PART B — Module-aware File hover

## B1. Keep GraphSelection unchanged

Do not add module selection.

Selection remains exact node/edge projection identity.

Module aggregation is transient hover behavior only.

## B2. Add optional modular entity metadata

Conceptually:

```ts
interface EntityNodeData {
  ...
  focusSchematicModuleId?: string;
  focusSchematicHoverBehavior?: 'exact' | 'module-aggregate';
  hasDirectFileConnectionRing?: boolean;
}
```

Classic mapping leaves these absent.

Modular mapping sets:

```text
File/document → module-aggregate
Heading/Block → exact
```

Use HIER1/model ownership, never coordinates.

## B3. File-card aggregate hover

Hovering a modular File/document must highlight:

1. the File card;
2. all visible File/Heading/Block nodes in its module;
3. its module boundary;
4. every currently rendered **reference edge** incident to any entity in that module;
5. the opposite external endpoint nodes;
6. internal hierarchy edges whose endpoints both belong to the module, so anatomy remains readable.

Do not recursively traverse the external endpoint's other connections.

One module + one external hop only.

## B4. Secondary Links

Meaning is:

```text
all currently rendered module relationships
```

Therefore:

```text
Secondary Off → hidden secondary excluded
Secondary On  → displayed secondary included
```

Secondary toggle must still cause:

```text
0 projection
0 HIER1 model
0 worker
0 layout
0 cache invalidation
```

## B5. Heading/Block hover remains exact

Hover Heading/Block:

```text
that exact node
+ directly incident edges
+ opposite endpoints
```

Do not aggregate the module.

## B6. Direct-File ring purpose

When expanded structure exists, the File card aggregate hover intentionally mixes:

```text
File/preamble references
Heading/Block references
```

The direct ring answers:

```text
Which visible references belong directly to the File/document endpoint?
```

## B7. Ring predicate

Show ring only if all are true:

```text
modular File/document node
AND
same module has at least one visible Heading/Block
AND
at least one currently rendered reference edge is directly incident
to the File/document node
```

Do not count hierarchy edges.

Do not count Heading/Block-owned references.

Do not count hidden secondary references.

Do not classify module-anchor fallback as direct File endpoint.

## B8. Ring absent when redundant

Hide ring if:

```text
Headings collapsed
OR
no direct File reference exists
```

## B9. Secondary-only direct references

If File direct relationships are secondary-only:

```text
Secondary Off → no ring
Secondary On  → ring appears
```

Zero geometry change.

## B10. Ring visual grammar

Quiet thin neutral border with a small gap around File card.

Must not conflict with:

```text
Focus root style
module boundary
selection outline
Visual Group accent
```

No strong semantic color.

## B11. Ring must not affect layout

Ring is renderer-only.

It must not change:

```text
File width/height
React Flow measurement
HIER3 input dimensions
cache key
module bounds
neighbour placement
```

Regression-test exact dimensions.

## B12. Pointer hit testing

Desired:

```text
border/gap region → direct File-only hover
card interior      → module aggregate hover
```

Do not place a transparent full-card overlay that blocks selection/focus.

Preferred implementation may use an SVG stroke-only ring or equivalent single hit target.

Avoid four separate tab stops.

## B13. Keyboard equivalent

The ring needs one focusable equivalent.

On focus:

```text
direct File-only highlight
```

On blur:

```text
clear direct override
```

Accessible label:

```text
Show direct File connections for <File title>
```

Do not create persistent mode or selection.

## B14. Transient GraphHoverTarget

Keep `GraphSelection` unchanged.

Introduce renderer-only hover type, conceptually:

```ts
type GraphHoverTarget =
  | { kind: 'node'; id: ProjectionNodeId }
  | { kind: 'edge'; id: ProjectionEdgeId }
  | { kind: 'document-direct'; id: ProjectionNodeId };
```

No persistence/history/Inspector state.

## B15. GraphCanvas hover architecture

Keep ordinary React Flow hover.

Add an optional nested custom-hover override:

```text
ordinary hover
+
ring direct override
→ effective hover target
→ renderer highlight
```

Ring override wins while active.

Moving ring ↔ File card must not flicker/stick.

## B16. Narrow hover context

If needed, add a renderer context for nested ring components:

```text
setDocumentDirectHover(nodeId)
clearDocumentDirectHover(nodeId)
```

Keep it renderer-owned.

Do not push hover state into `GraphExplorer`.

## B17. Direct File-only highlight

For `document-direct`:

Highlight:

- File card;
- ring;
- currently rendered reference edges directly incident to the File document node;
- opposite endpoints.

Exclude:

- Heading/Block-owned edges;
- unrelated module edges;
- hidden secondary;
- hierarchy-only containment.

## B18. Collapse/expand semantic continuity

Core regression:

```text
collapsed
→ File aggregate hover covers module relationships through rolled-up edges

expanded
→ File aggregate hover covers same underlying relationship provenance
through exact Heading/Block edges
```

Compare underlying ReferenceIds/provenance rather than requiring projection edge IDs to remain identical.

## B19. Use prepared renderer graph

Do not rebuild HIER1 semantics inside highlight code.

Use:

```text
renderer nodes + explicit module metadata + currently rendered edges
```

No source lookup, projection rebuild, model rebuild, worker request.

## B20. Module ownership

Assign exact module ID to modular File/Heading/Block nodes.

Module boundary already owns module ID.

Do not infer membership by title/path or geometry.

## B21. Selection/Inspector unchanged

Click File still selects File.

Click precise edge still selects its projected edge.

Hover changes do not alter Inspector selection.

---

# Hover fixtures

## FH1 — direct + Heading-owned

```text
Science.md
├─ Heading A
└─ Heading B

Science.md → DirectFile.md
Heading A → TargetA.md
Heading B → TargetB.md
```

Expected:

```text
File hover = all 3
Heading A hover = 1
ring hover = direct File edge only
ring visible
```

## FH2 — collapsed vs expanded

Same canonical graph.

Compare File aggregate underlying ReferenceId coverage before/after disclosure.

## FH3 — no direct File edge

Expanded Headings own all references.

File hover includes them.

Ring absent.

## FH4 — collapsed structure

File has direct reference but no visible Heading/Block.

Ring absent.

## FH5 — direct secondary only

Secondary Off → no ring.

Secondary On → ring visible.

Coordinates byte-identical.

## FH6 — mixed incoming/outgoing

File aggregate hover includes both macro sides.

## FH7 — Block endpoint

File hover includes Block-owned reference.

Block hover exact.

Ring excludes it.

## FH8 — filtered/fallback

Module-anchor fallback may participate in aggregate module hover if rendered and owned by module, but must not be misclassified as direct File endpoint.

Document exact policy.

## FH9 — same-module precise reference

Visible Heading↔Heading reference remains visible under File aggregate hover.

Ring only includes it if File document node is an exact endpoint.

---

# Hover performance gate

For:

```text
File aggregate hover
Heading hover
ring hover
edge hover
```

require:

```text
0 projection
0 HIER1 model
0 worker
0 layout
0 cache mutation
```

Only renderer highlight/render work.

Measure on ordinary and larger synthetic Focus graphs.

Use current Class-A direct-feedback guidance; do not add a new CI timing threshold.

If O(V+E) scan is measurably expensive, derive a renderer-only immutable interaction index during modular graph preparation:

```text
module entity nodes
reference edges by module
direct reference edges by File node
```

Do not serialize it through the worker or persist it.

---

# Classic parity

Classic nodes have no modular metadata.

Therefore Classic hover must remain current exact-node behavior.

Add explicit regression.

No direct ring in Classic.

---

# PART C — HIER5 routing handoff

Do not change current `GraphEdge` SmoothStep path in this task.

The current rounded SmoothStep appearance is only an interim connector.

Record HIER5 requirement:

```text
Direct
→ simple/direct connector

Electronic
→ orthogonal horizontal/vertical route with square corners

Electronic — Rounded
→ same orthogonal route geometry with rounded corners
```

Electronic and Rounded must share routing semantics.

Rounded is styling over the route, not a separate optimizer.

## HIER5 congestion regression

Record a synthetic future case:

```text
four vertically stacked Files
four distinct references sharing nearly the same current SmoothStep corridor
```

Current failure:

```text
paths visually merge
top SVG path captures hover
lower semantic edges become hard/impossible to target
```

HIER5 acceptance must require:

```text
distinct edge identities
distinct usable hit targets
channel/lane separation when routes coincide
clear branching into each target
```

Also record future wider invisible interaction strokes, but note that a wider hit stroke alone cannot solve exactly overlapping paths.

Do not implement this routing now.

---

# PART D — HIER4 folder handoff

Do not alter Focus Hierarchy positions with folder metadata in this task.

Record HIER4 acceptance:

```text
same-folder Files should tend toward coherent vertical bands
without fake edges
without overriding signed-rank truth
without worsening exact endpoint readability
```

Priority:

```text
signed rank / Focus-path truth
> endpoint crossing/readability
> folder coherence
```

Folder grouping stays soft.

---

# Required regression matrix

Re-run:

```text
HIER2 F1–F18
HIER3A EP1–EP26
HIER3A ES1–ES8
generated HIER2 holdouts
endpoint small/medium/hub/stability
HIER3B worker/cache/renderer/app suites
```

Keep hard geometry gates:

```text
module overlap = 0
node overlap = 0
node outside module = 0
invalid lane transition = 0
selected stub obstruction = 0
signed-rank violation = 0
non-finite geometry = 0
```

New center-spine hard gates:

```text
required >=4 center-branch fixtures do not form one horizontal row
center-module width <= old A1 baseline
exact endpoint crossings <= old A1
adjacent-rank inversions <= old A1
zero overlap/containment failure
```

Do not require height to shrink.

Expected trade:

```text
less width
more vertical extent
better schematic readability
```

---

# Production/browser QA

Use one synthetic production fixture containing:

```text
Focus File
5 top-level Headings
incoming Files
outgoing Files
one direct File reference
Heading-owned references
Block-owned reference
secondary relationship
filtered bridge
diagnostic
```

Check:

### Center geometry
- no wide single Heading row;
- File is obvious center;
- Headings distributed vertically;
- no crossing regression;
- no overlap.

### File hover
- File card highlights all module relationships;
- Heading/Block hover remains exact.

### Ring
- correct visibility predicate;
- direct File-only highlight;
- keyboard focus;
- no node movement;
- no blocked File click/double-click.

### Secondary
- no node movement;
- File aggregate includes displayed secondary;
- ring responds only to displayed direct File secondary.

### Classic
- layout and hover unchanged.

### Camera
- disclosure/adoption keeps semantic root context stable.

---

# Native optimized desktop gate

Because both selected A1 geometry and production hover interaction change, build the optimized desktop app and require explicit user graphical approval before merge.

The user may manually re-check the original real-vault `Language.md` / `Science.md` cases.

Do **not** commit:

```text
private note contents
private topology
private paths
private screenshots
```

Use synthetic fixtures in repository evidence.

---

# Performance

Add layout timing categories where useful:

```text
center branch layout
center stack partition/composition
center stack reorder
```

Profiles:

```text
5 center branches
20 center branches
100 center branches stress
nested mixed branches
existing medium
existing hub
```

Report:

```text
Dagre call count
module width/height
crossings/inversions
layout time
hover time
```

No new timing CI threshold.

---

# Failure behavior

If refined A1 fails strict validation:

```text
worker failure
→ existing HIER3B last-valid / Classic fallback behavior
```

Do not silently use old center TB for only one bad module unless a deterministic fallback is explicitly designed, validated, and documented.

No partial success-shaped geometry.

---

# Dependencies

Expected external additions:

```text
zero
```

Do not add routing/layout/state libraries.

---

# Likely files

Inspect latest main first.

Likely geometry:

```text
packages/focus-schematic-layout/src/endpoint-facing.ts
packages/focus-schematic-layout/src/crossing-minimization.ts
packages/focus-schematic-layout/src/types.ts
packages/focus-schematic-layout/src/endpoint-fixtures.ts
packages/focus-schematic-layout/src/*test.ts
packages/focus-schematic-layout/README.md
```

Likely renderer:

```text
packages/renderer-reactflow/src/types.ts
packages/renderer-reactflow/src/highlight.ts
packages/renderer-reactflow/src/nodes.tsx
packages/renderer-reactflow/src/GraphCanvas.tsx
packages/renderer-reactflow/src/focus-schematic/index.ts
packages/renderer-reactflow/src/focus-schematic/focus-schematic.test.ts
```

Potential narrow context:

```text
packages/renderer-reactflow/src/hover-context.tsx
```

if appropriate.

Production cache:

```text
apps/web/src/focus-schematic-layout-cache.ts
```

Docs:

```text
docs/HIER3B_FIX1_VALIDATION.md
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
```

Archive:

```text
history-implementations/HIER3B_FIX1_center_spine_module_hover_codex_prompt.md
```

Do not mechanically create every suggested file.

---

# Suggested implementation sequence

## Phase 1 — baseline
1. Sync main and inspect worktrees/PRs.
2. Run focused HIER3A/HIER3B suites.
3. Add synthetic old-A1 center-fan baseline.
4. Capture current hover sets structurally.
5. Confirm Classic parity.

## Phase 2 — center spine
6. Identify center structural branches.
7. Layout branch components.
8. Add deterministic above/below partition.
9. Compose around File.
10. Re-anchor side subtrees.
11. Recompute bounds.
12. Add CS fixtures.

## Phase 3 — center ordering
13. Add bounded within-stack adjacent swaps.
14. Use exact non-secondary endpoint scoring.
15. Preserve source order on ties.
16. Add stability and performance evidence.

## Phase 4 — algorithm/cache revision
17. Add explicit selected-layout revision.
18. Include revision in cache key/protocol evidence.
19. Test old revision miss.

## Phase 5 — module hover
20. Add modular node metadata.
21. Add renderer-only GraphHoverTarget.
22. Implement File module aggregate hover.
23. Keep Heading/Block exact.
24. Add direct File-only hover target.
25. Add FH fixtures.

## Phase 6 — ring
26. Derive exact ring predicate.
27. Add non-layout ring decoration.
28. Add pointer hover.
29. Add keyboard focus equivalent.
30. Verify card selection/double-click.
31. Verify Secondary Off/On zero layout.

## Phase 7 — future handoffs
32. Record HIER5 route-style options and overlapping-hit bug.
33. Record HIER4 folder-band acceptance.
34. Do not implement them.

## Phase 8 — QA
35. Re-run all inherited layout gates.
36. Re-run HIER3B worker/cache/app gates.
37. Browser QA.
38. Build optimized desktop.
39. Ask user for final graphical QA.
40. Wait for explicit approval.

## Phase 9 — merge
41. Update docs/roadmap.
42. Archive exact prompt + SHA-256.
43. Integrate latest main if needed.
44. `pnpm check`.
45. desktop check/build.
46. PR → CI.
47. Merge after approval.
48. Verify post-merge CI.
49. Clean only this branch/worktree.
50. Stop.

Do not start HIER4 automatically.

---

# Validation commands

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:focus-schematic-endpoints -- --profile fixtures
pnpm benchmark:focus-schematic-endpoints -- --profile medium
pnpm benchmark:focus-schematic-endpoints -- --profile hub
pnpm benchmark:focus-schematic-endpoints -- --profile stability

# Add a repository-conventional equivalent if needed:
pnpm benchmark:focus-schematic-center-spine

pnpm benchmark:focus-schematic-production-worker -- --profile small
pnpm benchmark:focus-schematic-production-worker -- --profile medium
pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:performance -- --profile small

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

---

# Roadmap after successful completion

Insert this milestone before HIER4/HIER5/HIER3C.

After merge:

```text
HIER0       — Complete
HIER1       — Complete
HIER2       — Complete
HIER3A      — Complete
HIER3B      — Complete
HIER3B-FIX1 — Complete: center spine + module-aware File hover

HIER4       — Next: folder-band positioning
HIER5       — After HIER4: explicit Direct/Electronic routing
HIER3C      — After HIER5: modular default + Classic Experimental
```

Do not leave HIER3C as immediate Next.

---

# Documentation

Add:

```text
docs/HIER3B_FIX1_VALIDATION.md
```

Update:

```text
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
packages/focus-schematic-layout/README.md
packages/renderer-reactflow/README.md
packages/renderer-reactflow/src/focus-schematic/README.md
```

Do not rewrite ADR 0019/0020 as if this behavior existed earlier.

A new ADR is unnecessary unless this task introduces a broader durable interaction architecture.

Archive exact prompt:

```text
history-implementations/HIER3B_FIX1_center_spine_module_hover_codex_prompt.md
```

Report SHA-256.

---

# Explicitly out of scope

Do not implement:

- folder clustering/bands;
- SPATIAL Pull in Hierarchy;
- Direct route style;
- Electronic route style;
- Electronic-Rounded route style;
- obstacle routing;
- route channels/waypoints;
- edge bundling;
- route persistence;
- HIER3C default flip;
- Classic removal;
- module selection;
- module Inspector;
- source snippets;
- manual Heading positioning;
- persistent hierarchy coordinates;
- physics;
- new dependencies.

---

# Exit gate

HIER3B-FIX1 is complete only when:

1. latest main is used.
2. unrelated work remains untouched.
3. Modular Preview remains lazy.
4. Classic remains default.
5. A1 signed-rank semantics remain unchanged.
6. left/center/right semantic lanes remain unchanged.
7. secondary edges retain zero geometry influence.
8. center structural branches are deterministic.
9. File remains one central semantic node.
10. >=4 center-branch fixtures no longer form one wide horizontal row.
11. above/below partition is data-driven, not hard-coded.
12. source order is deterministic tie-break.
13. side subtrees re-anchor to new center Y.
14. module bounds/padding/reserve remain valid.
15. macro backbone/ranks remain unchanged.
16. bounded center-stack reorder is deterministic.
17. center reorder uses only precise non-secondary endpoint evidence.
18. no branch crosses the File during post-pass.
19. CS1–CS6 pass.
20. center module width improves or does not regress.
21. crossings/inversions do not regress.
22. module/node overlap stays zero.
23. containment stays valid.
24. HIER2/HIER3A inherited corpora remain green.
25. secondary-only geometry remains byte-identical.
26. cold/input-permutation determinism remains.
27. selected algorithm revision is explicit.
28. stale algorithm cache cannot hit.
29. A0 remains unchanged.
30. GraphSelection remains unchanged.
31. modular entity nodes carry exact module ownership.
32. Classic nodes do not activate aggregate hover.
33. File hover includes all currently rendered module reference edges.
34. File hover includes Heading/Block-owned relationships.
35. Heading hover remains exact.
36. Block hover remains exact.
37. edge hover remains exact.
38. ring predicate is exact.
39. ring absent when collapsed.
40. ring absent with no direct File refs.
41. ring reacts to displayed secondary only.
42. ring hover highlights direct File references only.
43. ring has keyboard equivalent.
44. ring does not change node dimensions.
45. ring does not block card click/double-click.
46. ring does not mutate selection/history.
47. hover causes zero projection/model/worker/layout/cache mutation.
48. FH1–FH9 pass.
49. Classic hover parity passes.
50. current SmoothStep routing remains intentionally unchanged.
51. HIER5 handoff records route style choices.
52. HIER5 handoff records overlapping-edge hit-target bug.
53. HIER4 handoff records folder-coherence need.
54. no HIER4/HIER5 implementation leaks in.
55. no new dependency.
56. focused tests pass.
57. full `pnpm check` passes.
58. desktop check/build pass.
59. browser QA passes.
60. user optimized-desktop graphical QA passes.
61. validation doc exists.
62. roadmap sequencing is updated.
63. exact prompt + SHA are archived.
64. PR CI passes.
65. post-merge CI passes.
66. task branch/worktree cleanup completes.
67. HIER4 is not started automatically.

---

# Final report

Report:

## Summary
`HIER3B-FIX1 complete`.

## Center spine
Branch definition, partition, composition, bounded ordering.

## Geometry evidence
Old vs new width/height/crossing/inversion metrics.

## Cache revision
Exact invalidation behavior.

## Module-aware File hover
Aggregate neighborhood semantics.

## Heading/Block hover
Exact behavior retained.

## Direct File ring
Predicate, pointer, keyboard, dimensions.

## Secondary links
Zero geometry influence and display-aware ring/hover behavior.

## Fixtures
CS + FH corpus.

## Performance
Layout + hover measurements.

## Classic parity
No change.

## HIER4 boundary
Folder clustering still deferred.

## HIER5 boundary
SmoothStep unchanged; Direct/Electronic/Rounded + congestion case recorded.

## Browser + optimized desktop QA
Separate automated and user-confirmed evidence.

## Dependencies
Expected: zero.

## Prompt archive / SHA / CI / merge

## Follow-up

```text
HIER4 — folder-band positioning — next
HIER5 — explicit Direct/Electronic routing — after HIER4
HIER3C — modular default — after HIER5
```

Do not start the next milestone automatically.
