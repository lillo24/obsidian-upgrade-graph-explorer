# DISC1 — Actionable Disclosure Counts

**Task type:** KG6 disclosure semantics / renderer contract cleanup / correctness regression

## Goal

Fix the disclosure count so the chevron describes the **effect of the disclosure action the user can take now**, not the number of canonical descendants that merely exist somewhere below the entity.

Concrete bug:

```text
Blocks disabled
Nested › 3
```

The three descendants are explicit Obsidian block-reference targets under `Nested`. Clicking currently produces:

```text
Nested ⌄ 0
```

and reveals nothing.

That is wrong.

The intended meaning is:

> `› N` means **N descendant entity nodes this Expand action can reveal under the current view constraints**.

Therefore:

```text
Blocks disabled
Nested has only 3 Block children
→ no disclosure control
```

and:

```text
Blocks enabled
Nested has 3 revealable Block children
→ › 3
```

After expansion those three Blocks should appear and the control should become the corresponding non-zero collapse affordance.

No ordinary UI path should produce `› N → ⌄ 0` with no visible entity change.

---

# Terminology — Block

In Icarus Graph Explorer, a **Block** is an explicit Obsidian block-reference target such as:

```md
Some text ^my-block
```

which can be linked with:

```md
[[Note#^my-block]]
```

It does **not** mean every paragraph or line.

The current diagnostic/sample source includes explicit block markers beneath `Nested`, including:

```md
## Nested

Marker ^block-one
Duplicate ^repeat
Again ^repeat
```

Preserve current parser/resolver Block semantics. DISC1 does not redefine Blocks.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

NAV1 merged through PR #28. At prompt-writing time current `main` is:

```text
74b51bbe370d52f2591c0845b595f77df51fd4ad
```

Current KG6 pipeline:

```text
calculateDisclosure(...)
→ buildBaseProjection(...)
→ applyFocus(...)
→ applyFilters(...)
→ validate
```

Current `calculateDisclosure()` computes hidden metadata approximately as:

```ts
workspace
  .descendants(entityId)
  .filter(descendant => !visible.has(descendant.id))
  .length
```

So the count means **all canonical descendants not structurally visible now**.

This overcounts:

- Blocks while `includeBlocks = false`;
- descendants blocked by `maxSectionLevel`;
- descendants deeper than the one-action progressive expansion;
- potentially descendants that downstream entity filters remove from the final projection.

Current `ProjectedEntityNode` exposes:

```ts
hasHiddenChildren: boolean
hiddenDescendantCount: number
```

`buildBaseProjection()` derives the boolean from that count.

The renderer then uses:

```text
closed  → hiddenDescendantCount
open    → visibleDescendantCount
```

and shows the disclosure button when:

```text
hasHiddenChildren || isExpanded
```

That is why `Nested` can show `› 3`, then become an expanded state with `⌄ 0`.

The current KG6 README also explicitly states that visible entities report all canonical structurally hidden descendants and that filtering does not rewrite that metadata. DISC1 intentionally replaces that contract with actionable semantics.

---

# Required first step

Before editing:

1. sync/rebase onto actual latest `main`;
2. inspect newer KG12/live/UX changes;
3. reproduce the exact Blocks-disabled `Nested` regression;
4. read:
   - `AGENTS.md`;
   - `packages/view-projection/README.md`;
   - `packages/view-projection/src/types.ts`;
   - `packages/view-projection/src/disclosure.ts`;
   - `packages/view-projection/src/base-projection.ts`;
   - `packages/view-projection/src/slicing.ts`;
   - `packages/view-projection/src/project.ts`;
   - `packages/view-projection/src/workspace.ts`;
   - disclosure/filter/focus tests;
   - `packages/renderer-reactflow/src/types.ts`;
   - `packages/renderer-reactflow/src/mapping.ts`;
   - `packages/renderer-reactflow/src/nodes.tsx`;
   - renderer mapping/disclosure tests;
   - `apps/web/src/graph-state.ts`;
   - current NAV1 disclosure integration in `GraphExplorer`;
5. preserve UX4C compact disclosure chrome;
6. preserve NAV1 history;
7. preserve KG12 worker/performance boundaries.

If current code changed, implement the semantic intent against current architecture rather than restoring stale code.

---

# Product invariant

Disclosure count is **actionable UI metadata**.

It answers:

```text
If I activate this control now, how many descendant entity nodes can this action reveal?
```

It does not answer:

```text
How many canonical descendants exist below this entity?
```

Canonical hierarchy truth is unchanged and remains available through source-neutral KG6/workspace/inspection layers.

---

# Closed / Expand semantics

For a closed entity:

```text
› N
```

must mean:

```text
N = descendant entity nodes that become revealable/visible because of this one Expand action,
    subject to the current view constraints.
```

Hard rules:

```text
N > 0 → render Expand control
N = 0 → no Expand control
```

Never render `› 0`.

---

# Open / Collapse semantics

For an entity with currently visible descendant hierarchy:

```text
⌄ N
```

should continue to mean:

```text
N = currently visible descendant entity nodes Collapse will hide
```

The renderer already derives this from final projected hierarchy edges; preserve that unless a concrete bug is found.

Hard rule:

```text
N = 0 → no meaningless Collapse control
```

Never render `⌄ 0` merely because an `expandedEntityId` is preserved internally.

---

# One-action delta, not total hidden subtree

Example:

```text
File
└─ A
   └─ B
      └─ C
```

With Files-only/default depth 0 and no explicit expansion:

```text
File › 1
```

because expanding File reveals A, not the entire hidden subtree.

After expanding File:

```text
A › 1
```

Then expanding A reveals B.

Do not keep current `File › 3` total-hidden-subtree semantics.

---

# Preserved descendant expansion state

Do not oversimplify the algorithm to “immediate child count”.

Existing expanded/collapsed descendant IDs can survive ancestor collapse.

Example:

```text
File
└─ A      expanded
   └─ B   expanded
      └─ C
```

If an ancestor is collapsed while descendant expansion IDs remain preserved, reopening may restore multiple descendants in one action.

Then `› N` should count the actual one-action visible delta produced by reopening with all other disclosure state unchanged.

---

# Structural eligibility

The actionable count must respect current structural disclosure constraints.

## Blocks

Block descendants count only when current Block visibility semantics make them revealable.

```text
3 Block children
includeBlocks = false
→ revealable count 0
```

## Heading ceiling

`maxSectionLevel` remains a hard literal Markdown heading ceiling.

If an H4 child is blocked by `maxSectionLevel = 2`, it must not count.

Explicit expansion still cannot bypass the heading ceiling.

## Collapse precedence

Preserve current:

```text
collapsed > expanded/default depth
```

and calculate reopening against the state the action would actually produce.

---

# Downstream entity filters

The user-facing invariant applies to the **final graph**, not just canonical disclosure.

Current pipeline filters after structural projection. Inspect at least:

- Path Scope;
- Documents / Sections entity-kind filtering;
- current projected text filter if still supported.

Prevent the equivalent bug:

```text
Sections excluded
Document has only Section descendants
Document › N
click
nothing appears
```

If a structurally revealable candidate is guaranteed to be removed from the final projected graph by current entity visibility filters, it must not inflate the Expand count.

Reference Status normally changes edges/diagnostics rather than structural entity visibility; do not conflate it unless it actually changes descendant entity visibility.

---

# Focus mode

Inspect disclosure while Focus is active.

The same user-facing rule should hold:

```text
positive Expand count
→ action produces visible descendant entity nodes
```

Do not knowingly leave a Focus-only `› N → no visible change` defect.

However, do **not** solve Focus-aware counts by invoking `projectView()` once per visible node.

If exact Focus-aware revealability is non-local because expansion changes endpoint roll-up/reference topology:

1. inspect intended current Focus/disclosure behavior;
2. reuse/factor source-neutral visibility logic;
3. if a narrow suppression rule is necessary for provably non-actionable Focus controls, test/document it;
4. report any deliberate limitation.

Do not silently weaken the invariant.

---

# Architecture requirement

This is a KG6/view-projection semantics bug.

Preferred ownership:

```text
canonical + ViewProjectionState
→ KG6 computes truthful actionable disclosure metadata
→ renderer displays it
```

Do not make React Flow inspect canonical hierarchy, block eligibility, heading limits, filters, or Focus policy.

The renderer may continue deriving the currently visible Collapse count from final hierarchy edges.

---

# Rename misleading metadata

Current names encode the old semantics:

```ts
hasHiddenChildren
hiddenDescendantCount
```

Prefer an explicit contract such as:

```ts
revealableDescendantCount: number
```

and derive:

```text
hasRevealableDescendants = revealableDescendantCount > 0
```

where needed.

A separate boolean may be unnecessary.

Renderer data can conceptually become:

```text
revealableDescendantCount
visibleDescendantCount
isExpanded
```

Do not retain old and new fields indefinitely just to avoid compiler-driven cleanup.

This is not a persisted schema.

---

# Keep hidden candidate data internal

If KG6 needs candidate IDs internally to finalize counts across filters, keep them private inside `view-projection` where practical.

Do not expand public `ViewProjection` with large arrays of hidden canonical IDs per node unless there is strong architectural need.

KG7 only needs the final count.

---

# Performance constraint

Do not implement:

```text
for each visible node:
  clone state
  expand node
  projectView(...)
  diff projections
```

That is unacceptable for real vaults.

Also do not:

- rebuild ProjectionWorkspace per node;
- rerun Dagre;
- involve React;
- serialize projections for equality;
- perform pairwise full-subtree comparisons.

Prefer shared visibility predicates, indexed traversal, memoized subtree calculations, or a projection-internal candidate/finalization pass.

Target near-linear work in relevant hierarchy size per projection.

---

# Suggested calculation direction

A reasonable structural approach is to factor disclosure traversal around shared predicates:

```text
section allowed by heading ceiling?
block allowed by includeBlocks?
parent collapsed?
visible by default depth?
visible by explicit expansion?
```

Then compute, for each visible entity, the descendants that would become structurally visible under:

```text
this entity opened
all other disclosure state unchanged
```

Memoize subtree/reachability results so nested hierarchy is not rescanned quadratically.

Because filters run later, finalize the actionable count using the same source-neutral entity-retention semantics before exposing the public `ViewProjection`.

Possible implementation patterns:

```text
A. private revealability candidates → Focus/filter slicing → final count
B. shared entity-retention predicates for current + candidate entities
C. another equally efficient KG6-local approach proven by tests
```

Do not move filter semantics into renderer code.

---

# State preservation when filters change

Do not erase explicit expanded/collapsed state merely because a filter temporarily makes descendants ineligible.

Example:

```text
Blocks enabled
Nested expanded
3 Blocks visible

turn Blocks off
→ Blocks disappear
→ preserve Nested's expanded state internally
→ no ⌄ 0 control

turn Blocks on
→ preserved expansion may reveal Blocks again
```

Same principle for tightening/widening Heading limit.

Derived UI affordance and persisted disclosure intent are separate concepts.

---

# NAV1 interaction

NAV1 records real disclosure actions.

Required:

```text
visible actionable disclosure
→ toggle still creates normal history checkpoint

zero actionable descendants
→ no disclosure control
→ no user-generated visual no-op disclosure checkpoint
```

Do not change generic NAV1 architecture.

Back/Forward must continue restoring expanded/collapsed state.

Derived count recomputation itself must never create history.

---

# Persisted view compatibility

No persisted-view schema bump should be necessary.

Saved views contain disclosure state, not derived counts.

On hydration the current state should simply project with truthful actionable metadata.

---

# Structural-depth extension is explicitly next, not part of DISC1

Current contract remains:

```ts
defaultDepth: 0 | 1
```

Do **not** add 2/3 here.

The next separate plan will implement:

```text
Files only
1 level
2 levels
3 levels
```

while keeping literal Markdown Heading limit fully independent.

---

# Core regression tests

## 1. Exact Block regression

Hierarchy:

```text
Nested
├─ Block A
├─ Block B
└─ Block C
```

Blocks disabled:

```text
revealable count = 0
no Expand control
```

Blocks enabled:

```text
before → › 3
after  → 3 Blocks visible; non-zero Collapse count
```

## 2. Mixed children

```text
Parent
├─ Section
├─ Block
└─ Block
```

Blocks disabled:

```text
› 1
```

Blocks enabled:

```text
› 3
```

assuming those are the exact one-action visible descendants.

## 3. Progressive hierarchy

```text
File
└─ A
   └─ B
      └─ C
```

Files-only state:

```text
File › 1
```

Then A gets its own actionable count after File expansion.

## 4. Preserved nested expansion

Collapse an ancestor while descendant expanded IDs remain.

Reopen and verify count equals the actual multi-descendant reveal delta.

## 5. Heading ceiling

Excluded headings must not count. Widening the ceiling should increase actionable count appropriately.

## 6. Entity-kind filter

Visible ancestor + children excluded by entity-kind filter:

```text
revealable count = 0
```

Also test mixed retained/excluded descendants.

## 7. Path/text filter

Where current filter semantics retain a visible ancestor/context but suppress descendants, verify count reflects final revealability.

## 8. Focus

Add the smallest test proving any positive Focus-mode disclosure count corresponds to an actual descendant-entity reveal, or test the deliberate suppression rule if that is the correct architecture.

---

# Collapse-count renderer tests

Verify:

```text
open node + 3 visible descendants
→ ⌄ 3
```

and:

```text
expandedEntityId exists
visibleDescendantCount = 0
revealableDescendantCount = 0
→ no disclosure button
```

This prevents the `⌄ 0` half of the bug.

---

# Renderer behavior

Conceptual rule:

```text
closed + revealable > 0
→ › N

open + visibleDescendants > 0
→ ⌄ N

otherwise
→ no disclosure control
```

Preserve UX4C's compact chevron/caret and 44px target.

Do not restore large `+ / −` chrome.

---

# Aria wording

Use action semantics:

```text
Expand Nested; reveals 3 descendants
Collapse Nested; hides 3 visible descendants
```

rather than generic “3 hidden descendants”.

No positive count should be announced when the action does nothing.

---

# Browser QA — exact sample

Use the existing sample containing `Nested` and explicit block targets.

## Blocks disabled

Confirm:

```text
Nested
→ no false positive disclosure count for Block-only descendants
→ no › 3
→ no ⌄ 0 path
```

## Blocks enabled

Confirm the exact current resolver-produced Block count appears, expansion reveals those Blocks, and Collapse shows a truthful visible-descendant count.

If the fixture's exact canonical count changes, validate the invariant rather than hard-coding stale sample assumptions.

---

# Browser QA — other constraints

Exercise:

- Sections entity filter;
- Blocks;
- Heading limit;
- Path Scope where useful;
- Focus if disclosure remains available there.

For representative `› N` controls:

```text
activate
→ final visible descendant entity delta matches N
```

Diagnostic target nodes are not structural descendants.

---

# Browser QA — NAV1

Sequence:

```text
expand actionable node
Back
Forward
```

Verify disclosure state and counts restore correctly, with no derived-count history entries.

---

# Desktop/live QA

Using a disposable synthetic vault:

1. create explicit block targets;
2. Blocks off → no false disclosure;
3. Blocks on → correct positive count;
4. expand;
5. add/remove block targets in source;
6. allow live update;
7. verify counts reconcile to new snapshot;
8. no stale `› N` remains.

Do not commit private Icarus vault names/content.

---

# Performance / KG12

DISC1 is derived metadata.

It must not add:

- extra React Flow layouts;
- extra Dagre worker jobs;
- per-node hypothetical full projections;
- repeated workspace construction.

Use current KG12 instrumentation/counters to confirm no pathological duplicate projection/layout work.

If a new KG6 revealability pass is added, cover it with existing synthetic medium/large tests where practical.

No new performance framework.

---

# Source neutrality

`view-projection` remains source-neutral.

Do not import Obsidian adapter, diagnostics-obsidian, React, React Flow, web state, or filesystem APIs into KG6.

The bug was discovered through Obsidian Blocks, but the solution is general disclosure semantics.

---

# Documentation

Update `packages/view-projection/README.md`.

Replace the old contract that counts all canonical hidden descendants with approximately:

```text
Collapsed disclosure metadata reports the number of descendant entity nodes
that an explicit Expand action can reveal under the current view constraints.
It is not total canonical subtree size.
```

Update renderer README if it describes the old count contract.

---

# No new dependencies

Expected external additions:

```text
zero
```

---

# Likely files

Use actual latest structure, but likely:

```text
packages/view-projection/src/types.ts
packages/view-projection/src/disclosure.ts
packages/view-projection/src/base-projection.ts
packages/view-projection/src/slicing.ts
packages/view-projection/src/project.ts
packages/view-projection/src/validation.ts
packages/view-projection/src/disclosure.test.ts
packages/view-projection/src/projection.test.ts
packages/view-projection/README.md

packages/renderer-reactflow/src/types.ts
packages/renderer-reactflow/src/mapping.ts
packages/renderer-reactflow/src/nodes.tsx
packages/renderer-reactflow/src/mapping.test.ts
packages/renderer-reactflow/README.md

apps/web tests only where NAV1 integration requires updates
```

Do not modify more layers than necessary.

---

# Scope

## In scope

- exact Blocks-disabled regression;
- actionable one-toggle reveal count;
- progressive disclosure semantics;
- preserved nested expansion state;
- Blocks eligibility;
- heading ceiling;
- downstream entity visibility filters;
- truthful Focus behavior;
- suppress `› 0`;
- suppress `⌄ 0`;
- rename misleading hidden-count metadata;
- preserve UX4C compact disclosure;
- preserve NAV1;
- KG6 validation/tests/docs;
- renderer tests;
- browser QA;
- desktop/live synthetic QA;
- performance sanity;
- PR/CI/merge/cleanup.

## Explicitly out of scope

Do not implement:

- structural depth 2/3;
- Files/1/2/3-level UI;
- new Heading semantics;
- parser/resolver Block changes;
- paragraph-as-Block behavior;
- QUERY1;
- GROUP1;
- LAYOUT1;
- generic subtree analytics;
- renderer replacement.

---

# Suggested implementation sequence

1. Sync latest `main`.
2. Reproduce exact bug.
3. Add failing KG6 regression first.
4. Define/rename actionable disclosure contract.
5. Refactor disclosure traversal for one-action revealability.
6. Cover Blocks + heading ceiling.
7. Finalize against downstream entity filters.
8. Resolve Focus behavior without per-node full projections.
9. Update projection validation.
10. Update renderer data/mapping.
11. Suppress zero-action controls.
12. Update aria wording.
13. Add progressive/preserved-expansion tests.
14. Add filter/focus tests.
15. Verify NAV1 disclosure history.
16. Browser exact-sample QA.
17. Desktop/live synthetic QA.
18. KG12/performance sanity.
19. Docs.
20. Archive prompt using repository convention.
21. PR → CI → merge → post-merge CI → cleanup.

---

# Validation commands

Use repository-equivalent commands.

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/view-projection typecheck
pnpm exec vitest run packages/view-projection

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm --filter @icarus-graph-explorer/web build

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
pnpm desktop:check
git diff --check
```

Also run current KG12 performance/counter checks required by latest `main`.

PR CI and post-merge `main` CI must pass.

---

# Exit gate

DISC1 is complete only when:

1. `Nested` does not show a positive Block-only disclosure count while Blocks are disabled.
2. The same parent reports the correct positive count when Blocks are enabled.
3. `› N` means N descendants the current Expand action can reveal.
4. Count is not total canonical hidden subtree size.
5. Progressive disclosure reports one-action delta.
6. Preserved nested expansion state is handled correctly.
7. Blocks excluded by `includeBlocks=false` do not count.
8. Heading-ceiling-excluded Sections do not count.
9. Explicit expansion still cannot bypass heading ceiling.
10. Entity/path/text filtering cannot leave a known positive count when expansion produces no final descendant entity nodes.
11. Focus mode does not expose a known false-positive disclosure count.
12. Reference-status filtering is not incorrectly mixed into structural entity visibility.
13. Positive Expand count corresponds to an actual visible entity delta.
14. No `› 0` control renders.
15. No `⌄ 0` control renders.
16. Preserved expanded IDs may remain internally when filters hide all children.
17. Re-enabling Blocks/Heading eligibility can reuse preserved expansion state.
18. Collapse count remains final visible descendant count.
19. Renderer remains free of canonical/filter policy.
20. KG6 remains source-neutral.
21. Old misleading hidden-count naming is removed or explicitly justified.
22. No persisted-view schema bump.
23. NAV1 disclosure Back/Forward remains correct.
24. Derived count changes create no history entries.
25. UX4C disclosure/Focus event isolation remains intact.
26. Disclosure remains keyboard accessible with 44px target.
27. Aria describes reveal/hide action.
28. Node geometry remains unchanged unless a proven CSS correction is necessary.
29. No per-visible-node full hypothetical `projectView()` implementation.
30. No disclosure-count Dagre/layout work.
31. KG12 counters show no pathological duplicate work.
32. Live snapshots recompute truthful counts.
33. Projection output remains deterministic.
34. Validation covers the new count contract.
35. Renderer fixtures/tests use the new semantics.
36. KG6/renderer docs are updated.
37. No external dependency added.
38. Full check/build/test passes.
39. Browser exact regression QA passes.
40. Desktop/live synthetic QA passes where supported.
41. PR CI passes.
42. Post-merge CI passes.
43. Structural-depth extension is not included.
44. QUERY/GROUP/LAYOUT work is not started.

---

# Final report

Report:

## 1. Summary

What was fixed and merged PR/commit.

## 2. Root cause

Explain old all-canonical-hidden-descendant calculation.

## 3. New disclosure semantics

Define `› N` and `⌄ N` precisely.

## 4. Block regression

Report `Nested` with Blocks disabled/enabled.

## 5. Progressive disclosure

One-action delta versus total subtree.

## 6. Heading limit

Confirm excluded headings do not count.

## 7. Filters / Focus

Explain how final visibility constraints are handled and any deliberate Focus rule.

## 8. Projection contract

Field rename/removal and validation changes.

## 9. Renderer behavior

Zero suppression, chevrons, aria.

## 10. State preservation

Explain expansion IDs surviving temporary filter exclusion.

## 11. NAV1

Confirm history still works.

## 12. Performance

Describe revealability algorithm and prove no per-node full projection/layout.

## 13. Browser QA

Exact regression and other tested constraints.

## 14. Desktop/live QA

What actually ran.

## 15. Accessibility

Labels, keyboard, target size.

## 16. Dependencies / schema

Expected: zero dependency changes, no persisted schema bump.

## 17. Tests / validation

Commands, counts, CI.

## 18. Files changed

Important KG6/renderer/tests/docs.

## 19. Deviations / warnings

Especially any Focus-specific edge case.

## 20. Next handoff

Next separate milestone:

```text
Structure
- Files only
- 1 level
- 2 levels
- 3 levels
```

while keeping:

```text
Heading limit
- No limit
- #
- ##
- ###
- ...
```

independent.

Do not implement it automatically.
