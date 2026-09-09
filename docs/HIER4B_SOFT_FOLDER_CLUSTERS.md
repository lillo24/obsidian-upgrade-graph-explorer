# HIER4B Soft Folder Clusters

Status: **UNDER EVALUATION — HIER4B-FIX2 implemented; optimized graphical QA pending.**

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

The hull SVG remains pointer-inert and behind graph edges and nodes. Only each
small folder label is interactive. Hover or keyboard focus emphasizes the
current folder, its displayed parent, and sibling folder guides without
changing layout. If automatic compression hid an intermediate parent, the
passive context text reports that compressed ancestry.

## Context menu

FIX2 removes the former inline `↑ This group`, sibling, and Reset toolbar.
Right-click, Shift+F10, or the ContextMenu key opens folder-display actions on a
Modular File card or folder label. Modular uses the same shared nonmodal portal,
viewport bounding, keyboard traversal, Escape/outside dismissal, and focus
restoration infrastructure as Network Explorer. Opening, hovering, focusing,
or closing the menu does not enter projection, model, worker, layout, or cache
state.

File actions move the one File up one current displayed level or restore exact
placement. Folder actions flatten one displayed layer, flatten the current
folder plus displayed siblings, restore applicable hidden layers, or reset Soft
folder display. Generic Focus, Inspect, Hide File, and Hide folder actions are
reserved for `MODULAR-CONTEXT1` after HIER4B folder semantics.

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

## Ownership

`packages/focus-schematic-layout/src/soft-folder-display.ts` owns validation,
reconciliation, the pure nested tree, provenance, mutations, and bounded scope
memberships. `soft-clusters.ts` owns the renderer-neutral solver and H1 policy.
`packages/renderer-reactflow/src/focus-schematic/folder-cluster-guides.tsx`
owns nested guide geometry and renderer-only hierarchy emphasis.
`packages/renderer-reactflow/src/GraphContextMenu.tsx` owns the shared menu
surface. The web application owns workspace persistence and action dispatch.

The bakeoff records SC1–SC24 at strengths 0/25/50/75/100, stress profiles,
HFA1–HFA7 across H0/H1/H2, a nested strength matrix, and cardinal attachment
regressions. HIER4B remains under evaluation until the user completes graphical
QA.
