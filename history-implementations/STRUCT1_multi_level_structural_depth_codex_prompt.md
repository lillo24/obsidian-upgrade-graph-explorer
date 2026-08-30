# STRUCT1 — Multi-Level Structural Depth

**Task type:** KG6 structural-disclosure extension / persisted view-state evolution / graph toolbar semantics / NAV1 integration

## Goal

Extend Icarus Graph Explorer's existing structural disclosure depth from:

```text
Documents
Top-Level
```

to a clearer four-level control:

```text
Structure
- Files only
- 1 level
- 2 levels
- 3 levels
```

while keeping **structural depth** fully independent from the existing literal Markdown heading-level ceiling.

The two controls must remain separate concepts:

```text
1. Structural depth
2. Heading limit
```

Target semantics:

```text
Structural depth
= how many section-tree generations are automatically visible

Heading limit
= the highest literal Markdown heading level allowed to appear
```

Example:

```text
Structure: 3 levels
Heading limit: ##
```

means:

```text
automatically expose up to three structural section-tree generations,
but never display sections whose literal Markdown level is H3–H6.
```

Manual disclosure remains independent:

```text
default structural depth
→ automatic baseline visibility

manual Expand / Collapse
→ explicit user disclosure state

heading limit
→ hard eligibility ceiling
```

Therefore manual expansion may go deeper than the chosen structural depth, but it must never bypass the heading ceiling.

---

# Core mental model

Use structural generations, not Markdown heading numbers.

Given:

```text
File
└─ Section A          ← structural level 1
   └─ Section B       ← structural level 2
      └─ Section C    ← structural level 3
         └─ Section D ← structural level 4
```

the Structure control means:

```text
Files only
→ File

1 level
→ File + A

2 levels
→ File + A + B

3 levels
→ File + A + B + C
```

It does **not** mean:

```text
1 level = only H1
2 levels = through H2
3 levels = through H3
```

That remains the Heading limit's job.

---

# Example proving the distinction

Canonical Markdown structure may legitimately jump heading numbers:

```md
# A
### B
##### C
```

Structurally:

```text
File
└─ A        structural level 1, Markdown H1
   └─ B     structural level 2, Markdown H3
      └─ C  structural level 3, Markdown H5
```

With:

```text
Structure: 3 levels
Heading limit: No limit
```

all three sections should be visible.

With:

```text
Structure: 3 levels
Heading limit: ###
```

A and B may be visible, while C is excluded because H5 exceeds the literal ceiling.

With:

```text
Structure: 1 level
Heading limit: ######
```

only A is automatically visible, despite B/C being permitted by heading level.

This separation is a hard invariant.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

DISC1 merged through PR #29.

At prompt-writing time current `main` is:

```text
140405a91bc7febec06c2e0e6809faa83d898eff
```

Current source-neutral KG6 contract still defines:

```ts
interface StructuralDisclosureState {
  readonly defaultDepth: 0 | 1;
  readonly maxSectionLevel?: SectionHeadingLevel;
  ...
}
```

Current disclosure traversal already computes structural visibility with:

```ts
child.kind === 'section' && depth <= state.defaultDepth
```

where `depth` increments along the canonical hierarchy.

That architecture already represents the correct concept; the contract is simply artificially capped at `0 | 1`.

Current presets are:

```text
documentOnlyProjectionState()
topLevelSectionProjectionState()
```

Current web action type is:

```ts
{ type: 'set-depth'; depth: 0 | 1 }
```

Current toolbar is:

```text
Structure
[Documents] [Top-Level]
```

Current heading filter is independently stored as:

```text
disclosure.maxSectionLevel
```

and exposed in Filters as:

```text
Heading Depth
No limit / # / ## / ### / ...
```

Its hidden description currently explains that `Top-Level` means direct structural sections.

Current persisted KG9 view schema v1 also narrows:

```ts
defaultDepth: 0 | 1
```

and validation rejects anything except 0 or 1.

Current NAV1 already treats:

```text
set-depth
```

as a history-producing semantic graph action and compares `defaultDepth` directly in history checkpoint equality.

Current DISC1 actionable disclosure counts are computed from the same structural traversal and must remain truthful after depths 2 and 3 are introduced.

---

# Required first step

Before editing:

1. sync/rebase onto the actual latest `main`;
2. inspect whether any work landed after DISC1;
3. read:
   - `AGENTS.md`;
   - `packages/view-projection/README.md`;
   - `packages/view-projection/src/types.ts`;
   - `packages/view-projection/src/disclosure.ts`;
   - `packages/view-projection/src/presets.ts`;
   - `packages/view-projection/src/reveal.ts`;
   - `packages/view-projection/src/disclosure.test.ts`;
   - `packages/view-projection/src/projection.test.ts`;
   - `packages/view-state/README.md`;
   - `packages/view-state/src/types.ts`;
   - `packages/view-state/src/validation.ts`;
   - `packages/view-state/src/persist.ts`;
   - `packages/view-state/src/restore.ts`;
   - `packages/view-state/src/index.test.ts`;
   - `apps/web/src/graph-state.ts`;
   - `apps/web/src/graph-state.test.ts`;
   - `apps/web/src/navigation-history.ts`;
   - `apps/web/src/navigation-history.test.ts`;
   - `apps/web/src/components/GraphExplorer.tsx`;
   - `apps/web/src/components/GraphFilters.tsx`;
   - relevant GraphExplorer/browser tests;
   - current KG12 performance/benchmark fixtures;
4. preserve:
   - DISC1 actionable disclosure counts;
   - NAV1 Back/Forward history;
   - UX4B toolbar/filter containment;
   - UX4C node/focus grammar;
   - KG9 saved-view compatibility;
   - KG12 worker/performance architecture;
5. run the current sample before editing and record the current Documents/Top-Level behavior.

Do not restore stale assumptions if latest `main` has moved code.

---

# Part 1 — Introduce one shared Structural Depth type

Avoid duplicating unions such as:

```text
0 | 1 | 2 | 3
```

across KG6, view-state, and web code.

Prefer a source-neutral exported type from `view-projection`, e.g.:

```ts
export type StructuralDepth = 0 | 1 | 2 | 3;
```

or:

```ts
export type StructuralDisclosureDepth = 0 | 1 | 2 | 3;
```

Then:

```ts
interface StructuralDisclosureState {
  readonly defaultDepth: StructuralDepth;
}
```

Use the shared type in:

- web `set-depth` action;
- persisted view-state type;
- relevant helper signatures/tests.

Choose one clear name and use it consistently.

Do not turn it into a generic unbounded `number`.

The current product range is deliberately:

```text
0
1
2
3
```

---

# Why cap at 3 for now

This milestone should expose exactly:

```text
Files only
1 level
2 levels
3 levels
```

Do not add:

```text
4
5
6
Unlimited
```

to Structure in this PR.

The literal heading ceiling already supports H1–H6 and is a different axis.

A future product decision can widen structural depth if useful.

---

# Part 2 — Structural disclosure semantics

Generalize current depth logic without changing its meaning.

Current core condition:

```ts
child.kind === 'section' && depth <= state.defaultDepth
```

should naturally support 2 and 3.

Required:

```text
defaultDepth 0
→ documents only automatically

defaultDepth 1
→ direct document sections automatically

defaultDepth 2
→ direct sections + their structural section children

defaultDepth 3
→ three section-tree generations automatically
```

Do not derive structural depth from:

```text
SectionEntity.level
number of # characters
source line indentation
path
```

Use canonical parent/child hierarchy.

---

# Blocks are NOT a structural-depth generation

Preserve the existing conservative Block policy.

Even at:

```text
Structure: 3 levels
Blocks enabled
```

Blocks must not automatically appear merely because their parent lies within the default structural depth.

Current invariant remains:

```text
Block visibility
requires:
  includeBlocks = true
  AND
  visible parent explicitly expanded
```

Structural default depth auto-reveals Sections only.

Do not count a Block as another structural depth layer.

Do not reinterpret:

```text
defaultDepth 3
```

as “three arbitrary canonical child hops including Blocks”.

---

# Part 3 — Heading limit remains independent

The Heading limit stays in Filters and remains a hard literal Markdown ceiling.

Do not move it into the Structure control.

Do not merge the controls.

Do not derive one value from the other.

The projection order remains conceptually:

```text
structural hierarchy depth eligibility
AND
literal heading-level eligibility
AND
manual disclosure state
```

---

# Required cross-product examples

## Structure 3 + No heading limit

Hierarchy:

```text
H1 A
└─ H3 B
   └─ H5 C
```

Expected:

```text
A
B
C
```

because all are within three structural generations.

## Structure 3 + Heading limit ###

Expected:

```text
A
B
```

C is H5 and therefore excluded.

## Structure 1 + Heading limit ######

Expected:

```text
A
```

B/C are allowed by literal heading level but not automatically disclosed by structural depth.

## Structure 0 + Heading limit No limit

Expected:

```text
Files only
```

The heading ceiling does not automatically reveal sections.

---

# Part 4 — Manual Expand beyond default depth

Manual expansion must continue to work below the automatic depth.

Example:

```text
Structure: 1 level

File
└─ A             visible automatically
   └─ B          hidden
      └─ C       hidden
```

Expand A:

```text
B becomes visible
```

Expand B:

```text
C becomes visible
```

This works even though:

```text
defaultDepth = 1
```

Do not clamp manual disclosure to the default depth.

---

# Heading limit still constrains manual expansion

Example:

```text
Structure: 1 level
Heading limit: ##
```

Canonical:

```text
A = H1
B = H3
```

Expanding A must **not** reveal B.

Manual expansion never bypasses:

```text
maxSectionLevel
```

Preserve current UX3 behavior.

---

# Part 5 — Manual Collapse overrides automatic depth

Existing collapse precedence must remain.

Example:

```text
Structure: 3 levels

File
└─ A
   └─ B
      └─ C
```

All are auto-visible.

Collapse A:

```text
A remains visible
B and C disappear
```

because:

```text
collapsed > default depth
```

Changing default depth must not clear the collapse state.

---

# Preserve explicit disclosure state when depth changes

Changing:

```text
Files only → 3 levels
3 levels → 1 level
1 level → 2 levels
```

should update only:

```text
disclosure.defaultDepth
```

Do not automatically wipe:

```text
expandedEntityIds
collapsedEntityIds
```

This allows explicit user intent to survive baseline-depth changes.

Examples:

### Preserved collapse

```text
Structure 3
collapse A
switch Structure 1
switch Structure 3

A remains collapsed
```

### Preserved deep expansion

```text
Structure 1
manually expand A and B
switch Structure 0
```

Existing explicit expansion state may continue to expose eligible descendants according to current disclosure semantics.

Do not silently normalize it away merely because baseline depth changed.

---

# Part 6 — DISC1 actionable disclosure counts

DISC1 is now part of the stable semantics.

Depth 2/3 must integrate with:

```ts
revealableDescendantCount
```

without regression.

The disclosure count continues to mean:

```text
› N
= N descendants this one Expand action can reveal now

⌄ N
= N visible descendants this Collapse action hides now
```

not total hidden subtree size.

---

# Actionable-count examples under deeper Structure

Canonical:

```text
File
└─ A
   └─ B
      └─ C
         └─ D
```

## Structure: Files only

Expected:

```text
File › 1
```

## Structure: 1 level

A is auto-visible.

Expected around the first hidden boundary:

```text
A › 1
```

## Structure: 2 levels

A and B auto-visible.

Expected:

```text
B › 1
```

## Structure: 3 levels

A/B/C auto-visible.

Expected:

```text
C › 1
```

Do not keep stale reveal counts on higher ancestors for descendants already auto-visible.

---

# Depth change + preserved expansion count

If explicit descendant expansion means changing baseline depth reveals more than the simple baseline alone, DISC1 should continue to calculate the actual one-action delta correctly.

Do not replace DISC1's indexed revealability algorithm with a simpler count just because defaultDepth widened.

---

# Blocks + depth + DISC1

Example:

```text
Structure: 3 levels
Blocks disabled
```

A Block-only visible parent must still have:

```text
revealableDescendantCount = 0
```

and no disclosure control.

With Blocks enabled, explicit expansion may expose those Blocks and the count must be truthful.

Do not reintroduce the `Nested › 3 → ⌄ 0` bug.

---

# Focus + DISC1

DISC1 intentionally suppresses speculative Expand counts while Focus is active because endpoint roll-up makes exact prediction non-local.

Preserve that deliberate behavior.

STRUCT1 does not attempt to solve speculative Focus disclosure.

Focus Collapse counts remain exact.

---

# Part 7 — UI: replace Documents / Top-Level

Current:

```text
Structure
[Documents] [Top-Level]
```

becomes:

```text
Structure
[Files only] [1 level] [2 levels] [3 levels]
```

Use the exact semantic values:

```text
Files only → 0
1 level    → 1
2 levels   → 2
3 levels   → 3
```

Use `aria-pressed` exactly as current buttons do.

Do not use the Markdown `# / ## / ###` notation here.

That notation belongs exclusively to Heading limit.

---

# Why "Files only"

Use:

```text
Files only
```

rather than:

```text
Documents
```

for the structure baseline.

This makes the depth sequence read naturally:

```text
Files only
1 level
2 levels
3 levels
```

and avoids the previous ambiguous pair:

```text
Documents / Top-Level
```

Internal entity kind remains:

```text
document
```

No canonical rename is required.

---

# Remove "Top-Level" from user-facing structural depth UI

After STRUCT1 there should be no active graph-control label:

```text
Top-Level
```

for structural depth.

Internal helper names such as:

```text
topLevelSectionProjectionState()
```

may remain if they are still useful public/test compatibility APIs.

Do not churn stable package APIs solely to remove the phrase from internal code.

But user-facing helper copy should use the new model.

---

# Part 8 — Rename visible Heading "Depth" wording to "Heading limit"

Because Structure now genuinely has multiple depth levels, the current Filters label:

```text
Heading Depth
```

becomes unnecessarily confusing.

Rename the visible control to:

```text
Heading limit
```

with options unchanged:

```text
No limit
#
##
###
####
#####
######
```

This is a terminology clarification only.

Do not change:

```text
maxSectionLevel
SectionHeadingLevel
filter active-count behavior
persistence
```

---

# Update heading explanatory copy

Current hidden text says approximately:

```text
Limits sections by Markdown heading level.
Top-Level instead means direct structural sections.
```

Replace it with something like:

```text
Limits sections by literal Markdown heading level.
Structure separately controls how many section-tree levels are automatically visible.
```

Keep the explanation concise and accessible.

Do not add permanent helper paragraphs to the visible Filters panel.

---

# Part 9 — Responsive toolbar

Four Structure buttons consume more width than two.

Preserve UX4B containment principles.

Required at:

```text
390
600
768
1000
1440
```

- no horizontal page scroll;
- no graph workspace expansion;
- toolbar may wrap;
- button labels remain readable;
- controls remain touch-sized;
- maximized Tools remains contained.

Do not turn Structure into a horizontal scroller.

Do not redesign the whole toolbar.

If four buttons are too wide at 390px, allow the existing control group to wrap cleanly.

Do not abbreviate to cryptic:

```text
0 / 1 / 2 / 3
```

as the primary visible labels.

---

# Part 10 — Web graph-state contract

Generalize:

```ts
{ type: 'set-depth'; depth: 0 | 1 }
```

to the shared structural-depth type.

Example:

```ts
{ type: 'set-depth'; depth: StructuralDepth }
```

Reducer semantics remain:

```ts
disclosure: {
  ...state.disclosure,
  defaultDepth: action.depth
}
```

No new reducer action is needed.

No new state dimension is needed.

---

# No-op semantics

Existing NAV1 commit logic compares resulting view state.

Therefore:

```text
click current active Structure depth
→ reducer produces semantically same state
→ no history checkpoint
```

Preserve this.

Do not special-case the UI with a second history mechanism.

---

# Part 11 — NAV1 history

NAV1 already treats:

```text
set-depth
```

as `record`.

Depth 2 and 3 should participate automatically once the type is generalized.

Required sequence:

```text
Files only
→ 1 level
→ 2 levels
→ 3 levels
```

then:

```text
Back → 2 levels
Back → 1 level
Forward → 2 levels
```

A new graph action after Back still clears Forward per NAV1.

Do not modify the overall navigation-history architecture.

---

# History checkpoint equality

Current history compares:

```text
leftDisclosure.defaultDepth === rightDisclosure.defaultDepth
```

That should already support 2/3.

Do not add special string labels or duplicate structure state to history.

Checkpoint truth remains the numeric renderer-independent value.

---

# Viewport behavior on depth changes

Changing structural depth changes projection/layout, but currently `set-depth` is a normal history graph action rather than an explicit Fit action.

Preserve current policy unless actual QA demonstrates a regression.

Do not automatically Fit every Structure change merely because more nodes appear.

NAV1 should restore the semantic viewport checkpoint as designed.

Do not introduce a new viewport policy in STRUCT1 without evidence.

---

# Part 12 — KG9 persistence

Persist:

```text
defaultDepth 2
defaultDepth 3
```

under the existing saved-view contract.

Preferred:

```text
schemaVersion remains 1
```

because this is a widening of an existing enum-like field and old `0/1` records remain valid for the new reader.

No data migration is needed.

No local-storage key change.

No app-local identity changes.

---

# Persisted type should use the shared depth type

Current `PersistedProjectionState` duplicates:

```ts
defaultDepth: 0 | 1;
```

Replace it with the shared type if dependency boundaries permit:

```ts
defaultDepth: StructuralDepth;
```

`view-state` already imports view-projection types, so this follows current package direction.

Avoid duplicated unions.

---

# Persisted validation

Current validation:

```text
Expected 0 or 1.
```

must accept exactly:

```text
0
1
2
3
```

and reject:

```text
-1
4
5
1.5
"2"
null
```

Use an explicit supported-values check or shared predicate if appropriate.

Do not accept any nonnegative number.

---

# Backward compatibility

Old persisted schema-v1 records with:

```text
defaultDepth: 0
```

or:

```text
defaultDepth: 1
```

must hydrate exactly as before.

New records with:

```text
2
3
```

must round-trip deterministically.

No schema bump.

No migration warning.

---

# Reset behavior

Current Reset saved view returns to `documentOnlyProjectionState()`.

Preserve semantic reset:

```text
Files only
```

Update user-facing announcement from:

```text
documents-only
```

to the new terminology, e.g.:

```text
Saved view reset to Files only; search and selection were cleared.
```

NAV1 reset behavior remains:

```text
history cleared
```

---

# Part 13 — Presets API

Current:

```ts
documentOnlyProjectionState()
topLevelSectionProjectionState()
```

still represent valid states.

Do not remove them if tests/tools/public imports rely on them.

Optionally add a generic helper such as:

```ts
structuralDepthProjectionState(depth: StructuralDepth)
```

if it reduces duplication cleanly.

Then existing presets can delegate:

```text
documentOnly → depth 0
topLevelSection → depth 1
```

But this is optional.

Do not turn STRUCT1 into a preset-API cleanup.

---

# Part 14 — Navigation/reveal behavior

`revealEntityInViewState()` currently opens the target's ancestor chain and minimally widens the heading limit.

It should preserve:

```text
state.disclosure.defaultDepth
```

whether that is 0, 1, 2, or 3.

Search/Inspector navigation to a hidden deep entity may still add explicit expanded ancestor IDs.

Do not silently change the user's chosen Structure depth just because navigation reveals a target.

---

# Search navigation example

Current:

```text
Structure: 1 level
search result = structural level 4 section
```

Navigate:

```text
→ explicit ancestor expansion reveals target
→ Structure remains 1 level
```

Back through NAV1:

```text
→ returns to pre-navigation disclosure state
```

Do not widen:

```text
defaultDepth 1 → 3
```

as an implementation shortcut.

---

# Part 15 — Focus behavior

Focus remains KG6 reference-neighborhood slicing over the structurally visible base graph.

Changing structural depth can change what entities are structurally available to Focus, as expected.

Do not change:

- Focus hop count;
- direction;
- root semantics;
- hierarchy context;
- focus appearance;
- direct double-click Focus.

If a Focus root becomes structurally unavailable because the user reduces depth, preserve current projection/reconciliation behavior and existing issue handling.

Do not invent special root auto-expansion for this milestone.

---

# Part 16 — Structural-depth tests

Expand the neutral KG6 fixture if needed so it has at least three structural section generations.

Existing fixture already includes a chain similar to:

```text
doc-a
└─ a-overview
   └─ a-detail
      └─ a-deep
```

with intentionally nonconsecutive literal heading levels:

```text
a-overview → H1
a-detail   → H3
a-deep     → H5
```

This is an excellent regression fixture because it proves structural depth is not literal heading level.

---

# Required KG6 depth tests

## Depth 0

Expected:

```text
documents only
```

## Depth 1

Expected:

```text
documents + direct structural sections
```

## Depth 2

Expected to include:

```text
a-overview
a-detail
```

but not:

```text
a-deep
```

assuming no explicit expansion.

## Depth 3

Expected to include:

```text
a-overview
a-detail
a-deep
```

despite their literal levels being:

```text
H1
H3
H5
```

when no heading ceiling is active.

This is the central semantic proof.

---

# Heading-limit cross-product tests

Using the H1 → H3 → H5 fixture:

## depth 3 + maxSectionLevel 3

Expected:

```text
H1
H3
```

not H5.

## depth 3 + maxSectionLevel 1

Expected:

```text
H1 only
```

## depth 1 + maxSectionLevel 6

Expected:

```text
H1 only
```

because structural depth is still one generation.

---

# Manual expansion tests

At:

```text
defaultDepth = 1
```

explicitly expand H1 parent:

```text
H3 child appears
```

if heading ceiling allows it.

Then expand H3:

```text
H5 appears
```

if allowed.

This verifies manual expansion beyond default depth.

---

# Manual collapse tests

At:

```text
defaultDepth = 3
```

collapse the level-1 structural section.

Expected:

```text
level-1 section remains
level-2 and level-3 descendants disappear
```

Collapse precedence remains.

---

# Blocks tests

At:

```text
defaultDepth = 3
includeBlocks = true
```

a Block under an automatically visible Section does **not** appear unless its parent is explicitly expanded.

This must be tested explicitly because extending depth could accidentally cause generic child traversal to auto-show Blocks.

---

# DISC1 tests under depth 2/3

Add direct tests for actionable counts as baseline depth moves.

Example chain:

```text
File → A → B → C → D
```

Verify:

```text
depth 0
→ File revealable count targets A

depth 1
→ first hidden boundary is below A

depth 2
→ first hidden boundary is below B

depth 3
→ first hidden boundary is below C
```

Use exact expected values based on current DISC1 one-action semantics.

Do not assert total hidden subtree size.

---

# Preserved disclosure state tests

Test:

```text
depth 3
collapse A
depth 1
depth 3
```

A's collapse ID remains and descendants remain hidden.

Also test preserved expansion below baseline where appropriate.

---

# Part 17 — View-state tests

Add persisted round trips:

```text
defaultDepth 0
defaultDepth 1
defaultDepth 2
defaultDepth 3
```

At least 2 and 3 must be explicitly new regressions.

Verify:

- serialization deterministic;
- restore preserves exact depth;
- live reconciliation preserves exact depth;
- older schema-v1 depth 0/1 payloads remain valid;
- invalid depth 4 is rejected.

---

# No schema evolution noise

Do not introduce restore issues such as:

```text
structural-depth-upgraded
```

There is nothing to migrate.

`0/1` remain valid values.

---

# Part 18 — Web reducer tests

Update tests for:

```text
set-depth 0
set-depth 1
set-depth 2
set-depth 3
```

Verify only `defaultDepth` changes.

Explicit expanded/collapsed IDs remain untouched.

Filters/Focus remain untouched.

---

# Part 19 — NAV1 tests

Extend navigation-history integration with at least:

```text
0 → 1 → 2 → 3
Back → 2
Back → 1
Forward → 2
```

Also:

```text
currently at 2
click/set 2 again
→ no checkpoint
→ Forward not cleared
```

Do not create separate history action kinds for each depth.

---

# Part 20 — UI tests

Verify:

1. `Documents` structural button is gone.
2. `Top-Level` structural button is gone.
3. Structure contains:
   - Files only
   - 1 level
   - 2 levels
   - 3 levels
4. each button maps to the correct numeric depth;
5. `aria-pressed` follows active state;
6. current depth 2/3 restores correctly from persistence;
7. current depth 2/3 restores correctly through NAV1;
8. heading control remains in Filters;
9. visible heading label says `Heading limit`;
10. heading options remain unchanged;
11. structural depth does not contribute to Filters active-count badge;
12. heading limit still does.

---

# Part 21 — Browser QA

Use synthetic/sample graph with at least three nested section generations.

## Structure control

Exercise:

```text
Files only
1 level
2 levels
3 levels
```

Observe monotonically deeper automatic section visibility.

Do not use a sample where Markdown heading number happens to equal structural generation for every node; also verify a jump-level chain.

---

# Browser QA — distinction from heading limit

Test:

```text
Structure: 3 levels
Heading limit: No limit
```

then:

```text
Heading limit: ###
```

then:

```text
Heading limit: #
```

Confirm Structure selection remains 3 levels while literal heading eligibility narrows.

Then:

```text
Heading limit: No limit
Structure: 1 level
```

Confirm only one structural generation is automatic.

---

# Browser QA — manual disclosure

At Structure 1:

- expand deeper node;
- verify level 2 appears;
- expand again;
- verify level 3 appears.

At Structure 3:

- collapse level-1 node;
- verify descendants hide;
- change depth;
- return to 3;
- verify explicit collapse persists.

---

# Browser QA — DISC1

At every Structure setting, inspect a few boundary nodes.

Positive:

```text
› N
```

must still correspond to the one action's actual reveal delta.

No `› 0`.

No `⌄ 0`.

Blocks-disabled regression remains fixed.

---

# Browser QA — NAV1

Sequence:

```text
Files only
1 level
2 levels
3 levels
Back
Back
Forward
```

Verify the selected Structure button follows history.

Also combine:

```text
Structure 2
Heading limit ##
Structure 3
Back
```

and verify the two independent dimensions restore correctly.

---

# Browser QA — Search

At Structure 1, navigate via Search to a deep section.

Verify:

- target can be revealed;
- Structure still shows 1 level;
- Back restores previous graph;
- no automatic depth widening occurred.

---

# Responsive browser QA

At:

```text
390
600
768
1000
1440
```

verify:

- four Structure buttons fit/wrap cleanly;
- no page-level horizontal scroll;
- Filters still overlays correctly;
- Inspector drawer unchanged;
- maximized Tools contains controls;
- graph canvas dimensions remain stable when opening controls.

---

# Desktop/live QA

Using synthetic/disposable vault:

1. select Structure 3;
2. confirm nested sections;
3. save/restart/reopen where current test harness supports persisted UI state;
4. confirm depth 3 restored;
5. edit nested headings while live watcher is active;
6. stable structure updates without resetting depth;
7. Back/Forward through depth changes;
8. no crash when a previously visible nested section disappears.

Interactive native Tauri QA is desirable but may be reported as deferred if only compile/test suites are available.

Do not use private vault content in committed test artifacts.

---

# Part 22 — Performance posture

Depth 3 may legitimately project more nodes.

That is product behavior, not a regression by itself.

Preserve:

- KG12 projection instrumentation;
- Dagre worker latest-wins behavior;
- DISC1 indexed revealability calculation.

Do not add:

- duplicate projection passes per depth button;
- synchronous layout;
- DOM-measured geometry;
- per-node hypothetical projection.

Run existing Class B projection/layout benchmarks.

If practical, include one depth-3 projection in synthetic performance coverage, but do not create a new performance framework or arbitrary new budget.

---

# Performance expectation

Changing Structure is a semantic graph action, so:

```text
projection
layout
```

are expected when visible graph content changes.

Opening the toolbar/Filters remains nonsemantic and should not project.

NAV1 history bookkeeping remains small.

---

# Part 23 — Documentation

Update `packages/view-projection/README.md`.

Replace old wording:

```text
defaultDepth: 0 shows documents
defaultDepth: 1 also shows direct sections
```

with:

```text
defaultDepth 0 → files/documents only
defaultDepth 1 → one structural section generation
defaultDepth 2 → two
defaultDepth 3 → three
```

Explicitly state:

```text
structural depth counts canonical section-tree generations,
not Markdown heading numbers
```

and:

```text
Blocks are never auto-revealed by default depth.
```

Keep DISC1 actionable-count documentation intact.

---

# View-state docs

Update view-state README to state schema-v1 now accepts:

```text
defaultDepth 0–3
```

and remains backward-compatible with existing 0/1 records.

No schema bump.

---

# Web docs

Update relevant web/component README maps for:

```text
Structure: Files only / 1 / 2 / 3 levels
Heading limit remains separate in Filters
NAV1 records structure changes
```

Do not over-document visual implementation details.

---

# No new dependencies

Expected external additions:

```text
zero
```

---

# No canonical/source changes

Do not modify:

- Markdown parser;
- Obsidian adapter;
- Block parser/resolver semantics;
- stable identity;
- snapshot delta;
- workspace engine;
- source watcher;
- canonical section levels;
- reference resolution;
- renderer layout algorithm.

This is a view-state/disclosure/UI extension.

---

# No renderer semantics change

React Flow should receive the resulting projection exactly as before.

No renderer change should be needed specifically to understand structural depth.

DISC1 counts already arrive as projection metadata.

Do not teach KG7 what `defaultDepth` means.

---

# Likely files

Use actual latest structure, but likely:

```text
packages/view-projection/src/types.ts
packages/view-projection/src/disclosure.ts
packages/view-projection/src/presets.ts
packages/view-projection/src/disclosure.test.ts
packages/view-projection/src/projection.test.ts
packages/view-projection/README.md

packages/view-state/src/types.ts
packages/view-state/src/validation.ts
packages/view-state/src/index.test.ts
packages/view-state/README.md

apps/web/src/graph-state.ts
apps/web/src/graph-state.test.ts
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/GraphFilters.tsx
apps/web/src/components/*tests*
apps/web/src/navigation-history.test.ts
apps/web/README.md
apps/web/src/components/README.md

App.css only if responsive wrapping needs a narrow fix
```

`navigation-history.ts` itself may require no production change.

---

# Scope

## In scope

- introduce shared Structural Depth type;
- extend `defaultDepth` to 0/1/2/3;
- KG6 structural visibility through three generations;
- keep Blocks excluded from automatic depth;
- keep Heading limit independent;
- manual expansion beyond baseline;
- manual collapse precedence;
- preserve expansion/collapse IDs across depth changes;
- DISC1 actionable-count compatibility;
- Structure UI rename;
- Files only / 1 level / 2 levels / 3 levels;
- remove user-facing Top-Level;
- rename visible Heading Depth → Heading limit;
- update accessible explanatory copy;
- KG9 schema-v1 validation widening;
- persistence/restore 2/3;
- old 0/1 compatibility;
- NAV1 depth history;
- Search/reveal preserves selected depth;
- responsive QA;
- performance sanity;
- docs/tests/PR/CI.

## Explicitly out of scope

Do not implement:

- structural level 4+;
- unlimited structural depth;
- merging Structure and Heading limit;
- changing Markdown heading semantics;
- changing canonical section hierarchy;
- auto-showing Blocks by depth;
- Focus speculative Expand counts;
- saved query language;
- visual groups;
- folder clustering;
- layout-spacing controls;
- generic tree-depth analytics UI;
- new renderer.

Do not begin QUERY1 automatically.

---

# Suggested implementation sequence

1. Sync latest `main`.
2. Add shared Structural Depth type.
3. Generalize KG6 `defaultDepth`.
4. Add depth-2/depth-3 pure disclosure tests using jump-level headings.
5. Add heading-limit cross-product tests.
6. Add manual expand/collapse regression tests.
7. Add Blocks-not-auto-revealed regression.
8. Add DISC1 actionable-count depth regressions.
9. Widen persisted type + validation to 0–3.
10. Add old/new schema-v1 round-trip tests.
11. Generalize web `set-depth` action.
12. Replace toolbar with Files only / 1 / 2 / 3 levels.
13. Rename Heading Depth → Heading limit and update hidden explanation.
14. Update Reset announcement terminology.
15. Extend reducer/UI/NAV1 tests.
16. Search/reveal depth-preservation test.
17. Browser semantic QA.
18. Responsive QA.
19. Desktop/live smoke.
20. KG12 benchmark sanity.
21. Docs.
22. Archive prompt according to repository convention.
23. PR → CI → merge → post-merge CI → cleanup.

---

# Validation commands

Use repository-equivalent commands.

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/view-projection typecheck
pnpm exec vitest run packages/view-projection

pnpm --filter @icarus-graph-explorer/view-state typecheck
pnpm exec vitest run packages/view-state

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

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

Run current KG12/performance benchmarks required by latest `main`.

Responsive browser widths:

```text
390
600
768
1000
1440
```

PR CI and post-merge `main` CI must pass.

---

# Exit gate

STRUCT1 is complete only when:

1. A single shared source-neutral structural-depth type exists.
2. Supported values are exactly 0, 1, 2, and 3.
3. `defaultDepth` no longer narrows to only 0/1.
4. Depth 0 shows files/documents only automatically.
5. Depth 1 shows one structural section generation.
6. Depth 2 shows two structural section generations.
7. Depth 3 shows three structural section generations.
8. Structural depth follows canonical parent/child hierarchy.
9. Structural depth does not derive from Markdown heading number.
10. H1 → H3 → H5 can all appear at Structure 3 with no heading ceiling.
11. Heading limit independently excludes literal heading levels above the ceiling.
12. Structure 3 + Heading limit ### excludes H5 despite structural eligibility.
13. Structure 1 + Heading limit ###### still shows only one automatic generation.
14. Heading limit does not auto-reveal sections when Structure is Files only.
15. Manual expansion can reveal deeper structural generations than the baseline.
16. Manual expansion cannot bypass Heading limit.
17. Manual collapse overrides default structural depth.
18. Changing Structure preserves explicit expanded IDs.
19. Changing Structure preserves explicit collapsed IDs.
20. Blocks are never automatically revealed solely by default depth.
21. Blocks still require includeBlocks + explicit parent expansion.
22. DISC1 `› N` semantics remain one-action reveal delta.
23. DISC1 `⌄ N` semantics remain current visible collapse delta.
24. Depth 2/3 do not reintroduce stale/total-subtree counts.
25. No `› 0` or `⌄ 0` regression.
26. DISC1 Block-disabled `Nested` regression remains fixed.
27. Focus speculative Expand counts remain deliberately suppressed.
28. Web Structure UI contains Files only / 1 level / 2 levels / 3 levels.
29. User-facing Documents structural button is removed.
30. User-facing Top-Level structural button is removed.
31. `aria-pressed` accurately reflects depths 0–3.
32. Four-button Structure group remains responsive.
33. No new horizontal overflow at supported widths.
34. Visible Filters label uses `Heading limit`.
35. Heading options remain No limit / # through ######.
36. Structural depth remains outside the Filters active-count badge.
37. Heading limit still participates in Filters active count.
38. `set-depth` accepts the shared 0–3 type.
39. `set-depth` changes only defaultDepth.
40. NAV1 records depth 2/3 changes.
41. NAV1 Back/Forward restores exact depths.
42. Re-selecting the current depth creates no history checkpoint.
43. New action after Back still clears Forward normally.
44. Search/Inspector deep navigation preserves chosen structural depth.
45. Reveal logic does not widen defaultDepth as a shortcut.
46. Reset returns to Files only.
47. Reset announcement uses current terminology.
48. KG9 persists depth 2.
49. KG9 persists depth 3.
50. KG9 restores depth 2/3 exactly.
51. Existing depth 0/1 schema-v1 records remain valid.
52. Invalid persisted depth -1 is rejected.
53. Invalid persisted depth 4 is rejected.
54. Noninteger/string depth values are rejected.
55. Persisted schema remains version 1.
56. No migration/local-storage key change is introduced.
57. Same-workspace live reconciliation preserves depths 0–3.
58. Source/workspace identity behavior remains unchanged.
59. React Flow does not learn structural-depth semantics.
60. No canonical/parser/resolver changes occur.
61. Existing fixed node geometry remains.
62. Existing Dagre-worker architecture remains.
63. Structure changes use normal projection/layout path only.
64. No duplicate projection pass is added merely for the new buttons.
65. Current KG12 benchmarks remain within existing gates.
66. No external dependency is added.
67. View-projection docs explain structural generations vs heading levels.
68. View-state docs explain schema-v1 0–3 compatibility.
69. Web docs reflect new controls.
70. Full focused tests pass.
71. Full `pnpm check` passes.
72. Production build passes.
73. Desktop check passes.
74. Browser semantic QA passes.
75. Responsive QA passes.
76. PR CI passes.
77. Post-merge main CI passes.
78. Branch/worktree cleanup follows repository convention.
79. QUERY1 is not started.
80. GROUP1/LAYOUT1 are not started.

---

# Final report

Report:

## 1. Summary

What STRUCT1 changed and merged PR/commit.

## 2. Structural-depth contract

State the final type and exact semantics of:

```text
0 / 1 / 2 / 3
```

## 3. Structure vs Heading limit

Demonstrate with a jump-level synthetic hierarchy that they remain independent.

## 4. Manual disclosure

Explain expansion beyond baseline and collapse precedence.

## 5. Blocks

Confirm Blocks are not auto-shown by Structure depth.

## 6. DISC1 interaction

Report actionable disclosure count behavior at depth 0/1/2/3 and confirm the prior Block regression remains fixed.

## 7. UI

Report:

```text
Files only
1 level
2 levels
3 levels
```

and Heading limit terminology.

## 8. NAV1

Report depth-history sequence and no-op behavior.

## 9. Persistence

Confirm schema-v1 0/1 backward compatibility and 2/3 round trips.

## 10. Search / reveal

Confirm target navigation preserves the selected structural depth.

## 11. Focus

Confirm no Focus semantic changes and speculative Expand suppression remains.

## 12. Responsive/browser QA

Report tested widths and semantic combinations.

## 13. Desktop/live QA

What was actually run.

## 14. Performance

Report projection/layout benchmarks and whether depth 3 materially changed sample graph size/timing.

## 15. Accessibility

Structure group labeling, pressed states, Heading limit description.

## 16. Dependencies / schema

Expected:

```text
zero dependency changes
schemaVersion remains 1
```

## 17. Tests / validation

Commands, test counts, CI.

## 18. Files changed

Important KG6/view-state/web/tests/docs files.

## 19. Deviations / warnings

Any responsive compromise, persisted-schema concern, or surprising deep-tree behavior.

## 20. Next handoff

After STRUCT1, resume the larger planned sequence:

```text
QUERY1 — Graph Query Language + Saved Filters
GROUP1 — Visual Groups + Color Rules
LAYOUT1 — Spatial Clustering + Layout Controls
```

Do not implement QUERY1 automatically.
