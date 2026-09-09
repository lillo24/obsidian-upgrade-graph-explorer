# HIER4B-FIX1 — Per-Folder Soft Cluster Scope + Spatial Four-Side File Ports

**Task type:** HIER4B interaction semantics / workspace-scoped folder grouping / soft-layout endpoint geometry / live graphical evaluation

## Goal

Continue the existing **unmerged HIER4B Soft Folder Clusters** branch and add the two missing behaviors discovered during live QA:

1. **Per-folder spatial grouping level**
   - Soft Folder Clusters currently clusters by exact source folder.
   - The user needs to decide the useful spatial level independently for each folder.
   - Example: one branch of the vault may be grouped at `Pattern Theory/`, while another remains split into `Language/Pragmatics/`, `Language/Grammar/`, etc.
   - The folder guide itself should expose the current spatial grouping and allow the user to move that cluster **one folder level up**.
   - A separate action should perform the same promotion for the clicked cluster **and its sibling folders**.
   - This changes only Soft Folder Cluster grouping, never the real Obsidian folder structure.

2. **Spatial four-side File attachments in Soft mode**
   - Directional Bands has a meaningful left/right semantic axis.
   - Soft Folder Clusters deliberately removes that strict incoming-left / outgoing-right placement rule.
   - File-to-external connections therefore must stop all exiting from the same right-side handle.
   - In Soft mode, File/document endpoints should choose among:
     - left center,
     - right center,
     - top center,
     - bottom center,
     based on the final relative geometry of the connected endpoint.
   - This selection must be used by Soft-layout crossing/readability evaluation, not applied as a cosmetic renderer change after layout.

Do **not** merge HIER4B yet.

After implementation, regenerate the optimized desktop build and ask the user to evaluate HIER4B again.

---

# Current branch / baseline

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Continue:

```text
branch:
codex/hier4b-soft-folder-clusters
```

Current pushed HIER4B guide commit at prompt-writing time:

```text
5276328097f6f7ab7a0119f752968e4a6c3fa891
feat: add soft folder cluster guides
```

Its parent HIER4B implementation commit:

```text
a4f1f84bae38d3772ab8b809ec094796f372e717
```

No HIER4B PR has been created or merged.

The current branch already has:

```text
Modular Preview

Macro layout:
- Directional Bands              [default]
- Soft Folder Clusters           [experimental]

Soft Folder strength:
0..100
default 50
Soft mode only

Internal layout:
- Adaptive Compass
- Vertical Spine

Heading order:
- Crossing optimized
- Document order

Folder guides:
- On / Off

Connection style:
- Direct
- Electronic
```

Current Soft guide behavior:

```text
Directional Bands
→ horizontal exact-folder strips

Soft Folder Clusters
→ spatial folder regions / capsules / islands
```

Preserve all of that.

Current validation before this fix reportedly passed:

```text
207 test files
1,690 tests
web build
desktop check/build
HIER4B hard gates
strengths 0/25/50/75/100
guide toggle = zero layout/convergence change
```

Do not regress it.

Before editing:

1. inspect branch HEAD and working tree;
2. inspect open PRs/worktrees;
3. preserve unrelated concurrent work;
4. do not reset to old `main`;
5. continue this same HIER4B branch;
6. do not create/merge the HIER4B PR until the new live QA passes.

---

# Important separation of concepts

Keep these separate:

```text
REAL FOLDER
Obsidian / canonical source folder identity

SOFT CLUSTER GROUP
which folder scope Soft Folder Clusters currently treats as one spatial group

DIRECTIONAL FOLDER BAND
HIER4A exact-folder horizontal band semantics

FOLDER GUIDE
renderer visualization of the active macro layout's grouping

VISUAL GROUP
GROUP1 styling/classification

SPATIAL1/SPATIAL2
other Network spatial-intent systems
```

A Soft cluster override must never mutate:

```text
source path
Markdown
canonical folder identity
Directional Band membership
Visual Group membership
```

---

# PART A — Per-folder Soft Cluster scope

## A1. Do not use one global folder depth

Reject a global control such as:

```text
Cluster depth:
1 / 2 / 3
```

because different areas of the vault need different abstraction levels simultaneously.

Required model:

```text
exact folder A
→ may cluster at A

exact folder B/C
→ may cluster at B

exact folder D/E/F
→ may cluster at D/E/F
```

within the same graph.

---

# A2. Sparse per-folder spatial overrides

Represent the user intent as a sparse mapping from **exact source folder** to an ancestor folder used only by Soft clustering.

Conceptually:

```ts
interface SoftFolderClusterScopeOverride {
  readonly exactFolderKey: WorkspaceFolderKey;
  readonly spatialGroupKey: WorkspaceFolderKey;
}
```

Invariant:

```text
spatialGroupKey
must be
exactFolderKey itself
or
an ancestor of exactFolderKey
```

Prefer storing only non-default overrides:

```text
no override
→ effective group = exact folder

override A/Sub → A
→ effective group = A
```

Do not persist a duplicate identity mapping for every folder.

---

# A3. Effective Soft group key

For a visible non-filtered File whose exact folder is:

```text
Language/Pragmatics/
```

default:

```text
effectiveSoftGroup =
Language/Pragmatics/
```

after user promotes it once:

```text
effectiveSoftGroup =
Language/
```

after another promotion:

```text
effectiveSoftGroup =
workspace root
```

if root is a legal parent.

This is only the grouping key used by:

```text
Soft Folder Clusters
Soft folder guides
Soft folder strength
```

Directional Bands must still see:

```text
Language/Pragmatics/
```

as the exact folder.

---

# A4. Natural merging with parent direct Files

Suppose:

```text
Language/
  ParentNote.md
  Pragmatics/
    A.md
    B.md
  Grammar/
    C.md
```

If `Pragmatics/` is promoted to:

```text
Language/
```

then Soft clustering should naturally treat:

```text
ParentNote.md
A.md
B.md
```

as one effective `Language/` spatial group.

`Grammar/` remains independent unless explicitly promoted.

This is intentional.

---

# A5. Natural merging of independently promoted children

If later:

```text
Grammar/
→ promote to Language/
```

then both children share:

```text
effectiveSoftGroup = Language/
```

and become one Soft cluster guide/group.

Do not preserve two separate guides that happen to have the same effective group key.

---

# A6. Repeated promotion

The interaction must support repeated upward abstraction.

Example:

```text
Language/Pragmatics/Experimental/
        ↑
Language/Pragmatics/
        ↑
Language/
        ↑
root/
```

Each action moves the **current effective group** one hierarchy level upward.

Do not jump directly to root.

---

# A7. Guide ownership after merging

A Soft folder guide may represent more than one exact source folder after promotions.

Therefore the guide needs renderer-safe metadata conceptually like:

```ts
interface SoftFolderGuideGroup {
  readonly spatialGroupKey: WorkspaceFolderKey;
  readonly exactFolderKeys: readonly WorkspaceFolderKey[];
  readonly moduleIds: readonly EntityId[];
}
```

The guide label shows:

```text
current spatialGroupKey
```

not an arbitrary member folder.

On hover/focus it may also show:

```text
Source folders: N
```

and, for small N, the underlying exact folders.

Do not dump huge folder lists into the canvas.

---

# A8. User interaction on the Soft guide

The user specifically wants the folder guideline itself to expose the grouping level.

Soft-mode guide interaction should be:

```text
hover/focus folder guide label
→ reveal a small toolbar/popover
```

Suggested content:

```text
Spatial group
Language/Pragmatics/

Source folders
1

[↑ Group into Language/]
[↑ Group into Language/ + siblings]
[Reset]
```

Exact copy can be polished.

The first action is mandatory.

The sibling action is mandatory.

Reset is strongly recommended so the feature is reversible without editing storage manually.

---

# A9. Do not make the whole hull steal pointer events

Current folder guides were deliberately non-interactive renderer overlays.

Do not turn the full filled region into one giant pointer blocker.

Preferred:

```text
guide fill / hull
→ pointer-events: none

small label/header/chip
→ interactive

hover/focus label
→ toolbar/popover
```

This preserves:

```text
node hover
edge hover
pan
zoom
drag
selection
```

inside cluster regions.

---

# A10. Keyboard accessibility

The guide label/action surface must be keyboard reachable.

At minimum:

```text
Tab → folder-guide label/action
Enter/Space → open or expose actions
buttons usable by keyboard
Esc / blur → close
```

Accessible names should distinguish:

```text
Promote only this spatial group
Promote this group and sibling folders
Reset this spatial group
```

Do not make hover the only path.

---

# A11. "Group into parent" semantics

Let current guide effective group be:

```text
G
```

and its parent be:

```text
P = parent(G)
```

For every exact folder currently represented by the clicked guide:

```text
set sparse override:
exactFolder → P
```

This means the whole currently visible/effective cluster moves up one spatial level.

Example:

```text
guide:
Language/Pragmatics/

underlying exact folders:
Language/Pragmatics/

click ↑
→ exact Pragmatics maps to Language/
```

If the guide already represents several exact folders:

```text
all member exact folders
→ target P
```

so the merged group moves as one unit.

---

# A12. "Group into parent + siblings" semantics

This action means:

> Promote the clicked group one level up, and also promote its sibling folder groups at that same hierarchy level into the same parent spatial group.

Let:

```text
G = current effective group key
P = parent(G)
```

Find the sibling folders/groups whose current effective key has:

```text
parent(effectiveKey) = P
```

and promote their represented exact folders to:

```text
P
```

along with the clicked guide.

Example:

```text
Language/
  Pragmatics/
  Grammar/
  Semantics/
```

clicked:

```text
Pragmatics/
```

action:

```text
↑ parent + siblings
```

results:

```text
Pragmatics exact folders → Language/
Grammar exact folders    → Language/
Semantics exact folders  → Language/
```

and one effective `Language/` Soft cluster emerges.

---

# A13. Sibling discovery should be workspace-stable

Do not base sibling semantics solely on:

```text
what happens to be visible after current query/filter
```

if the application already has a source-neutral workspace folder registry available.

Preferred:

```text
derive sibling exact folders from the current workspace's canonical/source-neutral folder keys
```

not from the filesystem.

Then:

```text
hide sibling
apply "parent + siblings"
show sibling later
→ it remains promoted
```

If the current architecture only exposes the Focus neighborhood folder tree at this boundary, inspect existing workspace registries before inventing new I/O.

Do not read the filesystem from the renderer.

---

# A14. Workspace-scoped persistence

These overrides are vault/workspace-specific because folder keys are workspace-specific.

Do **not** store them as one global cross-vault `GraphPreferences` dictionary.

Persist them under the stable workspace identity using the existing app-local workspace-scoped persistence architecture where possible.

Conceptually:

```text
workspaceId
→ soft cluster scope overrides
```

Requirements:

- survive app reload;
- survive desktop restart;
- survive vault reopen;
- do not leak to another vault;
- no Markdown write;
- no absolute path persistence unless current safe storage already uses normalized workspace keys.

---

# A15. Do not misuse SPATIAL rules

Inspect existing SPATIAL1/SPATIAL2 persistence before implementing.

Reuse generic workspace-scoped storage infrastructure if clean.

But do not silently redefine:

```text
SPATIAL2 folder rules
```

to mean HIER4B Soft cluster grouping.

The semantics are different.

A narrow HIER4B workspace preference/session is acceptable.

---

# A16. Reconciliation after folder changes

On live vault changes:

- exact folder deleted;
- folder renamed;
- File moved;
- hierarchy changes;

reconcile sparse overrides conservatively.

Rules:

```text
missing exact folder key
→ ignore/prune stale override

target no longer ancestor of exact folder
→ reject/prune invalid override

still-valid mapping
→ keep
```

Do not crash the layout worker because of stale app-local preference data.

Do not invent identity migration across arbitrary folder renames unless stable folder identity already exists.

---

# A17. Reset current group

Recommended behavior:

```text
Reset
→ remove overrides for all exact folders represented by this current guide
```

They return to their exact-folder grouping on the next Soft layout.

If this splits one merged guide into several exact guides, that is expected.

---

# A18. Optional reset-all

If the current Sandbox UI has a natural location, add:

```text
Reset Soft folder grouping
```

to remove all workspace-scoped Soft cluster scope overrides.

Do not make this a requirement if it complicates the UI unnecessarily; per-guide Reset is the hard requirement.

---

# A19. Directional Bands completely ignore these overrides

Hard invariant:

```text
switch Soft Folder Clusters → Directional Bands
```

Directional output must use:

```text
exact source folders
```

exactly as HIER4A did.

Soft scope overrides must not change:

- horizontal Directional strips;
- Directional band membership;
- Directional node positions;
- Directional exact output;
- HIER4A regressions.

Add byte-identical Directional oracle tests with non-empty Soft overrides.

---

# A20. Soft strength operates on effective groups

In Soft mode:

```text
strength 0..100
```

must apply to:

```text
effectiveSoftGroup
```

not always the exact folder.

Example:

```text
Pragmatics/ → Language/
Grammar/ remains exact
```

At strength 100:

```text
Language/ group attraction includes promoted Pragmatics + direct Language files
Grammar/ stays independent
```

---

# A21. Strength 0 behavior

At:

```text
strength = 0
```

scope overrides may change:

```text
guide membership/labels
```

but should not exert Soft attraction.

Geometry should remain consistent with the current Soft-strength-0 contract.

Do not turn grouping scope itself into a hidden force at strength 0.

---

# A22. Soft guide visualization follows effective groups

The existing Soft cluster guides currently visualize exact-folder groups.

After this fix they must visualize:

```text
effective Soft spatial groups
```

So:

```text
exact:
Language/Pragmatics/
Language/Grammar/

both promoted to:
Language/
```

renders:

```text
one Language/ spatial guide
```

not two old child guides.

Directional mode continues rendering exact horizontal strips.

---

# A23. Disconnected islands still allowed

Preserve the current guide rule:

```text
if one effective group forms clearly disconnected spatial islands
→ multiple guide regions for the same spatialGroupKey are allowed
```

Do not create a giant misleading hull through unrelated Files merely because they share an effective group.

The interactive label may appear on each island, but actions operate on the whole effective group.

Make this clear in accessible text if practical:

```text
Language/ — island 1 of 2
```

or keep one primary interactive label and non-interactive secondary island labels.

Choose the least cluttered design.

---

# PART B — Four-side File attachment policy for Soft mode

## B1. Existing handles already support four sides

The shared React Flow entity nodes already expose:

```text
source-top
target-top
source-bottom
target-bottom
source-left
target-left
source-right
target-right
```

Do not create duplicate handles.

Use the existing four-side handle infrastructure.

---

# B2. Directional attachment policy remains unchanged

In:

```text
Directional Bands
```

retain the accepted HIER4A endpoint-facing logic.

Do not replace it with spatial cardinal attachment.

Directional mode intentionally encodes:

```text
incoming ← Focus → outgoing
```

and its endpoint geometry has already passed HIER4A validation.

Hard:

```text
Directional attachments/output byte-identical
```

except renderer-only state unrelated to layout.

---

# B3. Soft File endpoints use spatial cardinal sides

In:

```text
Soft Folder Clusters
```

for any visible **File/document endpoint** of a cross-module reference, choose the File handle from final relative geometry.

Conceptual rule:

```ts
dx = otherCenterX - fileCenterX
dy = otherCenterY - fileCenterY

if abs(dx) >= abs(dy):
    dx >= 0 ? RIGHT : LEFT
else:
    dy >= 0 ? BOTTOM : TOP
```

Equivalent deterministic angle-sector logic is acceptable.

The intent is:

```text
mostly right  → right center
mostly left   → left center
mostly above  → top center
mostly below  → bottom center
```

---

# B4. Target side mirrors geometry independently

For the opposite File endpoint, compute its side relative to the other endpoint from its own perspective.

For a File-to-File edge:

```text
source side
and
target side
```

are both chosen spatially.

Typical:

```text
source target is right
→ source RIGHT

target source is left
→ target LEFT
```

For vertical relationship:

```text
source BOTTOM
target TOP
```

---

# B5. Apply to collapsed Files too

When a File's Heading endpoints are collapsed/rolled up to the File:

```text
Soft mode
→ rolled-up File endpoint also gets cardinal side
```

Do not route all collapsed relationships through right.

This is one of the primary user-visible fixes.

---

# B6. Exact Heading/Block endpoints retain richer semantics

Do **not** replace Adaptive Compass precise Heading/Block attachment decisions with generic cardinal File logic.

If endpoint is:

```text
Heading
Block
```

keep the current exact endpoint/Compass-aware attachment behavior unless existing code already represents it as `auto`.

This task is primarily:

```text
File/document endpoint
→ four spatial sides in Soft mode
```

not a rewrite of precise Heading layout.

---

# B7. Module-anchor / filtered fallback

Inspect current fallback semantics.

If a Soft cross-module edge terminates on an anonymous module anchor rather than a visible File:

- preserve privacy;
- choose a spatially sensible cardinal side if the anchor already has four handles and this can be done cleanly;
- otherwise preserve current fallback behavior.

Do not turn fallback anchors into visible Files.

This is secondary to the File endpoint requirement.

---

# B8. Attachment side must participate in Soft quality scoring

Do **not** implement:

```text
layout/scoring assumes right/left
then renderer cosmetically switches to top/bottom
```

That would make the solver optimize the wrong geometry.

Instead, for each Soft candidate:

```text
candidate positions
→ derive candidate cardinal File sides
→ derive attachment coordinates
→ compute crossings / span / collision/readability metrics
→ score candidate
```

Only then select the candidate.

---

# B9. Recompute after geometry changes

Soft Folder Clusters includes:

```text
forces/attraction
collision corrections
bounded convergence
joint Compass/module work
```

Whenever a candidate's relative geometry changes enough to be rescored:

```text
recompute cardinal File sides
```

Do not cache a right/top/etc. decision from stale pre-correction positions.

Final attachment plan is derived from final accepted positions.

---

# B10. Complexity

Cardinal side selection is:

```text
O(reference endpoints)
```

per score evaluation.

It should be cheap.

Instrument if useful, but do not add a complex directional optimizer for this.

No combinatorial port search is requested.

The rule is deterministic geometry classification.

---

# B11. Center reference point

Use final rendered endpoint rectangle centers.

For File:

```text
fileRect center
```

For other visible entity:

```text
entityRect center
```

For module anchor:

```text
anchor/module center according to current fallback semantics
```

Do not use label text position.

---

# B12. Tie at 45 degrees

For:

```text
abs(dx) == abs(dy)
```

choose one deterministic policy.

Recommended:

```text
horizontal wins
```

because:

```ts
abs(dx) >= abs(dy)
```

but any stable documented tie-break is acceptable.

No random flip between runs.

---

# B13. Zero-distance defensive case

If endpoint centers are exactly coincident due to invalid/intermediate geometry:

- do not produce non-deterministic side;
- use a stable fallback;
- strict final validation should still reject invalid overlap where appropriate.

Do not hide a real geometry bug behind arbitrary routing.

---

# B14. Connection style remains orthogonal to attachment side

Current Sandbox:

```text
Connection style:
Direct
Electronic
```

Both must use the same newly selected Soft cardinal endpoint handles.

So:

```text
Soft + Direct
→ straight segment from chosen cardinal handle

Soft + Electronic
→ current stepped path from same chosen cardinal handle
```

Do not make Electronic revert to right-only.

---

# B15. Connection-style toggle remains zero layout

Although cardinal sides affect Soft layout scoring, the choice:

```text
Direct / Electronic
```

does not.

The cardinal attachment side is determined by macro geometry, not route rendering style.

Therefore:

```text
Direct ↔ Electronic
→ 0 worker
→ 0 layout
→ 0 cache mutation
```

remains true.

---

# B16. Cardinal sides are Soft-layout truth

Because cardinal side selection affects crossing metrics, include it in the Soft computed layout/attachment evidence as necessary.

Do not put it only in React renderer local state.

If strict serialized computed-layout attachment shape currently supports only:

```text
left / right / auto
```

extend it cleanly to:

```text
left
right
top
bottom
auto
```

or the minimal equivalent.

Update validators/protocol only if actual serialized contract changes.

---

# B17. Protocol/versioning

The HIER4B worker protocol is currently reported as:

```text
version 4
```

Inspect current branch.

If adding:

```text
soft scope overrides
cardinal attachment sides
```

changes strict worker request/result schema:

```text
increment protocol once
```

to the next clean version.

Do not bump multiple times during the same fix.

---

# B18. Cache identity

Soft layout cache identity must include layout-relevant scope state.

Two Soft requests with same graph/strength but different effective cluster mappings must not share geometry.

Include a canonical normalized representation of:

```text
sparse Soft scope overrides
```

or:

```text
derived effective group mapping
```

in the Soft layout/cache key.

Prefer sparse canonical override input if deterministic.

Directional cache/result must remain independent from these overrides.

---

# PART C — Workspace scope override API

## C1. Source-neutral helper

Add a pure helper package/module at the appropriate boundary for:

```text
validate overrides
canonicalize order
resolve effective group
promote one group
promote group + siblings
reset group
reconcile stale overrides
```

Do not bury this logic inside React event handlers.

The layout worker should consume normalized data.

The UI should call pure actions.

---

# C2. Canonical ordering

Serialized override arrays/maps must have deterministic ordering by exact folder key.

Input permutation must not change:

```text
effective groups
cache key
worker result
```

---

# C3. Validation

Reject/normalize:

```text
duplicate exact folder rules
target not ancestor
self rule if storage intends sparse-only
absolute filesystem path leakage
unknown malformed folder key
```

A stale but structurally valid unknown exact folder may be pruned during workspace reconciliation rather than crashing parsing.

---

# C4. No source writes

Hard:

```text
promote folder spatial scope
→ no vault write
→ no Markdown mutation
→ no folder rename/move
```

App-local presentation preference only.

---

# PART D — Guide interaction details

## D1. Soft guides interactive; Directional strips remain simple

Only Soft cluster guides need the new promotion interaction.

Directional strips may remain:

```text
visual On/Off overlay
```

with no scope-edit toolbar.

Reason:

```text
Directional Bands are exact-folder semantics
Soft Clusters own flexible spatial grouping
```

Do not accidentally make HIER4A folder bands hierarchical/promotion-driven.

---

# D2. Hover state

When pointer enters the interactive Soft guide label:

```text
show compact scope toolbar
```

Keep it visible while pointer is inside toolbar.

Avoid flicker moving:

```text
label → toolbar
```

Use a coherent hover/focus region or popover state.

---

# D3. Visual feedback before action

The toolbar should show:

```text
Current:
Language/Pragmatics/

Parent:
Language/
```

so the user understands the action before clicking.

For root:

```text
Already at workspace root
```

and promotion buttons disabled.

---

# D4. Sibling action clarity

Label clearly, e.g.:

```text
↑ This group
↑ This + sibling folders
```

with small explanation if needed:

```text
Sibling action groups folders sharing the same parent.
```

Avoid ambiguous:

```text
Move all
```

---

# D5. After action

On click:

```text
persist workspace override
→ request new Soft layout
→ latest-result-wins
→ adopt new guide geometry
```

No page reload.

No vault reopen.

The guide should visibly merge/move after worker adoption.

---

# D6. Root/viewport preservation

Scope promotion can materially move nodes.

Use the existing semantic transition-anchor/camera policy.

The focused File should remain screen-context stable where the current HIER4B/HIER4A architecture supports that.

Do not implement a new camera system.

---

# D7. Undo/reset interaction

At minimum:

```text
Reset
```

on the guide.

If action immediately makes multiple guides merge, ensure the merged guide still exposes Reset for all represented exact-folder overrides.

No dead-end grouping state.

---

# PART E — Tests for spatial scope

## E1. Exact default

No overrides:

```text
effective group
=
exact folder
```

byte-identical Soft behavior to current HIER4B at same strength.

---

# E2. Promote one child only

Workspace:

```text
Language/
  Parent.md
  Pragmatics/
  Grammar/
```

Promote:

```text
Pragmatics/ → Language/
```

Expected:

```text
Language effective group:
Parent.md + Pragmatics Files

Grammar:
separate
```

---

# E3. Promote + siblings

Click Pragmatics:

```text
↑ This + sibling folders
```

Expected:

```text
Pragmatics → Language/
Grammar    → Language/
```

One effective Soft group.

---

# E4. Mixed granularity

Workspace:

```text
Pattern Theory/
  A/
  B/

Language/
  Pragmatics/
  Grammar/
```

Set:

```text
Pattern Theory/A → Pattern Theory/
Pattern Theory/B → Pattern Theory/

Language/Pragmatics remains exact
Language/Grammar remains exact
```

Expected three independent grouping levels in same graph:

```text
Pattern Theory/
Language/Pragmatics/
Language/Grammar/
```

This is the core product use case.

---

# E5. Repeated promotion

```text
A/B/C/
→ A/B/
→ A/
→ root
```

Each click one current spatial level.

---

# E6. Reset merged guide

Merge:

```text
A/B/
A/C/
→ A/
```

Reset merged `A/` guide.

Expected exact grouping restored for represented exact folders.

---

# E7. Persistence

Set overrides.

Reload app / reopen workspace.

Expected same effective Soft groups.

Open another workspace.

Expected no cross-vault overrides.

---

# E8. Folder move reconciliation

Move File/folder so exact folder key changes.

Invalid old override ignored/pruned.

No crash.

---

# E9. Directional isolation

With non-empty Soft overrides:

```text
Directional Bands
```

must match current HIER4A exact output byte-for-byte.

Directional guides remain exact-folder strips.

---

# E10. Strength matrix

For effective promoted groups test:

```text
0
25
50
75
100
```

Expected:

- same group membership at every strength;
- attraction scales only with strength;
- strength 0 does not secretly pull promoted group together;
- guide membership remains correct.

---

# PART F — Tests for cardinal File ports

## F1. Right

Soft File target clearly to right.

Expected:

```text
source File handle = right
```

---

# F2. Left

Expected:

```text
source File handle = left
```

---

# F3. Above

Expected:

```text
source File handle = top
```

---

# F4. Below

Expected:

```text
source File handle = bottom
```

---

# F5. File-to-File mirror

One File directly above another.

Expected:

```text
upper source/target appropriate bottom
lower opposite endpoint appropriate top
```

according to authored edge direction.

---

# F6. 45° tie

Exact diagonal tie.

Expected deterministic documented side.

Cold repeats identical.

---

# F7. Multiple root connections

Root File has connected Files:

```text
left
right
above
below
```

Expected four different handle sides may be used simultaneously.

This directly regresses the user-observed all-right-tip problem.

---

# F8. Collapsed Heading roll-up

Exact Heading relation collapsed to File.

Soft mode chooses File cardinal side from final geometry.

Expand Heading.

Precise Heading endpoint resumes its normal exact attachment behavior.

---

# F9. Compass exact endpoint

File → Heading in another module.

Only File endpoint gets generic cardinal policy.

Heading endpoint retains current Compass/exact semantics.

---

# F10. Directional unchanged

Same fixture in Directional Bands.

Expected current left/right attachment semantics exactly.

---

# F11. Candidate scoring

Construct a Soft fixture where:

```text
right-only attachment assumption
→ crossing

cardinal top/bottom attachment
→ no crossing
```

Expected Soft solver scores the actual cardinal geometry and selects the cleaner candidate.

This proves the change is not cosmetic renderer-only behavior.

---

# F12. Collision correction

A Soft candidate moves a module from mostly-right to mostly-below during correction.

Expected final attachment recomputes:

```text
right → bottom
```

No stale handle.

---

# F13. Direct / Electronic parity

Soft cardinal handle assignment identical in:

```text
Direct
Electronic
```

Only SVG path style differs.

---

# F14. Secondary invariance

Secondary-only edge changes do not change:

```text
primary File cardinal sides
Soft geometry
effective groups
```

unless current architecture explicitly creates a displayed Secondary attachment separately.

Secondary remains zero-layout influence.

---

# PART G — Performance / boundedness

## G1. Scope resolution

Effective group resolution should be approximately:

```text
O(folders/modules)
```

using indexed overrides.

Do not traverse ancestor strings repeatedly for every solver iteration if a simple precomputed map avoids it.

---

# G2. Cardinal side cost

Expected:

```text
O(reference edges)
```

per candidate scoring step.

Record only if useful.

No new hard timing CI gate.

---

# G3. Benchmark additions

Extend HIER4B benchmark with:

```text
mixed spatial scope
promoted parent
promoted siblings
deep repeated promotion
many folder overrides
4-side root fan
vertical File fan
cardinal crossing-regression fixture
```

Retain existing:

```text
120 fixture rows
15 stress rows
```

or current branch equivalent.

---

# G4. No global combinatorial multiplication

Scope overrides only change group labels/member attraction.

Cardinal File sides are deterministic.

Neither feature should multiply Adaptive Compass or Soft macro candidate spaces beyond existing bounded logic.

---

# PART H — Live graphical QA handoff

After implementation, keep HIER4B unmerged and give the user the optimized `.exe`.

Ask them to test:

## Scope interaction

1. Open Modular Preview.
2. Select Soft Folder Clusters.
3. Folder guides On.
4. Hover/focus a folder guide label.
5. Confirm current spatial folder level is obvious.
6. Click:
   ```text
   ↑ This group
   ```
7. Confirm only that group promotes to parent.
8. Confirm sibling exact guides still exist.
9. On another case click:
   ```text
   ↑ This + sibling folders
   ```
10. Confirm sibling guides merge into the parent spatial group.
11. Promote the merged group another level.
12. Reset it.
13. Mix grouping levels in different vault branches.
14. Switch Directional Bands and confirm exact-folder strips are unchanged.
15. Switch back Soft and confirm overrides persist.

## Cardinal ports

16. Focus a File with neighbors above/below/left/right.
17. Confirm File edges use all sensible sides instead of all exiting right.
18. Reroot and check again.
19. Collapse/expand Headings.
20. Use Direct style.
21. Switch Electronic and confirm same endpoint sides.
22. Toggle Secondary.
23. Watch for stale port sides after node movement.

## Strength

24. Test:
   ```text
   0 → 25 → 50 → 75 → 100
   ```
   with promoted groups.
25. Confirm group identity stays stable while attraction changes.

Ask specifically:

```text
Does per-folder promotion solve the "Pattern Theory/ vs Language/" abstraction-level problem?

Do the four-side File ports make Soft mode connections substantially clearer?

What Soft strength now feels best?
```

Do not create adoption ADR/PR/merge until this QA passes.

---

# PART I — Compatibility

Preserve:

```text
Directional Bands default
Adaptive Compass selectable/default as currently configured
Vertical Spine
Crossing optimized
Document order
Folder guides On/Off
Direct/Electronic
File aggregate hover
Heading/Block exact hover
direct File ring
Secondary zero-layout
latest-result-wins
worker ownership
cache strictness
```

No new external dependency expected.

---

# PART J — Likely implementation areas

Inspect current branch first.

Likely Soft layout:

```text
packages/focus-schematic-layout/src/*
```

Look for current HIER4B macro dispatch / Soft cluster solver / worker protocol.

Likely model types:

```text
packages/focus-schematic-layout/src/types.ts
packages/focus-schematic-layout/src/policies.ts
packages/focus-schematic-layout/src/worker-protocol.ts
packages/focus-schematic-layout/src/worker-runtime.ts
```

Likely app preferences/workspace persistence:

```text
apps/web/src/preferences/*
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/GraphSettings.tsx
```

Likely Modular renderer / guide overlay:

```text
apps/web/src/components/ModularStructuredGraphView.tsx
packages/renderer-reactflow/src/*
```

Existing React Flow nodes already have four source/target handles on:

```text
Top
Bottom
Left
Right
```

Reuse them.

Do not mechanically create every suggested path.

---

# Suggested implementation sequence

## Phase 1 — baseline

1. Inspect current `5276328...` branch state.
2. Re-run focused HIER4B tests.
3. Add failing mixed-scope and all-right-port regressions.
4. Freeze Directional byte-identical oracle.

## Phase 2 — scope model

5. Add sparse workspace Soft scope override contract.
6. Add validation/canonicalization.
7. Add effective-group resolver.
8. Add one-group promotion helper.
9. Add group+sibling promotion helper.
10. Add reset helper.
11. Add stale override reconciliation.

## Phase 3 — persistence

12. Reuse workspace-scoped app-local storage.
13. Key by stable workspace.
14. Add load/save/reset tests.
15. Prove no cross-vault leak.

## Phase 4 — Soft solver

16. Feed normalized overrides into Soft worker input.
17. Derive effective groups.
18. Apply strength to effective groups.
19. Update cache key.
20. Preserve Directional exact semantics.
21. Update Soft guide group truth.

## Phase 5 — guide interaction

22. Make only guide label/action surface interactive.
23. Add hover/focus toolbar.
24. Add current/parent display.
25. Add ↑ This group.
26. Add ↑ This + sibling folders.
27. Add Reset.
28. Preserve pan/zoom/node/edge interaction.

## Phase 6 — cardinal File endpoints

29. Extend attachment side contract if required.
30. Derive Soft candidate File sides from relative geometry.
31. Use sides in candidate scoring.
32. Recompute after candidate/collision movement.
33. Finalize attachments from final positions.
34. Preserve Heading/Block exact behavior.
35. Preserve Directional left/right behavior.
36. Verify Direct/Electronic share handles.

## Phase 7 — automated validation

37. E1–E10.
38. F1–F14.
39. performance/stress.
40. worker latest-result-wins.
41. cache matrix.
42. live update/reroot/hide/restore.
43. full checks.

## Phase 8 — graphical QA

44. Build optimized desktop.
45. Launch it.
46. Give exact executable path.
47. Ask user to perform scope + cardinal-port QA.
48. STOP.

Do not create adoption ADR/PR/merge until user approves.

---

# Validation commands

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

# current HIER4B benchmark commands
pnpm benchmark:focus-schematic-soft-folder-clusters
pnpm benchmark:focus-schematic-production-worker -- --profile small
pnpm benchmark:focus-schematic-production-worker -- --profile medium

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

If command names differ on current branch, use repository-current equivalents.

No new hard timing CI threshold.

---

# Hard exit gates

HIER4B-FIX1 is ready for user QA only when:

1. current HIER4B branch is preserved.
2. no PR/merge occurs.
3. exact folder identity remains canonical.
4. Soft grouping scope is independent per folder/group.
5. no global cluster-depth control is introduced.
6. default effective group equals exact folder.
7. an exact folder can promote one level to parent.
8. a promoted group can promote repeatedly.
9. direct parent Files naturally join promoted child group at same effective key.
10. separately promoted children naturally merge.
11. clicked group promotion does not implicitly promote siblings.
12. explicit sibling action promotes sibling groups.
13. sibling action semantics are deterministic.
14. source folder tree is not read from filesystem in renderer.
15. overrides are workspace-scoped.
16. overrides persist across restart/reopen.
17. overrides do not leak across vaults.
18. stale overrides reconcile safely.
19. Reset reverses represented exact-folder overrides.
20. mixed granularity works in one graph.
21. Soft strength operates on effective group.
22. strength 0 does not introduce hidden attraction.
23. Soft guides visualize effective groups.
24. merged groups show one effective guide identity.
25. disconnected islands remain truthful.
26. guide label exposes current spatial group.
27. guide UI exposes parent target.
28. guide UI provides ↑ This group.
29. guide UI provides ↑ This + sibling folders.
30. guide UI provides Reset.
31. guide interaction is keyboard accessible.
32. full hull/fill does not steal graph pointer interaction.
33. Directional Bands ignore Soft overrides.
34. Directional output remains byte-identical to HIER4A/current branch oracle.
35. Directional strips remain exact-folder strips.
36. existing four node handles are reused.
37. Soft File endpoints can choose left.
38. Soft File endpoints can choose right.
39. Soft File endpoints can choose top.
40. Soft File endpoints can choose bottom.
41. one File can simultaneously use different sides for different references.
42. collapsed File roll-ups use cardinal sides in Soft.
43. Heading/Block exact endpoint behavior is preserved.
44. Directional attachment behavior is unchanged.
45. cardinal File sides are derived from candidate/final geometry.
46. cardinal sides participate in Soft crossing/readability scoring.
47. stale pre-correction port side is not retained.
48. 45-degree tie is deterministic.
49. Direct/Electronic use identical chosen handles.
50. route-style toggle remains zero-layout.
51. Secondary remains zero-layout influence.
52. Soft override state participates in Soft cache identity.
53. Directional cache identity does not unnecessarily depend on Soft overrides.
54. worker protocol increments only if strict schema requires it.
55. worker latest-result-wins survives rapid promotion/strength/macro changes.
56. no global combinatorial search is introduced.
57. no new external dependency.
58. E1–E10 pass.
59. F1–F14 pass.
60. existing HIER4B fixture/stress gates pass.
61. existing folder-guide tests pass.
62. existing Adaptive Compass tests pass.
63. existing HIER4A Directional oracle passes.
64. File aggregate hover passes.
65. direct File ring passes.
66. Secondary tests pass.
67. reroot passes.
68. query hide/restore passes.
69. live update reconciliation passes.
70. full `pnpm check` passes.
71. desktop check/build passes.
72. optimized desktop launches.
73. exact executable path is reported.
74. user QA instructions are concise and specific.
75. HIER4B remains under evaluation.
76. no adoption ADR is written.
77. no PR is created.
78. no merge occurs.
79. HIER5 is not started.
80. HIER3C is not started.

---

# Documentation during evaluation

Update development/HIER4B validation documentation as needed, but do not record adoption.

Document:

```text
Soft cluster scope
→ sparse per-folder ancestor overrides
→ workspace-local
→ no source mutation

Soft File endpoints
→ spatial cardinal attachment
→ left/right/top/bottom
→ candidate-scored

Directional Bands
→ exact folder + directional attachment unchanged
```

Archive this exact prompt at:

```text
history-implementations/HIER4B_FIX1_per_folder_scope_cardinal_file_ports_codex_prompt.md
```

Record SHA-256.

Do not mark HIER4B Complete.

---

# Required status report before user QA

Return:

## 1. Branch / commit

Current branch and pushed commit.

## 2. Scope overrides

Persistence and exact→effective group semantics.

## 3. Guide interaction

How ↑ group / ↑ group+sibling / Reset works.

## 4. Directional isolation

Byte-identical HIER4A evidence.

## 5. Cardinal File ports

Rule and candidate-scoring integration.

## 6. Direct / Electronic

Confirm same chosen handles.

## 7. Strength

Confirm effective grouping across 0/25/50/75/100.

## 8. Tests

Counts and hard gates.

## 9. Performance

Soft worker timings/candidate/collision evidence.

## 10. Privacy

No vault writes or private committed evidence.

## 11. Optimized desktop

Exact executable path.

## 12. User QA

Ask for:

```text
mixed folder levels
single vs sibling promotion
reset
four-sided root connections
expand/collapse
reroot
strength 0–100
Directional switch
Direct/Electronic
```

Then stop.

Do not create a PR or merge automatically.
