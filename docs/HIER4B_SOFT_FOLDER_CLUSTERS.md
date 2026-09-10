# HIER4B Soft Folder Clusters

Status: **UNDER EVALUATION — HIER4B-FIX4 implemented; optimized graphical QA pending.**

HIER4B evaluates a second macro-layout family for Modular Focus Hierarchy.
Directional Folder Bands remains the Modular Preview default, and Classic Focus
Hierarchy remains the product default. No adoption ADR or production-default
change belongs to this branch.

## Displayed folder hierarchy

Soft Folder Clusters uses a derived displayed folder tree. Canonical source
folder identity remains immutable. The pure transformation is:

```text
canonical source folders
→ sparse per-File display-parent overrides
→ sparse manually flattened folder layers
→ derived one-child-unit compression
→ deterministic nested display tree with provenance
```

A File override uses its stable document `EntityId` and a normalized ancestor
folder key. Moving one File never moves its siblings. Restore removes only that
File override. A manually flattened folder loses one displayed layer and lifts
its direct Files and child folders into the displayed parent; grandchildren
remain nested. Flattening displayed siblings records each sibling layer
explicitly. Context menus expose affected-layer restore actions and a workspace
reset, so manual intent is reversible.

After manual intent, every non-root displayed folder with exactly one direct
child unit is automatically suppressed. A child unit is one direct File or one
child folder. Suppression repeats until a useful branching level and is never
persisted. Two Files, a File plus child folder, or two child folders retain the
folder guide. File visibility may change this derived compression; Heading
disclosure cannot because it does not change visible File membership.

## Hierarchical attraction

The Soft solver combines primary topology springs, hop-radius preference, weak
stable seeding, hierarchical folder attraction, and deterministic
variable-rectangle collision packing. Secondary connections remain at zero
geometry influence.

Each File participates in its visible displayed ancestor scopes. FIX2 compared:

- H0: nearest displayed folder only;
- H1: normalized decaying ancestor weights;
- H2: normalized equal ancestor shares.

H1 is selected internally. The nearest displayed folder receives the strongest
share while all shares for one File sum to at most one, so depth cannot amplify
the global Folder strength. At strength 0 the solver builds no folder-force
groups. Manually promoted Files leave their former child scope; flattened and
automatically compressed layers receive no separate force.

The deterministic schedule remains Adaptive Compass, 36 relaxation/collision
iterations, Adaptive Compass, then 18 iterations. The Focus File is translated
to `(0, 0)` after packing. HIER4B performs no HIER5 routing.

## Nested Folder guides

Folder guides remain a renderer-only overlay derived from the final displayed
module rectangles and the pure display tree. Child regions are built first;
their rectangles then enter parent guide geometry along with the parent's
direct Files. This makes child containment structural. Fixed per-level padding
keeps deep nesting bounded. Logical folders may retain multiple disconnected
regions when topology separates their Files, avoiding a misleading hull across
unrelated modules.

The hull SVG remains pointer-inert and behind graph edges and nodes. The graph
pane converts a context-menu point through React Flow's screen-to-world helper
and tests the actual rounded region geometry. The deepest displayed region
wins, followed by smallest area and stable folder identity. This enables empty
guide-area context menus without intercepting ordinary pointer input. Turning
Folder guides off disables this area hit test.

Visible labels use only the final folder segment plus an optional quiet parent
segment. The full normalized workspace-relative key remains in title, ARIA,
menu naming, and development data. Disconnected regions repeat the same short
name without visible island numbering. Display depth is derived after manual
flattening and singleton compression: root is 0, top-level folders are 1, and
CSS styling is capped at `3+`. Hover or keyboard focus still emphasizes the
current folder, its displayed parent, and sibling folder guides without
changing layout.

POLISH1 presents the primary HTML label as plain text with a transparent
background, no persistent border, pill, shadow, or pointer cursor. It remains a
focusable button internally so Shift+F10, the ContextMenu key, right-click, and
focus restoration keep the established menu behavior. Hover adds text emphasis
only and keyboard focus gets a temporary visible outline. Repeated SVG labels
use the same restrained text weight and size.

FIX4 applies a second, renderer-local compression after spatial island
splitting. A named folder region is rendered only when its island contains at
least two direct visual units: direct File rectangles or immediate rendered
child-folder regions. A one-unit region emits no shape, label, hover target, or
area hit target. Its one surviving visual unit passes into the parent candidate
set before parent geometry is built, so recursive local wrapper chains compress
without losing descendant Files. Useful File-plus-child and two-child regions
remain. The logical display tree, persisted intent, promotion, flattening,
forces, spacing, ports, and routing do not change. The workspace root retains
its existing direct-File-only structural exception.

## Context menu

FIX2 removes the former inline `↑ This group`, sibling, and Reset toolbar.
Right-click, Shift+F10, or the ContextMenu key opens folder-display actions on a
Modular File card or folder label. Modular uses the same shared nonmodal portal,
viewport bounding, keyboard traversal, Escape/outside dismissal, and focus
restoration infrastructure as Network Explorer. Opening, hovering, focusing,
or closing the menu does not enter projection, model, worker, layout, or cache
state.

File actions move the one File up one current displayed level or restore exact
placement. The same File menu then uses a strong semantic separator before the
valid actions for that File's current displayed containing folder. A File at
display root has no folder section or empty separator. Folder labels and folder
area hits open folder actions only. Folder actions flatten one displayed layer,
flatten the current folder plus displayed siblings, restore applicable hidden
layers, or reset Soft folder display. Generic Focus, Inspect, Hide File, and
Hide folder actions are reserved for `MODULAR-CONTEXT1` after HIER4B folder
semantics.

## Persistence and privacy

Only manual File-parent overrides and manually flattened folder keys persist
under the stable workspace identity. Schema 2 reuses the previous Experimental
storage key. A schema-1 flat grouping registry is narrowly replaced by an empty
schema-2 display intent; unrelated preferences and workspace records are not
touched. Stable sessions write before adoption. Transient/legacy sessions are
memory-only, failed writes retain the last confirmed state, and stale identities
are dropped without fuzzy rename inference.

No Markdown, source file, absolute path, hidden File membership, geometry,
hover, menu, or automatic-compression state is stored. Guide membership comes
only from visible HIER1 modules.

## Directional and attachment isolation

Directional requests erase Soft display intent before worker computation and
cache identity. Directional exact horizontal strips, HIER4A geometry, endpoint
ordering, and signed-rank left/right attachments remain unchanged. Returning to
Soft restores the workspace display intent.

HIER4B-FIX1's four-side Soft File and module-anchor attachments remain accepted.
They use final relative geometry, participate in crossing scoring, and feed the
same handles to Direct and Electronic rendering. Precise Heading/Block endpoint
semantics are unchanged.

POLISH1 also hides the painted module boundary whenever a module currently has
only its File visible. A visible Heading or Block restores the boundary. Root
Files follow the same rule, and revealable-but-collapsed structure does not
count. The renderer keeps the module rectangle, handles, layout result, folder
guide geometry, and cache identity unchanged.

## Ownership

`packages/focus-schematic-layout/src/soft-folder-display.ts` owns validation,
reconciliation, the pure nested tree, provenance, mutations, and bounded scope
memberships. `soft-clusters.ts` owns the renderer-neutral solver and H1 policy.
`packages/renderer-reactflow/src/focus-schematic/folder-cluster-guides.tsx`
owns nested guide geometry, post-island local compression/pass-through, and
renderer-only hierarchy emphasis.
`packages/renderer-reactflow/src/GraphContextMenu.tsx` owns the shared menu
surface. The web application owns workspace persistence and action dispatch.

The bakeoff records SC1–SC24 at strengths 0/25/50/75/100, stress profiles,
HFA1–HFA7 across H0/H1/H2, a nested strength matrix, and cardinal attachment
regressions. HIER4B remains under evaluation until the user completes graphical
QA.

## Later work

`HIER4B-SPACING` will evaluate wider use of the available canvas and less
cramped module interiors after folder semantics are frozen. `MODULAR-CONTEXT1`
will add Network-style Focus, Inspect, Hide File, and Hide Folder actions to the
same composed menu model. Neither belongs to FIX4.
