# UX4C — Focus Interaction + Compact Node Visual Grammar

**Task type:** graph interaction semantics / renderer presentation / focus styling sandbox / node-information reduction

## Goal

Make the graph itself communicate more through interaction and visual grammar, and less through permanent diagnostic text inside every node.

UX4C should accomplish two related changes:

1. **Focus becomes a direct graph interaction**
   - single click selects;
   - double-click a canonical entity enters/re-targets Focus;
   - keyboard users have an equivalent graph-scoped activation;
   - the permanent `Focus Selected` button disappears;
   - the focused root remains visually identifiable.

2. **Entity nodes become substantially quieter**
   - remove permanent `FILE / HEADING / BLOCK` text;
   - remove permanent `Focus distance N` text;
   - remove permanent full source paths;
   - show location/context only when needed to disambiguate visually identical labels;
   - reduce expansion chrome;
   - preserve compact evidence that would otherwise disappear completely, such as collapsed internal-reference information;
   - let Document / Section / Block / Diagnostic differ primarily through shape, border treatment, size, and other visual grammar.

Target ordinary entity nodes should trend toward:

```text
┌────────────────────┐
│ Note               │
│                 ›  │
└────────────────────┘
```

instead of:

```text
FILE     Focus distance 0
Note
folder-a/Note.md
↺ 3 internal           + 4
```

A collision may legitimately add minimal context:

```text
┌────────────────────┐
│ Note               │
│ folder-a        ›  │
└────────────────────┘
```

and a repeated heading may show:

```text
╭──────────────────╮
│ Details          │
│ Note · line 84   │
╰──────────────────╯
```

Full source evidence remains available in Inspector / technical details / accessible labels and may be exposed through a lightweight hover/title affordance. The node itself should not read like a debugging card.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

UX4B merged through PR #25 at:

`96a71f8a5f5cb98c32b777da6097136f49bf740f`

At prompt-writing time, `main` is:

`957de30f8f60e077228568f4e8541f37a7324205`

whose parent is the UX4B merge; later commits may contain concurrent prompt/performance work. Always inspect current `main` rather than assuming UX4B is the literal tip.

Current renderer entity cards still render:

```text
typeLabel
focusDistance
title
detail
internal-reference badge
disclosure button
```

from `packages/renderer-reactflow/src/nodes.tsx`.

Current renderer data still includes:

```ts
entityKind: 'document' | 'section' | 'block'
typeLabel: 'File' | 'Heading' | 'Block'
title
detail
sourcePath
sourceStartLine
role: 'content' | 'context'
focusDistance: number | null
hasHiddenChildren
hiddenDescendantCount
visibleDescendantCount
isExpanded
internalReferenceCount
ariaLabel
```

Current mapping creates:

```text
Document: 224 × 112
Section:  200 × 96
Block:    168 × 80
```

and uses:

```text
Document detail → complete source path
Section detail  → source path + line
Block detail    → line
```

Current styling already gives useful entity-kind grammar:

```text
Document
→ rectangular card
→ stronger top border
→ blue/teal treatment

Section
→ more rounded/lozenge card
→ stronger left border
→ violet treatment

Block
→ smaller
→ dashed border
→ ochre treatment

Diagnostic
→ separate symbols / status-specific border patterns
```

Current `Focus distance N` is rendered visibly from `focusDistance`.

Current selection is already distinct:

```text
selected node
→ dark border
→ gold outer ring
```

Current hover emphasis is independent of selection:

```text
hovered neighborhood stays emphasized
unrelated nodes/edges fade transiently
```

Current Focus is projection-level isolation owned by KG6.

Current `GraphCanvas`:

```text
onNodeClick → selection
zoomOnDoubleClick={false}
```

and has no node double-click focus callback yet.

Current `GraphExplorer` has:

```text
Focus Selected
```

when not focused, and:

```text
Exit Focus
Hops
Direction
```

when Focus is active.

Current `graph-state.ts` already supports:

```ts
{ type: 'enter-focus'; entityId }
{ type: 'exit-focus' }
```

and entering a different root preserves existing Focus hops/direction when possible.

Current graph preferences persist only:

```text
trackpadZoomMode
```

under:

```text
icarus.graph-explorer.preferences.v1
```

Current renderer README explicitly treats:

- Focus semantics as KG6/application-owned;
- renderer presentation as renderer-owned;
- fixed node geometry as renderer-owned;
- React Flow IDs/layout as renderer-only;
- optional KG12 performance instrumentation as behavior-neutral.

UX4C must preserve those boundaries.

---

# Required first step

Before editing:

1. sync/rebase onto the actual current `main`;
2. inspect whether KG11B2, KG12, PERF, or other UX work has merged concurrently;
3. preserve all current performance instrumentation and live-update/view-state behavior;
4. read:
   - `AGENTS.md`;
   - `apps/web/src/components/GraphExplorer.tsx`;
   - `apps/web/src/components/GraphSettings.tsx`;
   - `apps/web/src/graph-state.ts`;
   - `apps/web/src/preferences/graph-preferences.ts`;
   - relevant web tests;
   - `packages/renderer-reactflow/README.md`;
   - `packages/renderer-reactflow/src/GraphCanvas.tsx`;
   - `packages/renderer-reactflow/src/nodes.tsx`;
   - `packages/renderer-reactflow/src/mapping.ts`;
   - `packages/renderer-reactflow/src/types.ts`;
   - `packages/renderer-reactflow/src/styles.css`;
   - `packages/renderer-reactflow/src/highlight.ts`;
   - renderer mapping/interaction/layout tests;
   - current `view-projection` focus contracts;
5. run the current sample visually before changing nodes;
6. preserve UX4A/UX4B edge-to-edge, floating Filters, and Inspector drawer behavior;
7. follow repository PR/CI/cleanup conventions.

If current code has changed materially, preserve the latest architecture and implement the user-facing intent rather than restoring assumptions from this prompt.

---

# Core UX grammar

After UX4C:

```text
single click canonical entity
→ select it

double-click canonical entity
→ Focus on it / re-target Focus to it

keyboard selected canonical entity + Enter
→ Focus on it

Exit Focus
→ explicit current Focus exit

double-click diagnostic target
→ no Focus

double-click edge
→ no Focus

double-click disclosure control
→ disclosure only, never Focus
```

And visually:

```text
selection
≠
focus root
≠
focus distance
≠
entity kind
```

Each should have a distinct visual role.

---

# Part 1 — Remove `Focus Selected`

Delete the permanent:

```text
Focus Selected
```

button from the graph toolbar.

When Focus is inactive, do not render an otherwise-empty Focus control group merely to say that no Focus is active.

When Focus is active, keep:

```text
Exit Focus
Hops
Direction
```

for now.

NAV1 will later add Back/Forward history and can make Focus exit/navigation even more natural.

Do not remove `Exit Focus` in UX4C; users still need an explicit visible way out before NAV1 exists.

Do not change:

```text
hops
direction
hierarchyContext
KG6 traversal semantics
```

---

# Part 2 — Double-click canonical entity to Focus

Add a narrow renderer interaction callback.

A good API direction:

```ts
GraphCanvasProps {
  ...
  onFocusEntity?: (entityId: string) => void
}
```

Exact naming may differ.

`GraphCanvas` should translate renderer interaction:

```text
React Flow entity node
→ canonical entityId already present in EntityNodeData
→ callback
```

It must not own Focus projection state.

Application/web layer still owns:

```text
dispatch({ type: 'enter-focus', entityId })
fit request
announcement
persistence
```

Do not make `renderer-reactflow` import:

```text
core
graph-state
view-state
App
```

for Focus semantics.

---

# Double-click behavior

Use React Flow's node double-click interaction.

Current:

```text
zoomOnDoubleClick={false}
```

already prevents the default viewport double-click zoom conflict.

Expected:

```text
onNodeDoubleClick
→ if node.kind/entity data is canonical entity
→ request Focus
```

Diagnostic projection nodes must be ignored.

Do not focus an ambiguous/unresolved synthetic target.

Do not infer an entity from an edge.

---

# Selection + double-click

Double-clicking a canonical entity should leave that entity selected.

Normal browser click sequencing may already select it via `onNodeClick` before `onNodeDoubleClick`.

Still test the final invariant explicitly:

```text
double-click entity A
→ A is the Focus root
→ A remains selected
→ Inspector can still inspect A if open
```

Do not clear selection merely because Focus entered.

If Focus projection rebuild causes the selected projected node ID to remain stable, preserve it normally.

---

# Re-targeting Focus

Double-clicking another canonical entity while already focused should re-target Focus.

Example:

```text
Focus root A
→ double-click visible B
→ root becomes B
```

Preserve current:

```text
hops
direction
```

according to the existing `enter-focus` reducer behavior.

Do not force the settings back to 1 hop / Both on every re-target.

Fit/recenter behavior should follow the same current application policy as the old `Focus Selected` action.

---

# Disclosure must not trigger Focus

The node disclosure control is a nested interactive element.

Ensure:

```text
double-click disclosure chevron/button
→ does not bubble into node Focus activation
```

The current disclosure click/keydown handlers already stop propagation for their own interactions; add explicit double-click protection if the actual event stack requires it.

Test:

```text
click disclosure
double-click disclosure
keyboard disclosure
```

independently from Focus.

---

# Part 3 — Keyboard-equivalent Focus activation

Double-click alone is not an accessible complete interaction.

Provide a graph-scoped keyboard equivalent without reintroducing a permanent `Focus Selected` button.

Preferred behavior:

```text
canonical node selected/focused in GraphCanvas
+ Enter
→ Focus selected canonical entity
```

Requirements:

- only while keyboard interaction is inside the graph canvas;
- selected edge → no Focus;
- diagnostic selected → no Focus;
- editable/control targets do not trigger Focus;
- disclosure button Enter remains disclosure, not Focus;
- ignore repeated keydown;
- prevent conflicting React Flow/default activation only when Focus is actually handled.

If current React Flow keyboard behavior makes `Enter` unsafe or ambiguous, `F` is an acceptable fallback, but prefer `Enter` if it can be implemented cleanly.

Do not add a global `window` shortcut that fires while Search/Settings/Inspector inputs are active.

Document the final keyboard behavior in the accessible node instructions.

---

# Focus discoverability

Removing the button reduces visual discoverability.

Do not compensate by adding another permanent helper paragraph.

Use low-cost discoverability:

- node/browser `title` can include a concise `Double-click to focus` hint;
- accessible graph instructions can mention Enter;
- a selected node Inspector may mention Focus only if there is already an appropriate compact action/hint surface.

Do not create a tutorial system in UX4C.

---

# Part 4 — Focus root must remain visually identifiable

Today the Focus root is mostly inferred because the graph becomes isolated.

Add explicit root styling whenever:

```text
focusDistance === 0
```

for a canonical entity node.

This is renderer presentation.

Do not pass a second application-owned `focusRootEntityId` if `focusDistance === 0` already unambiguously identifies the root in the projection.

A reasonable node class/data contract:

```text
entity-card--focus-root
data-focus-distance="0"
```

or equivalent.

---

# Focus root ≠ selected node

The two states must remain visually separable.

Example:

```text
Focus root A
→ select B

A still visibly appears as Focus root
B gets selection treatment
```

If A is both Focus root and selected, both states should still be legible.

Current selection treatment is a gold outer ring.

Do not redefine selection merely to make Focus styling easier.

A useful layering rule is:

```text
selection
→ outer gold ring

focus root
→ card/border/fill/title treatment

hover
→ transient neighborhood emphasis

focus depth
→ subtle distance treatment
```

This makes states composable.

---

# Part 5 — Focus appearance sandbox

The user explicitly wants to compare multiple focus-root visual treatments before choosing one permanent style.

Implement exactly three temporary/sandbox options:

```text
Outline
Inverted
Minimal
```

Default:

```text
Outline
```

Expose them in Settings under a small section such as:

```text
Graph Appearance
  Focus appearance
    Outline
    Inverted
    Minimal
```

Do not build a generic theme engine.

Do not add arbitrary color pickers.

This setting exists to compare product alternatives.

A later cleanup may collapse the preference to one chosen default.

---

# Focus style A — Outline

Intent:

```text
strong but not dominant
```

Use a visibly stronger focus-root boundary than ordinary entity-kind borders.

Possible grammar:

```text
extra outline / doubled boundary / stronger inset edge
```

It must not look identical to the current gold selection ring.

Avoid relying only on a hue change.

A thicker/different boundary geometry is useful.

This is the default candidate.

---

# Focus style B — Inverted

Intent:

```text
clearly exceptional root
```

Invert the card's foreground/background relationship enough that the root is unmistakable.

Example direction:

```text
dark card fill
light title/text
contrasting border
```

Preserve entity-kind shape.

Disclosure/internal-ref controls on the Focus root must remain readable.

Selection gold ring must still remain visible if the inverted root is selected.

Do not invert diagnostic nodes.

---

# Focus style C — Minimal

Intent:

```text
quiet persistent root marker
```

Keep the normal card mostly intact.

Use a subtle non-color-only cue such as:

```text
small focus marker / target glyph / corner marker
+
title accent
```

or a modest local border treatment.

Do not rely solely on changing title color.

This option should genuinely be visually lighter than Outline.

---

# Preference storage

Focus appearance is a UI preference, not KG9 workspace view state.

Extend current graph preferences rather than putting this in:

```text
ViewProjectionState
PersistedWorkspaceView
KnowledgeSnapshot
```

Suggested:

```ts
type FocusAppearance = 'outline' | 'inverted' | 'minimal'

interface GraphPreferences {
  trackpadZoomMode: TrackpadZoomMode
  focusAppearance: FocusAppearance
}
```

The renderer package may own/export the presentation type if that preserves the current ownership direction cleanly.

The existing preference key can remain:

```text
icarus.graph-explorer.preferences.v1
```

if the loader is made backward-compatible.

Old stored preferences that contain only:

```text
trackpadZoomMode
```

must load with:

```text
focusAppearance = 'outline'
```

Invalid focus appearance should safely fall back.

Do not bump the preferences storage version merely because an optional/defaulted field is added.

Preserve current storage-failure warnings.

---

# Settings updates

`GraphSettings` currently owns the Trackpad Zoom preference UI.

Add:

```text
Graph Appearance
```

without mixing it into Source/Developer settings.

A useful ordering:

```text
Source / Developer content injected by App

Graph Appearance
  Focus appearance

Graph Interaction
  Trackpad Zoom
```

If the latest merged UI has a better section order, use it.

The focus-style radios should make switching immediate.

Do not reproject/re-layout the graph when changing Focus appearance.

It is a renderer presentation-only preference.

---

# Focus appearance renderer boundary

Pass the preference to `GraphCanvas` as renderer presentation state.

A clean direction:

```ts
GraphCanvasProps {
  ...
  focusAppearance: FocusAppearance
}
```

Then expose one root-level attribute/class:

```text
.graph-canvas[data-focus-appearance="outline"]
```

or equivalent.

Do not rebuild mapped node data solely because the appearance preference changes if CSS can handle it.

Do not add Focus appearance to `ViewProjection`.

---

# Part 6 — Remove visible entity-kind labels

Current entity card topline renders:

```text
FILE
HEADING
BLOCK
```

Remove these visible words.

The canonical kind remains available through:

- card shape;
- border treatment;
- size;
- accessible label;
- Inspector.

Do not remove the kind from accessibility text.

Do not remove `entityKind` from renderer data.

`typeLabel` may remain as an accessibility/mapping helper or be renamed if cleaner; it simply should not consume permanent card space.

---

# Strengthen entity-kind visual grammar only as needed

Current styling already gives meaningful visual differences.

Preserve and refine rather than redesign from scratch.

Target grammar:

## Document

```text
most rectangular
strong top edge/accent
largest entity node
```

## Section

```text
more rounded / lozenge
distinct side-edge grammar
slightly smaller
```

## Block

```text
smallest
dashed / visibly different boundary
```

## Diagnostic

```text
status symbol/pattern
clearly exceptional
```

Kind must remain distinguishable without reading a `FILE` label and without depending only on color.

Do not add icons to every entity unless visual QA proves shape/border is insufficient.

---

# Part 7 — Remove visible `Focus distance N`

Delete the permanent textual:

```text
Focus distance 0
Focus distance 1
...
```

from entity cards.

Retain `focusDistance` in renderer data because it is useful for visual treatment and accessibility/testing.

Do not put Focus distance labels onto graph edges.

Edge color/style already communicates relationship semantics:

```text
hierarchy
resolved
unresolved
ambiguous
invalid
```

Do not overload that visual channel.

---

# Subtle Focus-hop depth treatment

Use Focus distance only as a subtle secondary visual cue.

Recommended:

```text
distance 0
→ focus-root style

distance 1
→ normal/full strength

distance 2
→ mildly subdued

distance 3
→ somewhat more subdued
```

Keep a strong readability floor.

Do not make distance 3 resemble disabled/hidden content.

Suggested lower bound:

```text
roughly >= 0.75–0.8 visual opacity/intensity
```

rather than fading toward invisibility.

Exact values should be visually tuned.

---

# Focus depth precedence

Current hover system already applies:

```text
is-deemphasized
→ strong transient fade of unrelated content
```

Do not fight that.

Recommended precedence:

1. selected/highlighted node remains clearly readable;
2. focus-root style remains identifiable;
3. normal focus-distance attenuation applies;
4. transient hover de-emphasis may become stronger while hovering.

A selected node at distance 3 should not remain heavily faded.

A directly hover-highlighted node at distance 3 should return to strong visibility.

Use CSS selectors/classes rather than React state churn if possible.

---

# Context-role interaction

Focus projection also distinguishes:

```text
role = content
role = context
```

and context nodes are already visually subdued.

Avoid accidental double-fading where:

```text
context + distance 3
→ nearly invisible
```

Tune context/focus-depth composition deliberately.

The minimum-readability rule applies to combinations too.

Do not alter KG6 content/context role semantics.

---

# Part 8 — Remove permanent full path/detail lines

Current nodes permanently show:

```text
Document:
folder-a/Note.md

Section:
folder-a/Note.md · line 84
```

This is too much repetitive filesystem information for the normal graph.

Default entity node should show:

```text
semantic title only
```

when that title is visually unambiguous in the current projection.

Full source path remains available in:

- Inspector;
- technical details;
- canonical search;
- `sourcePath` renderer data;
- accessible description;
- a lightweight hover/native-title hint if implemented.

Do not delete source-location information from the data model.

---

# Part 9 — Collision-aware compact disambiguation

If two visible nodes would otherwise have the same human-readable label, add the **minimum context needed to distinguish them**.

This is a renderer display concern.

Do not change canonical entity names/paths.

Do not permanently show context on unique labels.

---

# Document disambiguation

Default:

```text
folder-a/Unique.md
→
Unique
```

Collision:

```text
folder-a/Note.md
folder-b/Note.md
```

renders approximately:

```text
Note
folder-a

Note
folder-b
```

If immediate parent names also collide:

```text
alpha/models/Note.md
beta/models/Note.md
```

use the shortest unique parent-path suffix:

```text
Note
alpha/models

Note
beta/models
```

Do not fall back to the complete path unless that is genuinely the shortest unique suffix.

For a root document versus nested one:

```text
Note.md
folder/Note.md
```

use an explicit compact root marker if needed:

```text
root
folder
```

or another deterministic readable equivalent.

---

# Disambiguation algorithm performance

Do not compare every visible node against every other node.

Medium/large graphs can contain thousands of projected entities.

Build collision/group indexes using Maps/Sets.

Target approximately:

```text
O(n log n)
or better
```

for visible-label preparation.

Do not add a quadratic shortest-suffix scan across the whole projection.

Small duplicate groups may be locally compared after grouping.

---

# Section disambiguation

Default unique heading:

```text
Details
```

with no permanent path/line.

If visible headings share the same displayed title across different documents:

```text
Details
Note

Details
Other
```

If documents themselves need disambiguation, reuse the compact document disambiguator.

If the same heading title repeats within one source document, include line only when needed:

```text
Details
Note · line 84

Details
Note · line 142
```

Do not show line numbers on every section by default.

---

# Empty/untitled sections

Preserve the existing human-readable fallback:

```text
Untitled section
```

If multiple untitled sections collide, apply the same minimal document/line disambiguation.

Do not surface raw empty heading syntax.

---

# Block display

Schema v1 does not expose useful Obsidian block-label text to the renderer.

Do not fake semantic block names.

Prefer a compact presentation such as:

```text
Line 84
Note
```

or:

```text
Note · line 84
```

inside the visually distinct Block shape.

The word:

```text
BLOCK
```

does not need to remain visible because the shape/border carries type.

Full path remains Inspector/accessibility evidence.

---

# Tooltip / native title behavior

Do not introduce a tooltip dependency.

A lightweight native `title` is acceptable to reveal complete location on hover.

For example:

```text
Note
folder-a/Note.md
Double-click to focus
```

as concise title text.

Do not place huge technical metadata into the native tooltip.

Inspector remains the proper detailed evidence surface.

---

# Accessible labels after simplification

Visual simplification must not make nodes semantically vague to assistive technology.

Keep accessible labels rich enough to distinguish:

```text
entity kind
title
source location
disclosure state/count
focus-root state where appropriate
```

Do not require a screen-reader user to infer kind from border shape.

The visible node and accessible label do not need identical verbosity.

---

# Part 10 — Compact the entity-card structure

Current entity card has:

```text
topline
title
detail
footer
```

After UX4C, normal entity cards should use only the rows that contain useful information.

A good component structure is conceptually:

```text
article
  title
  optional disambiguator
  optional compact footer
```

Do not reserve an empty topline after removing File/Focus-distance text.

Do not render an empty detail row for unique entities.

Do not render an empty footer if a node has neither:

- disclosure;
- internal collapsed-reference cue.

---

# Part 11 — Preserve internal collapsed-reference evidence compactly

Current renderer deliberately does not create self-loop edges for references whose projected endpoints collapse into the same visible entity.

The current:

```text
↺ N internal
```

badge is therefore the **only visible graph cue** for those internal collapsed references.

Do not simply delete it without replacement.

Reduce it to a compact cue such as:

```text
↺ 3
```

with:

```text
title / aria-label:
3 references collapse within this node
```

or an equally compact representation.

The Inspector continues to expose detailed provenance.

Do not put the word `internal` permanently into every card.

---

# Part 12 — Reduce disclosure chrome

Current disclosure is a pill:

```text
+ 4
```

or:

```text
− 4
```

with significant visual weight.

Replace it with a quieter disclosure control.

Preferred grammar:

```text
collapsed:
› 4

expanded:
⌄ 4
```

or an equivalent chevron/caret.

Requirements:

- still clearly interactive;
- only rendered on nodes that can disclose/have disclosed children;
- visually smaller than the node title;
- count may remain because it communicates hidden/visible descendants compactly;
- full state/count remains in accessible label;
- minimum touch target remains usable even if visual glyph is small;
- keyboard behavior remains correct;
- nested control does not trigger node double-click Focus.

Do not make expansion hover-only if that would make the control undiscoverable or inaccessible.

A visually subdued persistent chevron is preferable.

---

# Disclosure count semantics

Preserve current semantics:

```text
collapsed
→ hiddenDescendantCount

expanded
→ visibleDescendantCount
```

Do not recalculate a different metric merely for visual cleanup.

Do not remove disclosure count from aria if the visible count is later reduced.

---

# Part 13 — Compact fixed node geometry

Removing two permanent text rows should reduce node footprint.

Keep **fixed deterministic per-kind dimensions**.

Do not switch to runtime DOM measurement/dynamic Dagre geometry in UX4C.

Tune `ENTITY_NODE_DIMENSIONS` to materially more compact values.

Suggested design ranges, not hard-coded requirements:

```text
Document:
  width ~192–208
  height ~72–84

Section:
  width ~176–192
  height ~64–76

Block:
  width ~144–160
  height ~56–68
```

Codex should choose exact dimensions after rendering:

- a unique document;
- duplicate document with disambiguator;
- long title;
- expanded node with disclosure count;
- internal-reference badge;
- focus root in each appearance variant.

Do not make nodes so small that optional collision context overlaps the footer.

Update renderer layout tests/snapshots/README with final fixed dimensions.

---

# Layout scope

Smaller node dimensions will naturally alter Dagre coordinates.

That is expected.

Do **not** additionally change:

```text
rank spacing
node spacing
Dagre weights
layout algorithm
orientation
cluster behavior
```

Those belong to LAYOUT1/PERF work.

This milestone changes node geometry because the node content itself became smaller.

---

# Part 14 — Diagnostic nodes remain diagnostic

Do not apply the entity-card simplification mechanically to diagnostic targets.

Diagnostic nodes need visible:

```text
status
raw target
candidate/reason/reference evidence
```

because their purpose is to surface exceptional unresolved/ambiguous/invalid state.

Minor visual consistency adjustments are acceptable if necessary for new dimensions/styles, but do not remove the information that makes diagnostics understandable.

Diagnostic nodes:

- are selectable;
- remain non-focusable as Focus roots;
- remain excluded from semantic viewport anchors according to KG9B;
- retain current status-specific non-color cues.

---

# Part 15 — Focus root styling must not change layout

Switching:

```text
Outline
↔ Inverted
↔ Minimal
```

must not alter node dimensions or Dagre layout.

Use:

```text
border/outline/box-shadow/background/pseudo-element/text treatment
```

without changing measured width/height.

If a marker is added, position it inside existing node bounds or via pseudo-element.

Do not add a new row to the card for:

```text
Focused
```

or similar text.

---

# Part 16 — Focus appearance preference is not graph history

Do not put focus-style changes into future NAV1 Back/Forward history.

This is a UI preference.

Likewise it should not alter KG9 per-workspace state.

Persist globally through current graph-preferences storage only.

---

# Part 17 — Focus mode toolbar after removing entry button

When not focused:

```text
Structure
Filters
Workspace controls
```

No disabled/empty Focus Selected button.

When focused:

```text
Focus
  Exit Focus
  Hops
  Direction
```

If current responsive toolbar ordering is different after UX4B, preserve its clean grammar.

Do not add a permanent:

```text
Double-click a node to focus
```

toolbar label.

---

# Part 18 — Focus announcements

Reuse the current application announcement path.

Double-click/keyboard Focus should announce approximately:

```text
Focused <kind> in <path>.
```

just as old `Focus Selected` did.

Re-target should announce the new root.

Exit Focus retains its current announcement.

Do not expose the absolute platform vault root; sourcePath is workspace-relative.

---

# Part 19 — Fit / viewport behavior

The old `enterFocus()` currently:

```text
dispatches focus
increments fitRequestKey
```

Preserve that product behavior for double-click/keyboard Focus unless current KG12/UX work has replaced it intentionally.

Do not add a competing center request.

Double-click Focus should not also trigger React Flow double-click zoom.

Exit Focus remains current fit behavior.

Changing Focus appearance must not fit/recenter.

Changing only selection must not fit/recenter.

---

# Part 20 — Live source update compatibility

KG11 live updates can replace the stable snapshot while preserving current Focus when stable identity survives.

UX4C must not break that.

Required:

```text
focused root stable ID survives edit
→ Focus remains
→ root style remains on reconciled root

focused root disappears/new identity
→ current reconciliation clears Focus safely
→ no stale root visual class

selected root survives
→ selection remains when possible
```

Do not key focus appearance off stale local component state.

Use current projection data.

---

# Part 21 — Hover / selection / focus visual precedence tests

Test combinations:

```text
focus root only
selected only
focus root + selected
distance-2 selected
distance-3 hovered
context + distance-3
focus root hovered
```

Ensure:

- selection remains obvious;
- focus root remains obvious;
- hover behavior remains transient;
- distance attenuation never makes selected/highlighted nodes hard to read;
- context nodes remain understandable.

Do not change highlight graph-neighborhood semantics.

---

# Part 22 — Mapping/disambiguation ownership

Human display disambiguation belongs in the renderer mapping/presentation layer, not KG6.

Do not add:

```text
displayFolder
shortPath
collisionLabel
```

to canonical entities or ViewProjection solely for UX4C.

Renderer already has:

```text
sourcePath
title
sourceStartLine
entityKind
```

which is enough to derive display labels for the current visible projection.

Keep full canonical/source facts untouched.

---

# Suggested pure display helpers

Prefer isolated/testable helpers around mapping, conceptually:

```text
documentDisplayName(path)
shortestUniqueParentSuffix(...)
buildEntityDisplayLabels(projectedNodes)
```

Exact names may differ.

Keep the node component dumb:

```text
render prepared display title/detail
```

Do not put collision scanning inside every React node render.

---

# Mapping determinism

Given identical `ViewProjection`, mapping must generate identical display text and React Flow scene.

Sort duplicate groups deterministically.

Do not depend on original object insertion order where grouping ambiguity exists.

Keep renderer mapping JSON/test determinism.

---

# Preference loader compatibility tests

Add tests for:

```text
no stored preferences
→ scroll-zoom + Outline

old v1:
{ trackpadZoomMode: ... }
→ same trackpad mode + Outline

new:
{ trackpadZoomMode, focusAppearance: 'inverted' }
→ exact values

invalid focusAppearance
→ safe default

storage failure
→ existing warning behavior
```

Do not silently break an existing user's trackpad preference.

---

# GraphCanvas interaction tests

Cover:

1. single entity click → selection only;
2. double-click document → Focus callback with correct entity ID;
3. double-click section → Focus callback;
4. double-click block → Focus callback if visible;
5. double-click diagnostic → no Focus;
6. double-click edge → no Focus;
7. `zoomOnDoubleClick` remains false;
8. disclosure click → disclosure only;
9. disclosure double-click → no Focus;
10. keyboard Enter on selected canonical entity → Focus callback;
11. keyboard Enter on selected diagnostic/edge → no Focus;
12. keyboard Enter on nested disclosure control → disclosure behavior only;
13. editable/control target does not trigger Focus;
14. repeat keydown ignored;
15. selection remains after pointer Focus activation.

Use public React Flow/test seams rather than DOM hacks where possible.

---

# GraphExplorer Focus tests

Cover:

1. `Focus Selected` button no longer renders;
2. inactive Focus group does not consume toolbar chrome;
3. pointer Focus request dispatches existing `enter-focus`;
4. keyboard Focus request uses same path;
5. entering Focus still triggers current fit behavior;
6. active Focus still renders Exit/Hops/Direction;
7. re-targeting Focus preserves hops/direction;
8. Exit Focus unchanged;
9. live snapshot reconciliation preserves root when stable ID survives;
10. missing root clears safely;
11. persistence still stores Focus state under KG9 rules.

Do not create a second Focus state outside `ViewProjectionState`.

---

# Renderer mapping tests

Cover:

## Type-label removal

- visible node data/card no longer requires File/Heading/Block text to identify type visually;
- aria still includes type.

## Unique document

```text
folder/Unique.md
→ title Unique
→ no visible detail
```

## Duplicate document

```text
folder-a/Note.md
folder-b/Note.md
→ compact parent disambiguators
```

## Repeated parent-name collision

```text
alpha/models/Note.md
beta/models/Note.md
→ shortest unique suffixes
```

## Section unique

No path/line detail.

## Section cross-document collision

Minimal document context.

## Repeated section in one document

Line added only where needed.

## Block

Compact useful line/document presentation.

## Determinism

Input order does not change final display labels.

## Scale

Synthetic thousands-node mapping does not introduce quadratic collision work.

A focused benchmark/micro-test may be used if current performance instrumentation makes this straightforward, but do not create a new performance framework.

---

# Node component tests

Cover:

1. no visible type-label text;
2. no visible `Focus distance`;
3. optional detail omitted when empty;
4. compact collision detail shown when provided;
5. focus-root class/data marker;
6. distance data/class marker;
7. compact internal-ref cue;
8. compact disclosure chevron/caret;
9. disclosure accessible label still includes state/count;
10. focus-root appearance never renders an extra text row;
11. diagnostic cards preserve status evidence.

---

# Browser visual QA — sample

This is a visual milestone, so manual browser QA is mandatory.

Use the synthetic sample and inspect:

## Structure mode

- unique Document;
- Section;
- Block enabled;
- diagnostic target;
- expanded/collapsed entity;
- internal-reference badge where available.

Confirm:

- FILE/HEADING/BLOCK text gone;
- full paths gone unless needed as short collision context;
- node geometry materially more compact;
- entity kinds remain visually obvious;
- disclosure affordance remains discoverable.

## Focus interaction

1. single-click a node;
2. confirm selection but no Focus;
3. double-click it;
4. confirm Focus;
5. change Hops;
6. double-click another visible entity;
7. confirm re-target with same Hops/Direction;
8. Exit Focus.

## Focus visuals

Switch Settings among:

```text
Outline
Inverted
Minimal
```

while Focus remains active.

Confirm no layout movement.

Inspect:

- root only;
- root + selection;
- selecting a different node;
- hover neighborhood;
- distance 2/3 nodes;
- context nodes.

---

# Browser QA — duplicate labels

Create/use a synthetic fixture/report with at least:

```text
folder-a/Note.md
folder-b/Note.md
alpha/models/Common.md
beta/models/Common.md

repeated heading titles
repeated heading within same document
```

Confirm:

- unique documents show no folder;
- duplicates show only shortest needed folder suffix;
- sections show document/line only when needed;
- full path remains Inspector evidence;
- node labels do not become unstable as unrelated unique nodes appear.

Do not use private Icarus note names for committed fixtures.

---

# Browser QA — responsive

Carry forward the deferred visual pass around:

```text
390 px
600 px
768 px
1000 px
wide desktop
```

At minimum verify:

- compact nodes remain readable;
- double-click works at pointer-capable widths;
- selection/focus rings do not clip;
- focus marker does not overflow;
- Inspector drawer from UX4B still behaves;
- floating Filters do not regress;
- no new horizontal graph-chrome overflow.

Do not redesign the toolbar in this milestone beyond removal of Focus Selected.

---

# Desktop QA

Run the important UX4C interactions in the Tauri build:

- Open synthetic vault/sample-equivalent source;
- select node;
- double-click Focus;
- switch focus appearance;
- expand/collapse;
- Inspector full-path evidence;
- live source edit while focused if KG11B2 is already merged;
- verify surviving focused stable ID remains styled.

If live KG11B2 is not yet on the implementation branch, do not invent it solely for this QA.

No need to modify the real Icarus vault for UX4C.

---

# Real Icarus visual check

Use the private real vault only for aggregate/visual sanity if available.

Check:

- large documents-only view is visually less noisy;
- duplicate names remain disambiguated;
- Focus root remains identifiable;
- no hidden path leakage beyond prior local UI semantics;
- mapping/layout remains usable.

Do not report private file/heading names.

Do not commit screenshots containing private names.

---

# Accessibility QA

Review current web-interface guidance.

Verify:

## Focus activation

- pointer double-click works;
- keyboard equivalent works;
- no global shortcut steals input behavior;
- diagnostic nodes do not claim Focus semantics;
- Focus transition is announced;
- Exit Focus remains reachable.

## Entity kind

Removing visual type text does not remove kind from aria label.

## Focus root

Do not rely only on color.

Each sandbox variant should have a geometric/contrast/marker cue.

## Disclosure

- compact visual button still has practical hit target;
- keyboard works;
- aria state/count remains clear;
- no Focus event leakage.

## Reduced motion

No new required animation.

Respect current reduced-motion styling.

---

# Visual-design constraints

Do not over-design the cards.

Avoid:

- large icons inside every node;
- gradients more complex than current subtle treatment;
- excessive shadows;
- multiple badges competing with title;
- animation on Focus style switch;
- rainbow colors for Focus distance;
- edge colors for hop distance.

The goal is:

```text
less text
less chrome
clearer hierarchy
```

not a more decorative graph.

---

# Performance posture

UX4C changes renderer mapping and fixed node geometry.

Preserve current KG12 instrumentation.

Required invariants:

```text
single click
→ highlight/selection work
→ no projection/layout solely from selection

Focus appearance switch
→ presentation work
→ no KG6 reproject
→ no Dagre relayout

hover
→ no projection/layout

double-click Focus
→ projection/layout expected because Focus semantics change
```

Collision-aware display preparation must not add quadratic graph work.

If current performance counters can verify mapping/layout behavior, add focused assertions.

Do not start broader KG12/PERF1 optimization.

---

# No domain changes

Do not change semantics in:

```text
core
parser
adapter
resolver
stable identity
snapshot delta
workspace engine
source provider
KG6 focus traversal
KG8 inspection/search
KG9 persisted view contract
KG11 watcher/live source contracts
```

Expected changes live mainly in:

```text
renderer-reactflow
GraphExplorer
GraphSettings
graph preferences
web tests/docs
```

Potential small preference-type exports are acceptable.

No canonical schema change.

No persisted-view schema bump.

---

# No new external dependencies

Expected external additions:

```text
zero
```

Do not add:

- icon packages;
- tooltip libraries;
- styling frameworks;
- gesture libraries;
- state libraries.

Use React Flow callbacks, current CSS, native title where useful, and existing storage helpers.

---

# Suggested implementation areas

Use actual current repo structure rather than forcing names.

Likely:

```text
packages/renderer-reactflow/src/types.ts
packages/renderer-reactflow/src/mapping.ts
packages/renderer-reactflow/src/nodes.tsx
packages/renderer-reactflow/src/GraphCanvas.tsx
packages/renderer-reactflow/src/styles.css
packages/renderer-reactflow/src/*.test.ts

apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/GraphSettings.tsx
apps/web/src/preferences/graph-preferences.ts
apps/web/src/*tests*
apps/web/src/App.css   // only if Settings styling needs it

packages/renderer-reactflow/README.md
apps/web/src/components/README.md
apps/web/README.md
```

If repository convention archives implementation prompts, archive the final prompt consistently.

No ADR is expected because this does not change the source/projection architecture.

---

# Scope

## In scope

- remove Focus Selected;
- single click remains selection;
- double-click canonical entity → Focus;
- keyboard equivalent for Focus;
- re-target Focus;
- preserve Exit/Hops/Direction;
- explicit focus-root renderer state;
- Outline/Inverted/Minimal focus-style sandbox;
- global graph preference for sandbox style;
- backward-compatible preference loading;
- remove visible File/Heading/Block labels;
- strengthen kind grammar only as needed;
- remove visible Focus-distance text;
- subtle bounded focus-depth emphasis;
- remove permanent full paths from entity cards;
- collision-aware compact disambiguation;
- shortest unique parent context for duplicate document names;
- minimal section document/line disambiguation;
- compact block display;
- compact internal-reference cue;
- quieter chevron disclosure affordance;
- smaller fixed node dimensions;
- accessibility/aria preservation;
- responsive visual QA;
- browser/Tauri regression;
- performance counter preservation;
- docs/tests;
- PR/CI/merge/cleanup.

## Explicitly out of scope

Do not implement:

- Back/Forward graph history;
- Ctrl+Z graph history;
- saved query language;
- saved filters;
- visual color groups;
- folder/group clustering;
- layout spacing controls;
- manual node positions;
- drag/pin;
- edge hop-distance colors;
- partial resolver changes;
- incremental downstream delta application;
- renderer replacement;
- source preview/edit/open-in-Obsidian.

Do not begin NAV1 automatically.

---

# Suggested implementation sequence

1. Sync latest main and preserve concurrent performance/live-source work.
2. Add renderer/app callback seam for entity Focus request.
3. Replace toolbar Focus Selected path with pointer/keyboard direct Focus.
4. Add tests for disclosure/double-click/diagnostic isolation.
5. Add focus-root marker from existing `focusDistance === 0`.
6. Add FocusAppearance renderer type + graph preference compatibility.
7. Implement Outline/Inverted/Minimal CSS variants without layout changes.
8. Remove visual type/focus-distance topline.
9. Build deterministic collision/disambiguation helpers.
10. Remove permanent path/details and render optional compact context only.
11. Compact internal-reference and disclosure footer.
12. Retune fixed per-kind node dimensions.
13. Tune focus-depth opacity/intensity interactions with hover/context/selection.
14. Update renderer mapping/layout/component tests.
15. Update web/settings/preference tests.
16. Browser visual QA including collision fixture and all focus styles.
17. Carry out 390/600/768/1000/wide visual regression pass.
18. Desktop smoke.
19. Performance-counter sanity.
20. Docs.
21. PR → CI → merge → post-merge CI → cleanup.

---

# Validation commands

Use repository-equivalent commands.

Expected focused checks:

```bash
pnpm install --frozen-lockfile

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
git diff --check
```

Run current performance tests/counters if the latest repository requires them.

Also run, where available:

```text
pnpm desktop:check
browser visual QA
desktop interaction smoke
```

Browser widths:

```text
390
600
768
1000
wide desktop
```

Focus appearance visual matrix:

```text
Outline
Inverted
Minimal
```

PR CI and post-merge `main` CI should pass.

---

# Exit gate

UX4C is complete only when:

1. `Focus Selected` is removed from the toolbar.
2. Inactive Focus no longer consumes a useless toolbar control group.
3. Single click still selects without entering Focus.
4. Double-clicking a canonical Document enters Focus.
5. Double-clicking a canonical Section enters Focus.
6. Double-clicking a visible canonical Block enters Focus if KG6 permits it.
7. Double-clicking a diagnostic target does not Focus.
8. Double-clicking an edge does not Focus.
9. React Flow double-click zoom remains disabled.
10. Disclosure click/double-click never accidentally Focuses the node.
11. A graph-scoped keyboard equivalent enters Focus for a selected canonical entity.
12. The keyboard equivalent does not fire in editable/nested control contexts.
13. Re-targeting Focus preserves current hops/direction according to existing reducer semantics.
14. Exit Focus remains available.
15. Existing Focus fit/viewport behavior remains correct.
16. Focus state still persists under the existing KG9 contract.
17. Focus root has an explicit visual treatment.
18. Focus root remains identifiable when a different node is selected.
19. Selection remains visually distinct from Focus root.
20. Focus root + selection combination is legible.
21. Settings exposes Outline/Inverted/Minimal sandbox variants.
22. Outline is the default for old/no preference.
23. Old trackpad-only graph preferences load correctly.
24. Invalid focus appearance falls back safely.
25. Changing appearance does not reproject or relayout.
26. The three variants do not change node measured dimensions.
27. Focus root styling is not color-only.
28. Visible `FILE / HEADING / BLOCK` labels are removed from entity cards.
29. Entity kind remains available in aria/Inspector.
30. Documents/Sections/Blocks remain visually distinguishable without those words.
31. Visible `Focus distance N` text is removed.
32. Focus-hop depth may be communicated only through subtle bounded node treatment.
33. Edge colors/styles are not repurposed for Focus distance.
34. Distance/context composition never makes content unreadably faint.
35. Selected/highlighted distant nodes remain clearly readable.
36. Unique documents no longer show permanent folder/full path detail.
37. Duplicate document names receive the shortest useful parent-path disambiguation.
38. Repeated same-parent-folder names expand only as far as necessary.
39. Unique sections no longer show permanent source path/line.
40. Cross-document duplicate sections get minimal document context.
41. Repeated heading titles within one document get line context only when necessary.
42. Blocks show compact useful location without a permanent `BLOCK` label.
43. Full source paths remain available through Inspector/accessibility/hover evidence.
44. Disambiguation is deterministic.
45. Disambiguation is not quadratic over the full projected graph.
46. The verbose `↺ N internal` text is replaced by a compact internal-reference cue rather than losing the only visible collapsed-internal-reference signal.
47. Disclosure chrome is reduced from the current large +/- pill.
48. Disclosure count/state remains accessible.
49. Disclosure remains keyboard/touch usable.
50. Entity node fixed dimensions are materially more compact.
51. Fixed deterministic geometry is retained; no DOM-measured dynamic layout is introduced.
52. Diagnostic cards retain their necessary diagnostic evidence.
53. Current hover neighborhood semantics remain unchanged.
54. Current selection semantics remain unchanged.
55. KG11 live stable-ID Focus reconciliation remains correct if present on the branch.
56. UX4A edge-to-edge behavior remains intact.
57. UX4B floating Filters/Inspector drawer behavior remains intact.
58. 390/600/768/1000/wide visual regression has no new graph-chrome overflow.
59. Current KG12 instrumentation/performance boundaries remain intact.
60. No new external dependency is added.
61. Existing domain/source/live tests remain green.
62. Renderer/web focused tests pass.
63. Browser visual QA passes.
64. Desktop smoke passes where run.
65. Renderer/web docs reflect the compact node and direct Focus grammar.
66. PR CI passes.
67. Post-merge main CI passes.
68. Branch/worktree cleanup follows repository convention.

Do not begin NAV1.

---

# Final report

Report:

## 1. Summary

What changed in Focus interaction and entity-node presentation.

## 2. Focus interaction

Explain:

```text
single click
double click
keyboard activation
re-target
Exit Focus
```

and confirm diagnostics/edges/disclosure do not accidentally Focus.

## 3. Focus visual sandbox

Describe exact:

```text
Outline
Inverted
Minimal
```

implementations, default, preference compatibility, and how selection remains distinct.

## 4. Focus distance

Explain removal of text and the final subtle distance treatment, including readability floor and hover/context precedence.

## 5. Entity-kind grammar

Describe how Document / Section / Block are distinguishable without visible type labels.

## 6. Node information reduction

State exactly what was removed from normal nodes and where full source evidence remains available.

## 7. Collision disambiguation

Explain:

- documents;
- shortest unique parent suffix;
- sections;
- repeated headings;
- blocks;
- deterministic/performance behavior.

Include only synthetic examples.

## 8. Disclosure/internal-reference chrome

Explain the compact disclosure control and how internal collapsed references remain discoverable without verbose text.

## 9. Node geometry

Report old → new fixed dimensions for all entity kinds and any layout-density effect.

## 10. Interaction-state combinations

Report selection + Focus root + hover + context/depth behavior.

## 11. Performance behavior

Confirm:

- style switching does not project/layout;
- selection/hover remain renderer-local;
- double-click Focus legitimately reprojects;
- collision prep did not introduce pathological mapping cost.

## 12. Responsive/browser QA

Report actual tested widths and visual variants.

## 13. Desktop QA

What was actually run.

## 14. Accessibility

Keyboard Focus entry, aria entity kind/location, disclosure, non-color Focus cues.

## 15. Dependencies

Expected external additions: zero.

## 16. Tests / validation

All commands/test counts/CI actually run.

## 17. Files changed

Important renderer/node/mapping/GraphExplorer/Settings/preferences/tests/docs areas.

## 18. Deviations / warnings

Anything the user should decide visually, especially which Focus appearance appears strongest after QA, long-title compromises, or disambiguation edge cases.

## 19. NAV1 handoff

State that NAV1 can now add renderer-independent graph Back/Forward history over the cleaned interaction model:

- direct Focus entry already exists;
- Focus exit/current view state are reducer-owned;
- meaningful structural/filter/focus actions can become history checkpoints;
- semantic viewport bookmarks already exist;
- search typing/hover/Inspector chrome remain transient and should not enter history;
- Ctrl+Z must remain text undo in editable controls.

Do not implement NAV1 automatically.
