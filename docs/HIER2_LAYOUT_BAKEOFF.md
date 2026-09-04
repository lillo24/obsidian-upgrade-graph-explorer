# HIER2 Dagre-first Focus Schematic layout bakeoff

Status: **complete. Strategy A was accepted after automated, browser, and user
graphical review.**

Accepted outcome: `ADOPT_TWO_STAGE_DAGRE` with `FILTERED_COMPACT_BRIDGE` and
`DEFER_EXPLICIT_ROUTING_TO_HIER5`. ADR 0018 records the final decision.

## 1. Question and accepted spatial semantics

The experiment asks how far pinned Dagre can implement a root-centric Focus
Schematic before a custom macro placer is justified. Authored incoming paths
flow left toward the focused File, authored outgoing paths flow right, reference
hop distance sets horizontal rank, and every File owns its visible File,
Heading, and Block hierarchy. Vertical order serves readable paths, precise
endpoints, collision clearance, and folder coherence in that order.

## 2. Exact baseline and version

The branch started from `836c465ea3143e769b7ee1937261b2a43cd80587`, after
HIER1 PR #58 and SPATIAL1B PR #59. The installed source and generated types for
`@dagrejs/dagre` **3.1.1** were inspected directly. Public compound
`Graph`, `setParent`, cluster `rankdir`, `constraints`, `customOrder`,
`useDynamic`, and `corePath` are present. No upgrade, fork, patch, private field,
or new external layout library is used.

Production remains the HIER0 path: flat React Flow mapping, current W3 Dagre,
collision-safe seed/adoption/fallback, controls, navigation, and diagnostics.

## 3. Common layout plan and filtered policy

One strict input carries the HIER1 model and projection, exactly one finite
positive dimension for each visible entity node, and explicit settings. The
tool-only renderer adapter asserts the current extended dimensions: File
200×80, Heading 184×72, Block 152×64.

One deterministic plan resolves every non-root module to side, signed rank,
parent module, and parent relationship. Non-mutual modules preserve HIER1.
Equal-mutual candidates compare validity, endpoint specificity, reference
count, same-folder status, signed-rank load, assigned folder continuity, side
balance, then stable EntityId. Validation requires one parent exactly one rank
nearer root and proves the parent chain acyclic. Secondary relationships never
affect coordinates.

The common box policy uses 28 px horizontal and 24 px vertical padding, a
bounded 34 px diagnostic shelf, and a 16 px clearance gate. The selected
filtered representation is a title-free 72×40 dashed bridge. The File-sized
200×80 context card also passes A, but costs more area without adding path
information. Both remain visible in the lab for the user decision.

## 4. D0 current baseline

D0 calls the current production `computeDagreLayout` wrapper in Focus mode with
the same mapped entity nodes and hierarchy/reference edges, then derives File
module rectangles. It preserves the present user-visible algorithm as the
future **Classic Focus Hierarchy** evidence baseline.

D0 succeeds as flat geometry on 41/42 fixed/generated cases but clears all
modular hard gates on only 8/42. It cannot represent F14's filtered semantic
module without deleting the reason the farther File is visible, so it reports
`unsupported`. D0 remains production during HIER2 and is not a modular
adoption candidate.

## 5. Strategy A: two-stage Dagre

Each File first receives a fresh LR Dagre graph containing only its visible
entity nodes and hierarchy edges. Actual card sizes and public adjacent-sibling
constraints produce the local rectangle. A second fresh LR Dagre graph contains
one variable-size node per module and only the shared parent backbone. The root
is normalized to center `(0,0)` and local node positions are translated into
world coordinates.

A passes every hard gate on F1–F18, all 24 seeded holdouts, eight 24-module
small cases, five 120-module medium cases, and the 500-module hub. Every cold
rerun is byte-identical.

## 6. Strategy B: compound Dagre

B uses `Graph({compound:true,multigraph:true})`, one public cluster per module,
public `setParent`, per-cluster LR settings, precise visible cross-cluster
endpoints, document fallbacks, and one deterministic internal filtered anchor.
Candidate nodes exclude the anchor. Module rectangles are re-derived from
public child geometry plus the same padding.

B returns complete deterministic candidates, but it fails the required 16 px
module clearance on 31/42 fixed/generated cases, including F11, F12, F16, and
all 24 seeded graphs. Public native cross-cluster route points are also
incomplete. Repairing these results would require post-layout cluster repair or
fixture-specific helpers, which violates the experiment boundary.

## 7. Conditional Strategy C

C was not built. A has zero hard failures, zero measured Heading/Block alignment
error, no signed-rank drift, and only 0.024 approximate crossings per case on
average. A bounded post-pass therefore has no material measured defect to fix.
Adding exact columns and packing would add a second coordinate policy without
meeting the required material-improvement threshold. The lab reports C as
`unsupported: not built` rather than showing a success-shaped placeholder.

## 8. Dagre configuration calibration

F1–F10 compared six global profiles: three public rankers across compact and
normal separation. All A variants passed 10/10. `network-simplex` was retained
because it is the production-proven ranker and tied the best compact area;
compact separation was smaller than normal without reducing clearance.

Frozen profile:

| Layer         | `nodesep` | `ranksep` | Direction | Ranker          |
| ------------- | --------: | --------: | --------- | --------------- |
| File internal |        24 |        48 | LR        | network-simplex |
| Module macro  |        36 |        80 | LR        | network-simplex |

The profile never changes per fixture. Holdouts were evaluated only after it
was frozen.

Canonical insertion alone was not sufficient: the installed default reversed
a four-Heading fan under one insertion order. Public adjacent-sibling
`constraints` restored source-line order for both insertion permutations.
`customOrder` and private rank/order mutation are unused.

## 9. Cold determinism

All primary comparisons construct fresh graphs and call Dagre with
`useDynamic:false`. D0, A, and B reproduced their status on 42/42 cases. Every
successful A and B candidate was byte-identical across cold reruns. Input and
plan arrays have stable ordering; the HIER1 F17 permutation oracle remains the
semantic source of truth.

## 10. Dynamic-layout experiment

The top viable A macro graph was retained across S1–S10 and rerun with the
installed public `useDynamic:true`. All ten candidates validated, stale nodes
were removed, and an unchanged second run was deterministic. Displacement was
identical to cold A on every pair; dynamic mode gave no stability benefit while
adding mutable graph/session lifecycle and reset complexity. `corePath` was
verified in installed types/source but not used because there was no dynamic
benefit to refine. The recommendation remains stateless.

## 11. Routing experiment

A exposes finite native macro Dagre points for 100% of selected backbone
relationships as separate evidence. B exposes them incompletely; D0's wrapper
does not return points. All primary candidates deliberately use `routes=[]`, so
the comparison uses the same approximate center-line metric and never treats
partial routes as complete.

Routing decision: `DEFER_EXPLICIT_ROUTING_TO_HIER5`. HIER3 can use ordinary
renderer edges attached to the exact visible endpoints; native backbone points
alone do not cover every explanatory and secondary relationship.

## 12. Fixture hard-gate table

`FAIL` values name the nonzero 16 px clearance count. Averages never erase a
failure.

| Fixture | D0              | A    | B               |
| ------- | --------------- | ---- | --------------- |
| F1      | PASS            | PASS | PASS            |
| F2      | FAIL overlap 2  | PASS | FAIL overlap 2  |
| F3      | FAIL overlap 2  | PASS | FAIL overlap 2  |
| F4      | FAIL overlap 2  | PASS | FAIL overlap 2  |
| F5      | FAIL overlap 4  | PASS | PASS            |
| F6      | PASS            | PASS | PASS            |
| F7      | PASS            | PASS | PASS            |
| F8      | PASS            | PASS | FAIL overlap 1  |
| F9      | FAIL overlap 1  | PASS | PASS            |
| F10     | FAIL overlap 1  | PASS | PASS            |
| F11     | FAIL overlap 1  | PASS | FAIL overlap 1  |
| F12     | FAIL overlap 1  | PASS | FAIL overlap 1  |
| F13     | PASS            | PASS | PASS            |
| F14     | unsupported     | PASS | PASS            |
| F15     | PASS            | PASS | PASS            |
| F16     | FAIL overlap 47 | PASS | FAIL overlap 47 |
| F17     | PASS            | PASS | PASS            |
| F18     | PASS            | PASS | PASS            |

## 13. Generated-corpus table

| Strategy | Seeded hard-gate passes |   Cold deterministic |                 Mean area | Mean approximate crossings |
| -------- | ----------------------: | -------------------: | ------------------------: | -------------------------: |
| D0       |                    0/24 |  24/24 status-stable | included in 2.53M overall |  included in 0.463 overall |
| A        |                   24/24 | 24/24 byte-identical | included in 2.47M overall |  included in 0.024 overall |
| B        |                    0/24 | 24/24 byte-identical | included in 1.74M overall |  included in 0.024 overall |

The generator uses fixed seeds 1–24, bounded rank-1 to rank-3 authored paths,
folders, structure, and actual dimensions. Worst B overlap seeds and exact
counts remain reproducible in the JSON benchmark output.

## 14. Visual-review findings

Automated browser inspection covered F4, F5, F7, F9, F11, F13, F14, the
48-module hub, and S1/S3 before/after. A reads as distinct File boxes in
left/center/right columns, retains precise Heading alignment, exposes the
diagnostic reserve honestly, and keeps F14's path continuous. The compact
bridge remains legible while the context card consumes visibly more width.
The fan is necessarily tall because all 47 leaves share one rank; no clipping
or overlap occurs.

User graphical review accepted Strategy A as clearly better than D0 and B,
with no observed overlap and sensible root/rank positioning. This approves the
layout architecture selected by the lab; production integration remains HIER3.

## 15. Performance table

These are development-machine observations, not CI thresholds. Medium and hub
attempts ran in disposable workers with hard timeouts.

| Profile | Cases/modules | D0 median/max ms | A median/max ms | B median/max ms |
| ------- | ------------- | ---------------: | --------------: | --------------: |
| small   | 8 × 24        |            12/32 |           11/24 |           20/26 |
| medium  | 5 × 120       |          114/140 |         105/147 |         154/189 |
| hub     | 1 × 500       |          244/244 |         208/208 |         269/269 |

For representative A inputs, serialized input/output sizes were 80,985/9,853
bytes at 24 modules, 409,019/49,613 bytes at 120 modules, and
997,475/88,502 bytes at 500 modules. Timings separately record input,
planning, internal, macro, post, validation, quality, serialization, and total.

## 16. Stability table

Values are root-relative median / p95 shared-module displacement in pixels.
Internal disclosure intentionally changes module width, so S1/S2/S7 move later
rank centers. Same-rank addition S3 leaves unaffected modules at median zero;
secondary-only S4 and diagnostic-independent cases remain fixed.

| Pair                     |           A |           B |
| ------------------------ | ----------: | ----------: |
| S1 root depth            |   432 / 864 |   436 / 872 |
| S2 neighbor disclosure   |   232 / 464 |   234 / 468 |
| S3 same-rank File        |      0 / 82 |      0 / 58 |
| S4 secondary only        |       0 / 0 |       0 / 0 |
| S5 filtered intermediary |       0 / 0 |       0 / 0 |
| S6 equal mutual          |       0 / 0 |       0 / 0 |
| S7 stable-ID source edit |   200 / 400 |   202 / 404 |
| S8 folder move           |       0 / 0 |       0 / 0 |
| S9 direction change      | 82 / 676.98 | 58 / 562.99 |
| S10 diagnostic only      |       0 / 0 |     17 / 17 |

## 17. Maintainability and worker table

| Property               | A                                  | B                                                      |
| ---------------------- | ---------------------------------- | ------------------------------------------------------ |
| State                  | stateless                          | stateless                                              |
| Dagre graphs           | one small graph/module + one macro | one recursive compound graph                           |
| Synthetic layout nodes | filtered bridge only               | cluster per module + filtered anchors                  |
| Public API reliance    | Graph/layout/constraints           | compound/setParent/cluster options                     |
| Failure recovery       | whole attempt fails                | whole attempt fails; many valid-but-ineligible results |
| Worker serialization   | plain input/candidate              | same, with more internal transient work                |
| Special repair pass    | none                               | would be required to clear overlaps                    |

## 18. Decision

Accepted outcome: `ADOPT_TWO_STAGE_DAGRE`.

It is the only new strategy that passes every fixed, generated, scale, and
determinism gate. It is simpler than B, remains stateless, uses only public
Dagre APIs, and leaves no measured defect that justifies C. User graphical
review confirmed the macro layout decision.

## 19. Rejected alternatives

- D0 is preserved as Classic but rejected as the modular default because its
  derived File bounds overlap and it cannot represent filtered intermediaries.
- B is rejected because public compound output does not reserve the shared
  padded module rectangles reliably and native route coverage is incomplete.
- C is rejected as unjustified work: the material-improvement prerequisite did
  not occur.
- Dynamic A is rejected because it matched cold stability while adding state.
- File-sized filtered context remains a reviewable alternative but is not the
  selected choice because it adds area without more truthful information.

## 20. HIER3 handoff

After final acceptance, HIER3 should send
`model + projection + dimensions + settings` to a dedicated latest-result-wins
layout worker and accept only a strict validated candidate. Use stateless
requests, a cache key over the serialized input/settings/version, cancellation
by stale-result rejection, and current HIER0 fallback on failure. Do not change
the existing W3 worker in HIER2.

HIER3 must preserve two independently testable strategies:

- **modular**: selected two-stage HIER2 layout, normal Focus-Hierarchy choice;
- **classic**: the unchanged current flat React Flow + Dagre/HIER0 path, hidden
  by default only after modular integration and revealed through
  **Settings → Graph → Experimental → Show Classic Focus Hierarchy**.

This is distinct from **Show All Hierarchy**. HIER3 must not overwrite the old
algorithm in place.

HIER3 must preserve the precise cross-file source and target semantics already
carried by HIER1. Each reference should visually connect its actual visible
File, Heading, or Block endpoints. Within each File module, relevant endpoint
entities should face the neighbouring macro rank when that improves legibility.
A multi-hop module may therefore need distinct incoming-facing and
outgoing-facing structural lanes instead of a fixed `File → Heading` internal
orientation. HIER3 must cover direct, Heading-specific, Block-specific,
two-sided, and multi-hop cases with endpoint and orientation tests.

This internal semantic refinement composes with Strategy A's selected macro
architecture and does not reopen the A/B decision. Exact polyline routing and
complete route ownership remain deferred to HIER5.
