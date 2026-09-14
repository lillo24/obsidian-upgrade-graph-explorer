# HIER4B-PATCH2 — Root-Neutral Soft Folder Force

**Task type:** focused layout-semantics bug fix / cache-version bump / regression tests

## Goal / success outcome

In **Modular Focus Hierarchy → Soft Folder Clusters**, the focused/root File must remain a fixed semantic/topology anchor **without acting as an immovable folder-attraction mass**.

Current behavior is subtly wrong:

```text
root File belongs to folder F
+ other Files belong to F
→ root is included in F's folder-force centroid
→ root itself is not moved
→ the other Files are nevertheless pulled toward the root's fixed position
```

Desired behavior:

```text
root File
→ remains visually inside its true displayed folder
→ remains the Focus/topology root
→ remains fixed at the focus origin
→ remains a collision body
→ remains part of ordinary topology/reference/hop semantics
→ DOES NOT participate in Soft folder-attraction membership or centroids
```

Success means the root File's own folder identity has **zero influence on Soft folder-force geometry**, while every display/hierarchy semantic remains truthful.

This is a small correction. Do not broaden it into Adaptive Compass, spacing, routing, or folder-guide redesign.

---

# Repository / current evidence

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

At prompt-writing time, latest `main` inspected was:

```text
eb7d8006e4881a32d06547a4752109cff058e838
```

Before editing:

1. read current `AGENTS.md`;
2. fetch/update current `main`;
3. inspect open PRs/worktrees;
4. use the latest `main` if it has advanced;
5. preserve unrelated branches/worktrees/user modifications;
6. record the exact starting SHA.

Suggested isolated branch/worktree:

```text
codex/hier4b-root-neutral-folder-force
```

Follow the current repository PR/CI/merge workflow in `AGENTS.md`.

Do not push directly to `main`.

---

# Current implementation evidence

Relevant owner:

```text
packages/focus-schematic-layout/src/soft-clusters.ts
```

Current `hierarchyFolderGroups(...)`:

```text
display tree
→ focusSchematicSoftFolderScopeMemberships(...)
→ every File membership enters groups
→ keep groups with members.length > 1
```

The helper currently has no `rootModuleId` / excluded-member input.

In `relax(...)`, the folder-force centroid is then computed from **all** members:

```ts
const centroid = members.reduce(...)
```

but only when applying movement does the code skip:

```ts
if (id === input.model.rootModuleId) continue;
```

So the root is:

```text
included in centroid
but excluded from movement
```

That is the incorrect asymmetric behavior this patch fixes.

Current display-tree behavior is separate and correct:

```text
buildFocusSchematicSoftFolderDisplayTree(...)
focusSchematicSoftFolderScopeMemberships(...)
```

The root File is an ordinary visible File there, so its displayed folder identity remains truthful.

Also note:

```text
workspace root folder "."
```

is already excluded from Soft scope memberships. This task is about the **focused/root File**, not the workspace-root folder.

Current Soft algorithm version inspected:

```ts
FOCUS_SCHEMATIC_SOFT_CLUSTER_ALGORITHM_VERSION = 3
```

The web layout cache already uses this Soft-specific algorithm version when Soft Clusters is active.

---

# Core invariant

Use this as the semantic contract:

```text
DISPLAY / HIERARCHY SEMANTICS
root File:
  INCLUDED

SOFT FOLDER PHYSICS
root File:
  EXCLUDED

TOPOLOGY / HOPS / COLLISION / FOCUS ANCHOR
root File:
  INCLUDED / FIXED AS TODAY
```

More explicitly:

```text
Root File
├─ display tree membership                 YES
├─ exact/display folder identity           YES
├─ folder guides / region containment      YES
├─ folder context semantics                YES
├─ raw displayed folder memberships        YES
├─ topology/reference springs              YES
├─ hop-distance semantics                  YES
├─ collision body                          YES
├─ final focus anchoring at origin         YES
└─ folder-attraction groups/centroids      NO
```

Root Heading/Block descendants:

```text
never independent folder-force members
```

because folder force is File-module based. Preserve that.

---

# Scope

## In scope

- exclude `input.model.rootModuleId` from Soft folder-force group assembly;
- perform exclusion **before** the two-member active-force threshold;
- ensure all folder-force centroids use only non-root Files;
- ensure force-active repeated-folder metrics/runtime evidence use the same filtered groups;
- bump the Soft algorithm/cache version because geometry changes;
- add exact regression tests;
- document the root-neutral force invariant.

## Explicit non-scope

Do not change:

```text
Soft display tree construction
folder guide membership/rendering
folder promotion / flattening
singleton compression
context menus
four-side File ports
topology spring construction
hop semantics
collision policy
root anchoring
Adaptive Compass behavior
Adaptive Compass × Soft diagnosis
HIER4B-SPACING
unified/no-island folder layout
MODULAR-CONTEXT1
HIER5 routing
HIER3C adoption
Classic Focus Hierarchy
Directional Folder Bands
```

Do not start the next milestone automatically.

---

# Implementation guidance

## 1. Filter the root at the force-group boundary

Prefer keeping:

```ts
focusSchematicSoftFolderScopeMemberships(...)
```

truthful and unchanged.

That helper represents displayed hierarchy membership and should continue to include the root File.

Instead modify the force-group boundary, likely:

```ts
hierarchyFolderGroups(...)
```

to receive the root ID, e.g. conceptually:

```ts
hierarchyFolderGroups(
  tree,
  strength,
  policy,
  rootModuleId,
)
```

Exact signature is Codex's choice after inspecting current code.

Filter:

```text
id === rootModuleId
```

out before the active-group threshold.

Do not construct a second fake display tree without the root.

---

## 2. Filter before `members.length > 1`

This ordering is important.

Example A:

```text
Folder F:
- Root
- File B
```

After root exclusion:

```text
force members:
- File B
```

Therefore:

```text
Folder F is NOT an active folder-force group
```

A one-member group cannot self-attract.

Example B:

```text
Folder F:
- Root
- File B
- File C
```

After root exclusion:

```text
force members:
- File B
- File C
```

Therefore:

```text
Folder F remains active
centroid = centroid(B, C)
```

It must not be:

```text
centroid(Root, B, C)
```

This rule must also apply to ancestor-scope memberships under the current normalized-decay hierarchy policy.

---

## 3. Reuse one force-group definition everywhere

Current code reuses `hierarchyFolderGroups(...)` in:

```text
relax(...)
metrics(...)
runtime repeatedFolderCount evidence
```

Preserve one semantic source of truth.

Do not fix the centroid in `relax(...)` while leaving metrics/evidence root-inclusive.

All **force-active** group calculations should use the same root-excluded member sets.

---

# Evidence / metrics distinction

Be careful not to accidentally erase truthful display evidence.

Current evidence includes concepts such as:

```text
displayedFolderCount
maximumDisplayedDepth
maximumPerFileFolderWeight
```

These derive from the displayed tree/raw memberships and should remain display-truthful.

The root may still contribute to those because it really is displayed in its folder.

By contrast, metrics/runtime values derived from `hierarchyFolderGroups(...)`, such as:

```text
repeatedFolderCount
repeatedFolderModuleCount
repeatedFolderRmsRadius*
childFolderCoherenceMean
parentFolderCoherenceMean
runtime.repeatedFolderCount
```

currently describe the groups used by Soft clustering analysis.

Those should use the root-excluded force groups.

If current naming/documentation makes any metric ambiguously claim to mean "all visually repeated folders" rather than "force-active repeated folders", do not silently redefine a public contract. Add a concise clarification or, if a schema-level rename would be needed, stop and report instead of broadening this patch.

Do not change evidence schema versions unless actually required by an interface contract.

---

# Root remains fixed in every other sense

Preserve current behavior in:

```text
initialPositions(...)
topology pair forces
hop-radius pull
collisionPass(...)
packWithoutOverlaps(...)
anchorRootFile(...)
```

The root remains:

```text
fixed / pinned
```

where current code pins it.

This task removes only its **folder-force gravitational influence**.

Do not make the root physically free.

---

# Cache / algorithm version

This changes deterministic Soft geometry.

Current inspected value:

```ts
FOCUS_SCHEMATIC_SOFT_CLUSTER_ALGORITHM_VERSION = 3
```

If latest `main` still uses `3`, bump Soft to:

```text
4
```

or the next current version if main advanced.

Verify:

```text
apps/web/src/focus-schematic-layout-cache.ts
```

already keys Soft mode with the Soft-specific version.

Add/update a focused cache test proving:

```text
Directional macro layout
→ still uses its existing selected algorithm version

Soft Folder Clusters
→ uses the bumped Soft algorithm version
```

Do not bump worker protocol or unrelated algorithm versions unless current architecture actually requires it.

---

# Required regression design

Prefer **geometry invariance tests** that directly prove the root's folder identity cannot influence Soft folder force.

Do not test only private helper implementation details.

## R1 — root + one other File

Create or reuse a fixture where:

```text
Root      → Folder F
File B    → Folder F
```

Compare with an otherwise identical fixture where only Root's folder changes:

```text
Root      → DifferentRootFolder
File B    → Folder F
```

At nonzero/full Soft strength:

```text
candidate geometry must be byte-identical
```

because after root exclusion there is only one non-root File in Folder F, so Folder F exerts no folder force.

Also expect force-active repeated-folder evidence to report no two-member active group from `{Root, B}`.

---

## R2 — root + two other Files

Fixture:

```text
Root      → Folder F
File B    → Folder F
File C    → Folder F
```

Compare to the same topology where only Root's folder is changed.

At full Soft strength:

```text
candidate geometry must be byte-identical
```

because the active folder group should be:

```text
{B, C}
```

in both cases.

Expected force-active evidence:

```text
repeatedFolderCount        = 1
repeatedFolderModuleCount  = 2
```

not 3.

This is the strongest regression for the centroid bug.

---

## R3 — ancestor hierarchy / normalized decay

Use a nested displayed hierarchy where:

```text
Root
B
C
```

share at least one ancestor Soft scope.

Changing only the Root's exact/displayed folder placement must not alter non-root folder-force geometry.

Ensure root exclusion applies at every ancestor force scope, not only the nearest folder.

---

## R4 — display membership remains truthful

Add an explicit assertion—preferably using the existing public display-tree/membership helpers—that:

```text
root File still exists in tree.files
root exact/display parent folder is unchanged
raw focusSchematicSoftFolderScopeMemberships(...) still includes its normal folder scopes
```

The layout force layer, not display semantics, performs the exclusion.

Avoid changing `soft-folder-display.ts` just to make the test pass unless there is a genuine bug there.

---

## R5 — root structural descendants

Use a fixture with expanded Heading/Block descendants under the root File.

Prove they do not become independent folder-force members.

Do not alter internal Heading/Block placement.

---

## R6 — strength zero

Existing hard invariant must remain:

```text
strength = 0
→ folder identity/display intent has zero geometry influence
```

Existing tests should continue passing unchanged.

---

## R7 — determinism

Cold repeat and permuted input-order tests must remain byte-deterministic.

Root exclusion must not introduce unstable Map/Set ordering.

---

# Existing tests to preserve

Current Soft tests already cover, among other things:

```text
fixed two-round schedule
root File anchored at (0,0)
no module overlap
byte determinism
strength-zero folder independence
nested display hierarchy
normalized-decay evidence
singleton folders force-free
repeated-folder cohesion
filtered bridge exclusion
multiplicity saturation
secondary relationships with zero geometry influence
```

Do not weaken them.

Add focused tests rather than replacing broad fixture coverage.

---

# Directional regression

Directional Folder Bands must remain unchanged.

This patch should ideally touch only Soft-specific code/tests/docs/cache version expectations.

Run current Directional/Focus Schematic suites.

If any Directional candidate bytes change, treat that as a regression and investigate before merge.

Do not "update snapshots" blindly.

---

# Documentation

Update the nearest HIER4B source of truth, likely:

```text
docs/HIER4B_SOFT_FOLDER_CLUSTERS.md
```

Add a concise invariant such as:

```text
The Focus/root File remains a displayed folder member and fixed topology anchor,
but is excluded from Soft folder-force membership and centroids so its pinned
origin does not gravitationally bias its folder.
```

If `docs/ROADMAP.md` still says the already-approved HIER4B label/wrapper graphical cleanup is pending, correct that stale wording **only if current repository evidence supports the accepted state**.

External context embedded in this prompt:

```text
The user already graphically approved:
- nested Soft folder hierarchy
- singleton-chain compression
- folder promotion/flattening semantics
- passive folder labels
- File-only module-boundary hiding
- post-island redundant wrapper suppression
- folder-area right-click
- composed File + containing-folder context menu
- general four-side File port concept
```

Do not reinterpret those as pending QA.

Do not mark future Adaptive/Spacing/Unified-layout work complete.

---

# Validation

Follow current `AGENTS.md`.

Run focused tests during development and the repository-required complete validation before merge.

Expected commands, adjusted to current scripts/package names:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/focus-schematic-layout
pnpm exec vitest run apps/web/src/focus-schematic-layout-cache.test.ts

pnpm check
git diff --check
```

Also run the existing Focus Schematic / Soft benchmark or bake-off smoke if current repo tooling makes it part of normal layout validation.

No new dependency.

A native desktop manual gate is not required **if** the exact geometry-invariance and cache regressions prove the requested semantics and all existing graphical semantics remain untouched.

If implementation unexpectedly requires renderer/display-tree changes, or tests reveal a consequential visual-semantics choice not covered by this prompt, stop and report rather than silently broadening the task.

---

# Git / PR workflow

Use the current `AGENTS.md` workflow:

```text
isolated branch/worktree
→ implement
→ focused + full validation
→ inspect diff
→ commit intended files
→ push
→ open PR to main
→ CI
→ merge automatically when clean/green unless a genuine unresolved consequential decision appears
→ verify post-merge CI
→ clean this task's branch/worktree
```

Do not start Adaptive Compass × Soft after merging this patch.

---

# Prompt archive

Archive this exact prompt under:

```text
history-implementations/HIER4B_PATCH2_root_neutral_soft_folder_force_codex_prompt.md
```

Record its SHA-256 in the final report.

---

# Hard exit gates

The task is complete only when:

1. work starts from latest `main`;
2. root File remains in the displayed Soft folder tree;
3. raw display memberships remain truthful and root-inclusive;
4. root File remains fixed Focus/topology anchor;
5. root remains a collision body;
6. topology/reference forces remain unchanged;
7. hop semantics remain unchanged;
8. root is excluded from every Soft folder-force group;
9. root exclusion occurs before the `>1 member` active-group threshold;
10. `{Root, B}` produces no active folder-attraction group;
11. `{Root, B, C}` produces force membership `{B, C}`;
12. folder centroid for `{Root, B, C}` excludes Root;
13. ancestor normalized-decay force scopes also exclude Root;
14. root folder identity changes cannot alter Soft geometry in the required invariance fixtures;
15. force-active repeated-folder metrics exclude Root;
16. display evidence remains root-inclusive where semantically appropriate;
17. root Heading/Block descendants remain non-members of folder force;
18. strength-zero invariant remains exact;
19. existing nested/promotion/flatten/compression semantics remain unchanged;
20. existing context-menu and guide semantics remain unchanged;
21. existing four-side ports remain unchanged;
22. existing Adaptive Compass behavior is not modified;
23. Directional Folder Bands are unchanged;
24. Soft geometry remains deterministic;
25. Soft algorithm/cache version is bumped correctly;
26. unrelated algorithm/protocol versions are unchanged;
27. focused Soft tests pass;
28. cache tests pass;
29. full `pnpm check` passes;
30. `git diff --check` passes;
31. nearest HIER4B docs describe the root-neutral force invariant;
32. prompt is archived with SHA-256;
33. PR is opened;
34. PR CI passes;
35. PR merges according to current repository workflow;
36. post-merge CI passes;
37. task branch/worktree is cleaned;
38. no next HIER milestone is started automatically.

---

# Final report

Report:

## 1. Branch / commits / PR

## 2. Starting `main` SHA

## 3. Exact root-neutral implementation

Explain where filtering occurs and why display membership remains unchanged.

## 4. Force/evidence distinction

State which evidence remains display-root-inclusive and which force-active metrics exclude Root.

## 5. Regression fixtures

Report the geometry-invariance results for:

```text
Root + 1
Root + 2
ancestor normalized-decay
```

## 6. Cache/version change

Report old → new Soft algorithm version and confirm Directional version/protocol unchanged.

## 7. Validation

Exact commands and pass counts.

## 8. Files changed

## 9. Dependencies

Expected:

```text
none
```

## 10. Prompt archive + SHA-256

## 11. Remaining HIER work

Keep these explicitly future:

```text
Adaptive Compass × Soft consistency
HIER4B-SPACING
unified/no-island layout experiment
MODULAR-CONTEXT1
HIER5
HIER3C
```

Do not start them automatically.
