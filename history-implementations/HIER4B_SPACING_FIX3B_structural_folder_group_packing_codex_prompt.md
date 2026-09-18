# HIER4B-SPACING-FIX3B — Structural Folder-Group Packing Before Radial Spread

**Task type:** structural layout refinement / overlap-proofing / corrective continuation of open PR #106

## Goal / success outcome

Continue the still-open PR #106 after FIX3 correctly stopped on its overlap gate.

The failed FIX3 experiment proved that this post-layout transform is **not safe**:

```text
current structural File layout
→ group Files by immediate folder
→ rigidly move each folder centroid outward
```

because the existing structural solver only guarantees safe individual File-module geometry, not safe compound-folder geometry.

In the legitimate SC14 Adaptive Compass fixture, rigid folder-centroid spreading produced cross-folder overlaps at multiple slider values.

The founder has chosen **Option B**:

> revise the structural Soft layout so immediate folder groups are already spatially/radially separable before the spacing slider is applied.

The desired architecture is now:

```text
existing Soft structural solve
├─ topology / hop structure
├─ Soft folder attraction
├─ Adaptive Compass
├─ module collision handling
└─ current stable candidate
        ↓
NEW structural folder-group packing/separation stage
        ↓
compound immediate-folder groups become safely separable
while preserving each group's internal File geometry as much as possible
        ↓
stable base structural result
        ↓
existing lightweight folder-centroid radial spacing slider
        ↓
no post-spread collision resolver
```

Success means:

1. SC14 and all other fixtures are overlap-free for the full supported spread range.
2. Same-folder Files move as rigid groups under the slider.
3. The slider remains smooth and does not trigger discrete re-packing.
4. No collision solver runs after the slider.
5. The new structural group pass happens only when the structural layout itself is computed.
6. Topology / hop / Adaptive semantics are preserved as much as possible.
7. Workspace-root grouping remains optional and OFF by default as requested in FIX3.
8. PR #106 remains unmerged until founder native QA.

---

# Current evidence

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Continue the same PR:

```text
PR #106
branch: codex/hier4b-spacing-slider
remote head remains:
2a6c35231f5503df55a6e61390d92fe66d496e2a
```

FIX3 did **not** commit or push changes because it hit the explicit stop gate.

The FIX3 worktree may still contain a local latest-main integration commit:

```text
b50de7700d5b9adfda29c430b69ef9ad12c25019
```

which integrated:

```text
main: 8e3cb4998b056ae3786e1fbd96c9e432bb19fedc
```

Do not assume that local commit still exists. Inspect the actual worktree/branch state first.

At task start:

1. read current `AGENTS.md`;
2. fetch latest refs;
3. inspect current `main`;
4. inspect PR #106 head;
5. inspect the existing task worktree before modifying it;
6. preserve any clean local sync commit if it is still the correct latest-main integration;
7. otherwise integrate current `main` using repository policy;
8. record exact starting SHAs;
9. update the same PR #106.

Do not create a competing PR unless continuation is technically impossible.

---

# Proven failure from FIX3

The required rigid folder-centroid transform created **11 cross-folder module overlaps** in the legitimate SC14 fixture.

Examples reported:

```text
spacing 25:
  Target5 overlaps Target7

spacing 50:
  two overlaps

spacing 71:
  two overlaps

spacing 73:
  two overlaps

additional overlaps:
  75
  100
```

The stop report also established:

```text
Direct-folder memberships are correct.
```

The base same-folder separation is caused by legitimate competing structural forces:

```text
topology springs
hop-radius preference
collision constraints
Soft folder attraction
```

Therefore do **not** spend this task looking for a direct-parent membership bug that was already ruled out.

---

# SC14 fixture anatomy

Current source fixture:

```text
SC14 — multi-heading Adaptive Compass
```

contains:

```text
Focus File
7 Heading branches H1..H7 on Focus
7 one-hop Target Files
```

Target folders are interleaved:

```text
folder-0:
  Target1
  Target4
  Target7

folder-1:
  Target2
  Target5

folder-2:
  Target3
  Target6
```

Each Heading connects to the corresponding Target.

This is exactly the kind of topology-vs-folder conflict the structural group pass must handle:

```text
Adaptive/topology wants Targets distributed around Focus
folder semantics want repeated-folder Targets to behave as spatial groups
```

Do not solve SC14 with fixture-specific logic.

---

# Preserve accepted PR #106 behavior

Do not regress:

```text
Soft Folder Clusters remains experimental
root Focus File excluded from folder attraction
root visual folder membership preserved
Direct folders only exists
Direct-only immediate parent = post-manual / pre-auto-compression parent
Direct-only singleton named guides render
Nested ancestor decay supports normalized 1/3 and 1/4
default decay = 1/3
folder labels use top horizontal visible segment
Soft spacing is post-structural
spacing slider does not enter structural cache identity
Adaptive Compass assignment/search/scoring unchanged
Folder-strength semantics unchanged
Directional unchanged
[36,18] main Soft relaxation schedule unchanged
secondary relationships have zero geometry influence
FIX2 renderer adoption / quality refresh remains
```

Also carry forward the FIX3 product requirement:

```text
Workspace-root group is optional
default OFF
visible name when enabled = "Workspace root"
never "Root folder"
```

---

# Scope

## In scope

- introduce one deterministic **structural immediate-folder group separation / packing stage**;
- treat each immediate-folder group as a compound spatial body during that stage;
- keep group member internal geometry rigid during this stage unless repository evidence proves a tiny bounded intra-group correction is strictly necessary;
- preserve Focus-containing groups as anchored;
- create safe geometry for the full radial spread slider range;
- then enable the folder-centroid spread design from FIX3;
- add Workspace-root grouping option from FIX3;
- add exact overlap-safety tests across the full slider domain;
- benchmark layout-quality tradeoffs;
- produce native QA artifact.

## Non-scope

Do not redesign:

```text
Adaptive Compass algorithm
Heading-order optimization
Folder strength continuity
1/3 vs 1/4 decay
manual promotion/flattening semantics
automatic singleton compression semantics
HIER5 routing
unified/no-island experiment
MODULAR-CONTEXT1
HIER3C adoption/default
Classic Focus Hierarchy
Network layouts
```

Do not add a post-spread collision resolver.

Do not reintroduce slider-triggered structural re-layout.

---

# Core design: compound immediate-folder bodies

After the existing Soft structural candidate is complete, derive disjoint compound bodies.

Use the same immediate-folder identity already accepted for Direct-only:

```text
post-manual-intent
pre-auto-singleton-compression
immediate displayed parent
```

Each visible File module belongs to exactly one structural spacing body:

### Named folder

```text
all visible modules sharing that immediate named folder
→ one compound body
```

### Workspace-root File with workspace-root grouping OFF

```text
each root-level non-focus File
→ singleton compound body
```

### Workspace-root grouping ON

```text
root-level Files
→ one workspace-root compound body
```

### Focus-containing body

If a body contains the Focus/root File:

```text
body is anchored
```

It cannot translate during group packing.

Every non-focus member in that body stays rigid relative to Focus.

---

# Group internal geometry

The structural group pass should begin from the candidate produced by the existing solver.

For each compound body, preserve member-relative geometry:

```text
module_i_center - group_reference
```

Do not rerun Adaptive Compass or internally reorder modules inside a group.

The group pass moves **whole groups**, not individual group members.

This preserves the topology/Adaptive decisions already made as much as possible.

If a group is extremely large because its Files are widely separated, that is valid evidence about current Soft cohesion; do not silently compress it by moving individual members in this task.

---

# Preferred group center

For each body compute a stable reference center.

Use:

```text
arithmetic mean of member module centers
```

unless current geometry architecture makes another equivalent center clearly better.

Store member offsets from this center.

No weighting by:

```text
module area
Heading count
edge count
folder strength
```

---

# Group body geometry

The new pass needs a compound footprint.

Prefer a representation that is:

```text
deterministic
cheap enough
strong enough to guarantee slider safety
not unnecessarily huge
```

At minimum inspect these options:

### Option 1 — axis-aligned compound envelope

```text
AABB of all member module rectangles relative to group center
```

Pros:

```text
simple
deterministic
easy collision math
strong separation guarantee
```

Risk:

```text
can be conservative if same-folder members are already widely separated
```

### Option 2 — exact list of member rectangles as rigid compound shape

Pros:

```text
less conservative
```

Risk:

```text
base non-overlap alone does not guarantee future radial-spread safety
```

### Option 3 — convex / directional envelope

Potential middle ground.

Do not automatically pick AABB only because it is easiest if benchmark evidence shows pathological canvas inflation.

However, the final implementation must have a **provable/validated safety condition across the whole slider range**, not only at one sampled scale.

---

# Continuous spread-safety requirement

The slider supports a continuous radial scale interval approximately:

```text
s ∈ [1.0, 2.4]
```

Do not validate only:

```text
0 / 25 / 50 / 75 / 100
```

and assume intermediate values are safe.

Prefer an exact continuous collision oracle.

For a module rectangle in group A and another in group B:

```text
their positions under spread are affine functions of scale s
```

because each whole group translates linearly with `s`.

Therefore horizontal and vertical overlap conditions can be represented as intervals over `s`.

Implement a deterministic helper/dev oracle conceptually like:

```ts
radialSpreadOverlapInterval(
  groupA,
  memberRectA,
  groupB,
  memberRectB,
  minScale,
  maxScale,
)
```

that can answer:

```text
Does any scale in [1.0, 2.4] produce a cross-group module overlap?
```

Use actual rectangle geometry + required layout clearance.

If an exact interval solution is unnecessarily complex after inspection, another mathematically sound continuous guarantee is acceptable, e.g. sufficiently separated compound envelopes whose separation monotonically increases with scale.

But final validation must justify why **all** slider values are safe.

---

# Structural group-separation stage

Add a bounded deterministic pass after current Soft module geometry and before final structural adoption.

Conceptually:

```text
existing Soft candidate
→ build compound folder bodies
→ group-separation / packing
→ translate entire groups
→ recompute structural geometry-derived attachments/quality
→ final base structural result
```

The stage must run in the structural worker/layout path.

It runs once per structural request.

The spacing slider does not rerun it.

---

# Group packing objectives

Hard gate:

```text
final structural base
must admit overlap-free rigid radial spreading across the full supported scale range
```

Soft objectives, in order of importance:

```text
1. minimize movement from the pre-group-pass candidate
2. preserve each group's polar direction from Focus where practical
3. preserve group radius/hop interpretation where practical
4. preserve topology edge lengths / endpoint quality where practical
5. avoid excessive canvas-area growth
6. stay deterministic
```

Do not optimize folder packing by destroying topology.

---

# Suggested implementation direction

A deterministic bounded group-level relaxation + final pack is acceptable.

For example:

```text
preferred group center = original centroid

repeat bounded fixed passes:
  - soft spring toward preferred center
  - repel groups whose compound bodies violate base / future-spread safety
  - anchored Focus group does not move

then:
  deterministic final group pack around preferred centers
  selecting the nearest safe translation
```

The exact algorithm is Codex's choice after inspection.

Important:

```text
discrete group packing is acceptable here
```

because it is part of the **structural layout computed once**.

It is NOT acceptable after each slider change.

That distinction is the reason Option B was chosen.

---

# No post-spread collision correction

After structural group packing:

```text
slider
→ pure folder-centroid radial translation
```

No:

```text
collision pass
spiral re-pack
angle reselection
force relaxation
```

after the slider.

If the structural candidate cannot guarantee the whole slider interval safely:

```text
the structural layout attempt must fail / reject during development
```

rather than silently patching it later.

---

# Group packing and Focus-containing group

The compound body containing Focus is fixed.

Other groups pack around it.

The anchored group's full compound footprint counts as an obstacle.

This may require pushing other groups farther from Focus.

Do not move Focus.

---

# Group packing and workspace root option

Implement the FIX3 Workspace-root preference:

```text
Include workspace root group
default OFF
```

### OFF

```text
"." is not a visible group
root-level non-focus Files are singleton bodies
no Workspace-root guide
no visible Root-folder label
```

### ON

```text
root-level Files form one workspace-root body
guide label = "Workspace root"
```

If the workspace-root body contains Focus:

```text
body anchored
```

This option should remain post-structural if possible.

However, because body membership affects the new structural group packing, inspect this carefully.

There are two legitimate architectures:

### Architecture A

Structural packing always treats root-level Files as singleton bodies.

Workspace-root ON only changes post-structural spread/guide grouping.

Pros:
```text
preference remains presentation-only
```

### Architecture B

Workspace-root ON changes compound structural body membership.

Pros:
```text
stronger semantic coherence
```

Cons:
```text
becomes structural/cache input
```

Do not decide silently.

Prefer **A** unless native/product semantics clearly require workspace-root Files to be structurally packed as one body when ON.

If B is necessary, report the rationale and update cache/protocol correctly.

Default OFF behavior must be correct either way.

---

# Activate folder-centroid radial spread after structural packing

Once the structural group pass is safe, implement the FIX3 slider semantics:

```text
for each spacing body:
  compute body centroid
  compute radial target centroid from Focus and scale
  translate every member module by same delta
```

For anchored Focus-containing bodies:

```text
delta = 0
```

For root-level singleton bodies:

```text
normal singleton radial translation
```

Intra-group vectors/distances must remain exact.

---

# SC14 hard regression

SC14 is now a required regression.

Remember its group membership:

```text
folder-0 = Target1, Target4, Target7
folder-1 = Target2, Target5
folder-2 = Target3, Target6
```

Requirements:

```text
structural group packing completes
no module overlap at base
no module overlap for ANY supported spread value
Targets in same folder keep exact relative geometry during spread
Adaptive Compass evidence unchanged by spread
```

The old failure:

```text
Target5 ↔ Target7 overlap
```

must be impossible after the structural group pass.

---

# Existing topology-conflict fixtures

Also inspect:

```text
SC3 — topology versus folder conflict
SC5 — disconnected same-folder islands
SC23 — topology legitimately splits one folder
SC24 — several free 2D folders
SC21 — large mixed-folder graph
```

These are important because a group-level pass can over-constrain Soft semantics.

Do not make all same-folder Files artificially compact.

Especially preserve the intent of SC23:

```text
folder attraction must not erase legitimate topology branches
```

The group pass may translate the compound body as a whole but should not collapse its internal branch separation.

---

# Base same-folder separation

The prior stop report established:

```text
memberships correct
base separation caused by competing topology/hop/collision constraints
```

Therefore this task does **not** need to force same-folder Files closer internally.

The chosen structural stage should:

```text
preserve their existing relative positions
```

unless a bug is discovered.

The primary purpose is:

```text
make folder groups spatially separable from OTHER groups
```

so the slider can translate them rigidly without collisions.

---

# Group envelope / island semantics

A folder may have multiple renderer islands because its members are far apart.

Do not automatically merge islands or draw one giant guide.

The structural packing body may still include all direct members for spread safety.

Renderer island splitting remains downstream presentation logic.

After spread:

```text
relative member geometry unchanged
→ island topology should remain stable
```

unless guide blockers from other groups move enough to alter island classification.

Measure/report if island count changes with spread.

Do not make island count a hard invariant unless current implementation makes it naturally invariant.

---

# Quality metrics / evidence

Add development evidence for the new stage:

```text
compoundGroupCount
anchoredGroupCount
groupPackingIterationCount
groupPackingCollisionCheckCount
groupPackingCorrectionCount
groupTranslationMean
groupTranslationP95
groupTranslationMax
groupEnvelopeAreaMean/P95
radialSpreadSafetyViolationCount
```

Also preserve existing:

```text
topology distance
endpoint span
crossings
hop-radius error
folder coherence
layout time
bounds area
```

Compare before vs after the group stage.

Do not expose all of this as product UI.

---

# Hard quality gates

Reject candidate implementation if it causes:

```text
module overlap
node containment failure
root movement
secondary geometry influence
Directional changes
nondeterminism
Adaptive algorithm changes
post-spread collision correction
pathological canvas explosion
major topology destruction without explicit founder review
```

If the only way to guarantee spread safety causes enormous bounds on legitimate fixtures:

```text
STOP and report
```

Do not silently accept it.

---

# Bounds / topology tradeoff gate

Because compound packing can increase canvas size, report:

```text
mean / P95 / max bounds area change
connected pair distance change
endpoint span change
hop-radius error change
exact crossing change
layout runtime change
```

Do not define arbitrary numeric rejection thresholds without evidence.

But explicitly surface worst-case fixture regressions.

The founder needs to know if folder separability costs too much topology quality.

---

# Determinism

For fixed structural inputs:

```text
group packing output must be byte-deterministic
```

Test:

```text
cold repeat
permuted input order
worker round-trip
```

No random search.

Any angular sampling must use stable seeded/deterministic ordering.

---

# Cache / algorithm ownership

The new group packing stage changes structural Soft geometry.

Therefore:

```text
bump Soft structural algorithm/cache version
```

to the next current version.

Do not change:

```text
Directional algorithm version
Classic
Network
```

The spacing slider remains excluded from structural cache identity.

If Workspace-root option remains presentation-only, exclude it too.

If the new stage requires new serialized structural evidence, bump only the relevant evidence/protocol schema.

Explain every bump.

---

# Worker behavior

The group pass belongs inside the existing structural worker compute.

Expected:

```text
change Folder strength / Direct-only / decay
→ structural worker recomputes

change Soft spacing
→ structural worker does NOT recompute
```

If Workspace-root option remains presentation-only:

```text
toggle Workspace-root
→ structural worker does NOT recompute
```

Test compute counts.

---

# Renderer / geometry refresh

After structural group packing and after radial spread, keep strict geometry truth.

Refresh only necessary derived values:

```text
attachments
endpoint quality
folder-band quality
routes if actually consumed
```

Do not hide failures with silent fallback.

The FIX2 explicit warning path remains.

---

# Workspace-root UI requirement

Add/complete Sandbox control:

```text
☐ Include workspace root group
```

Default:

```text
OFF
```

When OFF:

```text
no "." guide
no "Root folder"
no workspace-root product folder count
root-level Files visually ungrouped
```

When ON:

```text
guide label = "Workspace root"
```

Search only Soft-folder UI strings.

Do not rename unrelated `Focus Root` controls.

---

# Tests — structural group packing

Add at least:

## GP1 — simple two-folder compounds

Two multi-File folders.

Assert:

```text
member-relative geometry unchanged by group packing
groups do not overlap
```

## GP2 — SC14

Assert full spread-domain safety.

## GP3 — SC23 topology split

Group internal geometry remains split according to topology.

No artificial collapse.

## GP4 — Focus-containing group

Anchored body stays fixed; others pack around it.

## GP5 — singleton bodies

Named singleton/root-level singleton behavior remains valid.

## GP6 — deterministic repeat

Byte-identical.

## GP7 — input permutation

Stable output.

## GP8 — no Directional effect

Representative hashes unchanged.

---

# Tests — continuous radial spread safety

Prefer an exact/continuous oracle.

At minimum include:

```text
all cross-group module-pair overlap intervals
intersect [1.0, 2.4] = empty
```

for final structural result.

Test SC14 and representative dense fixtures.

Also sample:

```text
0
1
2
...
100
```

in a development test if runtime is reasonable, as an additional sanity check.

The exact continuous oracle remains the authoritative gate.

---

# Tests — radial group transform

After structural packing:

```text
same group members receive identical delta
intra-group pair vectors exact
Focus group anchored
group centroid radius scales smoothly
71/72/73 smooth
worker compute count stable
```

---

# Tests — workspace root option

Carry forward FIX3 requirements:

```text
default OFF
no "." guide
no Root folder label
ON label = Workspace root
preference/reset/save compatibility
no workspace-root force
```

Cache/worker tests according to chosen ownership architecture.

---

# Tests — Direct / Nested / decay

Preserve current tests:

```text
Direct-only immediate parent
single named direct guide
manual promotion
manual flatten
nested compression
1/3 weights
1/4 weights
root-neutral force
```

Run these alongside group packing because translations must not alter membership.

---

# Benchmark / bakeoff

Extend:

```text
pnpm benchmark:focus-schematic-soft-clusters
```

to report group-packing evidence.

Compare at least:

```text
pre-group-pass candidate
final group-packed structural candidate
spread 0
spread 50
spread 100
```

For SC14 explicitly include:

```text
cross-group overlap count
group translations
bounds area
endpoint crossing count
topology distance
```

Do not use private vault data.

---

# Native artifact

Build:

```text
hier4b-spacing-fix3b-structural-group-packing-native-candidate.exe
```

Report SHA-256.

Update the same PR #106.

Run CI.

Do not merge.

---

# Native founder QA request

Ask founder to test:

### Same-folder rigid spacing

Use a folder with >=2 visible Files.

Try:

```text
0
25
50
71
73
75
100
```

Expected:

```text
folder moves outward as one body
member spacing remains fixed
no overlaps with other folders
```

### Focus-containing folder

Expected:

```text
entire folder remains anchored
```

### Direct-only

Expected:

```text
same immediate folder Files preserve their base relative arrangement while the group moves
```

If their base arrangement is still visually too separated at spacing 0:

```text
report that separately
```

It is not a slider bug anymore.

### Workspace root

Default OFF:

```text
no visible root folder group
```

ON:

```text
Workspace root appears
```

---

# Likely files / areas

Inspect actual branch first.

Probable:

```text
packages/focus-schematic-layout/src/soft-clusters.ts
packages/focus-schematic-layout/src/soft-clusters.test.ts
packages/focus-schematic-layout/src/soft-radial-spread.ts
packages/focus-schematic-layout/src/soft-radial-spread.test.ts
packages/focus-schematic-layout/src/soft-folder-display.ts
packages/focus-schematic-layout/src/types.ts
packages/focus-schematic-layout/src/settings.ts
packages/focus-schematic-layout/src/policies.ts

packages/renderer-reactflow/src/focus-schematic/folder-cluster-guides.tsx
packages/renderer-reactflow/src/focus-schematic/folder-cluster-guides.test.ts

apps/web/src/components/ModularStructuredGraphView.tsx
apps/web/src/components/GraphSettings.tsx
apps/web/src/components/GraphSettings.modular.test.tsx
apps/web/src/preferences/*
apps/web/src/focus-schematic-layout-cache.test.ts

tools/focus-schematic-bakeoff/src/soft-cluster-benchmark.ts
tools/focus-schematic-bakeoff/src/soft-cluster-lab.ts

docs/HIER4B_SOFT_FOLDER_CLUSTERS.md
docs/HIER4B_VALIDATION.md
docs/ROADMAP.md
history-implementations/
```

Do not force all files to change.

---

# Validation

Follow current `AGENTS.md`.

Expected repository-current equivalents:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/focus-schematic-layout
pnpm exec vitest run packages/renderer-reactflow
pnpm exec vitest run apps/web/src/components
pnpm exec vitest run apps/web/src/preferences
pnpm exec vitest run apps/web/src/focus-schematic-layout-cache.test.ts

pnpm benchmark:focus-schematic-soft-clusters

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Use current scripts if paths/names moved.

No new dependency unless clearly justified.

---

# Decision gates

Stop and report instead of continuing if:

1. structural group packing cannot make SC14 safe across the full slider interval without major topology destruction;
2. safe compound-envelope packing causes pathological canvas growth;
3. the algorithm requires moving individual members inside groups in a consequential way;
4. Workspace-root ownership requires a product-level semantic choice not covered here;
5. a post-spread collision solver appears necessary.

Do not bypass these gates.

---

# Prompt archive

Archive this exact prompt as:

```text
history-implementations/HIER4B_SPACING_FIX3B_structural_folder_group_packing_codex_prompt.md
```

Record SHA-256.

---

# Hard exit gates before founder QA

1. same PR #106 continued;
2. latest main integrated;
3. new structural group stage runs before radial slider postprocess;
4. immediate-folder compound bodies are disjoint;
5. group member geometry preserved by group packing;
6. Focus-containing body anchored;
7. SC14 full spread range safe;
8. no Target5/Target7 overlap at any supported scale;
9. no post-spread collision resolver;
10. continuous safety oracle exists or equivalent proof is documented;
11. spread remains outside structural cache identity;
12. 71/72/73 smooth;
13. intra-group vectors exact under spread;
14. SC23 topology split preserved;
15. no module overlaps across all hard-gate fixtures;
16. root Focus fixed;
17. Workspace-root control implemented/default OFF;
18. no Root folder label by default;
19. ON label = Workspace root;
20. 1/3/1/4 behavior unchanged;
21. Direct-only semantics unchanged;
22. root-neutral folder force unchanged;
23. Adaptive Compass logic unchanged;
24. Folder-strength behavior unchanged;
25. Directional unchanged;
26. [36,18] unchanged;
27. secondary influence zero;
28. deterministic repeats pass;
29. input-order permutation passes;
30. topology/endpoint/bounds regressions reported;
31. group-packing runtime/evidence reported;
32. focused tests pass;
33. benchmark hard gates pass;
34. full `pnpm check` passes;
35. desktop check/build passes;
36. `git diff --check` passes;
37. docs updated;
38. prompt archived + SHA-256;
39. optimized EXE + SHA-256;
40. PR #106 CI green;
41. PR remains unmerged;
42. stop.

---

# Final report before founder QA

## Branch / commits / PR #106

## Latest main integrated

## FIX3 stop evidence recap

Include the SC14 overlap that motivated Option B.

## Structural group-packing algorithm

Explain:

```text
compound body representation
preferred center
anchoring
separation / packing
deterministic tie-breaks
continuous spread-safety guarantee
```

## SC14 result

Report:

```text
folder-0 / folder-1 / folder-2
group translations
overlap oracle
bounds/topology/crossing changes
```

## Slider behavior

Confirm:

```text
one structural result
folder-centroid spread
intra-group invariance
71→73 smooth
no collision pass after slider
```

## Workspace-root option

Report final architecture and cache ownership.

## Topology tradeoffs

Report worst fixture regressions.

## Versions

Explain every version/schema bump.

## Directional / Adaptive isolation

## Tests / benchmark / builds

Exact pass counts.

## Native artifact

Path + SHA-256.

## Prompt archive

Path + SHA-256.

## Merge status

```text
NOT MERGED — awaiting founder graphical QA
```

Then stop.
