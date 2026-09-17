# HIER4B-SPACING-FIX2 — Fix Radial Spread Adoption, True Immediate-Parent Direct Folders, and Top-Edge Labels

**Task type:** corrective native-QA follow-up to open PR #106

## Goal

Continue the existing open PR #106 and fix three issues found in founder native graphical QA.

The current candidate is visually much better overall, but it is **not ready to merge**.

Required fixes:

1. **Soft spacing slider currently appears to do nothing in the native app.**
   - Keep the new radial-spread architecture.
   - Diagnose why the transformed geometry is not being adopted/rendered.
   - Add an end-to-end renderer integration regression, not only layout-unit tests.
   - Never silently fall back to the old unspread graph.

2. **`Direct folders only` currently uses the wrong notion of direct folder.**
   - It is operating after automatic singleton compression.
   - Many Files therefore lose their immediate named folder, disappear from a guide, or appear under `Root folder`.
   - Direct-only must instead use each File's **post-manual-intent, pre-automatic-compression immediate displayed parent**.
   - In Direct-only mode, a one-File folder must still be allowed to render, otherwise a File can again appear to have no folder.

3. **Folder label position is wrong for diagonal hulls.**
   - Current label anchoring uses the hull bounding-box `x/y`.
   - When the left side is a steep diagonal, the label can appear far left of the actual top horizontal folder edge.
   - Anchor the label at the **start of the actual upper horizontal guide segment**, then apply the existing label offset.

Do not address Folder-strength structural movement in this task. Founder explicitly noted it, but it is future work.

Do not merge before founder native graphical QA.

---

# Repository / PR state

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Continue:

```text
PR #106
branch: codex/hier4b-spacing-slider
current head at prompt-writing time:
8cb40fe0152678e1824e43cd2b10b5149d6905f1
```

PR #106 is currently:

```text
OPEN
UNMERGED
```

Current `main` at prompt-writing time:

```text
e84dee9c23031c7a91cae4012611820c13720aa0
```

That `main` was already integrated into the PR branch by FIX1.

Before editing:

1. read current `AGENTS.md`;
2. fetch current refs;
3. verify PR #106 is still open;
4. verify its current head;
5. if `main` advanced, integrate latest `main` according to repository policy;
6. preserve unrelated work;
7. update the same PR #106;
8. do not create a replacement PR unless continuation is technically impossible.

Record exact starting SHAs.

---

# Preserve accepted FIX1 behavior

Do not regress the parts founder already considers much better:

```text
Direct folders only UI exists
Nested ancestor pull supports 1/3 and 1/4
1/3 remains default
root stays visible in folder display
root stays excluded from folder force
fixed structural Soft spacing policy
radial-spread concept
Directional isolation
Adaptive Compass logic unchanged
[36,18] Soft structural schedule
secondary relationships = zero geometry influence
```

The fixes below should correct implementation seams, not undo the design.

---

# Issue A — Soft spacing slider appears inert in native UI

## Proven current implementation

PR #106 currently has a pure radial transform:

```text
packages/focus-schematic-layout/src/soft-radial-spread.ts
```

It translates:

```text
non-root module rectangles
all nodes in each module
endpoint attachments
```

around the Focus/root.

The scale mapping is currently:

```text
0   → 1.0x
50  → 1.7x
100 → 2.4x
```

Unit tests already verify:

```text
root fixed
angles invariant
module sizes invariant
internal offsets invariant
71/72/73 smooth scale
no module overlaps
```

Do not throw away this design.

---

# Suspected renderer/adoption seam

Current `ModularStructuredGraphView.tsx` does approximately:

```ts
try {
  const displayedComputed =
    applyFocusSchematicSoftRadialSpread(
      lifecycle.adopted.computed,
      effectiveSoftSpacing,
      rootDocumentProjectionNodeId,
    );

  return prepareGraph(displayedComputed, ...);
} catch {
  return lifecycle.adopted.graph;
}
```

This is dangerous.

If radial postprocessing or `prepareFocusSchematicRendererGraph(...)` throws or rejects the transformed computed layout, the native app silently shows the original unspread adopted graph.

That produces exactly this user-visible symptom:

```text
slider value changes
but graph appears completely unchanged
```

Do not assume this is the exact cause until reproduced, but investigate this path first.

---

# A1 — Reproduce the actual failed native integration in tests

Add a regression that executes the real presentation path:

```text
valid structural Soft computed layout
→ applyFocusSchematicSoftRadialSpread(...)
→ prepareFocusSchematicRendererGraph(...)
→ resulting RendererGraph node positions
```

Test at least:

```text
0
50
100
```

Assertions:

```text
root renderer node unchanged
non-root renderer module/entity positions differ at 0 vs 50 vs 100
radius increases monotonically
renderer graph remains valid
edges/handles remain valid
```

This test must fail on the current buggy branch if the integration seam is truly broken.

Do not accept only:

```text
applyFocusSchematicSoftRadialSpread unit tests
```

as evidence.

---

# A2 — Find and report the exact exception/failure

Before patching, determine whether the current transformed layout fails because of:

```text
validateFocusSchematicComputedLayout(...)
stale quality evidence
stale folder-band quality
stale route/attachment assumptions
renderer graph validation
diagnostic placement
another prepared-graph invariant
or another integration issue
```

Do not guess.

Capture the exact error in a focused test/dev run.

Final report must say:

```text
native slider was inert because <specific validated cause>
```

If the existing silent `catch` hid it, state that explicitly.

---

# A3 — No silent fallback for radial postprocessing

Do not leave:

```ts
catch {
  return lifecycle.adopted.graph;
}
```

around the radial presentation path.

Use the repository's explicit warning/last-valid policy.

Acceptable behavior:

```text
radial presentation failure
→ last valid graph remains visible
→ explicit warning / development diagnostic records cause
```

Not acceptable:

```text
radial presentation failure
→ silently pretend slider applied
```

Founder must be able to distinguish:

```text
slider works
vs
postprocess rejected
```

without opening dev tools.

Keep user-facing wording concise.

---

# A4 — Recompute only post-transform derived geometry that must be truthful

The post-layout transform must still avoid rerunning structural solving.

But if the renderer/validator requires geometry-derived fields to match final transformed coordinates, recompute only those derived fields.

Potential examples after inspection:

```text
attachments
geometry-derived quality metrics
final crossing measurements
renderer diagnostic placement inputs
routes if any presentation path consumes coordinates
folder-guide inputs downstream
```

Do NOT rerun:

```text
Adaptive Compass assignment/search
Heading-order optimization
folder-force relaxation
collision packing
initial seeding
module internal layout
```

The structural result remains authoritative.

---

# A5 — GraphCanvas adoption regression

The integration test should extend through the prepared-graph seam far enough to prove React Flow receives changed positions.

At minimum verify:

```text
GraphCanvas `preparedGraph` changes when only Soft spacing changes
while structural layout/cache key remains unchanged
```

If practical, mock/spy the prepared graph entering `GraphCanvas`.

Required oracle:

```text
structural worker compute count = unchanged
prepared RendererGraph coordinates = changed
```

for spread-only slider changes.

---

# A6 — Structural cache remains spread-independent

Do not fix native adoption by putting `softSpacing` back into structural cache identity.

Required:

```text
Soft structural key(spread=0)
=
Soft structural key(spread=50)
=
Soft structural key(spread=100)
```

given all structural inputs equal.

Presentation output should still differ.

This distinction is the point of FIX1.

---

# Issue B — Direct folders only currently loses immediate folder identity

## Current cause to inspect

The current shared display-tree pipeline is approximately:

```text
exact canonical folders
→ File parent override / promotion
→ manual folder flattening
→ automatic singleton compression
→ final displayed tree
```

Current Direct-only guide rendering then uses:

```text
final tree.folder.directFileIds
```

and ignores child folder regions.

This means Direct-only is using membership **after automatic singleton compression**, not the immediate displayed parent founder intended.

Also, one-unit folder regions are still generally suppressed.

Together these can cause:

```text
File appears to have no folder guide
File gets visually lifted to ancestor
File gets visually lifted all the way to "."
"Root folder" appears even though File's meaningful immediate folder is named
```

---

# Required Direct-only semantic

For Direct-only mode define the File's grouping folder as:

```text
the immediate displayed parent AFTER:
- exact folder identity
- manual File promotion
- manual folder flattening

but BEFORE:
- automatic singleton compression
```

This is the core invariant.

Call it something clear, e.g.:

```text
preCompressionDisplayParentFolderKey
```

or:

```text
directDisplayParentFolderKey
```

Exact name is Codex's choice.

Do not reuse `manualDisplayParentFolderKey` blindly: it is currently captured before manual folder flattening, so it is too early for this purpose.

---

# B1 — Preserve an explicit pre-auto-compression parent

In the pure display-tree builder:

```text
build initial tree
apply File promotion
apply manual folder flattening
↓
CAPTURE direct parent identity here
↓
automatic singleton compression
```

For each File preserve the captured parent through final tree output.

This should be pure derived data.

Do not persist it separately.

Do not mutate canonical source folder identity.

---

# B2 — Direct-only force uses this parent

When:

```text
Direct folders only = ON
```

each non-root File should get at most one force scope:

```text
preCompressionDisplayParentFolderKey
```

not:

```text
post-compression displayParentFolderKey
```

Example:

```text
Folder2/File1.md
Folder2/Folder1/File2.md
```

Direct-only should produce:

```text
File1 → Folder2
File2 → Folder1
```

They are distinct flat groups.

The fact that `Folder1` is canonically under `Folder2` does not make File2 part of Folder2 in Direct-only force.

---

# B3 — Direct-only guides use this parent

Build flat guide membership from:

```text
File → preCompressionDisplayParentFolderKey
```

Do not derive direct-only guides from:

```text
final compressed folder.directFileIds
```

Conceptually construct a direct membership map:

```text
folderKey → visible File module IDs
```

from the captured parent field.

Then folder-guide geometry uses those direct memberships.

---

# B4 — Direct-only singleton folders MUST render

This changes the old wrapper-suppression rule for this mode.

Founder expects every non-root File with a named immediate folder to visibly belong to that folder.

Therefore in Direct-only mode:

```text
one direct File in named folder
→ render a folder guide for that File
```

Do not suppress it merely because it has one visual unit.

Why:

```text
there is no nested wrapper chain in Direct-only mode
```

so the one-unit guide is not redundant hierarchy noise; it is the only visible folder identity.

Nested mode keeps the existing post-island one-unit suppression semantics.

---

# B5 — Root folder correctness

The workspace root key:

```text
"."
```

must only appear as a File's Direct-only group when that File genuinely has root as its post-manual/pre-compression parent.

It must NEVER appear because automatic singleton compression lifted a File there.

Add explicit regression:

```text
exact/manual parent = "A/B"
automatic compression would later lift it to "."
Direct-only parent must still be "A/B"
```

If a non-focus File genuinely lives directly at workspace root after manual intent:

```text
do not fabricate a named folder
```

Keep semantic truth.

The goal is:

```text
no fake Root folder caused by auto-compression
```

not:

```text
invent a folder for genuine root-level Files
```

---

# B6 — Focus/root File behavior

Keep accepted current behavior:

```text
Focus/root File can remain visually represented in its truthful folder
but remains excluded from Soft folder-force groups
```

Direct-only must not accidentally reintroduce root force.

---

# B7 — Direct-only + manual promotion

Example:

```text
File exact: A/B/C/File.md
manual File promotion: display parent A/B
```

Then:

```text
Direct-only parent = A/B
```

even if singleton compression would later lift it further.

---

# B8 — Direct-only + manual folder flatten

Example:

```text
A/B/
  File1
  File2

manual flatten B
```

After manual flatten:

```text
File1 parent = A
File2 parent = A
```

Therefore Direct-only group is:

```text
A
```

The captured direct parent must happen after manual flatten, not before.

---

# B9 — Nested mode remains unchanged

The existing final displayed tree including automatic singleton compression remains the owner for nested guide presentation.

Switching:

```text
Nested
→ Direct-only
→ Nested
```

must not change:

```text
persisted intent
automatic compression result
promotion/flatten state
canonical folders
```

Only the selected force/guide projection changes.

---

# Required Direct-only tests

## D1 — nested singleton chain

```text
A/B/C/File.md
```

No manual intent.

Assert:

```text
preCompressionDirectParent = A/B/C
```

even if nested display compression eventually lifts File visually.

Direct-only guide label/group:

```text
C
```

not:

```text
Root folder
```

## D2 — siblings with different immediate parents

```text
Folder2/File1.md
Folder2/Folder1/File2.md
```

Assert:

```text
File1 group = Folder2
File2 group = Folder1
```

and both flat guides render.

## D3 — singleton guide

One visible File in:

```text
NamedFolder/File.md
```

Direct-only:

```text
NamedFolder guide renders
```

Nested mode may still compress/suppress according to old rules.

## D4 — manual File promotion

Verify captured direct parent after promotion.

## D5 — manual folder flatten

Verify capture occurs after flatten.

## D6 — genuine root File

A non-root Focus-neighbor File whose true/manual parent is `.` remains truthful.

Do not invent a folder.

## D7 — root-neutral force

Focus/root File remains excluded from direct-only force groups.

---

# Issue C — Folder labels should anchor to actual top horizontal edge

## Current implementation

Current folder-guide geometry derives:

```text
x = min hull x
y = min hull y
```

and sets:

```ts
labelX = x + 12
labelY = y - 9
```

This is bounding-box based.

For a hull whose lower-left point extends far left while the upper edge starts farther right, the label is visually detached.

Example:

```text
            LABEL SHOULD BE HERE
                  ↓
              ───────────────
             /
            /
           /
──────────
```

Current label is effectively anchored near:

```text
boundingBoxLeft
```

instead of:

```text
top horizontal edge start
```

---

# Required label rule

For non-singleton hull/capsule guides:

1. identify the **uppermost horizontal boundary segment** of the actual guide polygon;
2. choose the left/start point of that segment;
3. account for rounded-corner trimming so the anchor corresponds to the visible straight top segment, not a hidden/raw convex-hull vertex;
4. then apply the current label offset relative to that point.

Conceptually:

```text
labelX = topHorizontalVisibleStart.x + existingHorizontalPadding
labelY = topHorizontalSegment.y - existingVerticalOffset
```

Keep approximately:

```text
+12 x
-9 y
```

unless current styling constants differ.

---

# Rounded polygon detail

Current guide path rounds hull vertices.

The visible top horizontal line typically starts after the rounded top-left corner, not exactly at the raw hull vertex.

Prefer a helper that derives the visible straight segment from the same rounded geometry used to draw the path.

Do not create label math disconnected from path math.

Possible design:

```ts
interface RoundedPolygonGeometry {
  path
  hitPoints
  straightSegments
}
```

or a smaller helper:

```ts
topHorizontalSegment(points, radius)
```

Use the simplest clean seam.

---

# Fallbacks

For shapes with no valid horizontal top segment due to degenerate geometry:

```text
fallback deterministically to existing x/y anchor
```

Do not throw.

For singleton rounded rectangles:

```text
existing top-left/rectangle-based label behavior is acceptable
```

unless current rendered label demonstrates the same problem.

---

# Label tests

## L1 — steep lower-left diagonal

Construct hull with:

```text
minX much farther left than top horizontal edge start
```

Assert:

```text
labelX follows top horizontal segment start
not bounding-box minX
```

## L2 — ordinary rectangle

Assert label remains effectively at current expected top-left location.

## L3 — rounded top edge

Assert label anchor accounts for corner rounding consistently.

## L4 — deterministic hull order

Permuting input units must not move the chosen label anchor.

## L5 — multiple islands

Each repeated-region label uses its own actual top horizontal segment.

Primary HTML label and repeated SVG labels should use consistent geometry.

---

# Do not fix Folder-strength movement here

Founder noted:

```text
Folder strength still causes large movements with many blocks
```

This may be legitimate force-equilibrium behavior or may deserve later stabilization work.

Do not change it in FIX2.

Add a short roadmap/note if needed:

```text
Future: evaluate Folder-strength continuity on dense graphs
```

Do not let that expand this PR.

---

# Radial spread UI behavior after fix

Keep:

```text
0   = 1.0x
50  = 1.7x
100 = 2.4x
```

unless the native-integration bug reveals a reason this mapping is unusable.

Founder said the overall look is much better; do not retune scale until the slider actually renders correctly.

After integration fix, QA should verify:

```text
0 → obvious base geometry
50 → clearly farther out
100 → strongly farther out
71 → 73 → small smooth change
```

---

# Native spread instrumentation

For the QA candidate, add a small development-only evidence seam if useful:

```text
Soft radial scale: 1.700
base root→module radius
display root→module radius
```

Do not clutter normal product UI.

The key requirement is that tests and logs can prove:

```text
preparer received transformed coordinates
GraphCanvas received transformed coordinates
```

---

# Cache / worker requirements

Preserve:

```text
softSpacing absent from structural worker request
softSpacing absent from structural cache identity
```

Direct-only and ancestor decay remain structural and stay in cache/worker semantics as implemented in FIX1.

The new pre-compression direct-parent field is derived from existing display intent and visible files; do not persist geometry.

Bump Soft algorithm/evidence/protocol versions only if serialized structural contracts actually change.

Do not bump Directional algorithm.

---

# Privacy

Do not commit real vault:

```text
paths
folder names
screenshots
Markdown
```

Use synthetic folder examples in tests.

Founder-native findings may be summarized generically in validation docs.

---

# Likely files

Inspect current branch first.

Probable areas:

```text
packages/focus-schematic-layout/src/soft-folder-display.ts
packages/focus-schematic-layout/src/soft-folder-display.test.ts
packages/focus-schematic-layout/src/types.ts
packages/focus-schematic-layout/src/soft-clusters.ts
packages/focus-schematic-layout/src/soft-clusters.test.ts
packages/focus-schematic-layout/src/soft-radial-spread.ts
packages/focus-schematic-layout/src/soft-radial-spread.test.ts
packages/focus-schematic-layout/src/endpoint-facing.ts

packages/renderer-reactflow/src/focus-schematic/folder-cluster-guides.tsx
packages/renderer-reactflow/src/focus-schematic/folder-cluster-guides.test.ts
packages/renderer-reactflow/src/focus-schematic/index.ts
packages/renderer-reactflow/src/... focused prepared-graph tests

apps/web/src/components/ModularStructuredGraphView.tsx
apps/web/src/components/GraphSettings.modular.test.tsx
apps/web/src/focus-schematic-layout-cache.test.ts

docs/HIER4B_SOFT_FOLDER_CLUSTERS.md
docs/HIER4B_VALIDATION.md
docs/ROADMAP.md
history-implementations/
```

Do not force every file to change.

---

# Validation

Follow current `AGENTS.md`.

Expected repository-current equivalents:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/focus-schematic-layout
pnpm exec vitest run packages/renderer-reactflow

pnpm exec vitest run apps/web/src/components
pnpm exec vitest run apps/web/src/focus-schematic-layout-cache.test.ts

pnpm benchmark:focus-schematic-soft-clusters

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Run narrow tests during implementation.

No new dependency unless clearly justified.

---

# Native graphical QA artifact

Build a new optimized Windows executable.

Suggested name:

```text
hier4b-spacing-fix2-native-candidate.exe
```

Report SHA-256.

Update PR #106.

Run CI.

Do not merge.

---

# Native QA request

Ask founder to test:

## Soft spacing

```text
0
25
50
71
73
75
100
```

Confirm:
- slider visibly moves modules;
- 0/50/100 are clearly different;
- 71→73 is only a small smooth radial shift.

## Direct-only

Use Files known to be in nested folders.

Confirm:
- every named immediate parent remains visible as that File's folder;
- singleton named folders still get a guide;
- `Root folder` no longer appears because compression lifted a File;
- two Files in parent and child folders remain two flat groups.

## Labels

Inspect diagonal/hull folder shapes.

Confirm:
- label sits just after the start of the top horizontal line;
- label no longer floats far left because of a lower diagonal corner.

---

# PR workflow

Continue PR #106:

```text
implement FIX2
→ focused tests
→ full validation
→ optimized EXE
→ push same PR
→ CI
→ STOP for founder native QA
```

Do not merge before explicit approval.

---

# Prompt archive

Archive this exact prompt as:

```text
history-implementations/HIER4B_SPACING_FIX2_spread_adoption_direct_parent_labels_codex_prompt.md
```

Record SHA-256.

---

# Hard exit gates before founder QA

1. PR #106 remains the active PR;
2. latest `main` integrated if needed;
3. exact native radial-adoption failure cause identified;
4. radial transform itself preserved;
5. radial transform passes through real renderer preparation successfully;
6. no silent fallback to unspread graph;
7. explicit failure/warning path exists if postprocess fails;
8. GraphCanvas receives changed prepared positions for spread changes;
9. structural worker compute count does not increase for spread-only changes;
10. structural cache key remains spread-independent;
11. 0/50/100 RendererGraph positions demonstrably differ;
12. 71/72/73 remains structurally invariant;
13. pre-auto-compression direct parent is explicitly represented;
14. capture happens after manual File promotion;
15. capture happens after manual folder flatten;
16. capture happens before automatic singleton compression;
17. Direct-only force uses this captured parent;
18. Direct-only guides use this captured parent;
19. Direct-only singleton named folders render;
20. nested singleton-compression behavior remains unchanged;
21. no false `Root folder` caused by auto-compression;
22. genuine root-level membership remains truthful;
23. File1 in parent vs File2 in child folder yields two flat groups;
24. root-neutral force remains exact;
25. mode switching does not mutate persisted intent;
26. flat guide context target remains correct;
27. label no longer uses bounding-box minX for diagonal hulls;
28. label uses actual top horizontal visible segment;
29. rounded-corner geometry is accounted for;
30. rectangle/singleton behavior remains sane;
31. repeated island labels use their own region geometry;
32. Folder-strength behavior is not changed;
33. Directional output remains unchanged;
34. Adaptive logic remains unchanged;
35. [36,18] structural schedule remains unchanged;
36. focused layout tests pass;
37. renderer tests pass;
38. web integration tests pass;
39. benchmark hard gates pass;
40. full `pnpm check` passes;
41. desktop check/build passes;
42. `git diff --check` passes;
43. docs updated;
44. prompt archived + SHA-256;
45. optimized EXE produced + SHA-256;
46. PR #106 CI green;
47. PR remains unmerged;
48. stop.

---

# Final report before founder QA

## Branch / commits / PR #106

## Main synchronization

## Radial spread failure cause

State the exact swallowed/renderer/adoption cause.

## Radial integration fix

Show:

```text
structural compute reuse
RendererGraph positions 0 vs 50 vs 100
71 vs 73 continuity
```

## Direct-parent model

Explain the new:

```text
post-manual / pre-auto-compression parent
```

and why `manualDisplayParentFolderKey` alone was insufficient.

## Direct-only examples

Report synthetic cases:

```text
Folder2/File1
Folder2/Folder1/File2
singleton named folder
manual promotion
manual flatten
genuine root
```

## Label anchoring

Explain the top-horizontal-visible-segment algorithm and fallback.

## Versions

Report any actual Soft/evidence/protocol version changes with rationale.

## Directional / Adaptive isolation

## Tests / benchmark / builds

Exact pass counts.

## Native artifact

Path + SHA-256.

## Prompt archive

Path + SHA-256.

## Merge status

```text
NOT MERGED — awaiting founder graphical QA
```

Then stop.
