# HIERDISC1-FIX3 — Uniform Focus Depth Across Files + `Custom / All Files` Hierarchy Semantics

**Task type:** corrective continuation of PR #127 / Focus disclosure semantics + hierarchy-depth UX

## Goal

Continue open PR #127 after founder native QA.

The Focus Explorer and HIERDISC1/FIX2 layout correctness are accepted enough to preserve. This task fixes the remaining **Hierarchy depth semantics** and the confusing relationship between:

```text
Files only
1 level
2 levels
3 levels
```

and per-File manual disclosure.

Founder expectation:

```text
Files only
→ manually expand Headings for one File
→ UI should now communicate "1 level · Custom"

not:
"Files only" even though one File visibly has Heading level 1
```

Then offer one obvious action:

```text
All Files
```

which changes the current custom 1-level view into:

```text
1 level applied uniformly to every File in the Focus graph
```

with one graph-state/layout transition.

Also correct the underlying Focus projection rule:

> Selecting `1 level` must expose one canonical Heading generation for **every File in the current Focus document neighborhood**, not only the Focus/root File.

Do not implement layout-stability/incremental geometry in this prompt. That is a separate architectural task after this semantic pass.

Do not merge before founder native QA.

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
head at prompt-writing time:
804e0411e4c7f93c1d66e06c6fceb28d3e67f49e
base:
cfb4f715ce2d8df6ba083c21ce1d856f22f40ea2
```

Before editing:

1. read current `AGENTS.md`;
2. fetch current refs;
3. verify PR #127 is still open;
4. verify current head;
5. integrate newer `main` if repository workflow requires it;
6. preserve unrelated work;
7. update the same PR #127;
8. record exact starting SHAs.

---

# Current evidence

## Root-only automatic Focus depth is explicit current behavior

Current `projectFocusedDetailView(...)` effectively does:

```text
all Focus-neighborhood Files:
  defaultDepth = 0

Focus/root File only:
  defaultDepth = selected Hierarchy depth
```

The code comment explicitly says automatic depth is scoped to the focused root document only.

This is now the wrong product semantic.

---

# New Focus depth semantic

For Focus projections:

```text
Files only
→ every File in Focus neighborhood is shown as File only

1 level
→ every File in Focus neighborhood may show one canonical Heading generation

2 levels
→ every File may show two canonical Heading generations

3 levels
→ every File may show three canonical Heading generations
```

subject to the existing:

```text
Heading level ceiling
explicit hidden Headings
manual collapse
filters
Blocks rules
```

Do not special-case the root File for automatic depth anymore.

---

# Keep shared Focus projection parity

Focus Network and Focus Hierarchy currently share the same Local Focus detail projection.

Preserve that architecture.

Changing Focus depth should affect both layouts consistently.

Do NOT create a Hierarchy-only projection fork merely to satisfy this UI.

---

# Implementation direction

Current `FocusedDocumentNeighborhood` already contains the bounded document set through:

```text
documentDistance
```

Prefer applying selected automatic depth to:

```text
every document ID in the current Focus neighborhood
```

instead of only:

```text
neighborhood.rootDocumentId
```

Keep the document-neighborhood discovery itself unchanged.

Headings must still never change which Files are members of Focus.

---

# Manual per-File expansion becomes `Custom`

Important: do **not** implement the founder's requested custom view by synthesizing hundreds of hidden Heading IDs.

The current disclosure representation already has the right compact state:

```text
defaultDepth = 0
expandedEntityIds = [File A]
```

which means:

```text
File A shows level 1
other Files remain File-only
```

That is exactly a:

```text
1 level · Custom
```

view.

Use that representation.

This avoids:

```text
mass hiddenEntityIds writes
N sequential Hide actions
N history checkpoints
N layout recomputations
```

---

# Derived effective hierarchy depth

The depth control currently displays only:

```text
state.disclosure.defaultDepth
```

That is no longer sufficient to describe a manual custom view.

Derive a **presentation-level effective depth** for the active Focus graph.

Example:

```text
stored baseline:
Files only / depth 0

File A manually expanded once:
one Heading generation is visible in File A

control:
1 level · Custom
```

Similarly, if manual disclosure produces two structural Heading generations somewhere:

```text
2 levels · Custom
```

Do not confuse:

```text
structural generation depth
```

with Markdown heading number:

```text
H1 / H2 / H4
```

An H4 can be structural generation 1 if it is directly under the document.

Use canonical parent structure, not Markdown level number, to derive effective depth.

---

# Bounded depth control

The product supports structural depth:

```text
0 / 1 / 2 / 3
```

Keep that.

If manual expansion exceeds the supported automatic depth, do not silently invent a "4 levels" product value.

Use the closest truthful existing representation, e.g.:

```text
3 levels · Custom
```

with the Custom marker indicating additional manual disclosure.

Document/test the chosen behavior.

---

# What counts as `Custom`

For the active Focus graph, show:

```text
Custom
```

when manual disclosure overrides make the visible structural disclosure differ from the uniform automatic baseline at the displayed effective depth.

Relevant state includes:

```text
expandedEntityIds
collapsedEntityIds
```

that affect entities in the current Focus document neighborhood.

Do not mark File B's Focus as Custom merely because stale/surviving manual disclosure IDs belong only to unrelated File A outside the current Focus neighborhood.

Use current canonical neighborhood membership.

---

# Explicit Heading Hide is orthogonal

HIERDISC1 `hiddenEntityIds` is a separate explicit visibility feature.

Do not use hidden Headings to derive the automatic level itself.

The Headings tab already owns:

```text
Hidden
Hidden by parent
Show all
```

Keep that semantic separate from:

```text
uniform depth vs custom per-File disclosure
```

The depth control may optionally show a small hidden-count indicator if already natural in current UI, but do not broaden this task unnecessarily.

---

# `All Files` action

When the current Focus depth presentation is Custom, expose an obvious action beside the Custom indicator:

```text
All Files
```

Example:

```text
Hierarchy depth
[ 1 level ▼ ]   Custom   [All Files]
```

Meaning:

> Apply this effective structural depth uniformly to every File in the current Focus graph.

Implementation should perform one graph-state/history action equivalent to selecting that effective depth as the baseline.

It should:

```text
set defaultDepth = effectiveDepth
clear manual expanded/collapsed disclosure overrides according to existing set-depth semantics
preserve explicit hiddenEntityIds
preserve filters
preserve Focus
preserve Blocks setting
```

The result is one projection/layout update, not one action per File/Heading.

---

# Why preserve hiddenEntityIds on `All Files`

`All Files` is about **depth/disclosure uniformity**.

It is not the same as:

```text
Show all hidden Headings
```

The Headings tab already has that action.

So:

```text
All Files
→ uniform automatic depth for all Files
→ explicit Heading Hide choices remain hidden
```

This keeps two concepts clean.

---

# Manual `+` on a File at Files-only

Required founder workflow:

```text
Focus graph starts:
Files only

user clicks + on File A

result:
File A Headings appear
other Files remain File-only
depth control displays:
1 level · Custom
```

Do not first set depth=1 and then hide every other File's Headings.

The current compact manual disclosure state is better.

This action should remain:

```text
one disclosure action
one projection update
one layout update
one history checkpoint
```

---

# Pressing `All Files` after that

From:

```text
1 level · Custom
```

press:

```text
All Files
```

Result:

```text
every File in Focus graph receives automatic level 1
manual File-level expansion override disappears
control becomes plain:
1 level
```

If explicit hidden Headings exist, they remain hidden.

---

# Direct depth selection

If user directly chooses:

```text
1 level
```

from Files only:

```text
apply level 1 to ALL Files in Focus neighborhood
```

This is the core bug fix.

Do not show only the Focus/root File's Headings.

Similarly for 2 and 3.

---

# Current View / Saved View semantics

No new persistence field should be required.

Use existing:

```text
defaultDepth
expandedEntityIds
collapsedEntityIds
hiddenEntityIds
```

The new effective-depth/Custom display is derived UI state.

`All Files` ultimately writes ordinary existing disclosure state.

Do not bump Current View schema v4 for this task unless an unexpected contract change truly requires it.

---

# Graph history

Manual File expansion already creates history.

`All Files` / explicit depth selection should create one normal history checkpoint.

Required:

```text
Files only
→ expand File A
→ 1 level · Custom
→ All Files
→ 1 level

Ctrl+Z
→ 1 level · Custom

Ctrl+Z
→ Files only
```

Forward must restore symmetrically.

---

# Focus reroot

The effective Custom state must be computed against the **current Focus neighborhood**.

Example:

```text
Focus A:
File X manually expanded
→ 1 level · Custom

reroot Focus B:
if B's neighborhood has no relevant manual override
→ control may be Files only / 1 level without Custom as appropriate
```

Do not globally label every future Focus as Custom because some stored disclosure ID survives elsewhere.

---

# Search / Inspector reveal

Existing reveal behavior can add manual expansion state.

After explicit navigation reveals a Heading, the depth control should truthfully reflect the resulting effective/custom state.

Do not force a uniform depth just because Search revealed one Heading.

---

# Focus Explorer Headings tab

Keep accepted UI.

No redesign.

The canonical Heading list continues to distinguish:

```text
visible
hidden
hidden-by-parent
not-disclosed
```

After global `1 level`, Headings in all Focus Files may become disclosed according to the new projection semantic.

---

# Focus Explorer Files tab

Keep accepted UI.

Since Level 1 now affects all Files, Files tab remains just File navigation; do not add Heading rows there.

---

# Performance guard

Global Focus depth can expose substantially more Heading nodes than the legacy root-only behavior.

Add bounded performance evidence on synthetic Focus neighborhoods with multiple Files and Headings.

This is expected product work, but ensure:

```text
one KG6 detailed projection
one renderer/layout update
no per-File projection loop
no per-Heading dispatch loop
```

Use the existing single detailed-pass architecture.

---

# Required tests

## D1 — Files only

Focus neighborhood with 3 Files, each with Headings:

```text
depth 0
→ only 3 File entities projected
```

## D2 — Level 1 all Files

```text
depth 1
→ first structural Heading generation projected for all 3 Files
```

Not just root.

## D3 — Level 2 all Files

Two generations for every eligible File.

## D4 — File manual expand from depth 0

```text
expand File B
→ only B gains first Heading generation
→ derived control = 1 level · Custom
```

## D5 — All Files

From D4:

```text
All Files
→ all 3 Files gain level 1
→ expanded/collapsed override normalized
→ Custom false
```

## D6 — one history action

`All Files` creates exactly one graph-history destination.

## D7 — Back/Forward chain

As described above.

## D8 — hidden Heading orthogonality

Explicitly hidden Heading remains hidden after `All Files`.

## D9 — custom scope relevance

Manual override in File outside current Focus neighborhood does not mark current view Custom.

## D10 — reroot

Custom label recomputed correctly for new Focus neighborhood.

## D11 — Search reveal

Exact Heading navigation produces truthful effective-depth/Custom display.

## D12 — structural generation vs Markdown level

Direct H4 child of File counts as structural generation 1.

## D13 — Focus Network parity

Focus Network receives the same all-Files depth projection.

## D14 — Modular/Classic parity

Both Hierarchy implementations receive identical projection nodes.

## D15 — performance

One projection path / no N-per-File updates.

---

# Likely files

Inspect actual branch first.

Probable:

```text
packages/view-projection/src/focused-detail.ts
packages/view-projection/src/local.test.ts
packages/view-projection/src/focused-documents.test.ts
packages/view-projection/README.md

apps/web/src/components/StructureDepthControl.tsx
apps/web/src/components/StructureDepthControl.test.tsx
apps/web/src/components/structure-depth-selection.ts
apps/web/src/components/GraphExplorer.tsx
apps/web/src/graph-state.ts
apps/web/src/navigation-history.test.ts

possibly new pure helper:
apps/web/src/focus-hierarchy-depth.ts
apps/web/src/focus-hierarchy-depth.test.ts

apps/web/src/components/README.md
apps/web/README.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
history-implementations/
```

Do not force exact filenames.

---

# Non-scope: do not solve layout continuity here

Founder also reported that hiding an unconnected H4 can globally rearrange many Files.

That is real and important, but it is a separate architecture problem.

Do NOT in this prompt:

```text
add previous-layout seeds
change Adaptive Compass scoring
change Soft relaxation
change group packing
add displacement penalties
change worker cache semantics
```

Keep current validated FIX2 geometry algorithms intact.

A separate HIERSTAB prompt will address continuity after this disclosure semantic pass.

---

# Validation

Follow current `AGENTS.md`.

Expected equivalents:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/view-projection
pnpm exec vitest run apps/web/src/components
pnpm exec vitest run apps/web/src/navigation-history.test.ts

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Run task-specific multi-File Focus projection tests.

---

# Native artifact

Build:

```text
hierdisc1-fix3-uniform-focus-depth-native-candidate.exe
```

Report SHA-256.

Update PR #127.

Run CI.

Do not merge until founder graphical QA.

---

# Native founder QA

Ask founder to verify:

```text
1. Focus + Hierarchy → Files only.
2. Click + on one File.
3. Only that File reveals Headings.
4. Depth control now reads 1 level · Custom.
5. Press All Files.
6. Every File in Focus graph now reveals one Heading generation.
7. Control becomes normal 1 level.
8. Ctrl+Z twice returns through Custom → Files only.
9. Explicitly hidden Headings remain hidden.
10. Directly selecting 1 level from Files only reveals level 1 for every File.
11. Smoke-test Files | Headings explorer and Modular Nested layout.
```

---

# Prompt archive

Archive exact prompt as:

```text
history-implementations/HIERDISC1_FIX3_uniform_focus_depth_custom_all_files_codex_prompt.md
```

Record SHA-256.

---

# Hard exit gates

1. same PR #127 continued;
2. latest main integrated if needed;
3. Focus automatic depth applies to every File in neighborhood;
4. Files only still projects Files only;
5. Level 1 shows first generation for all Focus Files;
6. Level 2/3 scale uniformly;
7. manual + from depth 0 remains local to chosen File;
8. manual + displays effective `1 level · Custom`;
9. no mass hidden-ID synthesis;
10. `All Files` exists only when useful;
11. `All Files` applies effective depth uniformly;
12. `All Files` is one history/state action;
13. explicit hiddenEntityIds preserved by All Files;
14. Custom computation scoped to current Focus neighborhood;
15. structural depth does not use Markdown H number;
16. reroot recomputes Custom correctly;
17. Search/Inspector reveal reflected correctly;
18. Focus Network parity preserved;
19. Classic/Modular projection parity preserved;
20. no new persistence schema unless justified;
21. one projection/layout update, no N-per-File loop;
22. accepted Focus Explorer UI otherwise unchanged;
23. FIX2 Nested layout algorithms unchanged;
24. full task-specific tests pass;
25. `pnpm check` passes;
26. desktop check/build passes;
27. `git diff --check` passes;
28. docs updated;
29. prompt archived + SHA-256;
30. optimized EXE + SHA-256;
31. PR CI green;
32. PR remains unmerged;
33. stop.

---

# Final report

## Branch / commit / PR

## Focus depth semantic change

Explain old root-only behavior and new all-Files behavior.

## Effective depth / Custom derivation

Explain how:

```text
depth 0 + one manually expanded File
```

is represented as:

```text
1 level · Custom
```

without changing persistence schema.

## All Files

Explain exact state mutation and history behavior.

## Multi-File projection evidence

Report Level 0/1/2/3 fixtures.

## Performance

Confirm no per-File projection/action loop.

## Validation

Exact tests/builds.

## Native artifact

Path + SHA-256.

## Prompt archive

Path + SHA-256.

## Merge status

```text
NOT MERGED — awaiting founder graphical QA
```

Then stop.
