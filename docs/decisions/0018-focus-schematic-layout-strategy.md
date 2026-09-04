# ADR 0018: Adopt stateless two-stage Dagre for Focus Schematic layout

## Status

Accepted.

## Context

HIER1 established one renderer-independent File-module model and layout-quality
contract. HIER2 compared the unchanged current flat Focus layout (D0), a
two-stage Dagre strategy (A), and public compound Dagre (B) against the same
fixtures, dimensions, semantic plan, hard gates, scale profiles, and visual lab.
Strategy C was conditional on a material defect in A and was not justified.

## Decision

Adopt Strategy A as the HIER2 layout architecture. With pinned
`@dagrejs/dagre` 3.1.1, each File module uses a fresh LR internal graph and the
resulting module rectangles use a second fresh LR macro graph. Both stages use
public Dagre APIs and `network-simplex`. The implementation is stateless:
primary runs use `useDynamic:false`, and the retained-graph experiment showed no
stability benefit from dynamic mode.

The common deterministic layout plan resolves equal-mutual relationships before
layout using semantic candidate strength, rank load, folder continuity, side
balance, and stable identity. Filtered path intermediaries use the compact
72×40 anonymous bridge. Complete explicit routing is deferred to HIER5; partial
native Dagre backbone points remain evidence and are not presented as complete
routes.

HIER3 will integrate the modular strategy through a separate latest-result-wins
boundary. It must retain the current HIER0/D0 path as independently testable
**Classic Focus Hierarchy**, hidden by default only after modular integration
and available at **Settings → Graph → Experimental → Show Classic Focus
Hierarchy**. This setting is distinct from **Show All Hierarchy**.

HIER3 must also preserve precise endpoint semantics in the rendered result.
Cross-file references should visually connect their actual visible File,
Heading, or Block source and target endpoints. Module internals should orient
relevant endpoint entities toward the neighbouring macro rank where sensible.
Multi-hop modules may require separate incoming-facing and outgoing-facing
structural lanes instead of a fixed `File → Heading` orientation. This is an
internal semantic refinement on Strategy A and does not reopen the A/B macro
layout decision.

## Evidence

Strategy A passed every hard gate on F1–F18, all 24 seeded holdouts, eight
24-module cases, five 120-module cases, and the 500-module hub. Its cold reruns
were byte-identical. User graphical review accepted A as clearly better than D0
and B, with no observed overlap and sensible root/rank positioning.

D0 passed 8/42 modular hard gates and cannot represent the filtered
intermediary. B produced deterministic candidates but passed only 11/42 hard
gates, failing clearance on all 24 generated holdouts. A had no hard failure,
rank drift, or alignment defect that met the threshold for a custom post-pass.

## Consequences

`packages/focus-schematic-layout` remains the narrow reusable, non-production
implementation boundary. The D0/B experiments, calibration, scale harness, and
visual lab remain development-only evidence. HIER2 changes no renderer, W3
worker, view-state schema, persistence contract, or production UI.

HIER3 owns production worker integration, renderer mapping, endpoint attachment,
internal endpoint-facing orientation, failure fallback, caching, cancellation,
and preservation regressions for both modular and Classic strategies. Exact
polyline routing remains HIER5 work.

## Rejected alternatives

- D0 remains Classic but is rejected as the modular default because derived
  File-module bounds overlap and filtered intermediaries are unsupported.
- Compound Dagre is rejected because public cluster output does not reserve the
  shared padded module rectangles reliably and native route coverage is
  incomplete.
- A custom bounded post-pass is rejected because A exposed no measured defect
  meeting the material-improvement prerequisite.
- Stateful dynamic Dagre is rejected because it matched cold stability while
  adding graph/session lifecycle complexity.
- The File-sized filtered context card is rejected because it adds area without
  adding path information over the compact bridge.
