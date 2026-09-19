# HIER4B-FIX6 — Real-Vault Nested Split Hardening + Failed-Reroot Last-Valid Presentation Safety

**Task type:** corrective continuation of open PR #106 / Nested Soft geometry + Modular reroot lifecycle hardening.

## Goal

Continue PR #106 and fix two real-vault QA failures:

1. A legitimate Nested Soft layout can fail with:

```text
Nested Soft hierarchy validation failed:
containment=0, splits=2, blockers=0.
```

2. After File→File reroot, the user can still observe a blank/empty Modular canvas when the incoming replacement fails, even though UX1 already added last-valid graph retention.

Do **not** redesign Heading/Block subfocus in this task. Founder reports it works in the Synthetic Sample.

Do not merge before founder native QA.

---

## Chronology: commit `042ffef` is not the cause

Founder wondered whether the regression started after:

```text
042ffef35ac80d308706358a86e3a752d60aa3a8
fix(settings): reserve red for source errors
```

Repository evidence rules that out as a code cause.

Its parent is:

```text
507d54ff9f263318a1d7b8b892866786147d36d8
FOCUS-HIERARCHY-UX1: add reroot and subfocus UX
```

The full `507d54f → 042ffef` diff changes only:

```text
apps/web/src/App.css
```

with 5 additions / 5 deletions for Source & Diagnostics text/border/color tokens.

It does not touch:

```text
Soft layout
Nested packing
React Flow graph geometry
Modular lifecycle
Focus navigation
workers/cache
folder guides
subfocus
```

Therefore:

```text
do not revert 042ffef
do not treat that CSS commit as the regression source
```

If the founder remembers it working before, the likely explanation is that the failing real-vault geometry/state was not exercised previously.

Record this conclusion in the final report.

---

## Repository / PR state

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

At prompt-writing time:

```text
PR #106
branch: codex/hier4b-spacing-slider
head: 042ffef35ac80d308706358a86e3a752d60aa3a8
base: 7a808f9b4109b6811df5d36405173ec2b90de3bf
state: OPEN / UNMERGED
```

Before editing:

1. read current `AGENTS.md`;
2. fetch current refs;
3. verify PR #106 head/state;
4. integrate newer `main` if required by repo workflow;
5. preserve unrelated work;
6. update the same PR;
7. record exact starting SHAs.

The private real vault is **not assumed accessible to Codex**. Reproduce with synthetic fixtures and leave native vault QA to the founder.

---

# Part A — Understand the Nested failure precisely

The current error:

```text
containment=0
splits=2
blockers=0
```

means:

```text
logical ancestry/membership is correct;
no unrelated blocker is swallowed;
two retained nested folders are geometrically disconnected
according to the shared folder-island oracle.
```

This is a geometry failure, not a folder-tree bug.

Current Nested packing is deepest-first and packs rigid units using envelopes/AABB-style grid placement. That can still fail because a child subtree may have a large sparse envelope:

```text
child AABB is close to sibling/direct AABB
BUT
actual occupied module rectangles are still too far apart
```

The validator then sees multiple islands.

Treat this as a hypothesis to reproduce, not as proven until tests confirm it.

---

# Part B — Add a synthetic `splits>0, blockers=0` regression

Create a synthetic fixture where:

```text
Parent/
├─ Direct.md
└─ Child/
   ├─ C1.md
   ├─ C2.md
   └─ C3.md
```

The Child subtree should be internally valid but sparse/asymmetric enough that the old envelope/grid pack can leave the Parent split.

Hard pre-fix reproduction target:

```text
containment = 0
blockers = 0
splits > 0
```

Also add a deeper variant:

```text
GrandParent/
├─ SiblingSubtree/
└─ Parent/
   ├─ Direct
   └─ SparseChildSubtree
```

Do not weaken validation to make these pass.

---

# Part C — Parent packing must guarantee the same oracle used by rendering

For every retained parent folder, the structural pack must finish with:

```text
partitionFocusSchematicSoftFolderGuideIslands(
  actual logical member rectangles,
  blockers
).length === 1
```

The structural stage should guarantee this *during packing*, not discover it only in the final validator.

Current envelope geometry may remain useful for coarse bounds, but acceptance must use actual occupied module rectangles / the shared folder-guide geometry.

---

## Deterministic repair strategy

Implementation freedom remains with Codex, but a suitable pattern is:

```text
initial preferred/grid placement
↓
run shared island oracle
↓
if islandCount > 1:
  identify disconnected rigid unit groups
  move the nearest non-anchored unit/subtree toward the connected component
  search bounded deterministic offsets
  accept only candidates that:
    - reduce island count / occupied gap
    - do not overlap modules
    - do not swallow unrelated blockers
    - preserve already-packed child subtree geometry
```

No randomness.

Child subtree geometry is rigid at parent level.

Focus remains fixed and folder-neutral.

---

# Part D — Validate every pipeline stage

Current broad sequence:

```text
Soft relax
→ immediate-folder cohesion
→ Nested packing
→ group/radial-safety packing
→ final validation
```

Measure Nested quality at least at:

```text
postCohesion
postNested
postGroup
```

Report for each:

```text
containment violations
split violations
blocker violations
```

The final report must identify which stage originally left/introduced the split.

Add regression:

```text
postNested splits = 0
→ postGroup splits must remain 0
```

If group packing breaks a nested subtree, fix ownership rather than disabling validation.

---

# Part E — Spacing must remain hierarchy-safe

Re-run all supported integer slider values:

```text
0..100
```

For the new sparse Nested fixtures.

At every value:

```text
module overlap = 0
containment violation = 0
split violation = 0
blocker violation = 0
```

No post-slider packing or discontinuous correction.

Keep current smooth spacing architecture.

---

# Part F — Existing File-reroot fix must remain

UX1 already fixed one blank-screen mechanism.

Previously:

```text
Focus A → File B
old graph intersected with B projection
→ empty temporary graph when A/B shared no IDs
```

Current code intentionally keeps the complete old validated graph while:

```text
adopted.key !== incoming layoutKey
```

Do not remove this.

---

# Part G — Audit generation consistency during reroot

Retaining only the old `RendererGraph` is not enough if other derived layers combine:

```text
OLD adopted graph
+
NEW model/tree/root/projection
```

Audit all presentation derivation while:

```text
lifecycle.adopted.key !== layoutKey
```

Especially:

```text
softFolderGuides
folder hit testing
folder context-menu membership
viewport overlay
root-dependent presentation
subfocus presentation
any lookup that combines displayedGraph.nodes with current model/tree
```

No old/new generation mixing is allowed.

---

## Suspected concrete seam to verify

Current code retains an old displayed graph during reroot, but `softFolderGuides` is still derived eagerly from approximately:

```text
NEW softFolderDisplayTree
OLD displayedGraph.nodes
NEW model.rootModuleId
```

even though the overlay itself later checks the layout key.

That `useMemo` can still execute and throw before the overlay is suppressed.

Investigate this specifically.

If confirmed, this likely explains why real-vault reroot can still blank even after UX1's old-graph retention fix.

Do not assume it is the cause without reproduction.

---

# Part H — Preserve a coherent last-valid presentation

When showing a retained previous graph, all geometry-dependent presentation must belong to that same adopted generation.

Choose a clean architecture:

### Option A — adopted presentation snapshot

Store enough adopted presentation context with the graph to safely retain:

```text
old folder guides
old root/grouping metadata
other geometry-derived overlays
```

### Option B — defer generation-dependent overlays

While:

```text
adopted.key !== incoming layoutKey
```

show the old graph but do not recompute overlays/context from new semantic state.

Option A is preferable if clean; Option B is acceptable if it prevents generation mixing.

Never recompute old geometry with new tree/model data.

---

# Part I — Failed replacement behavior

Scenario:

```text
Focus A has valid Modular graph
→ reroot to File B
→ B's Nested layout fails validation
```

Required:

```text
A's last validated Modular presentation remains visible
explicit warning explains replacement failure
NO blank screen
NO null ErrorBoundary canvas
NO session-wide Classic fallback
```

because a prior valid Modular result exists.

`onFatalFailure(...)` should be reserved for:

```text
no valid Modular result exists for this mounted workspace/session
```

---

## First-result failure remains different

Scenario:

```text
open Focus / no previous adopted Modular graph
→ first layout fails
```

Current behavior is acceptable:

```text
explicit error
Classic Focus Hierarchy for session
Modular preference retained
Retry available
```

Keep this distinction.

---

# Part J — ErrorBoundary safety

Audit `ModularStructuredErrorBoundary`.

Expected recoverable replacement failures must not bubble into:

```text
render() => null
```

and blank the component.

Expected validation/generation mismatches should use explicit lifecycle state.

Unexpected render bugs can still use the boundary.

---

# Part K — Reroot failure tests

Add:

## RF1 — successful reroot

```text
A valid → B valid → B adopted
```

## RF2 — worker failure with prior adopted

```text
A valid → B fails
→ A remains visible
→ warning
→ no Classic fallback
→ no blank
```

## RF3 — Nested validation failure with prior adopted

Inject/reuse the sparse split failure.

Same last-valid behavior.

## RF4 — first-result failure

```text
no adopted graph → fail → explicit Classic fallback
```

## RF5 — generation consistency

While B is pending:

```text
no folder-guide or overlay computation combines A graph with B tree/model
```

## RF6 — Back after failed reroot

At minimum:

```text
Ctrl+Z / Back returns semantic state to A
A remains valid
```

Do not invent a new transactional navigation architecture unless required.

---

# Part L — Do not touch working UX1 features

Founder reports Heading subfocus works in Synthetic Sample.

Do not redesign:

```text
Heading/Block subfocus
primary/context/dim tiers
Ctrl+Z subfocus history
horizontal Folder | Parent label
```

Only touch these paths if required to eliminate generation mixing, and preserve all existing tests.

Also preserve commit `042ffef` Source & Diagnostics color polish.

---

# Part M — Safe diagnostics for native QA

Improve Nested failure evidence without private vault data.

Useful aggregate fields:

```text
splitFolderCount
maxRegionCount
retainedFolderDepth
memberCount(s)
closest inter-island gap
stage where split first appears
```

Do not commit:

```text
absolute paths
real folder names
real File names
Markdown content
```

Opaque stable synthetic IDs are fine.

---

# Version ownership

Nested structural packing changes require:

```text
Soft structural algorithm/cache version bump
```

if geometry changes.

Current expected branch versions are approximately:

```text
Soft algorithm v11
worker protocol v13
evidence schema v8
Directional unchanged
```

Inspect actual constants.

Bump worker/evidence schema only if serialized contracts change.

The web reroot lifecycle fix itself should not require Soft versioning.

Do not bump Directional.

---

# Performance / tradeoffs

Re-run current Soft benchmark.

Report:

```text
layout runtime delta
bounds-area delta
connected-pair distance delta
hop-radius delta
exact crossing delta
nested packing movement P95/max
```

Pay special attention to:

```text
SC21
SC29
new sparse Nested fixtures
```

Stop and report if the hard one-island guarantee creates pathological bounds growth.

---

# Likely files

Inspect actual branch first.

Probable:

```text
packages/focus-schematic-layout/src/soft-nested-hierarchy-packing.ts
packages/focus-schematic-layout/src/soft-nested-hierarchy-packing.test.ts
packages/focus-schematic-layout/src/soft-folder-guide-geometry.ts
packages/focus-schematic-layout/src/soft-cluster-fixtures.ts
packages/focus-schematic-layout/src/soft-clusters.ts
packages/focus-schematic-layout/src/soft-clusters.test.ts
packages/focus-schematic-layout/src/soft-group-packing.ts
packages/focus-schematic-layout/src/soft-group-packing.test.ts
packages/focus-schematic-layout/src/types.ts

apps/web/src/components/ModularStructuredGraphView.tsx
apps/web/src/components/hierarchy-availability.test.tsx

packages/renderer-reactflow/src/focus-schematic/folder-cluster-guides.tsx
only if a renderer seam is needed for generation-safe retention

tools/focus-schematic-bakeoff/src/soft-cluster-benchmark.ts
tools/focus-schematic-bakeoff/src/soft-cluster-lab.ts

docs/HIER4B_SOFT_FOLDER_CLUSTERS.md
docs/HIER4B_VALIDATION.md
apps/web/src/components/README.md
docs/ROADMAP.md
history-implementations/
```

---

# Validation

Follow current `AGENTS.md`.

Expected equivalents:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/focus-schematic-layout
pnpm exec vitest run packages/renderer-reactflow
pnpm exec vitest run apps/web/src/components

pnpm benchmark:focus-schematic-soft-clusters

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

---

# Native artifact

Build:

```text
hier4b-fix6-nested-split-reroot-failure-native-candidate.exe
```

Report SHA-256.

Update PR #106.

Run CI.

Do not merge.

---

# Native founder QA request

Ask founder to test:

## Real-vault File reroot

From a valid Modular Focus:

```text
double-click several Files
```

Expected:

```text
no blank canvas
old graph stays visible while replacement computes
successful replacement adopts normally
failed replacement keeps last-valid Modular graph + warning
```

## Nested mode

Revisit the view that previously produced:

```text
containment=0, splits=2, blockers=0
```

Expected:

```text
no Nested validation failure
one coherent retained region per nested folder
```

## Direct mode

Smoke-test unchanged.

## Heading/Block subfocus

Smoke-test only; do not retune.

---

# Prompt archive

Archive this exact prompt as:

```text
history-implementations/HIER4B_FIX6_nested_split_reroot_failure_hardening_codex_prompt.md
```

Record SHA-256.

---

# Hard exit gates

1. PR #106 continued;
2. latest main integrated if needed;
3. CSS-only commit `042ffef` preserved;
4. `042ffef` documented as non-causal;
5. synthetic `containment=0/blockers=0/splits>0` fixture reproduced pre-fix;
6. exact split mechanism identified;
7. parent packing uses actual occupied geometry/shared island oracle for acceptance;
8. every retained parent exits Nested packing with one island;
9. child subtrees remain rigid;
10. Focus-neutral semantics unchanged;
11. no module overlap;
12. no blocker swallowing;
13. postNested split count zero;
14. postGroup split count zero;
15. spacing 0..100 keeps zero Nested split violations;
16. no post-slider repacking;
17. successful File reroot unchanged;
18. last-valid graph remains visible while replacement pending;
19. no old-graph/new-tree presentation mixing;
20. `softFolderGuides` generation mismatch specifically audited;
21. failed replacement with previous adopted graph never blanks;
22. failed replacement with previous adopted graph does not trigger session-wide Classic fallback;
23. warning/retry explicit;
24. first-result failure still falls back explicitly;
25. ErrorBoundary does not null the canvas for expected replacement failures;
26. Back after failed reroot remains coherent;
27. Heading/Block subfocus unchanged;
28. Folder | Parent label unchanged;
29. Source & Diagnostics color polish unchanged;
30. safe aggregate Nested diagnostics added;
31. no private vault names/paths committed;
32. deterministic layout passes;
33. Directional unchanged;
34. secondary influence zero;
35. topology/bounds/runtime tradeoffs reported;
36. focused tests pass;
37. benchmark hard gates pass;
38. full `pnpm check` passes;
39. desktop check/build passes;
40. `git diff --check` passes;
41. docs updated;
42. prompt archived + SHA-256;
43. optimized EXE + SHA-256;
44. PR CI green;
45. PR remains unmerged;
46. stop.

---

# Final report

Include:

## Branch / commits / PR

## Chronology

Confirm:

```text
042ffef only changed Source & Diagnostics CSS
and did not cause the layout/reroot regression
```

## Nested split root cause

Explain why the prior pack could still yield:

```text
containment=0
splits>0
blockers=0
```

## New Nested packing rule

Explain actual occupied geometry + shared oracle acceptance.

## Stage evidence

Report:

```text
postCohesion
postNested
postGroup
spacing 0..100
```

## Remaining blank-screen root cause

State whether it came from:

```text
old graph + new tree/model generation mixing
ErrorBoundary
fatal lifecycle promotion
or another exact cause
```

and the exact fix.

## Replacement failure behavior

Show:

```text
valid A
→ failing B
→ A stays visible + warning
```

and distinguish first-result failure.

## Versions

Report any version/schema bump.

## Validation

Exact pass counts / benchmark / builds.

## Native artifact

Path + SHA-256.

## Prompt archive

Path + SHA-256.

## Merge status

```text
NOT MERGED — awaiting founder graphical QA
```

Then stop.
