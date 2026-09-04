# HIER3A precise endpoints and endpoint-facing lanes

Decision: `ADOPT_ENDPOINT_FACING_SPLIT_LANES`.

Status: **Complete and accepted after two graphical reviews.** HIER3A selects
A1 only in the non-production Focus Schematic layout package. Production
integration remains HIER3B work.

## Baseline and scope

HIER3A builds on the HIER2 Strategy A macro architecture. A0 lays every visible
File hierarchy out as one uniform LR graph and remains available through
`computeFocusSchematicUniformLayout` and
`computeFocusSchematicUniformLayoutAttempt`. HIER3A does not alter HIER2 module
rank selection, equal-mutual resolution, filtered bridges, spacing, root
normalization, or the decision to defer complete routing to HIER5.

The current HIER0/D0 production implementation remains the independently
testable **Classic Focus Hierarchy**. No app, renderer, worker, view-state,
settings, persistence, or desktop source imports the HIER3A package.

## Selected endpoint contract

Every HIER1 visible endpoint group produces one precise layout connection with
the authored source and target, projected edge, canonical File/Heading/Block
identity, owning modules, sorted ReferenceIds, and presentation role. Any
unrepresented relationship provenance produces one deterministic visible
document, structural-root, or filtered-module fallback rather than a fake
precise entity.

Physical side derives only from signed module ranks:

```text
target rank > source rank  → source right, target left
target rank < source rank  → source left, target right
equal rank                 → auto display attachment, no lane demand
```

Authored direction never changes to fit the drawing. Selected-backbone role
has priority over other Focus-path and secondary roles. Secondary connections
retain provenance and display attachments but have zero influence on lane,
module, branch, or node coordinates.

## Selected internal layout

A1 composes each visible File module from fresh public Dagre 3.1.1 regions:

- a center TB region for the File core, mixed ancestors, dual endpoints, and
  neutral center structure;
- maximal left RL subtrees for left-only demand;
- maximal right LR subtrees for right-only demand.

Subtree demand propagates through the validated hierarchy forest. A mixed
ancestor stays one center node. A dual-purpose File, Heading, or Block stays
one center node with two attachments. Neutral descendants inherit a side only
from a parent already assigned to that side. A real entity is never duplicated.

Exact connections attach to the midpoint of the relevant File/Heading/Block
boundary. Fallback module anchors remain explicit. Candidate routes stay empty;
these points are endpoint geometry rather than an obstacle-routing policy.

## Endpoint-aware ordering refinement

The first graphical review accepted A1 orientation as clearly better than A0
but found avoidable vertical inversions, especially EP12. The accepted
refinement runs after exact internal endpoint positions exist:

1. four fixed deterministic outward/inward sweeps visit every signed macro
   rank;
2. precise selected-backbone and Focus-path endpoints in the adjacent rank
   produce median desired module centers;
3. variable-height module rectangles are collision-packed with the frozen
   macro separation;
4. disjoint left/right sibling structural branches apply the analogous exact
   counterpart preference when a swap improves the crossing/order score;
5. Markdown source order is a deterministic soft tie-break;
6. secondary connections never enter preferences or scores.

The pass only reorders and translates existing rectangles. It creates no bend,
channel, waypoint, or obstacle-routing data.

## Evidence and graphical review

EP1–EP26 and ES1–ES8 cover File/Heading/Block combinations, both macro sides,
two-sided roots, left/right multihop, dual endpoints, mixed and neutral
hierarchies, roll-up, aggregation, filtered fallbacks, diagnostics, expansion,
live revisions, and deliberate module/sibling inversions. A committed Markdown
workspace verifies File, Heading, aliased Heading, and Block targets through the
real parser-to-layout pipeline. HIER2 F1–F18 and 24 generated holdouts remain
green.

The ordering refinement changes exact crossing/inversion counts as follows:

| Case | A0 crossing/inversion | A1 crossing/inversion |
| ---- | --------------------: | --------------------: |
| EP12 |                   3/3 |                   0/0 |
| EP25 |                   1/1 |                   0/0 |
| EP26 |                   1/1 |                   0/0 |

EP7/EP8 multihop, EP9 dual-endpoint, and EP22 large-fan evidence remain 0/0.
All fixtures retain zero module overlap, node overlap, containment failure,
invalid lane transition, selected-stub obstruction, and signed-rank violation.
Cold reruns and independently permuted semantic/projection inputs are
byte-identical. ES6 proves secondary-only geometry is byte-identical.

The first user review judged A1 clearly better than A0 across the graphical
cases and explicitly closed the internal-orientation decision. The second user
review approved the endpoint-aware pass after confirming that EP12, EP25, and
EP26 were resolved while multihop, fan, determinism, collision, and secondary
invariants remained intact.

## Performance and validation

The four-sweep ordering stage measured 1–3 ms on representative 120-module or
136-node profiles and 21 ms on the isolated 500-module stress hub. The complete
A1 attempts measured 35–75 ms on the ordinary medium profiles and 361 ms on the
500-module stress hub. These are local observations, not CI thresholds.

The accepted rebased candidate passed formatting, lint, every package
typecheck, 166 test files with 1,405 tests, the 588-module web build, desktop
check/build, endpoint fixture/scale/stability benchmarks, local-renderer and
application performance smoke benchmarks, and prompt archive hash verification.
`docs/HIER3A_VALIDATION.md` contains the detailed record.

## Selected API and consequences

`computeFocusSchematicLayout(input)` now returns the A1 candidate.
`computeFocusSchematicLayoutAttempt(input)` retains the established attempt
shape with A1 geometry. `computeFocusSchematicComputedLayout` and its attempt
variant expose the strictly validated endpoint/lane/attachment payload intended
for HIER3B. A0 remains an explicit development comparison and the HIER2 bakeoff
uses that alias directly.

HIER3B is next: production modular worker and renderer preview with
latest-result-wins adoption, cache/failure policy, and unchanged Classic
fallback. HIER3C owns product adoption and Classic exposure. HIER4 owns folder
bands. HIER5 owns complete explicit routing. None begins in HIER3A.
