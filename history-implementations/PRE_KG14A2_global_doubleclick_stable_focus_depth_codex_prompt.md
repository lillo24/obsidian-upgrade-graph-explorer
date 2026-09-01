# PRE-KG14A2 — Global Double-Click + Stable Focus Depth Semantics

**Task type:** focused interaction fix / source-neutral projection semantics / regression-safe pre-KG14A cleanup

## Goal

Fix two remaining product-semantic issues before running KG14A:

```text
A. Global double-click should perform the existing scale-down action: Open Local.

B. Structure Focus + Structural Depth must become stable and intuitive:
   determine the Focus neighborhood at File level first,
   then unfold hierarchy only around the focused File.
```

The intended Focus behavior is:

```text
Files only
→ focused File + its file-level reference neighborhood

1 level
→ SAME File neighborhood
→ add direct/top-level headings of the focused File only

2 levels
→ SAME File neighborhood
→ add first + second structural generations under the focused File

3 levels
→ SAME File neighborhood
→ add first + second + third structural generations under the focused File
```

Neighbor Files remain collapsed unless explicitly expanded by the user.

This task must not begin KG14A.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

Current baseline at plan-writing time is `main` after PRE-KG14A PR #38:

```text
e7e863f870e4178c877795fe27d3c1f170c464e2
```

Relevant current behavior:

## React Flow

`GraphCanvas` already wires:

```text
single click      → select
node double-click → onFocusEntity(...)
keyboard Enter    → Focus
```

so Structure has an established double-click Focus interaction.

## Sigma Global

Global currently owns click selection but does not expose the equivalent double-click scale-down interaction.

The established product action is already:

```text
Global selected File
→ Open Local
```

through the existing application/Inspector orchestration.

Do not create a separate Global Focus state.

## Structure Focus projection

Current generic `projectView()` order is:

```text
structural disclosure / endpoint roll-up
→ apply Focus traversal
→ filters
```

Therefore changing Structural Depth changes which projected node owns a reference **before Focus traversal is calculated**.

Example:

```text
Files only:
Associated Value ─────────→ File B

1 level:
Associated Value
└─ # Heading ─────────────→ File B
```

The reference moves from the File node to the Heading node. Current Focus traversal walks the already-projected reference graph, so revealing more hierarchy can unexpectedly change or shrink the File neighborhood.

Current normal Structure Focus also uses:

```text
hierarchyContext: ancestors
```

which does not automatically retain the focused document's newly visible child headings.

This explains the reported release behavior where:

```text
Files only Focus
→ relatively large File neighborhood

1 level Focus
→ fewer Files
→ focused File's expected # headings may still be absent
```

---

# Important concurrent work: PR #39 / GROUP1B

At plan-writing time PR #39 is open:

```text
GROUP1B: wire Visual Groups product UI and sessions
```

It is based on the current PRE-KG14A main and modifies, among other files:

```text
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/ProvenanceInspector.tsx
apps/web/src/App.css
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
```

This PRE-KG14A2 task will also likely touch `GraphExplorer.tsx`.

Before editing:

1. check PR #39 status;
2. if it has merged, sync/rebase onto the new `main` and use that as authority;
3. if it is still active, do not edit/clean its branch or worktree;
4. avoid final GraphExplorer integration against a stale base;
5. if necessary, stop and report the conflict rather than overwriting GROUP1B work;
6. preserve GROUP1 renderer-style/session behavior exactly.

Do not revert or bypass Visual Groups to implement this fix.

---

# Product decision 1 — Global double-click means Open Local

The desired Global interaction is:

```text
single click File
→ select File
→ Inspector may show it

hover
→ existing neighborhood emphasis

double-click File
→ select File
→ execute the exact existing Open Local action
```

Do **not** implement:

```text
double-click Global
→ generic Structure Focus
```

Global is the network overview; its established semantic scale-down is Local.

Use the same application-level Local-entry pipeline already used by the Inspector's **Open Local** button.

That preserves:

- history;
- Global screen-point transition anchor;
- Local root normalization;
- view-state semantics;
- selection;
- current Free/Structured Local preference.

Do not duplicate `planLocalEntry(...)` or Local history logic inside Sigma.

---

# Global renderer interaction seam

Add the narrowest renderer callback required, conceptually:

```ts
onNodeDoubleClick?: (
  key: ProjectionNodeId,
  attributes: GlobalNodeAttributes,
) => void
```

or an equivalent application-neutral activation callback.

Sigma/session responsibilities:

```text
doubleClickNode
→ validate node exists
→ only document/entity nodes are activatable
→ invoke callback
```

Application responsibility:

```text
callback entity ID
→ current Open Local orchestration
```

Do not give `renderer-sigma` knowledge of:

- presentation modes;
- KG6 Focus state;
- Local history;
- GraphExplorer;
- canonical navigation policy beyond the entity ID already carried in attributes.

---

# Sigma default double-click behavior

Inspect Sigma v3's actual double-click event/captor behavior before implementing.

If Sigma's default double-click also changes camera zoom:

```text
Open Local double-click
→ suppress the default Sigma camera action
```

using the supported event API (`preventSigmaDefault` or current equivalent).

Do not allow one double-click to both:

```text
zoom Global
and
switch to Local
```

Single-click selection on the first click may occur; that is acceptable and should remain stable.

---

# Global double-click edge cases

Global is documents-first but can contain diagnostic target nodes when non-resolved statuses are enabled.

Required:

```text
double-click document
→ Open Local

double-click diagnostic target
→ no Local entry
```

Do not attempt to infer a containing File for a diagnostic node.

Do not add edge double-click behavior.

The visible Inspector **Open Local** action remains the accessible/non-mouse path.

---

# Product decision 2 — Focus neighborhood is File-level and depth-independent

The focused File neighborhood must be decided before heading visibility.

Conceptually:

```text
canonical workspace
        ↓
document-only reference projection
        ↓
Focus root document + hops + direction
        ↓
FIXED allowed document neighborhood
        ↓
apply structural detail inside that neighborhood
```

Then visible headings can move precise reference endpoints:

```text
Associated Value ───────→ File B
```

may become:

```text
Associated Value
└─ # Heading ───────────→ File B
```

but `File B` remains in the Focus neighborhood.

This distinction is critical:

```text
Focus membership
≠
current visual endpoint granularity
```

---

# Normal Structure behavior remains unchanged

Outside Focus:

```text
Files only
→ all visible Files

1 level
→ first structural generation for all eligible visible Files

2 levels
→ first two generations for all eligible Files

3 levels
→ first three generations
```

Do not make root-scoped depth the general Structure behavior.

The new rule applies only while Structure Focus is active.

---

# Structure Focus depth behavior

While Focus is active, automatic depth applies only to the **focused document**.

Example:

```text
Files only Focus on Associated Value

           Initiative
               │
Curiosity ─ Associated Value ─ Neuroscience
               │
          another File
```

Then `1 level`:

```text
           Initiative
               │
Curiosity ─ Associated Value ─ Neuroscience
            ├─ # Heading A
            ├─ # Heading B
            └─ # Heading C
               │
          another File
```

Neighbor Files remain collapsed.

Then `2 levels` unfolds the second structural generation beneath the focused File's first-level headings.

---

# Manual neighbor expansion remains supported

Automatic depth is focus-root scoped, but explicit disclosure remains useful.

Example:

```text
Focus root = Associated Value
Depth = 1

neighbor File B is collapsed automatically
```

User clicks `+` on File B:

```text
File B's direct headings become visible
```

This is an explicit local customization and must not change which Files belong to the Focus neighborhood.

Likewise manual collapse should continue to take precedence where the existing disclosure contract says it does.

Do not disable manual disclosure in Focus solely because speculative reveal counts were historically suppressed.

If current Focus projection intentionally suppresses Expand controls because endpoint roll-up could change reachability, this task should remove that reason by making reachability document-level and stable, then restore **truthful** actionable disclosure counts where safe.

Do not show an Expand control that cannot change the focused projection.

---

# Depth presets in Focus

PRE-KG14A changed explicit depth selection into a fresh preset:

```text
set-depth
→ set defaultDepth
→ clear expandedEntityIds
→ clear collapsedEntityIds
```

Preserve that product rule.

Therefore in Focus:

```text
select Files only
→ clear manual disclosure
→ show fixed File neighborhood only

select 1 level
→ clear manual disclosure
→ same File neighborhood
→ root document first generation
```

After the preset is applied, the user can manually expand neighbor Files again.

Do not regress the PRE-KG14A fix.

---

# Focus root normalization

Current `enter-focus` accepts an entity ID and historical Structure interaction may focus Files or more precise structural entities.

Do not silently break existing heading/block Focus navigation.

For **document-neighborhood calculation** and **automatic depth ownership**:

```text
focus entity
→ containing document
```

Use the stable canonical containing-document relation.

If the exact Focus root is already a document, this is identical.

If the Focus root is a Heading/Block:

- preserve the current exact selection/navigation behavior where valid;
- use its containing document as the file-level neighborhood root;
- apply automatic structural depth to that containing document;
- do not fuzzy-match.

If current product code has already normalized Structure Focus to documents after concurrent changes, use the simpler current contract and document it.

---

# Source-neutral projection architecture

This behavior belongs in `packages/view-projection`, not in React/Sigma layout code.

Preferred direction:

```text
projectStructureView(workspace, state)
  if no Focus:
    → existing projectView(...)

  if Focus:
    → file-stable focused Structure projection
```

Exact function naming is flexible.

Do not make `GraphExplorer.tsx` manually traverse references or canonical children.

Do not put this policy in `renderer-reactflow`.

---

# Reuse the Local two-pass idea

`projectLocalView(...)` already contains an important related architecture:

```text
Pass A
→ determine document Focus neighborhood using documents-only projection

Pass B
→ project exact visible hierarchy/provenance inside those allowed documents
```

Inspect and reuse/generalize that logic rather than creating another independent neighborhood algorithm.

A clean internal extraction might look conceptually like:

```text
projectFocusedDocumentNeighborhood(...)
retainDetailedProjectionInsideDocuments(...)
```

used by:

```text
Local
Structure Focus
```

but do not over-refactor if a smaller source-neutral helper is clearer.

Hard invariant:

```text
Local semantics must not regress.
```

---

# File-neighborhood filter policy

Follow the current Local evidence unless current merged code has a stronger product rule.

The document-neighborhood pass should be driven by semantic graph reachability and relevant document-level constraints.

Likely preserve during neighborhood discovery:

```text
Focus hops
Focus direction
path scope
reference-status filters
```

Do not let heading visibility or entity-kind granularity change neighborhood membership.

Be careful with QUERY1/text/entity-kind filters: a query targeting headings should not accidentally erase the file-level neighborhood before the detailed pass merely because documents themselves do not match the heading predicate.

Prefer the same separation already used by Local:

```text
file-neighborhood selection first
→ detailed projection/filtering second
```

Document and test the final policy.

Do not modify QUERY1 syntax/evaluator.

---

# Root-scoped automatic disclosure

The Focus detailed pass needs a **projection-only** effective disclosure state.

Do not mutate persisted `ViewProjectionState` simply to represent root-scoped depth.

Conceptually derive:

```text
stored disclosure:
  defaultDepth = N
  manual expanded IDs
  manual collapsed IDs

Focus-effective disclosure:
  automatic default depth globally = 0
  + ephemeral automatic expansion chain under focused document through depth N
  + user's manual expansions
  + user's manual collapses (collapse retains precedence)
```

This preserves:

- saved/persisted state contracts;
- exact depth control value;
- manual neighbor expansion;
- no new schema version.

Do not add a second persisted `focusDepth` field.

---

# Example root-scoped depth derivation

For:

```text
File A
├─ # H1-A
│  ├─ ## H2-A
│  └─ ## H2-B
└─ # H1-B
```

Depth 0:

```text
File A
```

Depth 1:

```text
File A
├─ H1-A
└─ H1-B
```

Depth 2:

```text
File A
├─ H1-A
│  ├─ H2-A
│  └─ H2-B
└─ H1-B
```

Implement this by deriving ephemeral disclosure/visibility through canonical parent/child structure, not by creating synthetic graph entities.

Respect the existing Markdown heading ceiling (`maxSectionLevel`).

Blocks remain governed by the existing Blocks opt-in/disclosure rules.

---

# Stable Focus neighborhood oracle

Add a deterministic projection oracle.

For the same workspace/root/hops/direction/filters:

```text
Focus depth 0 documents
=
Focus depth 1 documents
=
Focus depth 2 documents
=
Focus depth 3 documents
```

Absent a separate filter that intentionally excludes a document.

Changing depth may change:

- Section/Block count;
- precise reference source/target projected node;
- hierarchy edges;
- layout geometry.

It must **not** change file-neighborhood membership.

This directly tests the reported bug.

---

# Focus root-only depth oracle

With a root document and at least two neighbor documents:

```text
Depth 1
→ direct headings of root visible
→ direct headings of neighbors absent
```

unless a neighbor was explicitly manually expanded after the preset.

Then:

```text
manually expand neighbor
→ neighbor heading visible
→ document neighborhood unchanged
```

Add depth 2/3 coverage for nested root headings.

---

# Reference endpoint oracle

Create a fixture where a reference originates in a root heading.

Depth 0:

```text
reference projected from root File
```

Depth 1:

```text
same reference projected from precise Heading
```

but:

```text
target neighbor File remains in Focus in both views
```

This proves the separation between membership and endpoint precision.

---

# Focus actionable disclosure counts

Current `projectView()` comments say Focus suppresses speculative Expand controls because expansion can change reachability non-locally.

After this fix, reachability is deliberately file-stable.

Re-evaluate this suppression.

Preferred outcome:

```text
Focus projected File/Heading with actually revealable descendants
→ truthful + control available
```

because the user explicitly wants to expand neighbor Files manually.

Use the existing DISC1 count contract.

Do not compute counts by rendering hidden entities.

Do not restore counts unless tests prove the action changes only detailed visibility and cannot corrupt File reachability.

---

# Future multi-focus seam

Do **not** implement multiple Focus roots now.

However avoid an implementation that would make this future model impossible:

```text
Focus roots = {File A, File B}
Depth 1
→ automatic first-level headings for A and B
→ all other neighborhood Files remain collapsed
```

A reasonable internal helper may accept:

```text
readonly Set<EntityId> detailDocumentIds
```

or otherwise isolate the current single-root assumption in one place.

Do not change persisted Focus schema for speculative multi-focus support.

---

# Global double-click tests

Cover:

1. single-click Global document still selects only;
2. double-click Global document invokes the new activation callback exactly once;
3. callback identifies the correct canonical document;
4. application uses the existing Open Local pipeline;
5. transition anchor still comes from the clicked File;
6. history records the same semantic transition as the Inspector button;
7. Local Free/Structured preference is preserved;
8. diagnostic-node double-click does nothing;
9. no edge double-click behavior;
10. Sigma default double-click zoom is suppressed if it otherwise conflicts;
11. hover/label/group style behavior remains intact.

---

# Focus/depth tests

At minimum cover:

1. Focus depth 0 produces expected File neighborhood;
2. depth 1 keeps identical File IDs;
3. depth 2 keeps identical File IDs;
4. depth 3 keeps identical File IDs;
5. depth 1 adds root direct headings;
6. neighbor headings are absent by automatic depth;
7. manual neighbor expansion adds neighbor headings;
8. manual neighbor expansion does not change File neighborhood;
9. selecting another depth preset clears manual disclosure per PRE-KG14A behavior;
10. root heading reference reroutes to Heading when visible without dropping target File;
11. heading limit remains enforced;
12. Blocks behavior remains correct;
13. path/reference-status filters remain coherent;
14. QUERY1 remains coherent;
15. Focus hops/direction remain correct;
16. Focus root section/block uses containing document safely if supported;
17. Local `projectLocalView` tests remain unchanged/green;
18. non-Focus Structure depth semantics remain unchanged.

---

# Performance / operation gates

This semantic fix should not introduce whole-workspace duplicate work.

Measure/update operation oracles as needed.

Expected Structure Focus depth change:

```text
one source-neutral Structure Focus projection
→ one W3 layout request for changed topology
```

No:

```text
KG10 work
Global projection
Global layout
Local layout
```

The document-neighborhood pass is allowed to be an internal second projection pass, but benchmark it at medium synthetic scale and keep it bounded by existing projection costs.

Do not add a general projection cache without evidence.

---

# GROUP1 compatibility

PR #39 / GROUP1B applies presentation styling after projection.

This task must preserve:

```text
same canonical EntityIds
same visual-group evaluation
same renderer style maps
```

Changing Focus projection contents legitimately changes which styled entities are visible, but:

```text
Focus/depth implementation
≠ Visual Group classification
```

Do not couple view-projection to GROUP1.

---

# Documentation

Update source-of-truth docs where the old Focus semantics are described.

Likely:

```text
packages/view-projection/README.md
apps/web/README.md
docs/ARCHITECTURE.md
```

Document clearly:

```text
Outside Focus:
Structural Depth is global across visible documents.

Inside Structure Focus:
File neighborhood is established at document level first.
Automatic depth unfolds only the focused document.
Manual neighbor disclosure remains possible.
```

Also document:

```text
Global double-click = Open Local shortcut
```

Do not create an ADR unless Codex judges this changes a durable architecture contract enough to warrant one. A concise update to the existing KG13 interaction guidance may be sufficient.

---

# Scope

## In scope

- Global File double-click → existing Open Local orchestration;
- Sigma double-click event seam;
- suppress conflicting default double-click zoom;
- source-neutral stable File-level Structure Focus neighborhood;
- root-scoped automatic structural depth during Structure Focus;
- manual neighbor expansion;
- truthful Focus disclosure counts where safe;
- exact reference endpoint precision after hierarchy expansion;
- QUERY1/filter compatibility;
- future multi-focus-friendly seam without implementing multi-focus;
- projection/renderer/web tests;
- browser/release Tauri QA;
- docs;
- prompt archival;
- PR/CI/cleanup.

## Explicitly out of scope

Do not implement:

- multiple simultaneous Focus roots;
- new Focus UI;
- Local semantic redesign;
- Global headings;
- another renderer/layout engine;
- new QUERY1 syntax;
- GROUP1 changes;
- Saved Views;
- manual positions;
- analytics;
- KG14A audit itself.

---

# Suggested implementation sequence

1. Check PR #39 status and sync to the correct latest `main`.
2. Reproduce both reported problems on Synthetic Sample/current release build.
3. Add source-neutral File-neighborhood projection fixtures/oracles.
4. Extract/reuse document-level Focus neighborhood logic from Local where appropriate.
5. Implement root-scoped automatic depth for Structure Focus.
6. Restore truthful Focus manual disclosure/counts if safe.
7. Switch Structure product projection to the new focused-Structure path only when Focus is active.
8. Add Global Sigma double-click callback/event handling.
9. Wire it to the existing GraphExplorer Open Local orchestration.
10. Add focused regression tests.
11. Run projection/renderer/web tests.
12. Run medium projection/performance diagnostics.
13. Run full `pnpm check`.
14. Production browser QA.
15. Release Tauri `.exe` QA using the reported `Associated Value` scenario.
16. Archive this prompt under `history-implementations/`.
17. PR → CI → merge → post-merge CI → cleanup.
18. Stop; KG14A remains next.

---

# Validation commands

Use current repository equivalents.

Expected:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/view-projection typecheck
pnpm exec vitest run packages/view-projection

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:performance -- --profile small
pnpm benchmark:performance -- --profile medium

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Also run:

```text
Global single-click vs double-click QA
Global double-click → Local transition-anchor QA
Focus depth 0/1/2/3 document-set oracle
Focus root-only automatic heading visibility QA
manual neighbor expansion QA
heading-reference endpoint reroute QA
QUERY1 + Focus + depth QA
GROUP1 regression after PR #39 merge
release Tauri Associated Value reproduction/fix QA
physical trackpad regression smoke
```

PR CI and post-merge `main` CI must pass.

---

# Exit gate

PRE-KG14A2 is complete only when:

1. Global single-click remains selection-only.
2. Global document double-click performs Open Local.
3. Global double-click uses the existing Local-entry/history pipeline.
4. Global double-click preserves the clicked File's transition anchor.
5. Global double-click preserves Local Free/Structured preference.
6. Global diagnostic double-click does not enter Local.
7. no conflicting Sigma double-click zoom occurs.
8. Global hover/selection/label behavior remains correct.
9. Global Visual Group styling remains correct after GROUP1B integration.
10. non-Focus Structure depth behavior remains unchanged.
11. Structure Focus neighborhood is derived at document/File granularity.
12. Focus document neighborhood is independent of structural depth.
13. depth 0/1/2/3 have identical document IDs absent intentional filters.
14. depth 1 shows focused document direct headings.
15. depth 1 does not automatically unfold neighbor documents.
16. depth 2/3 unfold only corresponding generations under the focused document.
17. a manual neighbor expansion works.
18. manual neighbor expansion does not alter the File neighborhood.
19. selecting a new depth preset clears old manual disclosure as established by PRE-KG14A.
20. heading limit remains enforced.
21. Blocks semantics remain intact.
22. Focus hops remain intact.
23. Focus direction remains intact.
24. path filters remain intact.
25. reference-status filters remain intact.
26. QUERY1/Saved Filter behavior remains intact.
27. a reference from a newly visible focused heading reroutes to that heading.
28. rerouting a reference does not remove its neighbor File from Focus.
29. Focus disclosure counts are truthful if restored.
30. no speculative Expand action is exposed if it cannot change visibility.
31. section/block Focus roots map to containing document safely if still supported.
32. Local `projectLocalView` semantics do not regress.
33. Global topology/layout semantics do not change from Structure depth.
34. Structure Focus depth causes no Global layout work.
35. no KG10/workspace transaction occurs for depth change.
36. W3 remains latest-result-wins.
37. projection performance remains within the existing product envelope.
38. no new external runtime dependency is added.
39. browser production QA passes.
40. release Tauri QA passes.
41. full test suite passes.
42. desktop release build passes.
43. docs describe the new Focus-depth contract.
44. prompt is archived under `history-implementations/`.
45. PR CI passes.
46. post-merge CI passes.
47. branch/worktree cleanup completes.
48. KG14A is not started automatically.

---

# Final report

## 1. Summary

Confirm both fixes.

## 2. Focus root cause

Explain why disclosure-before-Focus made file reachability depend on heading visibility.

## 3. Final Focus architecture

Show:

```text
File-level Focus neighborhood
→ root-scoped structural detail
→ precise visible reference endpoints
```

## 4. Focus depth semantics

Files-only / 1 / 2 / 3 and manual neighbor expansion.

## 5. Global double-click

Sigma event seam and reuse of Open Local orchestration.

## 6. QUERY1 / GROUP1 compatibility

Confirm no competing semantics.

## 7. Performance

Projection and W3 evidence.

## 8. Tests / QA

Automated, browser, and release `.exe` scenarios.

## 9. Files changed

Important projection / Sigma / GraphExplorer / docs areas.

## 10. Dependencies

Expected additions: zero.

## 11. Future multi-focus seam

State how the implementation could later accept multiple focused detail documents without claiming multi-focus exists.

## 12. Roadmap

Confirm:

```text
KG13 complete
PRE-KG14A cleanup complete
PRE-KG14A2 Focus semantics complete
KG14A next
```

Do not implement KG14A automatically.
