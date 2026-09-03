# ADR 0017: Model the Focus Schematic before selecting layout

## Status

Accepted.

## Decision

Focus Hierarchy is represented as File modules whose internal projected
Headings and Blocks retain canonical ownership. The semantic model is separate
from every renderer and layout backend. It reuses KG6's fixed document Focus
neighborhood, while the detailed projection enriches document relationships
with exact visible endpoints.

Authored reference direction determines incoming and outgoing shortest-path
distances. Those distances determine allowed sides and parent candidates.
Equal mutual distance remains explicitly eligible for both sides with no
selected parent; a later layout strategy must resolve it.

Exact normalized folder keys are automatic module metadata. They are neither
semantic graph edges nor user-authored SPATIAL folder anchors. Generic folder
identity is owned by core and re-exported by spatial-overrides for compatibility.

All future Focus Schematic layout prototypes must return the shared candidate
contract and use the same overlap, directional, compactness, folder, crossing,
alignment, and stability evaluators.

## Consequences

HIER1 can test semantic completeness and compare future layouts without placing
nodes. No two-stage Dagre, compound Dagre, custom algorithm, route strategy, or
filtered-module visual treatment is selected here. Production Focus rendering
and the HIER0 geometry/collision path remain unchanged.
