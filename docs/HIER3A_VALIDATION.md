# HIER3A validation

Status: **accepted — `ADOPT_ENDPOINT_FACING_SPLIT_LANES`.** The first
graphical review selected A1 internal orientation and requested the bounded
endpoint-aware ordering refinement. The final graphical review approved A1
with that pass after EP12, EP25, and EP26 reached crossing-free order while the
multi-hop, fan, determinism, collision, and secondary-edge invariants remained
intact. A1 is now the selected non-production Focus Schematic layout; the
production application remains unchanged.

## Scope and isolation

HIER3A initially started from
`e51f52ed11ae8b3a5ff233e4e50a3c1eb268f60c`; the final-review candidate was
rebased onto `b10ceaa`, and the accepted candidate is rebased onto `b4ea17e`.
HIER2 Strategy A remains the macro architecture. The experiment changes only
the per-File internal stage and adds renderer-neutral endpoint, lane,
attachment, and quality data in
`@icarus-graph-explorer/focus-schematic-layout`.

The production-boundary test still proves that apps, React Flow mapping, W3,
view-state, the desktop application, and other production packages do not
import this package. Current Classic Focus Hierarchy and All + Hierarchy
experimental gating are unchanged. Draft PRs #60 and #67 are untouched.

`computeFocusSchematicLayout` now selects A1 and returns only its candidate.
`computeFocusSchematicLayoutAttempt` preserves its established result shape
while returning A1 geometry. The explicit
`computeFocusSchematicComputedLayout` API exposes A0, A1, endpoint/lane plans,
and per-phase timing for HIER3B. Explicit uniform-layout aliases preserve A0
for development comparison and historical HIER2 bakeoff evidence.

## Endpoint and lane contracts

Every HIER1 visible endpoint group becomes one precise connection. Authored
source/target identity, projected edge, canonical entity, entity kind, sorted
ReferenceIds, owning modules, and relationship role are retained. Any
relationship ReferenceIds not represented by precise groups are accounted for
once through a deterministic visible-document, visible structural-root, or
module-anchor fallback. The EP18 filtered bridge uses a module anchor without
inventing a canonical entity.

Physical side derives from finalized signed module ranks:

```text
target rank > source rank  → source right, target left
target rank < source rank  → source left, target right
equal rank                 → auto display attachment, no lane demand
```

Selected-backbone role has priority over other Focus path and secondary role.
Secondary connections remain visible provenance, create no demand, and do not
change coordinates.

The lane planner validates one acyclic hierarchy forest per module, one parent
per non-root entity, exact entity coverage, and no cross-module hierarchy. It
propagates direct demands through descendants. Documents stay center;
left-only and right-only subtrees use their matching lane; mixed ancestors and
dual endpoints stay center; neutral children inherit a side only from a side
parent. No real entity is duplicated, and no side node transitions directly
to the opposite side.

## A1 geometry and attachments

A1 uses fresh public Dagre 3.1.1 calls only. Each module composes a center TB
region, maximal left RL subtrees, and maximal right LR subtrees. Side subtrees
anchor near their center parent, pack in deterministic source order with the
existing separation, and reserve a clear File-card endpoint stub when the File
itself participates. Module bounds are recomputed with the unchanged 28/24 px
padding and 34 px diagnostic reserve. The unchanged HIER2 macro Dagre graph
then places the variable-size modules and normalizes the focused File to the
origin.

The refinement requested after the first graphical review runs after exact
internal endpoint positions exist. Four fixed deterministic sweeps visit
signed ranks outward and inward. For each rank, precise selected-backbone and
Focus-path connections to the adjacent rank produce median desired module
centers; variable-height rectangles are then collision-packed with the frozen
macro separation. Disjoint sibling branches in a left/right internal lane use
the analogous counterpart-endpoint preference when a proposed swap improves
the exact crossing/order score. Markdown source order is a soft deterministic
tie-break. Secondary connections are excluded from preferences and scores, so
secondary-only geometry remains byte-identical. This pass changes rectangle
positioning only and creates no obstacle routes or waypoints.

Exact endpoint attachments use the midpoint of the demanded node boundary.
Same-rank secondary `auto` attachments choose the deterministic boundary that
faces the counterpart for lab display. Secondary auto stubs can report
display-only obstruction but are excluded from lane and own-module traversal
adoption gates because they do not drive geometry and complete routing remains
HIER5. Selected-backbone stubs are unobstructed throughout the fixed and
generated corpora.

The computed result is plain JSON data and contains no DOM handle, callback,
class, Map/Set, CSS selector, source text, absolute path, React Flow object, or
route waypoint policy. Strict validators reconcile the module plan, endpoint
plan, lane plan, candidate, attachment identity/boundaries, and quality result
before a success result is returned.

## Corpus and determinism

Automated coverage includes:

- EP1–EP26: File/Heading/Block combinations, both branches, root two-sided,
  left/right multihop, one dual Heading, mixed ancestors, neutral hierarchy,
  rolled-up targets, aggregation, multiple endpoint groups, same-rank
  secondary, equal mutual, filtered anchors, diagnostics, duplicate basenames,
  large mixed modules, expansion, live semantic revision, an obvious module
  order swap, and an obvious sibling-branch swap;
- ES1–ES8: endpoint gain/loss, neutral expansion, multihop growth,
  one-sided-to-dual, secondary-only, disclosure refinement, and stable-ID edit;
- HIER2 F1–F18 plus 24 generated holdouts;
- a committed Markdown workspace covering `[[Target]]`,
  `[[Target#Heading]]`, aliased Heading targets, and Block targets through the
  real parser/adapter/resolver/projection/model/layout pipeline.

All 26 endpoint fixtures and all 42 inherited fixed/generated HIER2 cases pass
candidate validation, endpoint/lane validation, exact coverage, finite
geometry, root normalization, signed-rank ordering, 16 px node/module
clearance, containment, lane transitions, side-demand, and selected-stub
gates. Cold repeats are byte-identical. Independently reversed model modules,
relationships, endpoint groups, ReferenceIds, projection nodes, and projection
edges produce byte-identical validated results. Unordered public dimensions
are rejected as required.

ES6 secondary-only geometry is byte-identical. ES8 stable-ID edit is also
byte-identical. Other affected modules can resize or move; the benchmark
reports that movement while unaffected/root-relative median module movement is
zero for ES1–ES8.

## Performance evidence

No timing threshold was added. Representative local cold measurements:

| Profile                   | Modules | Visible nodes |     A0 |     A1 | A1 order pass | A1 Dagre calls | A1 result bytes |
| ------------------------- | ------: | ------------: | -----: | -----: | ------------: | -------------: | --------------: |
| 120-module File hub       |     120 |           120 |  53 ms |  66 ms |          3 ms |            121 |         323,657 |
| 120-Heading mixed module  |       3 |           136 |  24 ms |  35 ms |          1 ms |             26 |         104,885 |
| 120 small Heading modules |     120 |           240 |  71 ms |  75 ms |          2 ms |            241 |         408,013 |
| 500-module stress hub     |     500 |           500 | 233 ms | 361 ms |         21 ms |            501 |       1,353,380 |

The three ordinary medium profiles remain below the approximate 250 ms Class B
layout target and pass all gates. The isolated 500-module stress hub completes
without timeout and passes all gates; its 361 ms result is evidence for HIER3B
worker transport rather than an ordinary interaction target. A1 uses one
center graph per visible module plus side-subtree graphs and the single macro
graph, so the 500-File case has the expected 501 calls rather than an
additional per-edge explosion. Its input is 1,025,024 bytes; endpoint/lane
metadata is 1,191,333 bytes.

On the seven-scenario review smoke, A0 has endpoint-side violations or blocked
endpoint stubs in EP4, EP7, EP9, EP10, EP12, and EP22. A1 removes those defects
and passes every hard gate. EP18 correctly reports zero precise coverage for
the filtered relationship provenance because both relationships require
fallback representation in the filtered projection.

EP12 reports 3 exact endpoint crossings and 3 adjacent-rank inversions in A0;
the refined A1 reports 0/0. EP25 and EP26 each encode one deliberately inverted
pair at the module and sibling-branch levels respectively; each moves from 1/1
to 0/0. EP7/EP8 multi-hop, EP9 dual-endpoint, and EP22 large-fan evidence remain
at 0/0. The lab and benchmark expose both metrics directly.

## Review lab

Generate the self-contained lab with:

```bash
pnpm generate:focus-schematic-endpoint-lab -- --out output/hier3a-endpoint-lab
```

The default view is A0/A1 side-by-side with precise endpoint arrows and
secondary edges hidden. The main controls are Scenario, Revision, View, and
Edges. Advanced details contain module/lane guides, secondary links,
approximate module-center comparison, native macro route evidence, and quality
numbers. Every EP/ES scenario explains the authored relationship, expected
side behavior, and what to inspect. SVG endpoints/edges are focusable and the
adjacent details list is keyboard accessible.

The generated-output test verifies EP1–EP26, ES3/ES4/ES5 revisions, defaults,
plain-language explanations, keyboard hooks, Advanced placement, and absence
of HIER2 B/C/configuration controls. Desktop browser automation could not open
the local `file://` artifact because its browser security policy blocked that
scheme and prohibited retrying through another browser route. The user viewed
the generated artifact directly and gave final graphical approval after both
review rounds; no automated browser-render claim is made.

## Validation

```bash
pnpm install --frozen-lockfile                         # baseline
pnpm --filter @icarus-graph-explorer/focus-schematic typecheck
pnpm exec vitest run packages/focus-schematic
pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout
pnpm --filter @icarus-graph-explorer/focus-schematic-bakeoff typecheck
pnpm exec vitest run tools/focus-schematic-bakeoff
pnpm benchmark:focus-schematic-layout -- --profile fixtures
pnpm benchmark:focus-schematic-endpoints -- --profile fixtures
pnpm benchmark:focus-schematic-endpoints -- --profile small
pnpm benchmark:focus-schematic-endpoints -- --profile medium
pnpm benchmark:focus-schematic-endpoints -- --profile hub
pnpm benchmark:focus-schematic-endpoints -- --profile stability
pnpm generate:focus-schematic-endpoint-lab -- --out output/hier3a-endpoint-lab
```

After graphical approval, the selected API, final decision record, ADR 0019,
architecture, roadmap, and validation record were updated together. The
production boundary and Classic Focus Hierarchy remain unchanged; HIER3B was
not started.

The accepted selection diff, rebased onto `b4ea17e`, passed `pnpm check`:
formatting, lint, every package typecheck, 177 test files with 1,461 tests, and
the 596-module web build. The existing Vite chunk-size advisory was the only
build warning. It also passed `pnpm desktop:check`, `pnpm desktop:build`, the
historical HIER2 fixture corpus through the explicit A0 alias, endpoint
fixtures, small/medium/hub/stability endpoint profiles, the regenerated lab,
the small local-renderer benchmark, the small application performance
benchmark, and `pnpm install --frozen-lockfile`. The archived prompt SHA-256 is
`DF9AA3F3A9D77E002183676E37089F194611DAD130FCBAC37000C3DEF76EE711`.

The earlier localhost production-app smoke loaded the workspace title, graph
controls, saved graph summary, and accessible control labels successfully.
This production smoke is separate from the user-completed local-file lab
reviews.
