# ADR 0013: Add lazy Global/Regional beside Structure

**Status:** Accepted

## Context

KG13A established that direct Sigma/Graphology serves a file-level overview
task that React Flow/Dagre Structure does not. Production still needs one source
of graph semantics, off-main layout, stable live updates, clear failure
behavior, and a path to local detail without turning headings into whole-vault
layout units. Folder proximity is useful spatial context but is not a semantic
reference relation.

## Decision

React Flow plus W3 Dagre remains the Structure renderer. A literal lazy import
loads direct Sigma 3 plus Graphology for Global and Regional visual LOD. Global
uses a documents-only KG6 projection and an effective resolved-only default
unless the user explicitly selects reference statuses. KG6 remains semantic
projection authority; Graphology is replaceable derived renderer state.

Far, Regional, and Near zoom levels change centralized Sigma reducer styling
only. Ordinary zoom, pan, hover, selection, and Inspector changes do not
reproject KG6, rebuild Graphology topology, or request layout.

Workspace-relative document paths derive folder metadata. Folders create no
nodes or edges. Reference attraction and the folder prior remain independent.
Production selects the evaluated chunked ForceAtlas2/folder-prior approach:
short ForceAtlas2 chunks alternate with bounded soft folder adjustments. The
offset-field candidate separated folders but did not reduce within-folder
distance and lengthened cross-folder reference geometry more strongly in the
small synthetic comparison.

ForceAtlas2/folder work runs in a latest-result-wins Worker with serializable
requests and strict results. Surviving positions warm changed fingerprints; an
exact hit uses a bounded memory-only cache. The fingerprint includes layout
schema/algorithm, semantic keys/sizes, reference endpoints/weights, folder keys,
and validated `GlobalLayoutSettings`. Search, labels, hover, selection, source
text, and raw seed coordinates are excluded. Layout settings are serializable
presentation preferences and future Saved-View-compatible, never canonical
truth. Node, folder, and ForceAtlas2 coordinates are not persisted.

Schema-v2 view state stores the current renderer entry point plus separate
canonical Structure and Global semantic viewports. Schema v1 migrates to
Structure losslessly. Search and Inspector remain shared: document navigation
stays Global, heading/block navigation and **Open in Structure** reveal exact
Structure context. Global is visual-only; Structure, Search, and Inspector
remain accessible. WebGL/lazy-start failure explicitly falls back to Structure
for the session without erasing the saved Global preference.

The initial `Structure | Global` control is not the final scale model. KG13B2
may add Local Free/Structured as a bounded induced subgraph anchored at stable
Global file coordinates. Adding local headings must not mutate Global topology
or relayout the whole vault. QUERY1 and GROUP1 remain independent future
systems. Separate LAYOUT1 is paused/absorbed into this spatial architecture.
Manual folder-cluster offsets remain future derived presentation state.

## Consequences

The product gains a lazy file-network overview while preserving Structure's
hierarchy, provenance, and accessibility strengths. It also accepts a second
renderer lifecycle, WebGL dependency, Worker, derived cache, and explicit
failure surface. The production package is isolated from canonical, source,
platform, analytics, React Flow, and Dagre concerns, and the KG13A harness now
consumes the production implementation rather than maintaining a fork.
