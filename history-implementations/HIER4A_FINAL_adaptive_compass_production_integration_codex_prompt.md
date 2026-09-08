# HIER4A-FINAL — Production Integration of Adaptive Compass into Modular Focus Hierarchy

**Task type:** production integration / settings wiring / worker + cache adoption / real-app graphical QA / HIER4A finalization

## User decision

The HIER4A internal-layout bakeoff is complete enough to make a product decision.

The selected production internal layout is:

```text
Adaptive Compass
```

Keep:

```text
Vertical Spine
```

as an **optional Sandbox / Experimental alternative**.

Keep:

```text
Document order
```

as an **optional Sandbox / Experimental Heading-order alternative**.

The default Heading-order behavior is:

```text
Crossing optimized
```

The old Current/Mosaic internal layout is development evidence only and must not become a product-facing option.

The next task is no longer another isolated lab prototype.

> Put the selected HIER4A geometry into the **actual Modular Focus Hierarchy graph** used by the application.

---

# Expected repository state

The repository has been renamed to:

```text
lillo24/obsidian-upgrade-graph-explorer
```

The latest known HIER4A internal-layout bakeoff commit from the implementation work is approximately:

```text
f71e4c528...
feat: compare HIER4A internal layout variants
```

Verify the actual current worktree/branch/HEAD before changing anything.

If the branch has advanced beyond that commit:

```text
continue from the current branch
```

Do not reset useful HIER4A work merely to match this prompt.

Continue the existing HIER4A worktree if it exists.

---

# Final HIER4A product decision

Freeze these semantics:

```text
Modular Focus Hierarchy
    ↓
Directional Folder Bands
    ↓
Adaptive Compass internal File-module layout
    ↓
Crossing-optimized visual Heading order
```

Defaults:

```text
Internal layout:
Adaptive Compass

Heading order:
Crossing optimized
```

Sandbox alternatives:

```text
Internal layout:
Vertical Spine

Heading order:
Document order
```

Development-only:

```text
Current / Mosaic
```

Do not expose Current/Mosaic in product settings.

---

# Important product boundary

This task integrates HIER4A into the **actual Modular Focus Hierarchy implementation**.

It does **not** yet make Modular Focus Hierarchy the global default over Classic.

Existing product-level behavior remains:

```text
Focus + Hierarchy
→ Classic is still the normal/default implementation

Settings → Graph → Sandbox / Experimental
→ user may select Modular Preview
```

When Modular Preview is active:

```text
Adaptive Compass
+
Crossing optimized
+
Directional Folder Bands
```

must be the default HIER4A geometry.

HIER3C still owns the later decision to make Modular the default and move Classic behind Experimental.

Do not perform HIER3C here.

---

# HIER4A final architecture

The real application path should now be:

```text
Focus query / focused File
        ↓
KG6 fixed neighborhood
        ↓
FocusSchematicModel
        ↓
selected modular layout worker
        ↓
Directional Folder Bands
        ↓
Adaptive Compass per visible File module
        ↓
Crossing-optimized visual branch ordering
        ↓
final exact node rectangles + endpoints
        ↓
React Flow Modular Focus Hierarchy renderer
```

The renderer must consume the worker-produced final geometry.

Do not reimplement Compass in React.

Do not run a second layout pass in the renderer.

---

# 1. Adaptive Compass is the selected production internal grammar

Use the already implemented and validated Adaptive Compass algorithm from HIER4A-FIX2.

Do not rewrite it unless production integration reveals an actual correctness bug.

Preserve its important structure:

```text
for each top-level structural Heading branch:

1. inspect real primary external relationships
2. measure left/right demand
3. compute useful external target-Y evidence
4. generate at most two sensible placement-region hypotheses
5. evaluate bounded assignments
6. rank candidates lexicographically
7. place branch as one structural unit
```

For ordinary branch counts:

```text
N <= 6
→ at most 2^N <= 64 assignments
→ exhaustive over the restricted meaningful candidate set
```

For larger branch counts:

```text
bounded deterministic fallback
```

No global force layout.

No arbitrary Heading floating.

---

# 2. Apply Adaptive Compass to every applicable visible File module

Do not special-case only the focused/root File.

The selected internal File-module grammar should apply consistently to:

```text
focused File module
incoming/context File modules
outgoing/context File modules
filtered-visible File modules that have visible expanded structure
```

whenever that module currently renders visible structural Heading/Block content.

Every File remains the central owner/anchor of its own module.

For a non-root File:

```text
external left/right demand
```

is measured relative to that File/module's actual position and connected counterpart modules.

Do not use the focused File's X as the local Compass center for every module.

---

# 3. Preserve whole-branch semantics

Adaptive Compass places:

```text
top-level structural branch
```

not individual unrelated Heading cards.

A branch includes its semantic descendants.

Hard:

- no Heading reparenting;
- no level mutation;
- no ownership mutation;
- no source-span mutation;
- no Block detachment;
- no entity duplication.

One entity remains one rendered node.

---

# 4. Adaptive Compass regions remain internal placement regions

Regions:

```text
TOP
BOTTOM
LEFT
RIGHT
```

are internal module geometry only.

They do not redefine authored relationship semantics.

Example:

```text
Heading displayed on LEFT of its File
```

does not mean:

```text
incoming Heading
```

Likewise:

```text
Heading displayed on RIGHT
```

does not mean:

```text
outgoing Heading
```

External signed-rank semantics still belong to File modules.

---

# 5. Keep the selected Compass candidate priority

Preserve the existing lexicographic quality hierarchy unless repository implementation uses equivalent names:

```text
1. exact endpoint crossings
2. adjacent-rank order inversions
3. internal hierarchy crossings
4. pathological one-sided vertical arrangement
5. vertical balance
6. total primary Manhattan connection span
7. total primary vertical connection span
8. source-order deviation
9. Compass module width
10. Compass module area
11. deterministic stable tie-break
```

Do not replace this with a weighted scalar cost.

Do not allow compactness to trade against an extra crossing.

Hard principle:

```text
0 crossings always beats 1 crossing
```

when comparing otherwise valid candidates.

---

# 6. Primary relationships only influence geometry

Compass geometry may use:

```text
primary exact authored cross-module relationships
```

Secondary relationships remain zero-layout.

Hard:

```text
Secondary Off / On
→ byte-identical modular node geometry
```

Secondary edges may render differently, but cannot change:

- Compass region;
- Heading visual order;
- File module dimensions;
- folder band order;
- root balance;
- module order.

---

# 7. Crossing Optimized is the product default

Make:

```text
Crossing optimized
```

the default visual Heading-order policy for Modular Focus Hierarchy.

This is a **visual layout policy only**.

Canonical Markdown/source order remains unchanged.

Crossing Optimized may reorder only legal sibling/branch display order according to the already implemented constraints.

Do not change:

- Markdown;
- source spans;
- Inspector source hierarchy;
- source-order metadata;
- navigation targets;
- breadcrumbs.

---

# 8. Document Order remains available in Sandbox

Add/retain a persisted Sandbox / Experimental setting:

```text
Heading order
- Crossing optimized
- Document order
```

Default:

```text
Crossing optimized
```

The alternative:

```text
Document order
```

must remain available because it is useful for users who prefer the visual graph to track canonical source order more closely.

This setting applies only to:

```text
Modular Focus Hierarchy
```

Do not make it alter Classic.

Do not make it alter Markdown.

---

# 9. Vertical Spine remains available in Sandbox

Add/retain a persisted Sandbox / Experimental setting:

```text
Internal layout
- Adaptive Compass
- Vertical Spine
```

Default:

```text
Adaptive Compass
```

Vertical Spine is a legitimate alternative internal grammar and should remain available for comparison / preference.

It must use the validated V1 implementation from the bakeoff.

Do not expose Current/Mosaic.

---

# 10. Suggested Sandbox UI

Use existing settings conventions.

Conceptually:

```text
Settings
→ Graph
→ Sandbox / Experimental

Focus Hierarchy implementation
    Classic
    Modular preview

[when Modular preview is relevant]

Modular internal layout
    Adaptive Compass
    Vertical Spine

Modular Heading order
    Crossing optimized
    Document order
```

Exact labels may follow current product vocabulary.

Prefer clear labels over internal IDs like:

```text
C1
V1
crossing-optimized
```

Do not show the development term:

```text
M0 Mosaic
```

to users.

---

# 11. Visibility of the Sandbox controls

Prefer showing the two new controls only in the Experimental/Sandbox area.

It is acceptable to show them even when Classic is selected if settings architecture is simpler, but the UI should make clear they affect:

```text
Modular Focus Hierarchy
```

Preferred:

```text
disable or hide when Modular Preview is not active
```

if existing settings patterns support conditional controls cleanly.

Do not create complicated settings UI architecture solely for this.

---

# 12. Persist the two selections

The user-selected Sandbox values should survive:

```text
app reload
desktop restart
vault reopen
```

using the existing settings persistence mechanism.

Defaults for users with no stored value:

```text
internalLayout = adaptive-compass
headingOrder = crossing-optimized
```

Existing users upgrading from the previous Modular Preview should receive these defaults automatically.

No migration modal.

---

# 13. Setting compatibility / migration

If old development settings exist for:

```text
current
vertical-spine
adaptive-compass
document-order
crossing-optimized
```

normalize them cleanly.

Do not preserve an obsolete persisted:

```text
current/mosaic
```

as a selectable production value.

If an old persisted value is unknown/removed:

```text
fall back to Adaptive Compass
```

for internal layout.

For Heading order:

```text
fall back to Crossing optimized
```

---

# 14. Folder Bands production semantics

Directional Folder Bands are part of selected HIER4A Modular geometry.

For this milestone:

```text
Folder Bands = On
```

inside the production Modular Focus Hierarchy layout.

Do not add a normal product strength slider.

Do not reintroduce:

```text
0 / 25 / 50 / 75 / 100
```

The old soft-strength prototype is rejected.

If an Off/On control still exists only in the development lab, retain it there as an oracle.

The real Modular graph should use the accepted categorical Directional Bands behavior.

---

# 15. Every visible exact folder retains a band

Preserve accepted HIER4A semantics:

- every visible non-filtered exact folder gets a band;
- singleton folder gets a band;
- nested exact folders are distinct exact identities;
- root folder is the central/root band;
- filtered bridge modules remain excluded from folder-band ownership as already designed;
- band satisfaction remains categorical.

Do not regress the singleton fixes.

---

# 16. Root-centered folder balance remains active

Preserve the corrected global folder-band rule.

The root folder is not only anchored:

```text
root File = (0, 0)
```

The overall above/below folder arrangement should remain balanced around the root when topology permits.

Use packed band heights.

Do not revert to baseline Y as a strong prior.

---

# 17. Joint folder/internal refinement remains active

Production must use the final HIER4A joint geometry, not:

```text
Compass once
then frozen folder placement
```

Preserve the bounded interaction:

```text
internal Compass candidate
        ↓
module dimensions / exact endpoints
        ↓
folder-band candidate
        ↓
updated external geometry
        ↓
bounded Heading/module refinement
        ↓
final candidate
```

Use the already implemented fixed iteration bounds.

No convergence loop.

No random iteration.

---

# 18. Avoid global combinatorial multiplication

This is a production hard guard.

Do not form:

```text
64^(number of File modules)
```

global combinations.

Compass search is module-local and bounded.

Folder/global refinement may query or recompute module-local candidates, but must not create the Cartesian product of all File-module internal assignments.

Instrument if necessary to prove this.

---

# 19. Preserve Compass assignment cap

Keep the validated Compass cap, currently expected around:

```text
64 complete assignments per module
```

for the restricted two-hypothesis branch choices.

If the implementation uses a slightly different constant, preserve the measured one and document it.

For large branch counts:

```text
deterministic demand initialization
+
bounded local relocation/swap sweeps
```

No exponential fallback.

---

# 20. Cache identity must include layout choices

The Modular exact-layout cache key must distinguish:

```text
Adaptive Compass + Crossing optimized
Adaptive Compass + Document order
Vertical Spine + Crossing optimized
Vertical Spine + Document order
```

A switch must never return stale geometry from another combination.

Also include:

```text
Directional Folder Bands selected algorithm revision
```

through the existing version/cache mechanism.

---

# 21. Worker request must include the real selected policies

The production Modular worker must receive enough typed input to compute the selected variant.

Conceptually:

```ts
{
  ...
  internalLayout: 'adaptive-compass' | 'vertical-spine',
  headingOrder: 'crossing-optimized' | 'document-order'
}
```

Exact schema may differ.

Do not read React component state from inside layout helpers.

Do not compute Compass outside the worker and pass final rectangles in.

Worker owns layout.

---

# 22. Worker protocol version

If these policy fields are new strict serialized worker-request fields:

```text
bump Modular worker protocol version
```

once.

Do not bump protocol merely because an internal helper changed.

Inspect the current HIER4A worktree: the bakeoff may already have introduced compatible types.

Avoid redundant version churn.

---

# 23. Selected layout algorithm version

After production adoption of Adaptive Compass:

```text
increment selected modular layout algorithm version
```

to the next clean revision.

The algorithm version should represent the actual selected production geometry:

```text
Directional Folder Bands
+
Adaptive Compass default
+
joint ordering
```

Do not increment separately for every dev-lab toggle.

Classic version remains untouched.

---

# 24. No renderer-specific Compass logic

The React Flow renderer should receive:

```text
final node positions
final module bounds
final endpoint attachment information
```

and render them.

Do not add:

```text
if adaptiveCompass then ...
```

layout geometry inside node components.

Renderer may show visual style based on node/module role, but not reposition structural nodes.

---

# 25. Actual app graph integration

Verify the real app path by running:

```text
Focus
+
Hierarchy
+
Modular Preview
```

on the web and desktop.

The actual user graph—not just the synthetic lab—must visibly show:

```text
File centered in each expanded module
Headings arranged by Adaptive Compass
exact folder horizontal bands
Crossing optimized order by default
```

This is the main acceptance condition.

---

# 26. Heading disclosure / expansion

Adaptive Compass must respond correctly to the current visible structure.

When a user expands Headings:

```text
new visible branches
→ recompute module Compass
→ recompute module bounds
→ recompute affected HIER4A folder geometry
```

When collapsed:

```text
hidden branches no longer consume layout geometry
```

Do not lay out invisible Heading nodes.

---

# 27. Reroot

When Focus changes to another File:

```text
new Focus File
→ new signed ranks
→ new root folder
→ new Compass demands
→ new folder balance
```

Do not preserve stale Compass region assignments from the old root if external geometry has changed.

Cache may reuse only exact matching input.

---

# 28. Query hide / restore

Existing exact path hide/query behavior must remain correct.

If a module is hidden:

```text
Compass demand
folder membership
cross-module geometry
```

must reflect the new projected graph.

Restoring the module should deterministically restore the expected geometry.

No ghost demand from hidden entities.

---

# 29. Filtered bridge semantics

Filtered bridge modules retain their HIER1/HIER2 semantics.

They may participate in topology as designed but should not suddenly gain visible folder bands contrary to HIER4A rules.

Compass should operate only on the visible structural content of a module.

No hidden-heading geometry.

---

# 30. Direct File references

Preserve the HIER3B-FIX1 direct-File behavior.

If expanded structure exists but a relation terminates directly on the File/document:

```text
direct File ring
```

remains the renderer affordance for exact direct-File reference distinction.

Adaptive Compass must not move the File away from module center in a way that breaks the ring.

---

# 31. File aggregate hover

Preserve:

```text
hover File
→ highlight all currently rendered relationships involving
   File + visible Heading/Block endpoints in that module
```

Compass visual branch placement must not change hover semantics.

Heading/Block hover remains exact.

---

# 32. No hover/layout coupling

Hover state must not trigger Compass recomputation.

Hard:

```text
hover
→ zero layout
```

---

# 33. Secondary toggle

Hard:

```text
Secondary toggle
→ zero layout
```

Only edge visibility/style changes.

No Compass candidate update.

No folder-band update.

No cache miss for geometry if the only changed input is Secondary display state and Secondary is intentionally geometry-neutral.

---

# 34. Visual Groups

Visual Groups remain:

```text
style / classification
```

not layout forces.

Do not use Visual Groups to bias Compass region or folder band.

---

# 35. Search / Inspect / Hide

Existing Network Explorer/sidebar interactions remain correct.

Focus / Inspect / Hide operations may change the projected graph and therefore trigger legitimate recomputation.

Do not couple Sandbox setting UI to those controls.

---

# 36. Viewport / camera

Preserve the shared React Flow surface/camera behavior from HIER3B.

When switching:

```text
Adaptive Compass ↔ Vertical Spine
Crossing optimized ↔ Document order
```

do not unnecessarily recreate the entire React Flow instance.

Prefer:

```text
same renderer/surface
new geometry
```

Preserve current semantic viewport behavior.

Do not implement a new camera system.

---

# 37. Root semantic anchor

The focused File must remain the semantic root anchor.

Preserve the accepted root coordinate contract if still current:

```text
root File = (0, 0)
```

Internal Compass branches move around the File.

Do not shift the File inside the module because one side has more Heading branches.

Instead reframe the module rectangle around the File + branch geometry.

---

# 38. Module bounds

After Compass placement:

```text
module bounds
=
union(File + visible structural branch rectangles)
+
accepted padding/reserve
```

File local position remains central anchor semantics.

Recompute full bounds before folder-band packing.

No stale M0 dimensions.

---

# 39. Folder bands use final selected module dimensions

Production order must be:

```text
selected internal variant
→ module dimensions
→ folder band stack heights
→ root balance
```

not:

```text
old M0 dimensions
→ bands
→ insert Compass afterward
```

This is critical.

---

# 40. Exact endpoint geometry

After final Compass + folder position:

```text
recompute exact endpoint attachments
```

from final node rectangles.

Do not render references using bakeoff/stale attachment coordinates.

This applies to:

- File endpoints;
- Heading endpoints;
- Block endpoints.

---

# 41. Current SmoothStep routing is unchanged

Do not implement HIER5 here.

Current renderer routing may still use SmoothStep/rounded paths.

The remaining issue where overlapping semantic edges can visually become one giant corridor belongs to:

```text
HIER5
```

Do not let production Compass integration turn into a routing rewrite.

---

# 42. Classic remains fully independent

Classic Focus Hierarchy remains:

- current D0/flat production path;
- default unless user selects Modular Preview;
- independently testable;
- unaffected by Adaptive Compass settings.

Hard:

```text
changing Modular internal layout
or
changing Modular Heading order
→ no Classic geometry change
```

---

# 43. All + Hierarchy remains unchanged

Do not touch the hidden-by-default Experimental:

```text
All + Hierarchy
```

behavior.

HIER4A is Focus + Hierarchy Modular work.

---

# 44. Development lab remains available

Keep the HIER4A-FIX2 lab for evidence.

It may still expose:

```text
Current
Vertical Spine
Adaptive Compass
```

because Current is valuable as historical/dev comparison.

But product settings expose only:

```text
Adaptive Compass
Vertical Spine
```

Similarly lab may expose richer diagnostic controls not present in app.

---

# 45. Defaults test

Add a settings/default test proving a fresh user gets:

```text
Modular internal layout = Adaptive Compass
Modular Heading order = Crossing optimized
```

This should not depend on browser localStorage already containing values.

---

# 46. Persistence test

Set:

```text
Vertical Spine
Document order
```

persist/reload settings.

Expected:

```text
Vertical Spine
Document order
```

Then reset/remove stored values.

Expected:

```text
Adaptive Compass
Crossing optimized
```

---

# 47. Obsolete Mosaic migration test

If prior development builds could persist:

```text
Current
Mosaic
M0
```

or equivalent:

Expected after migration:

```text
Adaptive Compass
```

Do not crash or expose an invalid select option.

---

# 48. Worker/cache matrix test

For one fixture compute:

```text
AC + Crossing
AC + Document
VS + Crossing
VS + Document
```

Verify:

- each expected geometry is correct;
- exact repeated request hits cache;
- changing either setting changes cache identity;
- returning to earlier combination returns identical geometry;
- no cross-contamination.

---

# 49. Real-app fixture test

Prefer a synthetic vault/test harness exercised through the real application stack.

Include:

```text
Focus File
5 top-level Headings
incoming File modules
outgoing File modules
multiple exact folders
one singleton folder
one direct File reference
one secondary relationship
```

Expected default real app:

```text
Adaptive Compass
Crossing optimized
folder bands
```

No special test-only renderer path.

---

# 50. Multi-module Compass fixture

Add a case with at least:

```text
3 expanded File modules
```

each having multiple visible top-level Heading branches.

Prove:

- Compass applies to each module;
- computation remains bounded;
- no global `64^3` search;
- external signed-rank semantics remain clear.

---

# 51. Large Heading module

Test one module with:

```text
> 6 top-level branches
```

Confirm bounded fallback.

Report:

```text
assignments evaluated
local sweeps
layout time
```

No exponential growth.

---

# 52. Nested Heading module

Test:

```text
H1
  H1.1
  H1.2
H2
  H2.1
```

Compass positions H1/H2 top-level structural branches.

Nested descendants remain with owning branch.

No independent free-floating H1.1/H1.2.

---

# 53. Mixed left/right demand

Test:

```text
branch A → left-only demand
branch B → right-only demand
branch C → mixed
branch D → no external demand
```

Expected default Compass candidate generation remains as already designed.

No regression from lab to production worker.

---

# 54. Folder balance regression

Re-run accepted HIER4A cases:

```text
DB5
DB11
DB12 reinterpretation
FB4 topology tension
DB14
true-blocked replacement
```

against the actual selected production worker configuration:

```text
Adaptive Compass
Crossing optimized
Folder Bands On
```

Do not rely only on bakeoff implementation tests.

---

# 55. DB12 final interpretation

The old DB12:

```text
true topology-blocked root balance
```

was exposed as suspicious because M0 internal geometry could manufacture the blocking condition.

After Adaptive Compass selection:

- keep the neutral renamed DB12;
- record its final production result;
- do not call it blocked unless it remains truly blocked under selected geometry.

Use the new true-blocked fixture for the hard topology oracle.

---

# 56. Visual Spine alternative QA

Vertical Spine remains supported, so test it in the actual Modular graph.

At minimum verify:

- setting switch works;
- no stale Compass geometry;
- exact folder bands remain valid;
- source semantics unchanged;
- root File anchor remains stable;
- hover/ring still work.

Do not optimize Spine further unless a regression was introduced by integration.

---

# 57. Document-order alternative QA

In actual Modular graph:

```text
Crossing optimized
→ expected selected visual order

Document order
→ source-order-preserving visual sibling sequence
```

Verify both against the same File.

Switch back to Crossing optimized.

Expected:

```text
identical to original Crossing optimized geometry
```

Cold determinism.

---

# 58. Sandbox setting labels

Use user-facing labels approximately:

```text
Internal layout
Adaptive Compass
Vertical Spine

Heading order
Crossing optimized
Document order
```

Avoid:

```text
C1
V1
M0
```

outside dev lab.

---

# 59. Optional help text

If settings UI supports concise descriptions:

Adaptive Compass:

```text
Places visible Heading branches around their File using connection geometry.
```

Vertical Spine:

```text
Keeps visible Heading branches on a vertical spine around their File.
```

Crossing optimized:

```text
May change graph-only sibling display order to reduce connection crossings.
```

Document order:

```text
Keeps graph sibling display order closer to Markdown source order.
```

No long tutorial in settings.

---

# 60. Performance instrumentation

Report for actual Modular worker:

```text
total layout time
Compass layout time
folder-band time
joint refinement rounds
Compass assignments evaluated
large-module fallback count
crossing evaluations
```

Use existing performance infrastructure.

Do not add noisy production console logs.

---

# 61. Performance expectation

The bakeoff evidence suggests Compass is computationally reasonable and was not slower than Spine in the sampled corpus.

Still validate production because:

```text
multiple expanded modules
+
folder joint refinement
+
real worker serialization
```

is more representative than isolated lab cases.

Do not impose a new hard CI timing threshold without stable evidence.

---

# 62. Worker latest-result-wins

Preserve HIER3B behavior.

Rapidly toggle:

```text
Adaptive Compass
Vertical Spine
Adaptive Compass
```

and:

```text
Crossing
Document
Crossing
```

Final rendered graph must correspond to the latest selection.

No stale worker result may overwrite a newer request.

---

# 63. Error fallback

Preserve existing Modular fallback semantics.

If the Modular worker/layout fails unexpectedly:

```text
fallback to Classic
```

or current established safe behavior.

Do not silently fall back from Adaptive Compass to Mosaic.

If only an unknown persisted internal-layout value exists:

```text
normalize to Adaptive Compass before worker invocation
```

---

# 64. No new dependency

Expected:

```text
new external dependencies = 0
```

Use current algorithms/data structures.

Do not introduce another graph-layout package.

---

# 65. Documentation decision

Update the existing HIER4/HIER3B documentation and ADRs so there is one coherent truth.

Record:

```text
HIER4A selected macro behavior:
Directional Folder Bands

HIER4A selected internal grammar:
Adaptive Compass

Sandbox alternative:
Vertical Spine

Selected Heading order:
Crossing optimized

Sandbox alternative:
Document order

Rejected product option:
Current/Mosaic
```

---

# 66. Explain why Compass was selected

Document briefly:

- both Compass and Spine passed hard topology gates;
- Compass communicates external Heading relationships more clearly in graphical review;
- Compass remains bounded;
- normal modules <=6 top-level branches evaluate all restricted meaningful assignments;
- large modules use bounded deterministic fallback;
- compactness/area did not justify selecting Spine over the visually clearer Compass.

Do not frame the choice as benchmark-only.

Graphical readability is the product criterion.

---

# 67. Preserve the exact algorithm explanation

The documentation may summarize:

```text
left-only external demand
→ LEFT or vertical fallback

right-only external demand
→ RIGHT or vertical fallback

mixed/no directional demand
→ TOP or BOTTOM
```

and:

```text
preferred Y
≈ median external counterpart Y
```

if that remains exactly true in current code.

Do not document obsolete details if implementation changed during final integration.

---

# 68. ADR

If repository ADR convention says a selected production layout requires a decision record, update or add the appropriate ADR.

Preferred decision statement:

```text
Adopt Adaptive Compass as the selected internal File-module layout
for Modular Focus Hierarchy Directional Folder Bands.

Keep Vertical Spine available under Sandbox/Experimental.

Use Crossing optimized as the default graph-only Heading-order policy.
Keep Document order as a Sandbox/Experimental alternative.
```

Do not create redundant ADRs if the existing HIER4A ADR is meant to be amended.

---

# 69. Roadmap update

After this task is accepted/merged:

```text
HIER4A = COMPLETE
```

Next:

```text
HIER4B — Soft Folder Clusters
```

Then:

```text
HIER5 — routing
```

Then:

```text
HIER3C — Modular default / Classic Experimental
```

Do not start HIER4B automatically.

---

# 70. Browser graphical QA gate

Before merge, give the user a fresh real-app build/run path.

Ask them to test:

```text
Focus
+
Hierarchy
+
Modular Preview
```

Default settings:

```text
Adaptive Compass
Crossing optimized
```

Then switch:

```text
Vertical Spine
```

Then switch Heading order:

```text
Document order
```

Then restore defaults.

The user should verify actual graph behavior, not lab screenshots only.

Stop for approval.

---

# 71. Optimized desktop QA gate

After browser approval, build fresh optimized desktop.

Give exact executable/run location.

User validates:

1. actual vault;
2. Adaptive Compass default;
3. multiple expanded File modules;
4. folder bands;
5. Heading disclosure;
6. reroot;
7. File hover aggregate;
8. exact Heading hover;
9. direct File ring;
10. Secondary toggle;
11. Vertical Spine Sandbox switch;
12. Document Order Sandbox switch;
13. switch back to defaults;
14. Classic unaffected.

Stop for explicit approval before merge.

---

# 72. Do not conflate Sandbox with Lab

Product Sandbox options:

```text
Adaptive Compass / Vertical Spine
Crossing optimized / Document order
```

Development lab can additionally show:

```text
Current/Mosaic
Folder Bands Off
diagnostic overlays
candidate scores
```

Keep these distinct.

---

# 73. Test naming

Update tests from generic bakeoff names where necessary.

Production tests should refer to actual semantics:

```text
adaptive compass
vertical spine
crossing optimized
document order
directional folder bands
```

Do not encode temporary lab IDs into public settings.

---

# 74. Settings typing

Prefer typed enums/unions.

No magic strings scattered across:

```text
settings UI
worker
layout
cache
renderer
```

Have one canonical definition where architecture permits.

---

# 75. Default values live in one canonical location

Avoid:

```text
web defaults = Adaptive Compass
desktop defaults = Spine
worker fallback = Mosaic
```

There should be one consistent canonical default policy.

Worker may defensively normalize, but the product default is singular:

```text
Adaptive Compass
Crossing optimized
```

---

# 76. Cache invalidation on Heading disclosure

If visible structural nodes change:

```text
layout input changes
→ cache key changes
```

No stale Compass branch assignment after expand/collapse.

---

# 77. Stable identity

Do not change:

```text
NodeId
ReferenceId
module identity
exact endpoint identity
```

because a Heading moved around the File.

Geometry changes only.

This protects Inspector/hover/cache provenance.

---

# 78. Module labels / folder guides

Actual production graph need not render the large development-lab folder-guide rectangles if current product design does not intend visible guides.

HIER4A folder bands are primarily spatial semantics.

Do not automatically add giant labeled folder backgrounds to production merely because the lab shows them.

If production currently has a subtle folder visualization already accepted, preserve it.

The key acceptance is actual placement.

---

# 79. Accessibility / DOM

Existing accessible graph/sidebar representation must remain intact.

Changing Compass geometry must not change screen-reader semantic ordering unless current architecture intentionally derives DOM order from canonical model.

Prefer canonical/source semantic order for accessibility, not visual Compass order, unless existing architecture says otherwise.

Do not create a new accessibility project here.

---

# 80. Cross-platform consistency

Same settings and same model input should produce the same geometry in:

```text
web
Tauri desktop
worker/in-process tests
```

No platform-dependent randomness.

---

# 81. Determinism matrix

Hard test:

For each:

```text
Adaptive + Crossing
Adaptive + Document
Spine + Crossing
Spine + Document
```

verify:

```text
cold run A == cold run B
input permutation == canonical input
worker == in-process
cache miss == cache hit geometry
```

---

# 82. Benchmark matrix

Use representative:

```text
small
medium
large
multi-expanded-module
large-heading-module
folder-heavy
hub
```

Report Compass default as primary.

Spine is secondary compatibility evidence.

No need to benchmark Mosaic except historical lab.

---

# 83. Quality matrix

For default production:

```text
overlap count
containment failures
exact crossings
rank inversions
internal hierarchy crossings
folder exceptions
root imbalance
primary span
module area
```

Compare to accepted HIER4A lab oracle.

Unexpected differences require explanation.

---

# 84. Current graph appearance

Do not redesign node styling.

Adaptive Compass is a geometry change.

Keep current:

- File card style;
- Heading card style;
- Block card style;
- focus highlight;
- diagnostic styling;
- direct ring style;
- hover style.

No visual-theme project.

---

# 85. Interaction hitboxes

Do not solve overlapping edge hit targets here.

HIER5 owns explicit lane/channel routing and interaction stroke.

Compass integration must not make existing hitboxes worse through accidental overlay containers.

---

# 86. Error diagnostics

If a Compass module produces invalid geometry in development/test:

report:

```text
module ID
branch count
candidate count
selected regions
invalid rectangle reason
```

in existing diagnostics infrastructure.

Do not leak verbose diagnostics into normal UI.

---

# 87. Safety fallback for one module

Prefer fixing invalid internal geometry rather than silently using Mosaic.

If a defensive per-module fallback is architecturally necessary:

```text
Vertical Spine
```

is the only reasonable internal fallback candidate.

But do not add it silently unless there is a real failure mode.

The existing whole-layout Classic fallback remains the established safe boundary.

Document any fallback explicitly.

---

# 88. User setting switching should be immediate

Changing Sandbox setting should trigger the normal modular layout recomputation without requiring:

```text
app restart
vault reopen
manual refresh
```

Persist after change.

---

# 89. No source mutation confirmation

Add regression:

```text
switch Crossing → Document → Crossing
```

then serialize/re-read canonical source model.

Expected:

```text
byte-identical source-derived ordering metadata/content
```

No mutation.

---

# 90. Main decision gates

This task cannot be marked complete until:

```text
real Modular graph uses Adaptive Compass by default
```

Not sufficient:

```text
lab uses Adaptive Compass
```

Not sufficient:

```text
worker test supports Adaptive Compass
```

Not sufficient:

```text
settings UI has Adaptive Compass
```

All layers must be connected.

---

# Suggested implementation sequence

## Phase 1 — inspect and freeze decision

1. Inspect current HIER4A branch/HEAD.
2. Confirm bakeoff implementations exist.
3. Record `ADOPT_ADAPTIVE_COMPASS`.
4. Record `Crossing optimized` selected default.
5. Keep Vertical Spine and Document order as Sandbox alternatives.
6. Mark Mosaic dev-only.

## Phase 2 — canonical settings

7. Add canonical internal-layout setting type.
8. Add canonical Heading-order setting type.
9. Set defaults:
   - Adaptive Compass
   - Crossing optimized
10. Add persistence/migration.
11. Add Sandbox controls.
12. Remove/avoid Mosaic product option.

## Phase 3 — worker wiring

13. Pass selected policies into Modular worker.
14. Update strict worker protocol if necessary.
15. Update exact cache identity.
16. Update selected algorithm revision.
17. Preserve latest-result-wins.

## Phase 4 — production layout

18. Replace current production modular internal geometry with selected Adaptive Compass path.
19. Apply it to every expanded visible File module.
20. Preserve whole structural branch semantics.
21. Preserve bounded candidate cap.
22. Preserve Crossing optimized default.
23. Keep Document-order path.
24. Keep Vertical-Spine path.
25. Force accepted Directional Folder Bands semantics On.
26. Preserve joint refinement.
27. Recompute final module bounds/endpoints.

## Phase 5 — renderer integration

28. Verify React Flow renders worker geometry directly.
29. No Compass layout in React.
30. Preserve hover/ring.
31. Preserve camera/surface.
32. Preserve current SmoothStep routing.

## Phase 6 — automated production tests

33. Defaults.
34. Persistence.
35. obsolete-Mosaic migration.
36. worker/cache matrix.
37. multi-module Compass.
38. large Heading fallback.
39. nested branch.
40. mixed demand.
41. folder balance regressions.
42. Secondary invariance.
43. reroot.
44. hide/restore.
45. disclosure.
46. Classic independence.
47. determinism matrix.

## Phase 7 — browser real-app QA

48. Run actual web app.
49. Verify Modular Preview default Adaptive Compass + Crossing optimized.
50. Verify Vertical Spine Sandbox.
51. Verify Document order Sandbox.
52. Restore defaults.
53. Ask user for graphical approval.
54. STOP.

## Phase 8 — optimized desktop QA

55. After browser approval, build optimized desktop.
56. Provide exact path.
57. User tests real vault.
58. Ask for explicit approval.
59. STOP.

## Phase 9 — documentation / PR / merge

60. Update HIER4A docs.
61. Update ADR.
62. Update roadmap: HIER4A complete.
63. Archive this exact prompt + SHA-256.
64. Full checks.
65. Open/update HIER4A PR.
66. Wait for CI.
67. Merge only after user approval.
68. Verify post-merge CI.
69. Clean only HIER4A worktree.
70. Stop.

Do not start HIER4B automatically.

---

# Validation commands

Use repository-current equivalents.

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout

pnpm --filter @icarus-graph-explorer/focus-schematic-bakeoff typecheck
pnpm exec vitest run tools/focus-schematic-bakeoff

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:focus-schematic-directional-folder-bands
pnpm benchmark:focus-schematic-internal-layout
pnpm benchmark:focus-schematic-production-worker -- --profile small
pnpm benchmark:focus-schematic-production-worker -- --profile medium

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

If script names changed during HIER4A development:

```text
use the current repository equivalents
```

Do not invent duplicate scripts merely to satisfy old prompt spelling.

---

# Hard exit gates

HIER4A production integration is complete only when all are true:

1. Adaptive Compass is the selected Modular production internal layout.
2. Crossing optimized is the selected Modular production Heading-order default.
3. Vertical Spine exists as Sandbox/Experimental alternative.
4. Document order exists as Sandbox/Experimental alternative.
5. Current/Mosaic is not a product setting.
6. Fresh settings default to Adaptive Compass.
7. Fresh settings default to Crossing optimized.
8. settings persist.
9. obsolete Mosaic persisted values normalize safely.
10. settings affect only Modular Focus Hierarchy.
11. Classic remains unchanged.
12. All + Hierarchy remains unchanged.
13. Directional Folder Bands are active in production Modular HIER4A.
14. no strength slider is reintroduced.
15. singleton folder bands remain correct.
16. root folder balance remains correct.
17. Compass applies to root File module.
18. Compass applies to other expanded visible File modules.
19. File remains central owner/anchor.
20. whole structural branches move coherently.
21. no Heading duplication.
22. no reparenting.
23. no source mutation.
24. Crossing optimized uses legal visual sibling/branch reordering only.
25. Document order preserves canonical visual order according to defined contract.
26. Secondary relationships remain zero-layout.
27. Visual Groups remain style-only.
28. Compass candidate search remains bounded.
29. Compass does not create global Cartesian search across File modules.
30. large Heading fallback is deterministic and bounded.
31. Compass quality remains lexicographic.
32. crossings outrank compactness.
33. exact endpoint attachments are recomputed from final geometry.
34. module bounds are recomputed from selected internal variant.
35. folder band heights use final module dimensions.
36. joint internal/folder refinement remains bounded.
37. root File anchor remains stable.
38. worker owns layout.
39. React Flow does not perform Compass layout.
40. cache key distinguishes all 4 Sandbox combinations.
41. selected algorithm revision invalidates prior prototype geometry.
42. worker protocol is bumped only if strict schema requires it.
43. latest-result-wins survives rapid setting switches.
44. no stale geometry after Adaptive ↔ Spine.
45. no stale geometry after Crossing ↔ Document.
46. Heading disclosure recomputes correctly.
47. reroot recomputes correctly.
48. query hide/restore recomputes correctly.
49. filtered bridge semantics remain correct.
50. direct File ring remains correct.
51. File aggregate hover remains correct.
52. Heading/Block exact hover remains correct.
53. hover is zero-layout.
54. Secondary toggle is zero-layout.
55. current SmoothStep routing remains untouched.
56. no HIER5 implementation leaks in.
57. web actual Modular graph visibly uses Adaptive Compass.
58. web actual Modular graph visibly uses Crossing optimized by default.
59. Sandbox Vertical Spine visibly works in real graph.
60. Sandbox Document order visibly works in real graph.
61. restoring defaults restores deterministic original geometry.
62. multi-expanded-module test passes.
63. large-Heading fallback test passes.
64. nested branch test passes.
65. mixed demand test passes.
66. DB5 production regression passes.
67. DB11 production regression passes.
68. DB12 neutralized/final result documented.
69. true-blocked production oracle passes.
70. FB4 production regression passes.
71. folder exceptions remain zero where expected.
72. no invalid node overlap.
73. no invalid module overlap.
74. no containment failures.
75. signed-rank X semantics remain correct.
76. internal hierarchy crossing hard quality remains correct.
77. cold determinism passes all 4 policy combinations.
78. input permutation determinism passes.
79. worker/in-process determinism passes.
80. cache hit/miss geometry equality passes.
81. no new external dependency.
82. browser graphical QA approved by user.
83. optimized desktop QA approved by user.
84. docs record Adaptive Compass selection.
85. docs record Vertical Spine Sandbox availability.
86. docs record Crossing optimized default.
87. docs record Document order Sandbox availability.
88. docs record Mosaic as development-only.
89. HIER4A roadmap is marked complete only after merge.
90. exact prompt is archived with SHA-256.
91. full `pnpm check` passes.
92. desktop check/build passes.
93. PR CI passes.
94. post-merge CI passes.
95. HIER4B remains unimplemented.
96. HIER5 remains deferred.
97. HIER3C remains deferred.
98. Classic remains default until HIER3C.
99. only this task's worktree is cleaned.
100. stop after HIER4A finalization.

---

# Required user-facing QA handoff

Before merge, provide the user exact steps, approximately:

```text
1. Open Settings → Graph → Sandbox / Experimental.
2. Select Focus Hierarchy implementation → Modular Preview.
3. Confirm:
   Internal layout = Adaptive Compass
   Heading order = Crossing optimized
4. Open a Focus + Hierarchy graph with multiple Headings.
5. Expand several File modules.
6. Check folder positioning and connections.
7. Switch Internal layout → Vertical Spine.
8. Switch back → Adaptive Compass.
9. Switch Heading order → Document order.
10. Switch back → Crossing optimized.
11. Toggle Secondary.
12. Hover File / Heading.
13. Reroot.
14. Report graphical issues.
```

Do not merge until they approve.

---

# Final report format

## Decision

```text
ADOPT_ADAPTIVE_COMPASS
```

Default:

```text
Crossing optimized
```

Sandbox alternatives:

```text
Vertical Spine
Document order
```

## Actual graph integration

State exactly where Adaptive Compass is now used in the real app.

## Settings

Defaults, persistence, migration.

## Worker / cache

Policy fields, cache identity, versioning, latest-result-wins.

## Compass

Confirm bounded per-module search and no global combinatorial product.

## Directional Folder Bands

Confirm production On semantics and root balance.

## Real-app regressions

DB5, DB11, DB12, FB4, true-blocked replacement.

## Interaction compatibility

Disclosure, reroot, hide/restore, hover/ring, Secondary.

## Performance

Actual production worker timings/candidate counts.

## Graphical QA

Browser approval.

## Desktop QA

Optimized native approval.

## Documentation

ADR / roadmap / prompt archive SHA-256.

## Files changed

## Dependencies

Expected:

```text
0
```

## Checks / CI / merge

## Next

```text
HIER4B — Soft Folder Clusters
```

Do not implement it automatically.
