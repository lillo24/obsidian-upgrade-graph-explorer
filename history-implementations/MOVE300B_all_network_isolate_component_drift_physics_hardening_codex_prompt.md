# MOVE300B — Stop disconnected-component drift during All Network Move

**Task type:** PHYSICS1 / MOVE1B correctness hardening inside existing MOVE300A draft PR

## Goal

Continue the existing draft:

```text
PR #103 — MOVE300A: raise All Network Move limit to 300
branch: codex/move300a-all-network-limit
head at plan-writing time: 8a027b7e54c8b29e32c63d566ea48935eb506c7b
```

Do **not** merge PR #103 yet.

Native QA on the user's real All Network showed that the 300-node scale itself feels smooth, but exposed a physics defect:

```text
while a File is being moved
→ disconnected / isolated Files keep drifting radially outward
→ the outer ring of individual Files keeps expanding
→ the longer the user drags, the larger the radius becomes
```

The user also observed:

```text
changing Folder clustering Strength
→ graph returns to the normal compact automatic layout
→ temporary Move deformation disappears
```

and:

```text
All Network Density barely compensates once the graph has physically expanded
```

The goal is:

> Keep All Move available through 300 nodes, while preventing unrelated disconnected components from continuously flying outward during temporary live physics.

Do not lower the All 300-node boundary because of this defect.

---

# Interpret the native evidence correctly

## A. Disconnected-component expansion — fix this

PHYSICS1 stays `hot-constrained` while a hard constraint is active:

```text
4 × public ForceAtlas2 iteration
→ publish/update
→ repeat continuously while held
```

Disconnected Files have no reference attraction but still participate in global repulsion/gravity. At larger scale they are weakly constrained and can migrate outward for as long as the simulation remains hot.

## B. Folder clustering Strength reset — expected

Do **not** preserve temporary Move positions across a real layout-setting change.

Folder clustering Strength is a real physics/layout setting:

```text
change strength
→ invalidate transient physics
→ recompute normal Global layout
→ M2 output-only folder shaping returns
```

Move is transient, not Pin.

## C. All Network Density — out of scope

Density is camera/framing only.

Do not enlarge its range or make it influence physics to compensate for the expanding graph.

---

# Existing architecture to preserve

## Move is transient

No temporary Move position enters:

```text
Global automatic layout cache
SPATIAL2 Pull cache
Place persistence
Saved Views
source Markdown
view history
```

## Position pipeline

```text
settled base automatic Global
→ optional SPATIAL2 dynamic Pull
→ temporary PHYSICS1 simulation
→ fixed Place translation
→ Sigma display
```

## M2 remains output-only

Global automatic folder shaping is:

```text
pure FA2 working graph
→ one output-only M2 transform
→ accepted base positions
```

Do not feed M2-transformed coordinates back into live ForceAtlas2. CONVERGENCE1C deliberately removed accumulating folder feedback.

## Authored Pull remains dynamic

Explicit SPATIAL2 Pull relationships stay active during All Move. A node that is otherwise reference-disconnected may still be meaningfully coupled through an active resolved Pull attractor.

---

# Core product invariant

During temporary File movement:

```text
meaningfully coupled nodes
→ may physically react

unrelated disconnected components
→ must not continuously migrate merely because the worker keeps running
```

Holding/moving one File must not inflate a distant ring of unrelated Files indefinitely.

---

# Phase 1 — Reproduce the defect synthetically

Before changing production behavior, add a private-safe deterministic All fixture around 300 nodes:

```text
connected core:
  40–100 Files with references

isolates:
  many degree-0 Files around the core

also:
  a few disconnected 2–5 node components
```

Cover:

```text
folder clustering off
folder clustering on
one Pull rule
cross-component Pull where useful
```

Test:

```text
begin drag
→ move File to fixed target
→ stop changing target
→ keep hot simulation running for many turns
```

Measure over time:

```text
degree-0 p50/p90/max radius from graph centroid
centroid drift of disconnected reference components
connected-core radius
dragged-component motion
```

Required baseline evidence:

```text
current PR #103 behavior
→ isolate/component radius grows materially during a long held interaction
```

If the synthetic fixture cannot reproduce an analogous effect, add aggregate native diagnostics rather than guessing.

Never commit private vault names/topology.

---

# Phase 2 — Define dynamic coupling

Create a deterministic interaction-time coupling model.

At minimum:

## Reference coupling

The dragged File's undirected reference-connected component is active.

## Pull coupling

Resolved effective SPATIAL2 Pull memberships can extend the active dynamic set beyond the reference component.

Do not resolve QUERY1/path/folder rules inside the physics worker. Use the source-neutral resolved attractors already present in the PHYSICS1 seed.

## Automatic M2 folder membership

Do not automatically convert same-folder membership into a live graph edge.

M2 is an automatic output spatial prior, not an authored dynamic Pull relationship.

---

# Phase 3 — Compare bounded candidate fixes

Do not implement the first idea without evidence.

## Candidate A — stabilize/freeze unrelated components

While one File is constrained:

```text
active set:
  dragged reference component
  + explicitly Pull-coupled components/nodes

outside active set:
  retain their current transient coordinates
```

A practical implementation may reassert inactive coordinates around each public FA2 iteration, just as the dragged node's target is reasserted.

Evaluate both variants:

```text
A1:
inactive nodes stay in the graph and influence active nodes via repulsion,
but their positions are reasserted

A2:
if technically cleaner, exclude their physical movement without changing
visible graph membership
```

Do not silently switch to neighborhood-only rendering.

On a later drag in another component, that component becomes active from its current transient position.

## Candidate B — component-centroid stabilization

Allow unrelated components some internal breathing, but bound each unrelated component centroid around its pre-interaction transient centroid.

The restoring effect must be duration-independent.

Reject this if it requires arbitrary tuning or visibly fights normal layout physics.

## Candidate C — held-stable lifecycle

When:

```text
constraint target has stopped changing
AND
constrained-state movement reaches practical stability
```

allow:

```text
hot-constrained
→ held-stable
→ zero simulation stepping while button remains held

new target update
→ reheat to hot-constrained
```

Do not use a timer-only "after N ms stop" rule.

Candidate C may be combined with A/B, but it must not be used to hide severe expansion that occurs before stability.

---

# Phase 4 — Audit the M2 handoff

Current normal Global layout is:

```text
raw FA2
→ output-only M2 folder field
```

Live PHYSICS1 starts from those shaped coordinates but evolves with:

```text
FA2 + explicit Pull
```

without automatic M2.

Quantify whether this materially contributes to the reported drift.

For a folder-clustered fixture:

```text
settled normal layout
→ begin near-zero-displacement Move
→ hold
→ release
```

Compare:

```text
mean within-folder distance
folder-centroid separation
degree-0 radius
reference-edge lengths
```

If component stabilization keeps the live graph visually consistent enough, **do not add M2 to PHYSICS1**.

Only evaluate live-display M2 composition if the active connected region itself loses unacceptable structure.

Never feed M2 output back into FA2.

If preserving M2 would require a new inverse-coordinate architecture for dragging, stop for user review instead of forcing it into this task.

---

# Preferred decision order

Prefer the smallest successful solution:

```text
1. Candidate A if interaction remains natural
2. A + held-stable if useful
3. Candidate B only if A is visibly too rigid
4. live M2 composition only if evidence proves necessary
```

Evidence may justify another choice.

Document exactly which nodes are considered physically coupled during one interaction.

---

# Required stationary-hold oracle

This is mandatory.

After the dragged File reaches a fixed target:

```text
hold pointer completely still
```

for a long deterministic number of worker turns.

Pass condition:

```text
unrelated isolate radius remains bounded
unrelated component-centroid drift remains bounded
```

This pattern must fail:

```text
radius keeps increasing monotonically with interaction duration
```

Exact zero movement is not required unless the chosen candidate deliberately freezes the component.

---

# Preserve meaningful reactions

Required fixtures:

```text
A—B
drag A
→ B reacts

A—B—C—D
drag A
→ connected component may rebalance

X disconnected from A and no Pull relationship
→ X does not continuously fly outward

X reference-disconnected but Pull-coupled to active group
→ preserve intended Pull reaction
```

Do not fix the problem by freezing the entire graph.

---

# Release / cooling

Release remains:

```text
clear hard constraint
→ affected dynamic region returns to automatic physics
→ bounded cooling
→ sleeping
```

Do not persist positions.

Explicitly decide what happens to unrelated stabilized components during cooling.

Preferred behavior:

```text
unrelated components remain stable at their current transient coordinates
while affected region settles
```

If whole-graph cooling is retained, prove that it does not recreate radial expansion after pointer-up.

---

# Worker / protocol

Avoid a protocol bump unless the selected solution genuinely needs new serialized data.

Prefer deriving reference components in the worker from the existing edge list.

Possible worker-owned indexes:

```text
reference component ID per node
effective dynamic coupling closure
```

Do not send paths, queries, canonical source data, or raw UI state into the worker.

If `held-stable` becomes a new lifecycle state, version and validate it explicitly. Do not misuse `sleeping` while a hard constraint is still active.

---

# Keep the 300-node experiment

PR #103 remains:

```text
All <= 300
Focus <= 100
```

After correction rerun:

```text
300-node All
300-node All + Pull
300-node isolate-heavy All
```

All 301 remains `graph-too-large`.

Do not merge PR #103 until corrected native QA passes.

---

# Density and layout-setting regressions

Preserve:

```text
All Network Density
→ camera only
→ zero physics-force changes
```

Preserve:

```text
Folder clustering Strength change
→ legitimate automatic re-layout
→ transient Move state may reset
→ normal M2-shaped automatic layout returns
```

No temporary Move coordinate may enter the automatic Global layout cache.

---

# Performance evidence

The user's ~255-file vault felt responsive, so do not over-optimize prematurely.

For corrected ~300-node simulation report:

```text
hot turn p50/p95
frames published/adopted
stationary-hold work
release-to-sleep
```

No CI timing threshold.

Do not introduce a new dependency.

---

# Automated tests

At minimum cover:

## Components

```text
reference components deterministic
parallel/reciprocal edges don't break classification
isolates are singleton components
Pull coupling expands active dynamic set correctly
```

## Drag

```text
target remains exact
connected neighbor reacts
unrelated isolate remains bounded
multiple unrelated components remain bounded
```

## Stationary hold

```text
long stationary constraint
→ no unbounded isolate-ring expansion
```

## Release

```text
constraint clears
affected region settles
unrelated region stays bounded
sleep or existing explicit fail-loud outcome
```

## M2 / Pull / Place

```text
no duration-accumulating M2 feedback
Pull-coupled nodes still react
Place inversion remains exact
Place applied once for display
```

## Capability

```text
All 300 supported
All 301 rejected
Focus 100 supported
Focus 101 rejected
```

---

# Native QA gate

Build a fresh optimized executable from the corrected PR #103 branch.

Keep the PR draft.

Ask the user to repeat:

```text
1. Open real vault → All + Network.
2. Confirm visible simulation node count <=300.
3. Drag a connected File for 10+ seconds.
4. Keep moving it continuously and watch the outer isolated Files.
5. Then hold pointer stationary for ~10 seconds without release.
6. Outer isolate/component radius must not keep inflating.
7. Release and confirm bounded settling.
8. Drag an isolated File itself:
   - active isolate should move;
   - unrelated isolates/components should remain stable.
9. Repeat with folder clustering enabled.
10. Repeat with authored Pull if available.
11. Change Folder clustering Strength afterward:
    - normal layout reset is expected.
12. Density may alter camera framing only; no physics effect is expected.
```

Do not merge until the user explicitly approves.

---

# Likely implementation areas

Inspect current branch first. Likely:

```text
packages/renderer-sigma/src/physics/simulation.ts
packages/renderer-sigma/src/physics/seed.ts
packages/renderer-sigma/src/physics/pull.ts
packages/renderer-sigma/src/physics/*.test.ts

apps/web/src/workers/network-physics-worker-client.ts
  only if held-stable/frame semantics require it

tools/vault-diagnostics/src/physics1-candidate-analysis.ts

docs/PHYSICS1_CONTINUOUS_SIMULATION.md
docs/PERFORMANCE.md
docs/ARCHITECTURE.md
docs/decisions/0023-continuous-network-public-forceatlas2-lifecycle.md
docs/decisions/0024-production-network-editing-and-temporary-file-move.md

history-implementations/
```

Avoid unrelated SAVEDUX/HIER files.

---

# Validation

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/renderer-sigma
pnpm exec vitest run apps/web

pnpm analyze:physics1
pnpm benchmark:file-move
pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Add a dedicated component-drift analysis command only if it makes the before/after result materially more reproducible.

---

# Exit gate

Ready for user QA only when:

1. current radial-expansion defect has a deterministic synthetic analogue;
2. chosen fix is evidence-backed;
3. unrelated components no longer show unbounded radial expansion under long held Move;
4. connected neighbors still react;
5. Pull-coupled nodes still react;
6. target remains exact;
7. Place remains exact;
8. Move remains transient/nonpersistent;
9. cooling remains bounded/fail-loud;
10. no M2 output is fed back into FA2;
11. real layout-setting changes still reset transient Move correctly;
12. Density remains camera-only;
13. All <=300 remains supported;
14. All 301 remains rejected;
15. Focus <=100 remains unchanged;
16. 300-node All / Pull / isolate-heavy probes pass;
17. full tests/checks/builds pass;
18. PR #103 remains draft pending native acceptance;
19. PR #100 and unrelated worktrees remain untouched.

---

# Final report

Report:

## Root cause

Separate evidence for:

```text
raw FA2 disconnected-component behavior
M2 handoff contribution
hot lifecycle contribution
```

## Selected solution

State exactly:

```text
which nodes remain dynamic
which nodes are stabilized
how Pull affects coupling
whether held-stable was adopted
```

## Before / after evidence

```text
isolate radius growth
component centroid drift
connected-neighbor reaction
300-node timing
release-to-sleep
```

## Boundaries

Confirm:

```text
M2 remains output-only
Density remains camera-only
Folder clustering Strength reset remains expected
```

## Native handoff

Provide fresh executable path/hash and the checklist.

## Merge state

Keep PR #103 draft until explicit user approval.

Do not start another feature automatically.
