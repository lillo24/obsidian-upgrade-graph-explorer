# HIER4B Soft Folder Clusters

Status: **HIER4B-SPACING-FIX5 CANDIDATE — Focus-neutral grouping and hard retained Nested containment await native graphical QA in PR #106.**

HIER4B evaluates a second macro-layout family for Modular Focus Hierarchy.
Directional Folder Bands remains the Modular Preview default, and Classic Focus
Hierarchy remains the product default. The merged Soft implementation does not
change either default.

## Displayed folder hierarchy

Soft Folder Clusters uses a derived displayed folder tree. Canonical source
folder identity remains immutable. The pure transformation is:

```text
canonical source folders
→ sparse per-File display-parent overrides
→ sparse manually flattened folder layers
→ derived Direct parent snapshot
→ derived ancestor-only pass-through compression
→ deterministic nested display tree with provenance
→ Focus-neutral grouping projection
→ grouping-only pruning and pass-through recompression
```

A File override uses its stable document `EntityId` and a normalized ancestor
folder key. Moving one File never moves its siblings. Restore removes only that
File override. A manually flattened folder loses one displayed layer and lifts
its direct Files and child folders into the displayed parent; grandchildren
remain nested. Flattening displayed siblings records each sibling layer
explicitly. Context menus expose affected-layer restore actions and a workspace
reset, so manual intent is reversible.

After manual intent, automatic compression suppresses only a non-root folder
with zero direct visible Files and exactly one child folder. Suppression repeats
through ancestor-only pass-through chains and is never persisted. A named
folder with one or more direct visible Files always remains, including a
one-File leaf. Manual flattening may still remove that layer intentionally.
File visibility may change which ancestor-only wrappers survive; Heading
disclosure cannot because it does not change visible File membership.

## Hierarchical attraction

The Soft solver combines primary topology springs, hop-radius preference, weak
stable seeding, hierarchical folder attraction, and deterministic
variable-rectangle collision packing. Secondary connections remain at zero
geometry influence.

Each visible File retains truthful membership in its displayed ancestor scopes.
For attraction, each non-root File participates in those scopes. The Sandbox
can compare two scope modes without changing the displayed tree or persisted
folder intent:

- H0: nearest displayed folder only;
- H1: normalized decaying ancestor weights (Nested, the default);
- Direct folders only: nearest displayed folder only.

Nested mode offers geometric raw decay of `1 / base ** index`, with 1/3 as the
default and 1/4 as the comparison. The selected raw weights are normalized per
File: two scopes produce `.75/.25` or `.80/.20`, and three produce about
`.6923/.2308/.0769` or `.7619/.1905/.0476`. Total force weight therefore stays
at most one. Direct-only mode selects each File's immediate parent after File
promotion and manual folder flattening but before automatic singleton
compression. This derived parent is not persisted, and it remains named even
when the Nested tree later compresses that folder into an ancestor or the
workspace root. Direct-only canonicalizes the stored decay choice out of
structural identity. At strength 0 the solver builds no folder-force groups,
while mandatory immediate named-folder cohesion still runs.
Manually promoted Files leave their former child scope, and a manually
flattened folder assigns its Files to the resulting parent scope.

In Focus Soft Folder Clusters, the semantic tree keeps the Focus/root File's
truthful exact folder and manual/display metadata for inspection and context
actions. A separate grouping projection removes Focus before recomputing
descendants, pruning empty folders, and compressing pass-through ancestors.
Folder attraction, cohesion, compound bodies, Nested packing, radial spacing,
guides, and visible grouping evidence all consume this Focus-neutral tree.
Focus remains the centered topology anchor and an unrelated collision/blocker
module. Root Headings and Blocks remain internal module geometry and never
become independent folder members.

The deterministic schedule remains Adaptive Compass, 36 relaxation/collision
iterations, Adaptive Compass, then 18 iterations. The Focus File is translated
to `(0, 0)` after packing. HIER4B performs no HIER5 routing.

## Adaptive Compass in Soft geometry

PATCH1 corrects a demand-model mismatch in the shared internal-layout engine.
Directional Bands keeps the accepted `directional-horizontal` policy, which
classifies counterpart modules by X position. Soft explicitly supplies
`spatial-cardinal`: each primary authored external reference is classified from
the current counterpart rectangle relative to the File center as left, right,
top, or bottom. The shared bounded Compass search still considers at most two
plausible regions per top-level branch, with the existing 64 complete-assignment
cap and four local relocation sweeps.

The D0/S1/S2 comparison retained S1, dominant cardinal count. It follows the
majority of authored references and is less sensitive to diagonal vector sums;
the mixed two-above/one-right fixture remains above at the production strength,
with lower primary span and bounds area than aggregate vector. Exact crossings,
order inversions, and hierarchy quality remain ahead of demand alignment, so a
branch may stay vertical when a lateral candidate would add a crossing.

Both Compass applications remain. The AC-S8 adaptation case changes three
branch regions after the first Soft relaxation, improves demand matches from
four to seven, reduces the immediate exact crossing count from eleven to zero,
and reduces primary Manhattan span. An unchanged candidate participates in each
spatial search and wins exact ties, preventing region or module-size churn that
has no quality benefit.

Development evidence records final cardinal branch counts per module, modules
with lateral or vertical-only branches, demand matches, hard-guard overrides,
pass-one/pass-two region and bounds churn, and before/after pass-two crossings
and span. The macro perturbation diagnostic distinguishes visible region,
internal rectangle, and module-bound changes from a true geometric no-op. When
Adaptive and Vertical input rectangles are identical across both bounded passes,
the downstream Soft candidate is byte-identical. Soft cache algorithm version 11
covers the Focus-neutral grouping projection, mandatory immediate cohesion,
hard retained Nested packing, and mode-specific compound bodies. Worker protocol
version 13 and Soft evidence schema 8 carry cohesion, Nested movement/quality,
named-folder coverage, post-Nested topology quality, group-packing evidence, and
the fixed-spacing policy without invalidating the Directional algorithm version.

## Structural group packing and Soft spacing

HIER4B-SPACING-FIX3B retains one fixed structural policy: 600 hop spacing, 88
module gap, 180 topology distance, 72 packing step, 104 radial jitter, 30/60
internal node/rank separation, and 34/30 module padding. The `[36, 18]`
schedule, Adaptive Compass, endpoint ordering, folder relaxation, collision
packing, and root-neutral force are decided once by that structural result.

After the existing solver finishes, FIX4 first groups non-Focus Files by their immediate
parent after manual intent and before automatic compression. Every named group
is deterministically compacted as whole File modules into one connected local
arrangement. Module sizes and File/Heading/Block offsets stay fixed. The
pre-cohesion centroid is the preferred center. Focus is absent from the group
and remains fixed. This stage runs even when Folder strength is zero, so the
strength control means additional centroid and ancestor attraction beyond
mandatory structural grouping.

Direct mode then derives disjoint bodies from the immediate displayed parent
captured after manual intent and before automatic compression. Every named
folder is a compact rigid list of its member module rectangles. Nested mode
packs every retained folder deepest-first from one direct-member unit plus its
already-packed child-folder subtree units. Its final compound bodies are whole
top-level retained subtrees, so later packing and radial spacing cannot tear an
ancestor composition apart. Files stored directly at workspace root are
individual structural bodies. Focus has its own explicit anchored
`focus-anchor` body with `folderKey = null`; all other bodies may translate as a
whole without changing any member-relative vector.
A deterministic nearest-ring search chooses the first safe translation. Its
exact affine interval oracle checks padded named-folder envelopes against other
bodies, including the 16 px clearance, over the entire continuous spread domain
from 1.0x to 2.4x. This prevents an unrelated File from becoming a blocker
inside a direct-folder hull. A structural attempt fails if any spread-safety or
shared guide-island violation remains. These passes do not rerun Adaptive
Compass or change internal module geometry.

The Sandbox `Soft spacing` value from 0 to 100 is now a post-layout radial
spread. Its linear scale is `1 + 1.4 × value/100`: 0 is 1.0× base radius, 50 is
1.7×, and 100 is 2.4×. Every member of a Direct folder body or Nested top-level
subtree receives the same translation from the fixed root center. The explicit
Focus anchor stays fixed; root-level Files move as singleton bodies by default.
Endpoint attachments and geometry-derived endpoint/folder quality are then
recomputed from those final rectangles so strict renderer validation remains
truthful; no structural search, packing, collision pass, or relaxation reruns.
The root, module
dimensions, internal offsets, angular direction, branch assignments, force
groups, and structural evidence remain unchanged. Folder guides derive from
the transformed rectangles.

`Include workspace root group` is a persisted Sandbox presentation preference
and defaults Off. Off shows no `.` guide and keeps root-level Files as separate
radial bodies. On groups those Files for the radial transform and renders the
label `Workspace root`. Structural packing always uses the Off singleton
partition and additionally proves the On aggregate partition safe, so this
toggle causes no projection, model, worker, structural layout, or cache work.

Radial spread is absent from worker requests and structural cache identity, so
changing it causes zero projection/model/worker/solver work and reuses one
base result. A presentation failure keeps the validated adopted graph visible
and exposes the exact error in the Modular controls rather than silently
showing an unspread graph. Directional requests ignore all Soft-only scope,
decay, strength, and radial values. Native graphical QA is pending.

## Nested Folder guides

Folder guides remain a renderer-only overlay derived from the final displayed
module rectangles and the Focus-neutral grouping tree. In Nested mode, child
regions are built first; their rectangles then enter the one parent guide along
with the parent's direct Files. Logical membership comes from retained path
ancestry, never spatial proximity. The island and blocker geometry is a strict
validator: every retained named folder must produce exactly one coherent region
containing every logical child and no unrelated module. A failure is surfaced
instead of dropping a child or drawing duplicate same-name regions.

In Direct-only mode, each folder guide uses Files grouped by the
pre-compression Direct parent. Child-folder regions never become parent-guide
units, so a parent with its own Files may render independently without wrapping
a child folder. A named one-File Direct group renders a singleton guide because
it is that File's only visible folder identity. Nested mode also retains an
immediate named folder with one direct File. Grouping-tree pass-through
compression removes only ancestor-only single-child layers before layout; every
retained Nested folder then renders exactly once. Area targeting uses the
Focus-neutral guide projection, while context actions retain the semantic tree.
Switching modes leaves manual intent unchanged.

The hull SVG remains pointer-inert and behind graph edges and nodes. The graph
pane converts a context-menu point through React Flow's screen-to-world helper
and tests the actual rounded region geometry. The deepest displayed region
wins, followed by smallest area and stable folder identity. This enables empty
guide-area context menus without intercepting ordinary pointer input. Turning
Folder guides off disables this area hit test.

Visible labels use only the final folder segment plus an optional quiet parent
segment. Non-singleton labels anchor at the left end of the uppermost visible
horizontal segment produced by the rounded guide geometry, then retain the
existing `+12/-9` offset. A deterministic bounding-box fallback covers
degenerate shapes; singleton rectangles retain their prior anchor. The full
normalized workspace-relative key remains in title, ARIA, menu naming, and
development data. One retained folder produces one region and one label; split
or blocker-invalid geometry is rejected by the shared structural/renderer
oracle. Display depth is derived after manual
flattening and automatic pass-through compression: root is 0, top-level folders are 1, and
CSS styling is capped at `3+`. Hover or keyboard focus still emphasizes the
current folder, its displayed parent, and sibling folder guides without
changing layout.

POLISH1 presents the primary HTML label as plain text with a transparent
background, no persistent border, pill, shadow, or pointer cursor. It remains a
focusable button internally so Shift+F10, the ContextMenu key, right-click, and
focus restoration keep the established menu behavior. Hover adds text emphasis
only and keyboard focus gets a temporary visible outline. Repeated SVG labels
use the same restrained text weight and size.

The earlier post-island wrapper pass still suppresses a named ancestor region
when its island contains only one child visual unit and no direct File. Its one
surviving child passes into the parent candidate set, so recursive local wrapper
chains compress without losing descendants. Any island containing a direct File
renders, including named singletons. Useful File-plus-child and two-child
regions remain. The workspace root retains its existing direct-File-only
structural exception and is hidden by default.

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
reconciliation, the pure semantic tree, Focus-neutral grouping projection,
provenance, mutations, and bounded scope memberships.
`soft-folder-cohesion.ts` owns mandatory immediate-group compaction and its
quality evidence. `soft-nested-hierarchy-packing.ts` owns deepest-first retained
tree packing plus hierarchy and coverage hard gates. `soft-folder-guide-geometry.ts`
owns the pure island oracle shared with the renderer. `soft-clusters.ts` owns
the renderer-neutral solver and H1 policy.
`packages/renderer-reactflow/src/focus-schematic/folder-cluster-guides.tsx`
owns hierarchy-driven guide geometry, one-region/blocker validation, and
renderer-only hierarchy emphasis.
`packages/renderer-reactflow/src/GraphContextMenu.tsx` owns the shared menu
surface. The web application owns workspace persistence and action dispatch.

The bakeoff records SC1–SC24 and SC26–SC29 at strengths 0/25/50/75/100, stress profiles,
HFA1–HFA7 across H0/H1/H2, a nested strength matrix, and cardinal attachment
regressions. PATCH1 adds AC-S1–AC-S8, D0/S1/S2 demand rows, a five-strength
matrix, and Adaptive/Vertical macro-perturbation evidence.

Before PATCH1, graphical review accepted the nested hierarchy, singleton-chain
compression, promotion and flattening semantics, passive labels, File-only
module-boundary suppression, redundant region-wrapper suppression, folder-area
and composed File/folder context menus, and four-side File ports. PATCH1 does
not reopen those decisions. Adaptive Compass compatibility is the current
graphical question.

## Later work

`HIER4B-SPACING` now has a FIX5 native candidate and Sandbox tuning control;
native graphical approval is pending. FIX5 makes Focus neutral to folder
grouping and gives Nested mode hard retained-ancestry containment with one guide
per named folder. Direct keeps FIX4 immediate named-folder unity.
`MODULAR-CONTEXT1` will add Network-style
Focus, Inspect, Hide File, and Hide Folder actions to the same composed menu
model. Adaptive Compass compatibility remains a separate graphical review
question.
