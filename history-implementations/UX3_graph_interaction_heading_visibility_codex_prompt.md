# UX3 — Graph Interaction Semantics + Heading-Level Visibility

## Task type

Focused interaction/graph-view usability pass.

## Starting point

Use the latest `main` of:

`lillo24/icarus-graph-explorer`

At the time this plan was prepared, `main` is:

`1e294200ae55af361ca7e88725a2c599fec2abfb`

This includes:
- KG10;
- UX1 graph-first workspace/maximize/collapsible Inspector;
- UX2 user-facing Inspector.

A separate KG11A worktree may be active in parallel.

Before merge:
1. synchronize/rebase onto the latest `main`;
2. preserve any newer KG11 work;
3. resolve overlapping files deliberately rather than taking one side wholesale.

---

# Goal

Make graph interactions visually distinct and predictable:

```text
HOVER
→ temporary neighborhood emphasis
→ unrelated graph content fades only while the pointer is hovering

CLICK / SELECTION
→ select the node or edge
→ keep a clear selected state
→ do NOT keep the rest of the graph faded

FOCUS
→ intentionally isolate a local graph
→ nodes outside the chosen neighborhood are actually absent
```

Also add a compact way to limit visible Markdown heading levels, especially the user's immediate use case:

> show `#` headings but hide `##`, `###`, etc.

The heading-level control must preserve Graph Explorer's existing collapsed-link roll-up semantics rather than simply hiding rendered nodes after projection.

---

# Current evidence to preserve

## Selection/highlight behavior

Current `packages/renderer-reactflow/src/GraphCanvas.tsx` does:

```ts
applyRendererHighlight(prepared, hovered ?? selection)
```

Therefore:
- hover emphasizes the neighborhood;
- after hover ends, selection becomes the active highlight;
- clicking a node/edge leaves unrelated material faded.

UX3 should separate those concepts.

## Highlight implementation

`packages/renderer-reactflow/src/highlight.ts` already contains the desired neighborhood calculation for:
- hovered node → node + directly connected nodes/edges;
- hovered edge → edge + its two endpoints.

Reuse that logic for hover emphasis.

Do not create a second competing neighborhood algorithm.

## Focus

Focus is already projection-level isolation through the existing view-projection behavior.

Do not reimplement Focus as CSS fading.

## Heading information

Canonical `SectionEntity` already has:

```ts
readonly level: number;
```

So literal Markdown heading levels are already source-neutral canonical data.

## Current structural controls

Current disclosure state supports:

```ts
defaultDepth: 0 | 1
```

where:
- `0` = documents only;
- `1` = documents + direct structural sections.

This is **structural hierarchy depth**, not Markdown heading level.

Do not silently redefine `Top-Level` to mean `#`.

A direct section can legitimately be an `##` if the document starts at level 2.

---

# Scope

UX3 has two linked but separable parts:

1. **Interaction semantics**
   - hover;
   - selection;
   - Focus visual distinction.

2. **Heading-level visibility**
   - compact literal Markdown heading-level limit;
   - correct structural roll-up;
   - navigation/persistence integration.

Do not include performance architecture in this PR.

---

# Part A — Hover vs Click vs Focus

## 1. Hover is the only temporary de-emphasis trigger

Change renderer behavior so `applyRendererHighlight(...)` is driven by hover state only.

Conceptually:

```ts
applyRendererHighlight(prepared, hovered)
```

not:

```ts
applyRendererHighlight(prepared, hovered ?? selection)
```

Expected behavior:

### Hover node

While pointer is over a node:
- hovered node emphasized;
- directly connected graph neighborhood emphasized;
- unrelated nodes/edges de-emphasized.

When pointer leaves:
- all unrelated graph content immediately returns to normal;
- any existing selection remains selected;
- selection does not keep the faded-neighborhood state.

### Hover edge

While pointer is over an edge:
- edge emphasized;
- source and target emphasized;
- unrelated graph content de-emphasized.

On pointer leave:
- temporary emphasis disappears;
- selection styling remains if the edge/node is selected.

---

# 2. Click means selection only

Clicking a node or edge should still:
- set graph selection;
- drive the Inspector;
- permit `Focus Selected`;
- preserve React Flow/accessibility selection state.

But it should **not** globally de-emphasize unrelated graph content.

Selected state should remain visibly identifiable using the existing selected node/edge treatment or a restrained improvement to it.

Requirements:
- selected node is clearly distinguishable without fading the graph;
- selected edge is clearly distinguishable without fading the graph;
- selection remains visible after pointer leaves;
- selecting node A, then node B, moves the selected state normally;
- clicking empty canvas clears selection as today;
- Inspector selection behavior from UX1/UX2 remains unchanged.

Do not make the selected state so visually strong that it looks like Focus.

---

# 3. Keyboard selection follows click semantics

Keyboard/accessibility selection must behave like click selection:

- selected element remains identifiable;
- no persistent global fading;
- temporary neighborhood fading remains pointer-hover behavior only.

Do not regress:
- `elementsSelectable`;
- node/edge focusability;
- existing selection synchronization;
- Inspector navigation.

---

# 4. Focus remains actual isolation

Do not change the core meaning of Focus.

Focus should continue to:
- project a small N-hop reference neighborhood;
- retain the existing hierarchy context;
- remove non-focus graph content from the projection;
- support incoming/outgoing/both;
- support 1/2/3 hops.

The visual distinction should now be clear:

```text
Hover = temporary visual preview
Selection = persistent chosen object
Focus = persistent reduced graph
```

Inside Focus:
- hover still temporarily emphasizes the hovered local neighborhood;
- click still selects without fading the rest of the focused graph;
- changing selection must not change Focus root automatically;
- `Exit Focus` restores the structural graph exactly as existing state rules specify.

Do not alter Focus projection semantics merely to satisfy UI tests.

---

# Part B — Literal Markdown Heading-Level Visibility

## 5. Add a compact heading-level limit

The user needs an easy control for:

```text
# visible
## hidden
### hidden
...
```

Add a compact control such as:

```text
Heading limit: No limit
Heading limit: #
Heading limit: ##
Heading limit: ###
...
```

or another equally compact design.

Preferred UI:
- a single select/dropdown;
- no row of six new buttons;
- no large explanatory paragraph;
- available alongside structural/disclosure controls or inside the compact Filters UI, whichever keeps the graph toolbar cleaner.

Use user-facing wording.
Avoid implementation vocabulary.

A tooltip/help title may explain:

> Limits sections by their Markdown heading level. This is different from “Top-Level”, which means direct structural sections.

Do not make permanent explanatory prose consume graph space.

---

# 6. Heading limit semantics

This must be **literal Markdown heading level**.

Examples:

```markdown
# A
## B
### C
# D
```

With limit `#`:
- document visible;
- `A` visible;
- `D` visible;
- `B`, `C` hidden.

With limit `##`:
- `A`, `B`, `D` visible;
- `C` hidden.

With no limit:
- existing disclosure behavior is unchanged.

Important edge case:

```markdown
## Starts at level two
### Child
```

With limit `#`:
- the document remains visible;
- `Starts at level two` is hidden because it is genuinely level 2.

Do not reinterpret “first section in a document” as H1.

---

# 7. Implement heading limit at structural-disclosure/projection level

Do **not** implement this by:
- CSS `display:none`;
- deleting React Flow nodes after layout;
- renderer-only filtering;
- hiding a node without reconciling its references.

The existing architecture intentionally rolls links from hidden/collapsed structural entities to the nearest visible ancestor.

Heading-level hiding must use that same semantic path.

Preferred model:

Extend `StructuralDisclosureState` with an optional heading-level ceiling, for example:

```ts
readonly maxSectionLevel?: 1 | 2 | 3 | 4 | 5 | 6;
```

Exact naming can follow repository conventions.

Meaning:
- absent = no heading-level ceiling;
- present = a section can only become visible if `section.level <= ceiling`.

Apply the ceiling to visibility regardless of whether a section would otherwise be visible through:
- default structural depth;
- explicit parent expansion.

In other words, if limit is `#`, manually expanding an H1 must **not** reveal its H2 children until the heading limit is widened/removed.

Blocks under heading-hidden sections remain hidden naturally.

---

# 8. Preserve endpoint roll-up and aggregation

This is a critical correctness requirement.

Suppose:

```markdown
# A
## Hidden child
[[Target]]
```

and heading limit is `#`.

The H2 node is hidden, but the authored link must not simply disappear if the existing projection architecture can represent it through the visible ancestor.

It should roll to the nearest visible structural ancestor according to existing KG6 rules.

Likewise:
- multiple hidden lower-heading references may aggregate into one visible edge;
- UX2 Connection Inspector must still explain the underlying exact links;
- provenance/reference IDs remain correct internally.

Add tests specifically proving this.

Do not implement heading limit as a normal post-projection filter if that would drop references instead of rolling them.

---

# 9. Keep structural depth and heading level conceptually separate

The UI currently has:
- `Documents`
- `Top-Level`

Those mean structural disclosure depth.

Do not silently change their behavior.

You may improve labels if it makes the distinction clearer, for example:

```text
Files
Main sections
```

but only if tests/documentation are updated and the semantics remain:

- Files/Documents = documents only by default;
- Main sections/Top-Level = direct structural children of documents.

Heading limit is separate:

```text
Heading limit: #
```

The combination is valid.

Examples:

### Documents + `#`
Still documents only, because structural disclosure has not revealed sections.

### Top-Level + `#`
Shows direct structural sections only when their literal level is 1.

### Expanded graph + `#`
Manual expansions can reveal more H1 structural peers/descendants where structurally valid, but never H2+ while the limit remains `#`.

Avoid an interface where users need to understand this architecture. Keep labels compact and behavior consistent.

---

# 10. Navigation/search must be able to reveal deeper results

Search is supposed to find canonical material even when it is not currently visible.

If the user has:

```text
Heading limit: #
```

and searches/navigates to an H3 section, targeted navigation must not fail merely because the heading ceiling hides it.

Update the existing navigation planner so successful targeted reveal minimally widens the heading ceiling as necessary.

Example:

```text
current limit: #
navigate to H3
→ limit becomes ###
→ necessary ancestors expand
→ target is revealed and centered
```

Do not remove unrelated filters unnecessarily.

If repository conventions support a better minimal reveal strategy, use it, but the result must be:
- target becomes visible;
- navigation remains deterministic;
- no hidden-focus-root/projection error is introduced.

Add focused navigation tests.

---

# 11. Focus and heading limit

Entering Focus on an already visible node must preserve the current heading-limit state.

Focus should operate on the structurally disclosed graph as today.

Do not automatically remove the heading limit simply because Focus starts.

If a navigation action first reveals a deeper node by widening the limit and the user then focuses it, that widened state can be used normally.

---

# 12. Persistence

Heading-level visibility is a user-facing graph view preference, like disclosure/filter/focus state.

If implemented in `StructuralDisclosureState`, integrate it with KG9 persistence.

Requirements:
- saved stable view restores the heading limit;
- old saved views without the new field remain valid and restore as “No limit”;
- transient reports remain transient according to existing rules;
- reset saved view returns to the existing default with no heading limit;
- source evolution reconciliation remains correct.

Follow the existing versioned view-state conventions.

Do not break old localStorage data just to add this optional preference.

If the strict persisted-view schema requires a version/schema adjustment:
- make the smallest backward-compatible change possible;
- document it;
- add migration/compatibility tests as required by repository conventions.

Do not persist hover or selection.

---

# 13. Filters/status counts

If heading limit is part of structural disclosure, do not misrepresent it as a canonical deletion.

Node/edge counts should reflect the current projected visible graph, as they already do.

If Filters UI has an “active filter count,” decide deliberately whether the heading limit belongs in that count:
- if the control lives inside Filters, counting it is reasonable;
- if it lives with Structure, do not falsely count it as a filter.

Keep behavior internally consistent.

---

# Architecture boundaries

## Expected files/packages

Interaction work likely touches:

```text
packages/renderer-reactflow/src/GraphCanvas.tsx
packages/renderer-reactflow/src/highlight.ts
renderer tests
```

Heading-level work may legitimately touch:

```text
packages/view-projection/src/types.ts
packages/view-projection/src/disclosure.ts
packages/view-projection tests

apps/web/src/graph-state.ts
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/GraphFilters.tsx and/or App.css
apps/web/src/navigation.ts
web tests

packages/view-state/*
```

if persistence contract integration requires it.

## Avoid

Do not modify unless genuinely necessary:

```text
parser-markdown
adapter-obsidian
resolver
stable-identity
incremental workspace engine
diagnostic report schema
explorer-inspection
Tauri/source-provider KG11 work
```

Section heading level already exists in canonical core data; do not add another parser-specific representation.

---

# Parallel KG11A constraint

This task may run while KG11A is being implemented in another worktree.

Therefore:
- do not modify direct-vault access/source-provider architecture;
- do not add file watching;
- do not change report loading to solve UX3;
- do not take ownership of Tauri code;
- keep web conflicts narrow;
- rebase/synchronize with latest `main` before final validation.

If KG11A lands and changes app entry/loading components, preserve its behavior and reapply UX3 interactions on top.

---

# Performance constraint

The user also reported that large graphs are slow, but that is **not UX3**.

Do not:
- replace Dagre;
- add workers;
- add Sigma/Pixi/WebGL;
- redesign layout;
- add speculative caches;
- merge KG12 performance work into this PR.

However:
- do not introduce avoidable full graph recomputation on mouse move;
- hover should remain local renderer state;
- heading-limit changes may legitimately reprojection/layout once when the setting changes;
- no reprojection should occur merely because hover changes.

If profiling reveals a new severe regression caused by UX3 itself, fix that regression only.

---

# Explicitly out of scope

- Inspector redesign — UX2 already complete.
- More shell/maximize work — UX1 already complete unless regression fix required.
- Performance/worker hardening.
- Direct vault access/watching.
- Source preview/open in Obsidian.
- Manual node positioning/pinning.
- New graph analytics.
- Semantic relations.
- New renderer.
- Editing Markdown.
- Named/saved graph layouts.
- Hover delay animations unless a usability bug demonstrates the need.

---

# Suggested implementation sequence

1. Synchronize from latest `main`.
2. Read current:
   - `GraphCanvas.tsx`
   - `highlight.ts`
   - renderer tests
   - `GraphExplorer.tsx`
   - `graph-state.ts`
   - `navigation.ts`
   - `GraphFilters.tsx`
   - view-projection disclosure/types/tests
   - view-state persistence/restore validation/tests.
3. Run baseline focused tests / `pnpm check`.
4. Change renderer highlighting so only hover drives neighborhood de-emphasis.
5. Confirm selected node/edge remains visibly selected without global fading.
6. Add/update renderer tests for hover vs selection.
7. Add heading-level ceiling to structural disclosure.
8. Prove hidden lower-heading references roll up correctly.
9. Wire compact UI control.
10. Update graph reducer/actions.
11. Update navigation planner to minimally widen the level ceiling for hidden search targets.
12. Integrate heading limit with persisted view state and backward-compatible restore.
13. Add focused projection/navigation/persistence/UI tests.
14. Browser QA synthetic report.
15. Browser QA real Icarus vault/report if available.
16. QA maximize + Inspector + Focus regression.
17. QA ~390px.
18. Rebase/synchronize latest `main`, especially if KG11A merged.
19. Run full validation.
20. Open PR and merge only after CI.

---

# Required tests

## Renderer — hover

Test at least:

- no hover + no selection → no de-emphasized neighborhood;
- node hover → direct neighborhood highlighted, unrelated material de-emphasized;
- node mouse leave → de-emphasis removed;
- edge hover → edge/endpoints emphasized;
- edge mouse leave → de-emphasis removed.

## Renderer — selection

- click/select node → node selected, unrelated graph not de-emphasized;
- click/select edge → edge selected, unrelated graph not de-emphasized;
- selection survives pointer leave;
- keyboard selection does not cause persistent neighborhood fading;
- pane click clears selection.

Where feasible, test the pure highlight function separately from ReactFlow integration.

## Focus regression

- Focus still removes outside-N-hop content;
- selection inside Focus does not further fade unrelated focused nodes after hover leaves;
- hover works inside Focus;
- Exit Focus restores existing structural state.

## Heading level

Fixture should include at least:

```markdown
# H1 A
## H2 A
### H3 A
# H1 B
```

Verify:
- no limit preserves existing behavior;
- `#` excludes H2/H3;
- `##` includes H1/H2 but excludes H3;
- level is literal, not structural depth.

Also test a document starting at H2:

```markdown
## First heading
### Child
```

With `#`, both sections remain hidden.

## Heading limit + expansion

- explicit expansion cannot reveal a heading deeper than the current ceiling;
- removing/widening ceiling allows it again;
- collapse precedence remains unchanged.

## Roll-up

Create references authored by/targeting hidden H2/H3 sections.

Verify:
- reference does not disappear incorrectly;
- endpoint rolls to nearest visible ancestor according to existing rules;
- multiple hidden references aggregate correctly;
- exact reference provenance remains attached for Inspector.

## Search/navigation

With limit `#`:
- search finds an H3;
- navigating to it widens ceiling minimally to H3;
- expands necessary ancestors;
- target becomes visible;
- target centers/selects normally.

## Persistence

For stable report:
- save `#` heading limit;
- reload/hydrate;
- limit restored;
- old persisted payload without heading-limit field remains valid;
- reset view clears limit to default/no limit.

Do not persist hover/selection.

---

# Browser QA

Use the synthetic report and, if available, the ignored/private Icarus report.

## Normal graph

1. Hover a node.
   - unrelated graph fades.
2. Move pointer away.
   - graph returns fully visible.
3. Click the node.
   - node remains selected;
   - graph does not remain faded.
4. Open Inspector.
   - correct selected item appears.
5. Hover another node without clicking.
   - temporary hover neighborhood appears;
   - selected item remains selected;
   - on leave, full graph returns.
6. Click an edge.
   - edge selected;
   - no persistent background fade.

## Focus

1. Select node.
2. Focus Selected.
3. Verify outside graph content is actually gone.
4. Hover inside focused graph.
5. Click another focused node.
6. Verify focus root/neighborhood does not silently change.
7. Exit Focus.

## Heading limit

Use a note with H1/H2/H3 sections:

1. No limit.
2. Set `#`.
3. Confirm only literal H1 sections remain eligible.
4. Confirm hidden child references appear rolled up where appropriate.
5. Change to `##`.
6. Confirm H2 appears.
7. Remove limit.
8. Confirm previous disclosure/expansion remains coherent.

Search for a hidden H3 while limit is `#`:
- result found;
- navigate;
- target revealed;
- limit widened minimally.

## UX regressions

Verify:
- maximize still works;
- Inspector collapse still works;
- UX2 Inspector still explains aggregated edges;
- Filters still work;
- reset saved view still works;
- stable reload still works.

## Narrow viewport

At ~390px:
- heading limit control is reachable;
- toolbar does not create page-level horizontal overflow;
- Focus controls remain usable;
- Inspector drawer behavior unchanged.

No new console errors/warnings.

---

# Validation

Run:

```bash
pnpm check
git diff --check
```

Run focused tests during implementation as needed.

No new runtime dependency is expected.

---

# Documentation

Keep documentation concise.

Update architecture/package READMEs only where needed to state:

- hover is transient renderer emphasis;
- selection is not neighborhood filtering;
- Focus is projection-level isolation;
- heading-level ceiling is structural disclosure using canonical `SectionEntity.level`;
- hidden-heading references continue through normal endpoint roll-up;
- heading-level preference participates in stable view persistence if implemented in persisted disclosure state.

Do not turn the roadmap into a UX changelog.

If the repo convention still stores completed prompts under `history-implementations/`, add this prompt there as part of the implementation PR.

Do not mark KG11/KG12/KG14 complete.

---

# Exit gate

UX3 is complete only if all are true:

## Interaction

- [ ] Hovering a node temporarily fades unrelated graph content.
- [ ] Hovering an edge temporarily fades unrelated graph content.
- [ ] Mouse leave fully removes temporary de-emphasis.
- [ ] Clicking/selecting a node does not keep unrelated graph content faded.
- [ ] Clicking/selecting an edge does not keep unrelated graph content faded.
- [ ] Selected node remains visibly selected.
- [ ] Selected edge remains visibly selected.
- [ ] Keyboard selection follows selection semantics, not hover semantics.
- [ ] Inspector continues to follow selection.
- [ ] Focus remains real projection-level isolation.
- [ ] Hover works inside Focus.
- [ ] Selection inside Focus does not change the Focus root automatically.
- [ ] Exit Focus behavior is unchanged.

## Heading level

- [ ] Compact heading-level control exists.
- [ ] `#` means literal H1 only.
- [ ] `##`/other supported levels behave literally.
- [ ] A document starting at H2 does not incorrectly show that H2 under `#`.
- [ ] Structural Top-Level/direct-child semantics are not silently redefined.
- [ ] Explicit expansion cannot bypass the heading ceiling.
- [ ] Hidden lower-heading references roll up rather than disappearing incorrectly.
- [ ] Aggregated provenance remains correct.
- [ ] Search can still find hidden deeper headings.
- [ ] Navigating to a deeper result widens the ceiling enough to reveal it.
- [ ] Focus works coherently with the heading ceiling.
- [ ] Stable view persistence restores heading limit.
- [ ] Old persisted views without the field remain valid.
- [ ] Reset saved view returns to no heading limit.

## Boundaries/regressions

- [ ] UX1 maximize behavior unchanged.
- [ ] UX1 Inspector collapse behavior unchanged.
- [ ] UX2 Inspector behavior unchanged.
- [ ] KG10 behavior unchanged.
- [ ] KG11A/source-provider work not absorbed into this PR.
- [ ] No parser/resolver changes needed for heading levels.
- [ ] No performance architecture added.
- [ ] No unnecessary dependency added.
- [ ] Desktop browser QA passes.
- [ ] ~390px QA passes.
- [ ] No new console warnings/errors.
- [ ] `pnpm check` passes.
- [ ] `git diff --check` passes.
- [ ] Branch is synchronized with latest `main` before merge.

---

# Final implementation report

When complete, report:

1. Summary
2. PR + merge commit
3. Files changed
4. Hover behavior
5. Selection behavior
6. Focus regression status
7. Heading-level control and semantics
8. Hidden-heading link roll-up behavior
9. Search/navigation behavior with heading limits
10. Persistence/backward compatibility
11. Responsive behavior
12. Tests
13. Browser QA
14. Dependencies
15. Core/projection/view-state changes
16. Parallel KG11A conflict/rebase notes
17. Deviations from plan
18. PERF1/KG12 handoff

Do **not** begin performance work automatically.
