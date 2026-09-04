# SPATIAL2B — Dynamic Pull + Hierarchical Folder-Scope Authoring

**Task type:** production spatial-rule editor / hierarchical scope visualization / direct-manipulation refinement / release-time dynamic settling

## Goal

Expose the SPATIAL2A rule system as a coherent production workflow in:

```text
Scope = All
Layout = Network
```

Users must be able to author and edit both spatial behaviors:

```text
Dynamic pull
→ soft graph-aware attraction
→ connected outside nodes can react
→ selected cluster is encouraged toward a target, not fixed exactly

Fixed placement
→ exact post-layout folder translation
→ surrounding graph does not react
→ current SPATIAL1 behavior
```

They must also be able to choose hierarchical membership:

```text
This folder only
→ Files directly in this exact folder

Folder + subfolders
→ direct Files + every descendant folder

Custom
→ choose direct-root participation
→ exclude selected child-folder subtrees
```

The intended interaction is:

```text
Arrange folders
→ choose/activate a folder
→ choose Dynamic pull or Fixed placement
→ choose folder scope
→ included nodes become prominent
→ excluded/unrelated nodes fade
→ drag the scoped cluster toward a target
→ immediate rigid preview follows the pointer
→ release persists the rule
→ Dynamic pull settles asynchronously and the surrounding graph reacts
```

The product must preserve the current fixed-placement workflow and every schema-v1 migrated rule.

If all gates pass:

```text
SPATIAL2 — Complete
SPATIAL2A — Complete
SPATIAL2B — Complete
SAVED1 — Later
```

Do not begin Saved Views, Adaptive Layout, or individual-node movement automatically.

---

# Current repository baseline

Repository:

`lillo24/icarus-graph-explorer`

SPATIAL2A merged through PR #63 at:

```text
16bbd2208593cb320c9ab57affafbf0b7dee0a11
```

SPATIAL2A provides:

- schema-v2 `SpatialOverrideRegistry`;
- one spatial rule per normalized root folder;
- `pull | place` behavior;
- exact/subtree scope;
- `includeRootFiles` plus normalized subtree exclusions;
- integer Pull strength `0–100`;
- schema-v1 migration to `place + exact`;
- deepest matching rule wins per document;
- strict position layers:

```text
base automatic
→ dynamic pull
→ fixed placement
→ display
```

- a separate latest-result-wins Pull worker/cache;
- interleaved ForceAtlas2 + centroid attraction;
- dynamic graph reaction outside the affected folder;
- current production Arrange workflow preserved as Place/exact;
- production renderer already receives the full rule array;
- development harness already exercises Pull, Place, hierarchical scopes, exclusions, strengths, and precedence.

ADR 0018 is authoritative for the force algorithm and position ownership.

Do not reopen its algorithm bake-off in SPATIAL2B unless production QA exposes a correctness defect.

---

# Important parallel work

At plan-writing time PR #60 is open/draft:

```text
SPACING1B — density-aware Focus camera framing
```

It affects Focus Network camera behavior and Settings.

Before editing:

1. inspect PR #60 status;
2. do not modify, clean, rebase, or delete its branch/worktree;
3. if it merges, rebase SPATIAL2B onto the merged `main` before final QA;
4. preserve its Focus-only behavior;
5. verify that no All-Network Arrange control or spatial panel is overwritten during conflict resolution.

Also inspect local worktrees for HIER2 or any other user-owned task. Do not touch them.

---

# Required first inspection

Read current versions of at least:

```text
AGENTS.md

docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
docs/GLOBAL_RENDERER_DECISION.md
docs/decisions/0017-arrange-folders-direct-manipulation.md
docs/decisions/0018-hierarchical-folder-spatial-rules-and-soft-attractors.md

packages/spatial-overrides/src/types.ts
packages/spatial-overrides/src/registry.ts
packages/spatial-overrides/src/scope.ts
packages/spatial-overrides/src/resolution.ts
packages/spatial-overrides/src/preview.ts
packages/spatial-overrides/src/geometry.ts
packages/spatial-overrides/README.md

packages/renderer-sigma/src/GlobalGraphCanvas.tsx
packages/renderer-sigma/src/arrangement.ts
packages/renderer-sigma/src/spatial.ts
packages/renderer-sigma/src/spatial-influence.ts
packages/renderer-sigma/src/spatial-influence-cache.ts
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/types.ts
packages/renderer-sigma/README.md

apps/web/src/spatial-overrides/*
apps/web/src/persistence/spatial-overrides.*
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/GlobalGraphView.tsx
apps/web/src/components/NetworkExplorer.tsx
apps/web/src/network-explorer-model.ts
apps/web/src/network-explorer-folders.ts
apps/web/src/network-explorer-context.ts
apps/web/src/graph-workspace-overlays.ts
apps/web/src/App.css

tools/global-renderer-spike/*
```

Use current `main` rather than old implementation prompts as the source of truth.

---

# Hard architecture rules

1. Spatial rules remain workspace-scoped derived presentation intent.
2. Rules never alter canonical truth, KG6 projection, QUERY1, or topology.
3. Pull and Place remain distinct behaviors.
4. Folder membership never creates semantic graph edges.
5. Hierarchical membership is resolved through existing SPATIAL2A rules.
6. Deepest matching rule remains the sole winner for each document.
7. Base automatic, dynamic, fixed, and displayed positions remain separate.
8. Pull authoring uses the existing dynamic worker/cache.
9. Fixed placement remains an exact post-dynamic translation.
10. Raw graph/viewport coordinates are never persisted.
11. Focus Network and both Hierarchy presentations remain unaffected.
12. Custom scope is folder-declarative, not a persisted list of File IDs.
13. Editing is transactional: durable state is persisted before adoption.
14. Continuous pointer movement must not invoke the Pull worker.
15. Production UI must not expose source paths beyond existing workspace-relative folder labels.

---

# Product terminology

Use user-facing terms:

```text
Behavior
[ Dynamic pull ] [ Fixed placement ]

Scope
[ This folder ] [ Folder + subfolders ] [ Custom ]
```

Avoid exposing:

```text
exact
subtree
includeRootFiles
excludedSubtrees
interleaved-centroid
schema v2
```

outside Technical details/developer surfaces.

Suggested concise descriptions:

```text
Dynamic pull
Encourages this folder toward the target while the surrounding network reacts.

Fixed placement
Places the selected folder scope exactly at the target.
```

Do not call Dynamic pull a fixed position.

---

# Default rule for a new folder

The existing Place/exact default reflected SPATIAL1, but the intended primary behavior is now Dynamic pull.

For a folder without a saved rule, initialize an editor draft as:

```text
behavior: Dynamic pull
scope: This folder
strength: 70
anchor: current displayed folder-center normalized against the base automatic frame
```

The initial anchor must represent the folder's current position so merely opening the editor does not move the graph.

Strength `70` is the proposed default. Validate `60/70/80` on the synthetic production graph and retain `70` unless evidence shows it is too weak or too aggressive.

Do not persist a rule merely by selecting a folder.

Existing rules load exactly as saved:

```text
schema-v1 migrated rule
→ Fixed placement / This folder

existing Pull subtree rule
→ Dynamic pull / corresponding hierarchical scope
```

---

# One production editor, not parallel interaction systems

Evolve the current Arrange Folders panel into a spatial-rule editor.

The panel should own one transient draft:

```ts
interface SpatialRuleDraft {
  readonly folderKey: WorkspaceFolderKey;
  readonly behavior: FolderSpatialBehavior;
  readonly scope: FolderSpatialScope;
  readonly anchor: NormalizedFolderAnchor;
  readonly strength?: number;
}
```

Exact type/name may differ.

The draft is not persisted until:

- the user presses Apply/Save; or
- a target drag is released and the complete draft is committed.

Changing behavior, scope, exclusions, or strength updates the draft and visual selection only.

Do not run a dynamic Pull worker for every slider tick or scope checkbox.

---

# Editor lifecycle

Use a clear state machine, conceptually:

```text
inactive

active-no-folder
→ Arrange mode active; hover/select a folder

editing
→ rule draft loaded
→ behavior/scope/strength editable

choosing-scope
→ Custom membership selection active

dragging-target
→ immediate rigid preview

committing
→ persistence transaction

settling-pull
→ saved Pull rule is being dynamically refined
```

Do not spread independent booleans across GraphExplorer, Network Explorer, and Sigma without one authoritative state model.

Renderer gesture state may remain separately optimized, but application rule-editor state must be coherent.

---

# Existing Arrange entry points

Preserve current entry paths:

```text
All Network canvas → Arrange folders
Network Explorer exact folder action → Arrange folder
```

Generalize folder-row actions:

## No rule at this exact root

```text
Arrange folder
```

## Existing rule at this exact root

```text
Edit spatial rule
Remove spatial rule
```

Do not use the old anchored indicator only for Place/exact.

Show a restrained exact-root badge:

```text
Pull
Place
```

with accessible scope detail:

```text
Dynamic pull, folder and subfolders
Fixed placement, custom scope
```

A parent row must not display a rule badge merely because a descendant has one.

---

# Generalize production session mutations

`useSpatialOverrides` currently exposes compatibility Place/exact operations plus the rule array.

Add generic transactional methods using existing domain operations:

```text
setFolderRule(rule)
removeFolderRule(folderKey)
clearFolderRules()
```

Keep compatibility methods only where existing tests/older interaction code still need them.

Production SPATIAL2B UI must use generic rule operations.

`Reset folder` should now mean:

```text
remove the one spatial rule rooted at this exact folder
```

regardless of Pull/Place/scope.

`Reset all` should remove all Pull and Place rules after confirmation.

Do not let compatibility `clearFolderClusterAnchors()` silently leave Pull rules while the UI claims all spatial rules were reset.

---

# Scope presets

Map UI to schema exactly:

## This folder

```ts
{ kind: 'exact' }
```

Meaning:

```text
Files directly inside the exact folder only
```

Nested subfolder Files are excluded.

## Folder + subfolders

```ts
{
  kind: 'subtree',
  includeRootFiles: true,
  excludedSubtrees: [],
}
```

Meaning:

```text
all Files directly in the folder
+
all descendant folder Files
```

## Custom

Any subtree scope where:

```text
includeRootFiles can be true/false
excludedSubtrees can contain normalized descendant folder roots
```

Switching from This folder to Custom should start from the broad useful state:

```text
include root Files = true
all descendant folders included
```

The user can then deselect.

Switching to Folder + subfolders clears exclusions.

Do not discard the old Custom draft accidentally when the user briefly inspects another scope option; preserve it within the current editor session if practical, but only the active scope is committed.

---

# Full workspace folder-scope model

Custom scope is declarative and should not depend solely on the current filtered projection.

Build the scope-selection tree from:

```text
canonical document workspace-relative paths
```

not only currently visible Network nodes.

Each folder entry should know approximately:

```text
folderKey
direct File count
descendant File count
current visible File count
included/excluded state
whether a more-specific saved rule owns its members
```

QUERY1-hidden folders remain editable and may become active when visible later.

Do not persist resolved member IDs.

Use a bounded/scrollable tree; reuse existing virtualized folder-tree primitives if practical.

Do not render thousands of hidden checkbox DOM rows at once.

---

# Custom scope editor

When `Custom` is selected, expose:

```text
[✓] Files directly in this folder

Subfolders
[✓] Child A
[✓] Child B
[ ] Child C
```

Unchecking a child folder excludes that entire subtree.

Rechecking it removes the exclusion and restores that subtree.

The persisted `excludedSubtrees` remains a normalized minimal antichain.

If a parent subtree is excluded:

- descendants are shown as inherited-excluded/disabled;
- clicking a descendant cannot secretly create an unsupported re-inclusion rule;
- re-enable the nearest excluded ancestor first.

When re-enabling an excluded ancestor, its subtree becomes included. The user may then exclude narrower descendants again.

Document this behavior; do not silently invent inclusion overrides absent from schema v2.

---

# Deep child-rule precedence in the editor

A descendant folder may have its own saved rule.

Deepest rule wins remains non-negotiable.

In a parent scope editor, child-rule-owned subtrees should be shown as:

```text
Own rule: Pull
or
Own rule: Place
```

They are not effective members of the parent's rule even if the parent's broad scope includes them.

Visual treatment:

- distinct outline/marker;
- not confused with ordinary exclusion;
- accessible explanation: `This subfolder uses its own spatial rule.`

Do not silently delete or override child rules from the parent editor.

Provide one explicit route such as:

```text
Edit child rule
```

Optionally provide:

```text
Remove child rule and use parent
```

only with clear confirmation.

Do not make parent and child forces additive.

---

# Scope visualization on the graph

This is a core requirement, including before movement.

While a folder draft is active:

```text
effective included members
→ prominent / full opacity

candidate descendants excluded by Custom scope
→ visibly dim

members shadowed by a deeper own rule
→ separate distinct treatment

unrelated graph outside the selected root scope
→ strongly faded / transparent
```

Keep enough context to see reference relationships.

Incident edges:

- edges internal to included members remain prominent;
- included-to-outside edges remain visible enough to understand dynamic reaction;
- unrelated edges fade more strongly.

This visual scope emphasis remains useful even when no drag is occurring.

It must compose with:

- Visual Group colors;
- per-File size overrides;
- selection;
- Network LOD;
- diagnostic styling.

Do not rewrite semantic colors to represent scope; use opacity, outline, halo, or another secondary channel.

---

# Brief inclusion feedback, not continuous vibration

The user's original interaction idea includes a visible response when selecting/deselecting cluster members.

Implement a restrained brief pulse/halo when a folder subtree is toggled.

Do not continuously vibrate or shake included nodes.

Requirements:

- short duration;
- does not move graph coordinates;
- disabled under reduced-motion preferences;
- does not invoke layout;
- does not obscure labels.

---

# Direct graph shortcut for Custom scope

The DOM folder tree is the authoritative accessible editor.

Also provide a graph shortcut while the editor is in an explicit:

```text
Choose included folders
```

submode.

Behavior:

## Click a visible File in a strict descendant folder

```text
included folder subtree
→ exclude that exact subtree

excluded subtree root
→ reinclude that subtree
```

If the clicked File is below an already excluded ancestor, re-enable the nearest excluded ancestor rather than inventing an unsupported nested inclusion.

## Click a File directly in the rule root

```text
toggle all Files directly in this folder
```

Do not toggle one File independently.

## Click a child-rule-owned File

Do not modify the parent draft silently.

Prefer:

```text
activate/show the child rule as a separate edit target
```

or show an explicit `Own rule wins` message.

In Choose-members submode, target dragging is disabled to avoid click-vs-drag ambiguity.

Expose:

```text
Done selecting
```

before returning to target movement.

---

# Behavior controls

## Dynamic pull

Show:

```text
Pull strength 0–100
```

Use integer values and clear endpoints:

```text
0 = no dynamic influence
100 = strongest soft pull
```

Strength 100 remains soft, not exact.

Changing the slider updates the draft immediately but does not submit workers continuously.

Apply/Save or drag release commits one rule and triggers the current latest-result-wins dynamic pass.

## Fixed placement

Hide/disable Pull strength.

The target is exact after dynamic geometry.

Switching Pull → Place keeps the current target/scope but removes strength.

Switching Place → Pull keeps target/scope and initializes strength to the last draft strength or the default 70.

Do not create a second global preference for Pull strength.

---

# Target marker

Make the target concept visible without adding a semantic graph node.

When a rule draft is active, render a small pointer-transparent target marker/halo at its normalized target.

Distinct but restrained variants may communicate:

```text
Dynamic pull target
Fixed placement target
```

The marker:

- is a renderer/DOM overlay;
- is not Graphology topology;
- is not selectable as a graph entity;
- is not persisted beyond the normalized anchor already in the draft/rule;
- follows camera transforms;
- disappears when the editor closes.

This helps explain why a Pull cluster may settle near, not exactly on, the target.

---

# Drag member set

Current SPATIAL1B drag preview assumes Place/exact membership.

Generalize preview capture to an explicit resolved member set.

For the active draft, compute effective members using:

```text
confirmed registry
with active draft replacing the same-root rule
→ deepest-wins resolution
```

Then:

```text
Place exact/subtree/custom
→ preview all effective Place members

Pull exact/subtree/custom
→ preview all effective Pull members
```

Child-rule-owned members must not move in the parent preview.

Do not derive hierarchical membership inside pointer handlers.

Resolve once when the draft/membership changes.

---

# Immediate drag preview for both behaviors

During pointer drag:

```text
move effective members as one rigid group
```

This is temporary interaction feedback only.

For Pull, connected outside nodes do not need to react during raw pointer movement.

Reason:

- SPATIAL2A measured 5,000-node dynamic work as worker-safe but not continuous-preview speed;
- pointer interaction must remain responsive;
- the dynamic response happens after release.

Do not submit a Pull worker on each pointermove.

Reuse SPATIAL1B sparse rAF-coalesced partial-position preview.

Generalize the pure preview helper from exact folder membership to:

```text
resolved effective member node keys
```

without duplicating normalized-anchor math.

---

# Pull release behavior

On release of a Dynamic pull draft:

```text
1. derive final normalized target
2. persist complete Pull rule before adoption
3. retain the rigid preview visually
4. start/allow the current dynamic Pull worker for the committed registry
5. show `Settling dynamic pull…`
6. when the matching latest result arrives:
   → apply dynamic geometry
   → apply any fixed rules
   → clear rigid preview
   → surrounding connected nodes have reacted
```

The final centroid need not equal the target exactly.

The target marker explains the soft intent.

Do not briefly snap:

```text
rigid preview
→ old/base layout
→ dynamic result
```

Keep preview until authoritative dynamic adoption or explicit failure.

If the Pull worker fails:

- clear the temporary preview;
- display the existing base-plus-fixed fallback;
- retain the saved Pull rule;
- show actionable failure/retry status;
- do not claim the pull was visually applied.

A retry/re-layout action may reuse the existing spatial worker path.

---

# Place release behavior

On release of Fixed placement:

```text
1. persist the complete Place rule
2. authoritative fixed composition adopts
3. preview clears without flicker
4. no Pull worker is required unless other effective Pull rules already exist
```

Existing Place/exact behavior must remain unchanged.

Place subtree/custom applies one shared exact translation to its effective member set after the current dynamic layer.

Do not apply Place twice.

---

# Commit behavior/scope/strength without dragging

The editor must support changing an existing rule without moving its target.

Provide:

```text
Apply changes
```

This commits the complete draft transactionally.

Examples:

```text
Place exact → Pull subtree at same target
Pull strength 50 → 80
Custom exclusions changed at same target
```

For Pull, Apply triggers one dynamic latest-result request.

For Place-only changes, apply exact composition without unnecessary dynamic work unless the change also changes effective Pull resolution elsewhere through deepest-wins precedence.

This precedence case is important:

```text
adding a child Place rule
→ removes child members from a parent Pull group
→ parent Pull membership fingerprint changes
→ dynamic worker may be required
```

Use resolved-rule fingerprints rather than guessing from behavior labels.

---

# Draft cancellation

Closing the editor, switching active folder, leaving Arrange mode, changing Scope/Layout, or pressing Escape with unsaved edits must not mutate persistence.

Policy:

## While dragging

```text
Escape
→ cancel target preview
→ return to editing draft
```

## While choosing scope

```text
Escape
→ leave Choose-members submode
→ retain draft
```

## While editing with dirty draft

Prompt compactly:

```text
Discard unsaved spatial changes?
```

or use a clear Apply / Cancel model that prevents accidental loss.

Do not create modal overload for every harmless folder hover.

---

# Rule dirty state

Show a restrained unsaved indicator only when the draft differs from the confirmed rule/default.

Do not persist editor draft across application restart.

Do not put draft state into view history.

Spatial rule edits are presentation configuration, not graph navigation checkpoints.

---

# Reset behavior

## Remove this rule

Deletes the exact-root Pull or Place rule after confirmation if necessary.

Consequences are recomputed through deepest-wins resolution:

```text
child Files may become governed by a parent rule
or
return to automatic behavior
```

## Reset all spatial rules

Deletes all Pull and Place rules with a clear confirmation including count.

Do not call this `Reset all folder positions` if Pull rules are also affected.

`Reset saved view`, graph preferences, Saved Filters, Visual Groups, and per-File sizes remain separate.

---

# Rule indicators and summaries

For each exact rule root, show a compact summary in the Network Explorer or spatial editor:

```text
Pull · This folder · 70%
Place · Folder + subfolders
Pull · Custom · 45%
```

For inactive rules:

```text
No visible members
```

Do not prune them.

For parent/child precedence, indicate:

```text
3 Files use a more-specific child rule
```

without listing private File names in logs.

---

# Automatic folder clustering remains independent

Keep separate:

```text
Automatic folder clustering strength
→ general automatic layout prior

Dynamic Pull rule strength
→ user-authored spatial rule
```

Do not synchronize or conflate the sliders.

Turning automatic folder clustering Off must not disable Pull rules.

Turning Pull strength to 0 must not change automatic folder clustering.

---

# QUERY1 / Hide / live updates

Rules remain folder-declarative.

## Query/Hide

- hidden members are inactive;
- no rule is deleted;
- restoring them re-resolves deepest-wins membership;
- an active drag/scope edit must recalculate or cancel safely if visible membership changes.

## Live topology change

If source updates while editing:

- preserve draft only if its root folder still exists as a normalized workspace folder;
- recompute full folder tree and effective visible membership;
- cancel active pointer preview;
- show `Graph changed; movement preview was canceled`;
- do not silently commit stale membership.

## Folder rename

V2 identity remains exact path.

- old rule becomes dormant;
- new folder has no inherited rule;
- editor closes or reports root unavailable;
- no fuzzy migration.

---

# Overlapping parent/child rule QA

Required production scenarios:

```text
Parent Pull subtree
Child Place exact
→ child members use Place only

Parent Place subtree
Child Pull subtree
→ child members use Pull only

Parent Pull custom excluding Child B
Child B own Pull
→ child rule still owns its members

Remove child rule
→ parent rule becomes effective immediately
```

No additive parent/child effects.

---

# Accessible non-pointer authoring

The complete rule must be authorable without dragging the WebGL graph.

Use DOM controls for:

- selecting/editing a folder rule;
- Behavior;
- Scope;
- Custom folder tree;
- Pull strength;
- current normalized target;
- arrow-key target nudging;
- Apply/Cancel;
- Remove rule;
- Reset all.

Preserve SPATIAL1B keyboard target nudging:

```text
Arrow: 0.02 normalized units
Shift + Arrow: 0.10
```

Update the full draft target; do not force Place/exact.

Screen-reader status should announce:

```text
Dynamic pull, Theory and subfolders, 70 percent
35 percent right, 20 percent down
24 visible Files included
3 Files use child rules
```

Do not require interaction with Sigma nodes.

---

# Custom graph-click accessibility relationship

Graph clicks in Choose-members mode are a shortcut only.

Every graph-click operation must have an equivalent DOM tree action.

Sigma remains `aria-hidden` as a visual graph.

The scope tree must expose inherited exclusion and child-rule ownership textually.

---

# Visual emphasis classifications

Define one explicit transient classification map for visible document nodes:

```text
active-member
excluded-candidate
shadowed-by-child-rule
outside-root
```

Optionally:

```text
active-root-direct-file
```

Derive it from folder keys, draft scope, and resolved winning rules.

Renderer styling consumes the classification map.

Do not let Sigma reimplement scope semantics.

Do not persist the map.

---

# Node/edge styling priority

Temporary editor emphasis must compose predictably:

```text
canonical/status base
→ Visual Group color/accent
→ per-File size
→ selection/hover
→ spatial-editor emphasis/fade
```

Spatial-editor emphasis may force opacity/outline/label visibility but must not rewrite group membership or stored color.

For Pull editing, keep boundary-crossing reference edges visible enough to show which outside nodes may react.

---

# Target and settle status

Use compact transient statuses:

```text
Moving Pull target…
Saving spatial rule…
Settling dynamic pull…
Dynamic pull applied
Fixed placement saved
Dynamic pull failed — automatic layout is shown
```

Successful final status should disappear after a short accessible announcement rather than consuming permanent canvas space.

Do not report success before persistence and authoritative renderer adoption.

---

# Dynamic worker interaction policy

SPATIAL2A evidence shows 5,000-node dynamic work can range from hundreds of milliseconds to a cold outlier near two seconds.

Therefore initial production policy:

```text
scope/strength slider edits
→ draft only

pointer drag
→ rigid rAF preview only

Apply/release
→ one latest-result dynamic worker
```

Do not implement continuous Pull-worker previews during dragging.

Do not precompute dynamic results for every hovered folder.

If small-graph release-time settling is consistently fast, document it; do not create a hidden scale-dependent continuous mode in this milestone.

---

# Dynamic-result adoption and preview generation

Add a precise generation/identity contract.

A retained Pull preview may clear only when:

```text
committed registry contains the expected rule
AND
latest spatial-influence result/fallback corresponds to the resulting dynamic fingerprint/generation
```

Stale dynamic success, stale failure, or another folder edit must not clear/adopt the wrong preview.

If the user edits another rule while settling:

- supersede the older dynamic request;
- latest registry wins;
- retain only the latest relevant transient preview;
- no serial worker backlog.

---

# Dynamic cache behavior

Keep current separation:

```text
base automatic cache
→ independent of spatial rules

dynamic cache
→ Pull rules + resolved memberships + targets + strengths

fixed composition
→ no dynamic fingerprint unless it changes Pull membership through precedence
```

Editor draft is excluded until Apply/release.

Changing only an uncommitted draft must not pollute caches.

Place target changes should not invalidate dynamic cache when resolved Pull membership is unchanged.

---

# Existing fixed Arrange compatibility

Regression-test the current workflow:

```text
old migrated Place/exact rule
→ opens as Fixed placement / This folder
→ drag behaves exactly as before
→ zero dynamic worker if Pull resolution is unchanged
```

Users must not lose saved fixed anchors.

No schema v3 is needed.

Persistence continues reading v1/v2 and writing v2.

---

# Scope-tree scale and virtualization

Test with:

- shallow workspace;
- 100+ folders;
- deeply nested folder tree;
- root `.`;
- folders containing only subfolders;
- query-hidden branches.

Use virtualization or bounded rendering consistent with current Network Explorer if needed.

Do not let opening Custom scope mount the entire large-vault document list.

The tree operates on folders, not Files.

---

# Performance instrumentation

Add aggregate phases/counters where useful:

```text
spatial-rule-draft-resolution
spatial-scope-visualization
spatial-rigid-preview
spatial-rule-persist
spatial-pull-settle
```

Operation oracles:

## Behavior/scope/strength draft change

```text
0 KG6
0 topology
0 automatic layout
0 dynamic worker until Apply
```

## Custom graph toggle

```text
scope model + style refresh only
```

## Pointer preview

```text
0 KG6
0 topology
0 automatic layout
0 dynamic worker
≤1 sparse position refresh per animation frame
```

## Pull Apply/release

```text
1 persistence transaction
≤1 latest dynamic request
1 final composition/adoption
```

## Place Apply/release

```text
1 persistence transaction
0 dynamic requests if resolved Pull fingerprint is unchanged
1 final composition/adoption
```

---

# Tests — draft/editor model

Cover:

1. new folder defaults to Pull/exact/strength 70/current target;
2. existing migrated Place/exact loads unchanged;
3. existing Pull custom loads unchanged;
4. behavior switch preserves target/scope;
5. Pull→Place removes strength;
6. Place→Pull restores/defaults strength;
7. This folder mapping;
8. Folder + subfolders mapping;
9. Custom mapping;
10. direct-root include toggle;
11. exclusion add/remove;
12. excluded ancestor behavior;
13. dirty-state comparison;
14. Cancel restores confirmed rule;
15. Apply commits full rule;
16. switching folder handles dirty draft safely.

---

# Tests — scope model and visualization

Cover:

1. root folder `.`;
2. exact direct Files only;
3. subtree direct + descendants;
4. subtree without direct root Files;
5. custom one exclusion;
6. nested exclusions normalize;
7. hidden folders remain in full scope tree;
8. visible counts are projection-scoped;
9. active members classified correctly;
10. excluded candidates classified correctly;
11. outside-root classified correctly;
12. child-rule shadowing classified correctly;
13. most-specific winner both behavior directions;
14. graph click toggles exact descendant subtree;
15. direct-root File click toggles direct-root group;
16. child-rule-owned click does not mutate parent draft;
17. reduced-motion disables pulse.

---

# Tests — generalized target preview

Cover:

1. exact Pull members preview rigidly;
2. subtree Pull members preview rigidly;
3. Custom Pull members preview rigidly;
4. Place subtree/custom preview;
5. child-rule members excluded from parent preview;
6. no initial jump;
7. all effective members receive equal delta;
8. outside nodes stay fixed during raw drag;
9. edges follow moved members;
10. preview uses current dynamic geometry but normalizes target against base frame;
11. repeated preview has no drift;
12. cancel restores confirmed dynamic+fixed display.

---

# Tests — Pull release and settling

Cover:

1. successful Pull release persists v2 rule;
2. rigid preview remains while latest worker runs;
3. matching dynamic result clears preview;
4. connected outside nodes react after settle;
5. centroid remains soft rather than exact at nonzero strength;
6. strength 0 exact base bypass;
7. stale result cannot clear latest preview;
8. stale failure cannot override latest edit;
9. worker failure clears preview and shows fallback;
10. rule remains persisted after worker failure;
11. retry can re-run dynamic refinement;
12. no base-layout/cache contamination.

---

# Tests — Place compatibility and precedence

Cover:

1. Place/exact old drag unchanged;
2. Place/subtree exact final translation;
3. Place/custom exact final translation;
4. fixed target after current dynamic layer;
5. fixed-only target update causes zero dynamic worker;
6. child Place changes parent Pull membership and triggers appropriate dynamic recompute;
7. child Pull under parent Place wins;
8. removing child rule reactivates parent;
9. parent/child effects never add;
10. remove/reset operations use generic rules.

---

# Tests — persistence and failure

Cover:

1. durable Apply writes before adoption;
2. session-only Apply adopts in memory;
3. corrupt registry blocks editing;
4. recovery resets corruption explicitly;
5. write failure preserves confirmed rule/display;
6. draft never persists accidentally;
7. v1 read migration still writes only after first edit;
8. v2 round-trip exact;
9. workspace A/B isolation;
10. Reset saved view unaffected;
11. graph preferences unaffected;
12. Saved Filters/Visual Groups/per-File sizes unaffected.

---

# Browser QA

Production browser matrix:

1. create new default Pull rule by dragging;
2. observe rigid immediate preview;
3. release and observe surrounding graph settle/react;
4. edit Pull strength 0/25/50/75/100 using Apply;
5. change Pull→Place and Place→Pull;
6. This folder / Folder + subfolders;
7. Custom direct-root inclusion;
8. Custom exclude/reinclude child subtrees;
9. graph-click custom selection;
10. brief pulse + reduced-motion behavior;
11. child-rule precedence and edit handoff;
12. parent Pull + child Place;
13. parent Place + child Pull;
14. target marker behavior;
15. Reset one / Reset all;
16. query Hide/Restore;
17. live update while editing/dragging;
18. Visual Groups + File sizes;
19. automatic folder clustering On/Off;
20. short/narrow/maximized layout;
21. keyboard-only rule authoring;
22. screen-reader status/labels;
23. no console errors/warnings.

---

# Mandatory release Tauri QA gate

This feature is pointer- and worker-heavy. Browser QA and release startup smoke are not sufficient.

Use the freshly built optimized executable.

Required native checklist:

1. Open a stable synthetic vault containing parent/child folders and cross-folder references.
2. Create a Dynamic pull rule by mouse drag.
3. Confirm immediate rigid preview, then asynchronous surrounding-node reaction after release.
4. Repeat at multiple camera zoom/pan states.
5. Test physical precision-touchpad wheel/pinch outside active drag.
6. Test This folder, Folder + subfolders, and Custom.
7. In Custom, deselect/reselect subfolders through both graph and DOM tree.
8. Test root direct-File inclusion.
9. Test parent Pull + child Place and the reverse.
10. Confirm target marker and included/excluded/shadowed visual states.
11. Restart/reselect the vault and verify rules restore.
12. Test query Hide/Restore and one live create/delete.
13. Test write-failure/corrupt recovery if practical.
14. Confirm Fixed placement still behaves exactly.
15. Confirm no stuck dragging, camera theft, or CSP/worker errors.

**Merge policy:**

If the implementation environment cannot drive native pointer interaction:

```text
build the exact release executable
provide its full path and this checklist
leave the PR draft/unmerged
stop for explicit user QA
```

Merge only after:

- agent-performed native interaction QA passes; or
- the user explicitly reports the checklist passed and approves merge.

Do not convert startup smoke into pointer QA.

---

# Privacy

Persisted rules contain only:

```text
workspace ID
normalized folder keys
behavior
scope/exclusions
normalized target
Pull strength
schema metadata
```

No:

- source body;
- absolute paths;
- File IDs as scope membership;
- resolved member lists;
- raw graph coordinates;
- camera state;
- telemetry;
- network transmission.

Do not commit private folder names, screenshots, registries, or graph topology.

Use generic synthetic fixtures.

---

# Dependencies

Expected external runtime additions:

```text
zero
```

Use current React, Sigma, Graphology, ForceAtlas2, and internal folder-tree primitives.

Do not add a form library, tree library, drag library, animation library, or state-management library.

---

# ADR

Add the next available concise ADR recording:

1. production spatial authoring supports Dynamic pull and Fixed placement;
2. new unruled folders default to Pull/exact with evidence-backed strength;
3. production scope supports exact, full subtree, and custom subtree exclusions;
4. Custom scope is declarative and folder-based, never a File-ID list;
5. deepest matching child rule remains authoritative;
6. scope visualization distinguishes included, excluded, child-owned, and unrelated nodes;
7. graph-click scope selection is a shortcut to an accessible DOM tree;
8. raw drag uses rigid sparse preview for both behaviors;
9. Pull dynamic refinement occurs after Apply/release, not every pointer event;
10. retained preview clears only after matching authoritative adoption/failure;
11. Place remains exact post-dynamic composition;
12. all edits persist transactionally before durable adoption;
13. dynamic and automatic folder-clustering strengths remain independent;
14. no schema-v3, raw coordinates, Saved Views, or individual movement are introduced.

---

# Documentation

Update at least:

```text
packages/spatial-overrides/README.md
packages/renderer-sigma/README.md
apps/web/src/spatial-overrides/README.md
apps/web/src/persistence/README.md
apps/web/src/components/README.md
apps/web/README.md
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
```

Update the development harness so it reuses production rule-editor/preview primitives where practical rather than maintaining a second semantic implementation.

---

# Roadmap

Preserve active KG14 and HIER track status.

If all gates pass:

```text
SPATIAL1 — Complete
SPATIAL2 — Complete
SPATIAL2A — Complete
SPATIAL2B — Complete
SAVED1 — Later
```

Do not start SAVED1.

---

# Scope

## In scope

- production Pull/Place behavior selector;
- production exact/subtree/custom scope selector;
- direct-root inclusion;
- subtree exclusions;
- hierarchical full-workspace scope tree;
- included/excluded/child-owned/unrelated visualization;
- brief graph toggle pulse;
- graph-click custom-scope shortcut;
- child-rule precedence UX;
- generic rule session mutations;
- default Pull rule;
- Pull strength editor;
- generalized resolved-member rigid preview;
- release-time dynamic settling;
- target marker;
- preview/adoption generation safety;
- rule indicators/summaries;
- reset one/all rules;
- accessible keyboard/DOM authoring;
- QUERY1/live update/size/group compatibility;
- browser + mandatory native QA;
- performance/tests/docs/ADR/roadmap;
- prompt archive;
- PR/CI/cleanup.

## Explicitly out of scope

Do not implement:

- continuous Pull worker on pointermove;
- additive parent/child forces;
- per-File membership exceptions;
- positive re-inclusion beneath an excluded subtree;
- individual node movement;
- pins;
- Focus/Hierarchy spatial rules;
- collision solver;
- post-fixed-placement relaxation;
- folder rename reconciliation;
- raw coordinate persistence;
- multiple spatial profiles;
- Saved Views;
- Adaptive Layout;
- source write-back;
- analytics.

---

# Suggested implementation sequence

1. Check PR #60 and other worktree status; sync latest `main`.
2. Generalize `useSpatialOverrides` to transactional rule operations.
3. Add pure draft/preset/dirty-state helpers.
4. Build full-workspace folder-scope editor model.
5. Add scope classifications and child-rule precedence model.
6. Evolve Arrange panel to behavior/scope/strength editor.
7. Add accessible custom folder tree.
8. Add Choose-members graph submode and visualization map.
9. Generalize preview capture from exact folder to effective member set.
10. Add target marker.
11. Implement Pull rigid preview + retained settling handoff.
12. Implement Place subtree/custom authoritative composition.
13. Add generic reset/remove actions and indicators.
14. Handle source/query/layout changes and cancellation.
15. Add operation/performance tests.
16. Run full focused suites and builds.
17. Production browser QA.
18. Build optimized release executable.
19. Complete native QA or hand off draft PR/checklist to user.
20. After native approval, update docs/ADR/roadmap.
21. Archive this prompt under `history-implementations/`.
22. PR CI → merge → post-merge CI → cleanup.
23. Stop before SAVED1 or individual movement.

---

# Validation commands

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/spatial-overrides typecheck
pnpm exec vitest run packages/spatial-overrides

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium
pnpm benchmark:performance -- --profile small

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Also run:

```text
Pull/Place editor matrix
exact/subtree/custom scope matrix
full-workspace folder-tree scale test
parent/child precedence both directions
custom graph toggle + DOM parity
Pull rigid-preview → dynamic-settle oracle
preview generation/stale-result oracle
Place-only zero-dynamic-worker oracle
query Hide/Restore
live topology change during edit/drag
Visual Group + File-size composition
small/medium/stress dynamic performance
production browser matrix
mandatory release Tauri physical pointer/touchpad matrix
```

PR CI and post-merge `main` CI must pass after the native merge gate is released.

---

# Exit gate

SPATIAL2B is complete only when:

1. production authoring exposes Dynamic pull and Fixed placement.
2. existing Place/exact rules load unchanged.
3. new unruled folders default to Dynamic pull.
4. default Pull strength is validated and documented.
5. This folder maps to exact scope.
6. Folder + subfolders maps to full subtree scope.
7. Custom exposes direct-root inclusion and subtree exclusions.
8. scope is declarative, not a File-ID list.
9. full canonical folder tree drives scope authoring.
10. query-hidden folders remain authorable/dormant.
11. excluded subtrees remain a normalized minimal antichain.
12. unsupported re-inclusion below excluded ancestors is not faked.
13. child-rule-owned subtrees are clearly identified.
14. deepest matching rule remains sole winner.
15. parent editing never silently deletes child rules.
16. included members are prominently highlighted even without dragging.
17. excluded candidates are visibly dimmed.
18. unrelated graph is faded.
19. child-rule-owned members have distinct treatment.
20. incident boundary edges remain visible enough to understand Pull reaction.
21. Visual Group colors remain intact.
22. per-File sizes remain intact.
23. brief toggle feedback respects reduced motion.
24. graph click in Choose-members mode toggles folder subtrees, not individual Files.
25. direct-root File click toggles the whole direct-root group.
26. the DOM scope tree provides equivalent accessible operations.
27. target dragging is disabled during Choose-members submode.
28. Pull strength is integer 0–100.
29. strength 100 is described as soft, not exact.
30. behavior/scope/strength edits remain draft until Apply/release.
31. draft changes cause zero KG6/topology/automatic-layout work.
32. draft changes cause zero dynamic workers before Apply.
33. target marker is non-semantic and pointer-transparent.
34. generalized drag preview uses effective deepest-wins members.
35. parent preview excludes child-rule-owned members.
36. raw pointer preview remains rigid and immediate for Pull and Place.
37. pointer preview causes zero Pull worker requests.
38. pointer preview remains rAF-coalesced and sparse.
39. Pull release persists the complete v2 rule.
40. Pull rigid preview remains visible while matching worker settles.
41. surrounding connected nodes react after Pull adoption.
42. matching latest result clears the retained preview.
43. stale results/failures cannot clear a newer preview.
44. Pull worker failure clears preview and shows base-plus-fixed fallback.
45. persisted Pull rule remains available for retry after worker failure.
46. Place release remains exact and flicker-free.
47. Place-only target changes cause zero dynamic worker when Pull resolution is unchanged.
48. precedence-induced Pull membership changes trigger appropriate recomputation.
49. Apply changes works without target movement.
50. successful durable edits persist before adoption.
51. failed durable edits preserve confirmed registry/positions.
52. session-only edits work with explicit status.
53. corrupt registry blocks editing and exposes recovery.
54. Reset this rule removes Pull or Place at the exact root.
55. Reset all removes every spatial rule with confirmation.
56. Reset saved view remains independent.
57. spatial edits remain outside navigation history.
58. rule badges/summaries accurately state behavior/scope/strength.
59. inactive rules are not pruned.
60. QUERY1 Hide/Restore preserves rules.
61. live topology changes re-resolve declarative membership.
62. active previews cancel safely when membership/frame changes.
63. exact-path folder rename limitation remains explicit.
64. automatic folder-clustering strength remains independent.
65. schema remains v2 and v1 migration remains correct.
66. no raw positions or resolved member IDs are persisted.
67. no external runtime dependency is added.
68. small/medium performance evidence is recorded.
69. 5,000-node scale limitations are reported honestly.
70. browser production QA passes.
71. release Tauri physical pointer interaction passes or receives explicit user approval before merge.
72. physical precision-touchpad behavior is checked.
73. agent does not substitute startup smoke for native interaction QA.
74. existing tests remain green.
75. desktop release build passes.
76. docs/ADR/roadmap are reconciled.
77. SPATIAL2 is marked complete.
78. SAVED1 remains later/not started.
79. prompt is archived.
80. PR CI passes.
81. post-merge CI passes.
82. task branch/worktree cleanup does not touch SPACING1B/HIER2.

Do not start SAVED1 automatically.

---

# Final report

## 1. Summary

What Pull/Place and hierarchical scope authoring now supports.

## 2. Production interaction

Arrange entry, folder activation, editor, Custom selection, target drag, Apply/Cancel.

## 3. Rule model

Behavior, scope presets, direct-root inclusion, exclusions, strength.

## 4. Scope visualization

Included, excluded, child-owned, unrelated node/edge treatment.

## 5. Parent/child precedence

Deepest-wins UX and edit/remove behavior.

## 6. Pull interaction

Rigid immediate preview followed by release-time dynamic settling.

## 7. Place compatibility

Existing exact placement and new hierarchical scopes.

## 8. Persistence/failure

Write-before-adopt, session-only, corruption, write failure, reset.

## 9. Accessibility

DOM folder tree, keyboard target nudging, announcements, graph shortcut parity.

## 10. QUERY1 / live updates / composition

Visual Groups, File sizes, automatic folder clustering, Hide/Restore.

## 11. Performance

Draft, scope visualization, rigid preview, dynamic settle, worker/cache evidence.

## 12. Tests / browser QA

## 13. Native release QA

List each physical-pointer/touchpad scenario actually completed. If user-performed, state that precisely.

## 14. Privacy

## 15. Dependencies

Expected external additions: zero.

## 16. Files changed

## 17. ADR / roadmap

Confirm:

```text
SPATIAL1 complete
SPATIAL2 complete
SPATIAL2A complete
SPATIAL2B complete
SAVED1 later
```

## 18. Deviations / warnings

Surface scale limits, target-settling differences, custom-scope limitations, exact-path identity, or interaction compromises.

## 19. Future handoff

State what SAVED1 or later individual positioning can rely on without implementing either:

- complete serializable spatial-rule registry;
- Pull/Place authoring;
- hierarchical scopes;
- normalized targets;
- transactional persistence;
- direct manipulation;
- dynamic worker/cache;
- fixed composition;
- accessible rule editor;
- no canonical graph changes.

Do not start SAVED1 automatically.
