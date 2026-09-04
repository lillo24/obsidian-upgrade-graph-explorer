# Focus Schematic

This package owns the renderer-independent semantic contract for a future
root-centric Focus Hierarchy. It turns the existing KG6 fixed document
neighborhood and detailed projection into deterministic JSON: File modules,
exact folder metadata, directed relationships, precise visible endpoints,
internal references, diagnostics, distances, placement eligibility, and
parent/backbone candidates.

`createFocusSchematicModel` accepts a validated `ProjectionWorkspace`, Focus
state, detailed projection, and optionally the already prepared public
document-neighborhood description. The prepared path validates the supplied
description against its projection and state without running Focus traversal
again. Invalid or contradictory inputs throw; no partial model is returned.
`validateFocusSchematicModel` independently derives the canonical model and
requires byte-identical shape, ownership, provenance, semantics, and ordering.

## Source map

- `src/types.ts` owns schema-v1 model, summary, layout-candidate, quality, and
  stability types.
- `src/model.ts` owns deterministic construction and strict semantic validation.
- `src/summary.ts` emits aggregate, private-safe semantic counts.
- `src/layout.ts` validates candidate geometry and evaluates layout quality and
  stability without a layout or renderer dependency.
- `src/test-fixture.ts` builds synthetic canonical graphs for tests only.
- `src/model.test.ts` covers semantic scenarios F1–F18 and validation.
- `src/layout.test.ts` covers hand-authored good and bad candidate layouts.
- `src/integration.test.ts` covers the Markdown-to-model pipeline.
- `src/production-boundary.test.ts` proves production web/layout sources do not
  import this package.

Runtime dependencies are limited to `core` and `view-projection`; parser,
adapter, and resolver packages are test-only. The package has no React, React
Flow, Sigma, Dagre, Node filesystem, Tauri, Obsidian runtime, spatial override,
or persistence dependency.

## Quality formulas

Rectangles use top-left coordinates, positive X right, positive Y down, finite
values, and positive dimensions. Overlap means a positive-area intersection
after optional clearance. Direction compares module center X with the root
center. Rank order requires every farther preferred rank to be at least as far
from the root as nearer ranks, subject to an optional tolerance.

Folder adjacency sorts module centers by Y and divides adjacent same-folder
pairs by all adjacent pairs. Root-folder center offset is the mean root-folder
center Y minus the mean center Y of all modules. Mean same-folder vertical
distance averages every same-folder module pair. Compactness uses the enclosing
module bounds; empty-area ratio is `1 - summed module area / bounds area`,
clamped at zero.

Supplied routes produce route-aware focus-path and secondary crossing counts.
When routes are empty, those fields are `null` and a separately named straight
module-center approximation is reported. Heading alignment is a documented
proxy: the absolute center-Y difference of visible section/block endpoint
nodes until explicit ports exist. Stability reports raw displacement and
root-relative displacement; percentiles use nearest-rank selection on a sorted
array.

HIER1 does not generate coordinates and is absent from the production renderer
graph. HIER2 now consumes this contract through the separate
`focus-schematic-layout` package; the semantic model remains unchanged and
equal-mutual ambiguity is resolved only in the HIER2 layout plan.

HIER3 must use the model's precise visible File, Heading, and Block endpoints
when drawing cross-file references. Endpoint-facing internal lanes are a layout
refinement over those existing semantics, not a new relationship model.
