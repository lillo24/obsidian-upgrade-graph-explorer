# SPACING1A — Focus Network Density Diagnostic + Normalization Decision Spike

**Task type:** diagnostic/design spike / layout evidence / no production behavior change

## Goal

Determine the cleanest way to fix this observed Focus + Network problem:

```text
few visible nodes
→ nodes can appear unnecessarily far apart
→ large empty space between nodes
→ graph feels sparse/overspread

many visible nodes
→ graph often feels much denser / more reasonable
```

The current leading approach is **B: application-owned post-layout / presentation normalization on top of ForceAtlas2**, not a ForceAtlas2 fork.

This spike must answer:

1. **Why does the current ForceAtlas2 + Sigma pipeline produce the observed sparse-graph appearance?**
2. **Can B solve it cleanly without changing ForceAtlas2 forces?**
3. **What visual-density metric or combination should drive normalization?**
4. **Where should normalization live: graph coordinates, Sigma normalization/framing, camera framing, or a small combination?**
5. **What exact SPACING1B implementation should follow?**
6. If B is genuinely insufficient, state the evidence for moving to **C: mild adaptive ForceAtlas2 parameters + normalization** — but do **not** implement C here.

The user should not need to invent the math before this spike. Produce evidence and a small number of concrete visual options.

---

# Hard non-goal

**Do not change production Focus spacing, ForceAtlas2 settings, camera behavior, or renderer behavior in SPACING1A.**

This is a decision spike.

No production behavior should change simply because this branch exists.

Do not implement the final normalization formula yet.

---

# Current repository baseline

Repository:

```text
lillo24/icarus-graph-explorer
```

Current `main` at plan-writing time:

```text
b81cc2cdd93ec7dd314189616efec3717ae81d18
```

Current Focus Free layout is in:

```text
packages/renderer-sigma/src/local-layout.ts
```

and uses Graphology ForceAtlas2:

```ts
forceAtlas2.assign(...)
```

with current defaults:

```text
hierarchyWeight = 6
referenceWeight = 1
scalingRatio = 1.35

strongGravityMode = true
gravity = 0.08
edgeWeightInfluence = 1
Barnes-Hut only for >= 600 nodes
```

After ForceAtlas2 finishes, positions are only translated so the Focus root is at `(0,0)`:

```text
FA2 output
→ subtract root.x/root.y
→ retain the resulting scale
```

There is currently no sparse/dense graph normalization stage.

The Focus renderer then passes positions through Sigma 3.0.3 and its camera/framing behavior.

Current renderer settings include:

```text
stagePadding: 24
minCameraRatio: 0.02
maxCameraRatio: 6
```

and the repository does not currently explicitly configure all Sigma normalization/size scaling defaults.

---

# Important new concurrent evidence: VISUAL1B

At plan-writing time:

```text
PR #51 — VISUAL1B: per-file Network size overrides
status: draft / unmerged
```

Its latest correction found an important architectural fact:

```text
per-file visual Size override
→ should NOT enter ForceAtlas2 input/fingerprint
→ should NOT move unrelated nodes
→ render-only Sigma reducer output
```

PR #51 now keeps automatic node sizes in layout inputs and applies user size multipliers only during Sigma rendering.

This is relevant to SPACING1A because:

- do not use the pending Size override as a layout-spacing mechanism;
- keep layout-density policy separate from per-file presentation Size;
- preserve PR #51's worktree/branch;
- do not modify or merge its work.

Before starting, inspect current main and open PRs again.

If NETWORKPOLISH1 or another sidebar/Focus-edge task exists concurrently, preserve it too. SPACING1A should mostly live in diagnostics/tooling and avoid UI files.

---

# Existing diagnostic seam

The repo already has:

```text
tools/vault-diagnostics/src/local-renderer-benchmark.ts
pnpm benchmark:local-renderer
```

It already exercises:

```text
real KG6 Local projection
→ Local topology mapping
→ deterministic seed
→ Graphology
→ computeLocalLayout / ForceAtlas2
```

with synthetic Local profiles.

Reuse this diagnostic ecosystem rather than creating a disconnected research harness.

A likely new command is something like:

```text
pnpm analyze:focus-spacing
```

or a tool-local equivalent.

Exact naming is flexible.

---

# Key conceptual separation

Keep these layers explicit:

```text
GRAPH SEMANTICS
which nodes/edges exist

FORCEATLAS2
relative topology-driven geometry

NORMALIZATION / DENSITY POLICY
how large that geometry should be overall

SIGMA NORMALIZATION / CAMERA
graph coordinates → viewport pixels

NODE SIZE
independent visual presentation
```

The spike must discover which of the last three layers actually controls the user's visible problem.

Do not assume that multiplying ForceAtlas2 coordinates by `0.5` changes screen spacing: verify it through the actual Sigma transform chain.

---

# Phase 1 — Trace the actual coordinate → screen pipeline

Inspect the installed/locked versions:

```text
sigma 3.0.3
graphology-layout-forceatlas2 0.10.1
```

Use repository code plus the installed dependency source/type definitions.

Document, precisely enough for implementation:

```text
LocalLayoutPosition x/y
→ Graphology node attributes
→ Sigma processing / normalization
→ camera ratio/x/y
→ viewport pixel coordinates
→ apparent node radius
```

Answer these questions empirically where source inspection is ambiguous:

### 1A. Uniform coordinate scaling

Given one layout:

```text
P
```

and:

```text
0.5 × P
```

with identical topology/node sizes, what happens to viewport pixel distances:

- immediately after normal renderer mount?
- after the existing `fit()` call?
- under the same explicit camera state?
- after saved semantic viewport restoration?

Does Sigma auto-normalization cancel the scale?

### 1B. Node apparent size

For the same experiment, what happens to visible node radius?

Determine the current Sigma behavior; do not rely on vague assumptions.

### 1C. Fit interaction

Test the user's intuition directly:

```text
cluster nodes closer in graph space
→ more empty space
→ Fit / camera zooms closer
→ nodes appear larger?
```

Report when this is true, partially true, or cancelled by Sigma normalization.

This is an important deliverable.

---

# Phase 2 — Characterize current ForceAtlas2 output

Build a deterministic fixture matrix that intentionally varies **node count and topology**.

Use production `computeLocalLayout()` unchanged.

At minimum include:

```text
2 nodes — one reference
3 nodes — chain
3 nodes — star/root + 2
5 nodes — chain
5 nodes — star
5 nodes — mixed connected + isolated
8 nodes — star
10 nodes — mixed
20 nodes — mixed
50 nodes — mixed

two dense clusters with one bridge
long chain / elongated topology
root + several unconnected/weakly connected nodes
root + hierarchy-heavy nodes
reference-heavy graph
```

Also run current existing Local benchmark fixtures where useful:

```text
smoke
small
medium
```

Use realistic production node kinds/sizes/edge weights when constructing direct Local inputs.

Do not change ForceAtlas2 parameters per fixture.

Use deterministic seeds.

---

# Phase 3 — Measure graph-space AND screen-space density

For every fixture, record raw ForceAtlas2 metrics.

At minimum:

## Topology

```text
node count
edge count
component count
document / heading / block / diagnostic counts
reference vs hierarchy edges
```

## Graph-space geometry

```text
median nearest-neighbor center distance
p10 / p90 nearest-neighbor distance

median reference-edge length
median hierarchy-edge length

median root radial distance
p90 root radial distance
max root radius

bounding width / height
robust extent (prefer percentile-based over raw outlier-only extent)
```

## Node-relative geometry

Even though current FA2 uses `adjustSizes: false`, measure visual ratios such as:

```text
nearest-neighbor distance / representative node diameter
connected-edge length / representative node diameter
robust graph radius / representative node diameter
```

The point is to capture what the eye experiences, not to feed size into ForceAtlas2.

## Standard viewport metrics

Use at least one deterministic viewport such as:

```text
1200 × 800
```

and preferably one smaller viewport to detect scale artifacts.

After the actual current Sigma transform/framing:

```text
median nearest-neighbor pixel distance
median reference-edge pixel length
p90 graph radius in pixels
occupied viewport width/height fraction
node-radius / nearest-neighbor ratio
```

Do not guess these from raw graph units if actual Sigma behavior differs.

---

# Phase 4 — Identify what is really changing with node count

The report must directly answer the user's question:

> Why can a 3–5-node Focus graph look much more spread out than a graph with many nodes, even though fewer nodes means less total repulsion?

Distinguish at least:

```text
actual ForceAtlas2 graph radius / edge distance
vs
visual density caused simply by more nodes occupying the same area
vs
Sigma/camera fitting/normalization effects
```

For example, it is possible that:

```text
raw graph radius is similar
but 20 nodes fill it densely

OR

raw sparse ForceAtlas2 radius is genuinely too large

OR

Sigma fit makes small graphs occupy too much screen

OR

multiple effects contribute
```

Do not decide before measuring.

---

# Phase 5 — Test B-family normalization candidates

Do not alter ForceAtlas2 forces.

Simulate several **application-owned** normalization/framing rules on identical raw ForceAtlas2 results.

The purpose is not to tune final magic numbers yet; it is to discover which invariant behaves robustly.

Include:

## B0 — baseline

```text
no normalization
current behavior
```

## B1 — target connected-edge distance

Uniform scale derived from a robust connected-edge statistic, e.g.:

```text
median reference/hierarchy edge length
```

Consider edge kinds separately if necessary.

Known risk:

```text
disconnected nodes are poorly constrained
```

## B2 — target nearest-neighbor visual density

Use a robust nearest-neighbor statistic, preferably also inspecting node-relative clearance.

Known benefit:

```text
directly tracks visual crowding
```

Known risk:

```text
does not know graph semantics
```

## B3 — target overall density / radius as graph size grows

Test a principled size-growth law rather than:

```text
5 nodes → arbitrary multiplier
```

In particular evaluate constant-area-per-node intuition:

```text
target area ∝ node count
therefore target radius/linear extent ∝ sqrt(node count)
```

Use robust extent/radius, not one extreme outlier.

This directly tests the user's intuition:

```text
fewer nodes
→ intentionally smaller overall graph
```

while still letting larger graphs occupy more area.

## B4 — bounded hybrid

Test a small combination such as:

```text
overall sqrt(N)-style extent target
+
minimum/maximum connected-edge or nearest-neighbor spacing
```

or another evidence-backed combination.

The hybrid should remain a **single uniform transform / framing policy**, not per-node distortion.

Do not invent a complex optimizer.

---

# Important: normalization bounds

Every simulated normalization must be bounded.

Do not allow:

```text
0.05× compression
10× expansion
```

Test reasonable conservative bound families, e.g. around:

```text
0.5–1.5
0.6–1.4
0.7–1.3
```

but treat these as candidates, not final requirements.

The spike should explain whether most real cases need only mild correction or whether B requires extreme scaling.

Extreme required correction is evidence that the chosen metric is poor or that B may be insufficient.

---

# Phase 6 — Verify relative geometry preservation

For every B candidate, prove the intended invariant:

```text
all coordinates receive one uniform scale around the Focus root
```

or an equivalent pure camera/framing transform.

Therefore preserve:

```text
angles
relative distance ratios
cluster shape
edge-length ratios
node ordering
```

within floating-point tolerance.

No per-node warping.

This is B's primary architectural advantage over adaptive ForceAtlas2.

---

# Phase 7 — Determine whether coordinate normalization is actually the right insertion point

Do not force the final design to be:

```text
positions × scale
```

if Sigma cancels it.

Based on Phase 1, choose among:

### B-coordinate

```text
ForceAtlas2
→ root normalization
→ uniform coordinate scale
→ Sigma
```

### B-camera

```text
ForceAtlas2 unchanged
→ Sigma unchanged
→ camera/framing target creates desired screen density
```

### B-combined

A small deterministic combination, if needed:

```text
layout-coordinate sanity bound
+
camera visual-density framing
```

Still no ForceAtlas2 parameter adaptation.

Recommend the narrowest layer that actually changes the user's screen-space result predictably.

---

# Phase 8 — Visual comparison artifact

Numbers alone are not enough.

Produce a deterministic comparison artifact using identical raw layouts.

Preferred output:

```text
SPACING1A comparison
────────────────────────────────────────────
fixture       B0 raw    B1     B2     B3/B4
3-chain       preview   ...    ...    ...
5-star        preview
5-mixed
10-mixed
20-mixed
two-cluster
long-chain
```

A small self-contained local HTML/SVG report is acceptable.

Requirements:

- no external network;
- deterministic;
- no private vault content;
- clearly label node/edge kinds where useful;
- use the same viewport and node-size rendering assumptions across candidates;
- make before/after shape preservation visible;
- do not turn this into a production app screen.

Avoid committing large generated binary artifacts.

If a small deterministic HTML/SVG report is useful to keep, place it under a clearly diagnostic/docs area. Otherwise generate it locally and document the exact path/command.

The final Codex response must tell the user exactly what to open.

---

# User decision burden

The user does **not** need to choose a formula before this spike.

The spike should make a recommendation.

If one B candidate clearly dominates on evidence and visuals:

```text
recommend it
→ specify exact SPACING1B contract
```

If two candidates are genuinely close:

```text
select 4–6 representative side-by-side cases
→ ask the user only for a visual preference
```

Do not ask the user to choose between statistical formulas without visual evidence.

---

# Phase 9 — B vs C decision

At the end classify:

## B sufficient

Choose this if one B-family rule can:

```text
fix sparse overspread
preserve useful ForceAtlas2 geometry
avoid crushing dense graphs
handle isolates reasonably
work consistently in screen space
use bounded corrections
```

Then define SPACING1B.

## C warranted

Only recommend C if B cannot solve the problem because the **relative ForceAtlas2 geometry itself** is bad, for example:

```text
isolates have qualitatively wrong placement
clusters distort badly
uniform scaling cannot reconcile sparse and dense cases
```

If C is recommended, specify which ForceAtlas2 parameters likely need a future sensitivity spike:

```text
gravity
scalingRatio
possibly edge weights
```

but **do not modify them here**.

Do not fork ForceAtlas2.

A fork is not a SPACING1A outcome unless there is extraordinary evidence of a library-level limitation that cannot be expressed through settings or application-owned transforms.

---

# No production behavior change

SPACING1A may add:

```text
diagnostic fixture builders
metric helpers
analysis CLI
tests for the analysis helpers
a concise design report
small reproducible visual diagnostic tooling
```

It must not change:

```text
computeLocalLayout production output
DEFAULT_LOCAL_LAYOUT_SETTINGS
LocalGraphCanvas camera behavior
LocalRendererSession Sigma settings
ForceAtlas2 production settings
layout cache/fingerprint
Focus fit
node-size rules
view-state/persistence
```

If reusable math is implemented during the spike, keep it in diagnostic tooling until SPACING1B approves the production contract.

---

# Privacy

Default analysis must be synthetic/reproducible.

Do not emit real vault:

```text
paths
titles
content
workspace IDs
queries
```

If optionally testing a user's real local Focus projection would materially improve evidence:

- keep it explicit/local-only;
- aggregate/anonymize output;
- never commit private data;
- the spike must remain complete without it.

No external context is required.

---

# Concurrency / repository discipline

Before implementation:

1. sync current `main`;
2. inspect open PRs;
3. preserve PR #51;
4. preserve any NETWORKPOLISH1 branch/worktree if it now exists;
5. use an isolated branch/worktree;
6. do not edit unrelated user changes;
7. preserve current `AGENTS.md` content;
8. do not touch/recreate user-owned ROADMAP state unnecessarily.

This diagnostic task should have very low overlap with UI work.

---

# Likely implementation areas

Inspect before editing. Likely:

```text
tools/vault-diagnostics/src/focus-spacing-analysis.ts       (new)
tools/vault-diagnostics/src/focus-spacing-fixtures.ts       (possible)
tools/vault-diagnostics/src/focus-spacing-metrics.ts        (possible)
tools/vault-diagnostics/package.json
root package.json                                            (optional script)

tools/vault-diagnostics tests

docs/SPACING1A_FOCUS_DENSITY_SPIKE.md
history-implementations/<this prompt>
```

Production `packages/renderer-sigma` should preferably remain unchanged.

If a tiny export is truly needed to reuse production-safe computation, keep it narrow and explain why.

---

# Required report structure

Create a tracked report such as:

```text
docs/SPACING1A_FOCUS_DENSITY_SPIKE.md
```

Include:

## 1. Current transform pipeline

Actual ForceAtlas2 → Sigma → camera behavior.

## 2. Why sparse graphs look sparse

Evidence, not assumptions.

## 3. Metric table

Across the fixture matrix.

## 4. Uniform-scale experiment

Does raw coordinate scaling survive Sigma/framing?

## 5. Candidate B rules

B0/B1/B2/B3/B4 results.

## 6. Screen-space comparison

Which rule stabilizes visual density.

## 7. Edge cases

```text
isolates
long chains
two clusters
hierarchy-heavy
reference-heavy
very small 2–3 node graphs
```

## 8. Recommendation

One concrete recommended formula/layer/bounds if possible.

## 9. B vs C verdict

Explicit.

## 10. SPACING1B handoff

State exactly what production implementation should do — but do not implement it.

---

# Validation

Use current repo equivalents.

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/vault-diagnostics typecheck
pnpm exec vitest run tools/vault-diagnostics

pnpm benchmark:local-renderer -- --profile smoke
pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile medium

# new command, exact name flexible
pnpm analyze:focus-spacing

pnpm check
git diff --check
```

Desktop build is not required if no production/runtime app code changed.

If the analysis uses an actual Sigma/browser transform experiment, run the smallest relevant browser test/build needed to validate it.

No CI timing thresholds.

---

# Exit gate

SPACING1A is complete only when:

1. current ForceAtlas2 settings are documented accurately;
2. actual Sigma 3.0.3 normalization/framing behavior is inspected, not guessed;
3. uniform coordinate scaling is experimentally tested;
4. Fit interaction with coordinate scaling is tested;
5. apparent node-size impact is explained;
6. sparse and dense fixtures are deterministic;
7. 2–5 node cases are covered;
8. 10/20/50 node cases are covered;
9. chain topology is covered;
10. star topology is covered;
11. mixed/isolate topology is covered;
12. two-cluster topology is covered;
13. hierarchy-heavy and reference-heavy cases are covered;
14. graph-space nearest-neighbor metrics are computed;
15. connected-edge metrics are computed;
16. robust radius/extent metrics are computed;
17. screen-space equivalents are measured;
18. node-size/spacing ratios are inspected;
19. the user's "less repulsion but farther apart" question is answered from evidence;
20. B0 baseline exists;
21. connected-edge normalization is evaluated;
22. nearest-neighbor normalization is evaluated;
23. sqrt(N)/constant-density extent normalization is evaluated;
24. a bounded hybrid is evaluated;
25. all B transforms preserve relative ForceAtlas2 geometry;
26. correction bounds are evaluated;
27. disconnected/outlier behavior is explicitly assessed;
28. a deterministic visual comparison artifact exists;
29. the user is told exactly how to open/view it;
30. no private vault data is committed;
31. no production ForceAtlas2 setting changes occur;
32. no production camera/fit changes occur;
33. no production spacing normalization is enabled;
34. VISUAL1B remains untouched;
35. NETWORKPOLISH1/concurrent work remains untouched;
36. full relevant tests pass;
37. `pnpm check` passes;
38. a tracked SPACING1A report is produced;
39. report contains an explicit B-vs-C verdict;
40. if B wins, report gives an implementable SPACING1B contract;
41. if C is needed, it is justified by relative-geometry evidence;
42. no ForceAtlas2 fork is created;
43. prompt is archived;
44. task stops before SPACING1B implementation.

---

# Final Codex response

Report concisely:

```text
SPACING1A result
- Why sparse graphs look overspread:
- Does coordinate scaling survive Sigma?
- Best density metric:
- Best B candidate:
- Recommended insertion layer:
- Recommended correction bounds:
- B vs C verdict:
- Visual comparison artifact:
- Tests:
- Production behavior changed: NO
- Next: SPACING1B implementation / user visual choice
```

If user visual judgment is still needed, ask only a simple question such as:

```text
Open <comparison artifact>.
For the highlighted sparse cases, do you prefer A or B?
```

Do not start SPACING1B automatically.
