# HIERDISC1-FIX2 — Hidden-Heading Geometry Regression: Preserve Nested Soft Invariants Through Group Packing

**Task type:** corrective continuation of PR #127 / real-vault Modular Soft layout regression after selective Heading Hide

## Goal

Continue PR #127 after founder native QA.

The **Focus Explorer UI changes are accepted**:

```text
Files | Headings
selective Heading Hide/Restore
pending disclosure-control visual fix
Maximize/Restore follow-up
```

Do not redesign those.

The remaining blocker is a Modular Soft layout failure on the real vault after the HIERDISC1/FIX1 workflow changes module contents:

```text
Nested Soft hierarchy validation failed:
containment=0, splits=1, blockers=1.
Classic Focus Hierarchy is active for this session.
The Modular Preview preference was retained.
```

Fix the structural layout so selective Heading visibility can safely change File-module dimensions without invalidating Nested Soft folder guarantees.

Do not merge until founder native QA.

---

# Repository / PR state

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Continue:

```text
PR #127
branch: codex/focus-outline-heading-visibility
current head at prompt-writing time:
25d8101a19849b7242fe678a36c5153f4b2350ba
base:
cfb4f715ce2d8df6ba083c21ce1d856f22f40ea2
```

PR #127 is:

```text
OPEN
UNMERGED
MERGEABLE
```

Before editing:

1. read current `AGENTS.md`;
2. fetch refs;
3. verify PR #127 head/state;
4. integrate newer `main` if needed by repository workflow;
5. preserve unrelated work;
6. update the same PR;
7. record exact starting SHAs.

---

# External/private-vault boundary

The failing vault is private and is **not assumed available to Codex**.

Do not require private files, paths, screenshots, or Markdown.

Build a synthetic reproduction from the geometry class exposed by HIERDISC1:

```text
same File/folder topology
+
Heading Hide changes visible structural content
→ File module dimensions shrink/change
→ Nested Soft layout must still remain valid
```

Founder performs final real-vault QA.

---

# Preserve accepted HIERDISC1-FIX1 work

Do not regress or redesign:

```text
Focus Explorer
Files | Headings tabs
File folder grouping in Files tab
File select/center
safe File reroot
Heading visibility model
Show all
Current View schema v4
Saved View migration
Search/Inspector reveal
Heading/Block subfocus
Ctrl+Z history
pending disclosure buttons no longer showing translucent square
Maximize/Restore in Focus Hierarchy
```

The founder explicitly reports the new UI changes are good.

This task is structural layout hardening.

---

# Important current evidence

## Error meaning

Current final validator reports:

```text
containment=0
splits=1
blockers=1
```

Therefore:

```text
logical retained folder membership is correct
at least one retained folder is geometrically split
at least one retained folder hull contains an unrelated blocker
```

This is not a disclosure-tree membership failure.

---

# Important pipeline evidence in current code

Current Soft pipeline is approximately:

```text
Soft relax
→ immediate-folder cohesion
→ applyFocusSchematicSoftNestedHierarchyPacking(...)
→ postNested quality/metrics
→ packFocusSchematicSoftFolderGroups(...)
→ postGroup quality
→ FINAL Nested validation
```

The final error fields come from the quality measured **after group packing**.

Current evidence already contains stage-specific fields such as:

```text
postCohesion...
postNested...
postGroup...
nestedFirstSplitStage
```

Use those.

Do not assume the defect originates in post-group merely because the final error occurs there; inspect the stage evidence for the synthetic reproduction.

---

# Likely new stressor introduced by HIERDISC1

HIERDISC1 does not change folder membership when hiding a Heading.

It changes:

```text
visible Heading/Block nodes
module dimensions
exact endpoint rectangles/routes
```

A File module can shrink substantially.

The existing FIX6 corpus proved Nested safety for its fixture dimensions, but did not necessarily prove:

```text
same folder topology
across large dynamic module-size changes
```

That is the missing dimension of the stress corpus.

---

# PART A — Reproduce through the real product path

Do not only fabricate a final rectangle set.

Create a synthetic Markdown/projection integration case where:

```text
File A has several Headings
one or more Headings materially enlarge its module
File A participates in a Nested folder hierarchy
other Files/folders occupy nearby geometry
```

Then compare:

```text
all relevant Headings visible
vs
one Heading subtree explicitly hidden
```

The hidden version should generate meaningfully different `nodeDimensions`.

Run through:

```text
ViewProjection
→ Focus Schematic model
→ renderer dimensions
→ FocusSchematicLayoutInput
→ Soft Nested layout
```

Hard target:

```text
pre-fix hidden-Heading variant reproduces
containment=0
splits>0 and/or blockers>0
```

Prefer reproducing the exact:

```text
splits=1
blockers=1
```

class if possible.

---

# PART B — Add dimension-mutation layout fixtures

In addition to the product-path integration fixture, add direct layout fixtures that exercise the same topology with multiple dimension profiles:

```text
large modules
medium modules
small/shrunk modules
asymmetric module shrink
root module shrink
non-root module shrink
```

For a fixed folder tree, all supported size profiles must satisfy the same hard Nested invariants.

This is not a one-off "Heading Hide" special case in the layout package.

The general contract is:

> Soft Nested hierarchy must remain valid for any supported finite module rectangle sizes produced by the renderer.

---

# PART C — Identify the failing stage exactly

For the reproducing fixture, report:

```text
postCohesion:
  containment
  splits
  blockers

postNested:
  containment
  splits
  blockers

postGroup:
  containment
  splits
  blockers
```

Also report:

```text
module overlap count
nestedFirstSplitStage
```

Do not patch until the actual stage is known.

---

# If postNested is already invalid

Then `applyFocusSchematicSoftNestedHierarchyPacking(...)` is not robust to the shrunk/asymmetric geometry.

Fix Nested packing itself.

Requirements remain:

```text
every retained parent = one guide island
no blocker swallowed
no module overlap
child subtrees remain rigid at parent level
Focus remains folder-neutral/fixed
```

Use actual occupied rectangles/shared guide oracle, not only envelopes.

---

# If postNested is valid but postGroup becomes invalid

Then `packFocusSchematicSoftFolderGroups(...)` is violating a Nested invariant.

This case deserves a structural fix, not another repair after group packing.

## Preferred invariant

For Nested mode:

```text
every retained top-level subtree must be a rigid compound body
```

Group packing may translate that entire body only.

For any two modules A/B that belong to the same top-level retained subtree:

```text
(postGroup(A) - postNested(A))
==
(postGroup(B) - postNested(B))
```

within floating tolerance.

Therefore all internal Nested relations are translation-invariant.

Add this as a hard test/oracle.

---

# Verify compound-body partition

Audit `createFocusSchematicSoftCompoundBodies(...)` in Nested mode.

Prove:

```text
every non-Focus groupable module belongs to exactly one structural body
every retained top-level subtree is represented by exactly one body
no descendant File leaks into another body
no ordinary descendant becomes `ungrouped-module`
```

Explicit exceptions:

```text
Focus anchor
workspace-root Files according to current policy
filtered/ungrouped modules according to existing truthful semantics
```

If one of those exception bodies can geometrically invalidate a nested folder after group packing, handle it explicitly.

---

# Do NOT solve postGroup invalidity with a blind second Nested pack

Avoid:

```text
Nested pack
→ group pack
→ Nested pack again
```

because the second Nested pack can invalidate:

```text
continuous radial-spread safety
compound group separation
spacing smoothness
```

Fix the ownership/invariance of group packing instead.

A post-group validation remains useful, but should not be the normal repair stage.

---

# PART D — Blocker guarantee must survive group packing

FIX6 guaranteed:

```text
no unrelated blocker inside retained nested guide hull
```

The new size-mutated fixtures must prove this at postNested **and** postGroup.

If the blocker is:

```text
Focus
workspace-root File
filtered bridge/module
another top-level subtree
same top-level subtree but outside the nested folder
```

record the category in development evidence/tests.

Do not print private real-vault names.

---

# PART E — Split guarantee must survive group packing

Likewise:

```text
postNested islandCount = 1
→ postGroup islandCount = 1
```

for every retained folder.

Add a pure invariant test over group-packing translation:

```text
shared oracle results are unchanged for folders whose members + same-body blockers
undergo identical translation
```

Then test cross-body blockers separately.

---

# PART F — Hidden Heading changes module size, not folder semantics

Keep this separation explicit.

Do NOT:

```text
rebuild folder tree differently because Heading hidden
drop Files from folders
disable Nested mode while Headings are hidden
fallback to Direct automatically
relax hard validation
```

The correct result is:

```text
same File/folder semantics
new module rectangles
valid new Nested geometry
```

---

# PART G — Integration with HIERDISC1 Hide/Restore

Add a web/integration regression:

```text
Modular Soft Nested ready
→ Hide geometry-significant Heading
→ new layout input/key
→ worker succeeds
→ new Modular graph adopted
→ zero containment/split/blocker violations
```

Then:

```text
Restore Heading
→ previous-size topology returns
→ valid layout/cache hit or compute
→ zero violations
```

Rapid:

```text
Hide → Restore → Hide
```

latest-wins.

No Classic fallback.

No blank.

---

# PART H — All spacing values

For the new dimension-mutation fixtures, test:

```text
Soft spacing 0..100
```

Hard at all values:

```text
module overlap = 0
Nested containment = 0 violations
Nested splits = 0
Nested blockers = 0
```

Preserve no-post-slider-repacking architecture.

---

# PART I — Strength / ancestor variants

At minimum run the dimension-mutated fixtures across:

```text
Folder strength 0 / default / 100
ancestor decay 1/3
ancestor decay 1/4
```

and:

```text
Nested
```

Direct mode gets a smoke regression but is not the failing feature.

---

# PART J — Focus-root variants

Selective Heading Hide can shrink the **Focus File module** itself.

Include:

```text
root module size changes
neighbor module size changes
both
```

Focus remains:

```text
fixed
folder-neutral
collision/blocker obstacle
```

No folder guide may start counting Focus because its dimensions changed.

---

# PART K — Filtered bridge / workspace-root variants

If the blocker category can involve modules outside the folder tree, include at least one synthetic case with:

```text
workspace-root File
or
filtered/ungrouped module
```

near a nested hierarchy.

The folder hull must not swallow it after group packing.

Do not change truthful root/filtered semantics.

---

# PART L — Improve failure message with stage evidence

If a hard Nested validation still fails, make the development/native error more actionable.

Instead of only:

```text
containment=0, splits=1, blockers=1
```

include safe aggregate stage info, e.g.:

```text
stage=post-group
postNested[splits=0 blockers=0]
postGroup[splits=1 blockers=1]
```

plus current safe evidence such as:

```text
maxRegions
closestGap
member-count range
```

Do not include:

```text
private paths
folder names
File names
Markdown
```

This will make future native QA much faster.

---

# PART M — Algorithm/versioning

If structural Soft geometry changes:

```text
bump Soft structural algorithm/cache version
```

Current merged FIX6 baseline is expected around:

```text
Soft algorithm v12
worker protocol v14
evidence schema v9
```

Inspect actual branch constants.

If adding fields to serialized worker evidence:

```text
bump protocol/evidence schema as required
```

Do not bump Directional.

HIERDISC1 persistence schema v4 is unrelated; do not change it.

---

# PART N — Performance / quality evidence

Re-run the full Soft benchmark.

Compare before/after:

```text
layout runtime
bounds area
connected-pair span
hop-radius error
exact crossings
Nested packing movement
group packing movement
```

Pay special attention to:

```text
SC29
SC30
SC31
new HIERDISC-size fixtures
largest stress fixture
```

No pathological canvas expansion.

---

# Likely files

Inspect actual branch first.

Probable:

```text
packages/focus-schematic-layout/src/soft-nested-hierarchy-packing.ts
packages/focus-schematic-layout/src/soft-nested-hierarchy-packing.test.ts
packages/focus-schematic-layout/src/soft-group-packing.ts
packages/focus-schematic-layout/src/soft-group-packing.test.ts
packages/focus-schematic-layout/src/soft-clusters.ts
packages/focus-schematic-layout/src/soft-clusters.test.ts
packages/focus-schematic-layout/src/soft-cluster-fixtures.ts
packages/focus-schematic-layout/src/types.ts
packages/focus-schematic-layout/src/soft-folder-guide-geometry.ts

packages/focus-schematic-layout/src/markdown-integration.test.ts
packages/focus-schematic/src/integration.test.ts

apps/web/src/components/ModularStructuredGraphView.tsx
apps/web/src/focus-schematic-layout-cache.test.ts
apps/web/src/components/FocusExplorer.test.tsx / related integration tests

tools/focus-schematic-bakeoff/src/soft-cluster-benchmark.ts
tools/focus-schematic-bakeoff/src/soft-cluster-lab.ts

docs/HIER4B_SOFT_FOLDER_CLUSTERS.md
docs/HIER4B_VALIDATION.md
apps/web/src/components/README.md
docs/ROADMAP.md
history-implementations/
```

Do not force every file to change.

---

# Do not change accepted UI

No redesign of:

```text
Files | Headings tab styling
Focus Explorer placement
Heading Hide/Show buttons
pending control styling
Maximize placement
```

unless a tiny integration adjustment is unavoidable.

Founder says the UI changes are good.

---

# Validation

Follow current `AGENTS.md`.

Expected equivalents:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/focus-schematic-layout
pnpm exec vitest run packages/focus-schematic
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
hierdisc1-fix2-hidden-heading-nested-soft-native-candidate.exe
```

Report SHA-256.

Update PR #127.

Run CI.

Do not merge.

---

# Native founder QA

Ask founder to use the same real-vault case that currently throws:

```text
containment=0, splits=1, blockers=1
```

Then test:

```text
1. Open Focus + Hierarchy + Modular Soft Nested.
2. Open Focus Explorer → Headings.
3. Hide the Heading that previously triggers the failure.
4. Confirm Modular remains active.
5. Confirm folder guides remain coherent.
6. Restore the Heading.
7. Hide/Restore several times.
8. Try another Heading that changes module size strongly.
9. Switch Files ↔ Headings tabs.
10. Smoke-test File reroot and Heading subfocus.
```

Expected:

```text
no Classic fallback
no Nested validation error
no blank screen
accepted UI unchanged
```

---

# Prompt archive

Archive this exact prompt as:

```text
history-implementations/HIERDISC1_FIX2_hidden_heading_nested_soft_geometry_codex_prompt.md
```

Record SHA-256.

---

# Hard exit gates

1. same PR #127 continued;
2. latest main integrated if needed;
3. accepted Focus Explorer UI unchanged;
4. real-product-path synthetic Heading Hide geometry fixture exists;
5. module dimensions demonstrably change in fixture;
6. pre-fix Nested failure reproduced or closest equivalent justified;
7. exact failing stage identified;
8. postCohesion counts reported;
9. postNested counts reported;
10. postGroup counts reported;
11. hidden Heading does not alter File/folder semantics;
12. postNested containment=0;
13. postNested splits=0;
14. postNested blockers=0;
15. postGroup containment=0;
16. postGroup splits=0;
17. postGroup blockers=0;
18. group packing rigid-subtree invariant tested;
19. each retained top-level subtree partitions correctly into one body;
20. no descendant leaks into unintended group body;
21. no blind second Nested repair after group packing;
22. Focus remains fixed/folder-neutral;
23. workspace-root/filtered blocker case covered if relevant;
24. module overlap=0;
25. spacing 0..100 passes size-mutated fixtures;
26. strength variants pass;
27. decay 1/3 and 1/4 pass;
28. root-module shrink case passes;
29. neighbor-module shrink case passes;
30. Hide integration adopts valid Modular result;
31. Restore integration adopts valid Modular result;
32. rapid Hide/Restore latest-wins;
33. no Classic fallback in valid case;
34. FIX6 last-valid failure safety preserved;
35. Direct mode smoke passes;
36. Heading/Block subfocus preserved;
37. Current View schema v4 unchanged;
38. Saved Views unchanged;
39. safe stage-aware failure message added;
40. no private vault information committed;
41. Soft algorithm version bumped if geometry changes;
42. Directional unchanged;
43. benchmark hard gates pass;
44. no pathological bounds regression;
45. full `pnpm check` passes;
46. desktop check/build passes;
47. `git diff --check` passes;
48. docs updated;
49. prompt archived + SHA-256;
50. optimized EXE + SHA-256;
51. PR #127 CI green;
52. PR remains unmerged;
53. stop.

---

# Final report

## Branch / commit / PR

## Reproduction

Describe the synthetic Heading-Hide size mutation and the pre-fix failure.

## Exact failure stage

Show:

```text
postCohesion
postNested
postGroup
```

quality values.

## Root cause

State precisely why changing module dimensions exposed the failure.

## Structural fix

Explain whether the correction was in:

```text
Nested packing
group-body partition
group rigid translation
cross-body blocker handling
or another exact mechanism
```

## Invariance evidence

Report:

```text
same-top-level subtree translation equality
zero postGroup Nested violations
spacing 0..100
```

## HIERDISC integration

Report Hide / Restore / rapid latest-wins.

## Versions

Explain Soft/protocol/evidence bumps.

## UI preservation

Confirm Files/Headings UI and disclosure artifact fix were unchanged.

## Validation

Exact tests / benchmark / builds.

## Native artifact

Path + SHA-256.

## Prompt archive

Path + SHA-256.

## Merge status

```text
NOT MERGED — awaiting founder graphical QA
```

Then stop.
