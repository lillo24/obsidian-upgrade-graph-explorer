# ADR 0014: Add bounded Local Free beneath Global

**Status:** Accepted for KG13B2A; Local Structured remains KG13B2B.

## Context

KG13B1 added a documents-only Global/Regional network. Users still need to
move from one Global file into nearby headings, blocks, diagnostics, and linked
files without turning those entities into whole-vault Global topology. That
transition must preserve semantic context, work with KG6 disclosure/focus,
survive stable-identity updates, and show useful geometry before a force layout
finishes.

## Decision

The application has three explicit presentation modes: `structure`, `global`,
and `local`. Local is a presentation of ordinary KG6 state, never canonical
truth. `focus.rootEntityId` is normalized to a stable document and remains the
neighborhood authority. Local projection first derives the bounded document
neighborhood through documents-only KG6 focus, then retains disclosed entities
and exact reference/diagnostic provenance only for those documents. The root
document reveals its top-level headings; neighboring documents remain
collapsed unless the user expands them. Global continues to reject headings
and blocks.

Local Free uses the production Sigma/Graphology package through a separate
mapper, lifecycle, style grammar, cache, and serializable layout protocol.
Files, headings, blocks, and diagnostic targets have distinct node roles.
Hierarchy and reference edges keep distinct kinds and force weights. No folder
prior, folder node, fake relationship, manual coordinate, or Global position
mutation exists in Local.

A deterministic seed places the root at graph origin and makes Local usable
immediately. A dedicated latest-result-wins Worker refines that geometry with
ForceAtlas2 and strong hierarchy weighting. An active obsolete request is
terminated, stale results are rejected, surviving positions warm a changed
projection, and an exact topology/settings fingerprint uses a bounded
memory-only cache. The fingerprint excludes coordinates, labels, interaction
state, and camera state. Worker failure keeps the last valid seed/refined scene
visible and exposes recovery through Structure.

Global exposes only a stable-node viewport-point query. On **Open Local**, the
application captures the chosen Global file's runtime screen point and places
the Local root there when possible. The point is transient. Worker refinement
and root-origin normalization preserve the root's displayed screen point. If
capture is unavailable, Local performs a semantic center request instead.

Schema v3 persists `presentationMode` and separate Structure, Global, and Local
semantic viewports. A Local bookmark contains only canonical anchor ID plus
Free camera ratio; raw x/y, Sigma/Graphology state, layout positions, and
transition points are forbidden. Schema v1 migrates to Structure. Schema v2
migrates its explicit renderer mode conservatively—even a Global view with an
active focus remains Global. Future schema versions fail loudly.

Search, Inspector, Back/Forward, and live reconciliation remain shared. A
visible search result stays Local; another document reroots Local; a hidden
heading opens only its required ancestor chain. **Back to Global** restores the
actual prior Global checkpoint, not merely the immediately previous Local
disclosure checkpoint. Stable root rename/move preserves Local; root loss or
deletion never fuzzy-reroots and instead exposes an explicit Global/Structure
recovery path.

Ordinary Local zoom, pan, hover, selection, Inspector activity, and style LOD
perform no KG6 projection, Graphology topology reconciliation, or layout.
Disclosure/focus changes affect Local only and issue zero Global layout work.
The accepted precision-wheel gain remains `0.0017` in both Sigma modes.

## Consequences

Local Free supplies a bounded semantic zoom-in without adding canonical state,
a second traversal model, or whole-vault relayout. It adds a third renderer
presentation, a separate worker protocol, and a visual-only WebGL surface; DOM
Search, Inspector, disclosure controls, and Structure therefore remain the
accessible and failure-recovery surfaces.

The synthetic bounded Local benchmark shows the normal seed path is sufficient
without speculative precomputation: medium (381 nodes/430 edges) projection,
mapping, and seed remain small, while the roughly 47 ms ForceAtlas2 median runs
off-main. The 1,101-node stress refinement remains about 108 ms off-main. No
background layout warming is adopted.

`LocalLayoutMode = 'free' | 'structured'` exists as a persistence/preference
seam, but production exposes only Free. KG13B2B may add a React Flow/W3
Structured presentation of this same Local projection; it must not redesign
the projection or silently reinterpret the existing Structure renderer.
