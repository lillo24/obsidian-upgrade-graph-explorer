# ADR 0016: Normalized folder spatial overrides

**Status:** Accepted — SPATIAL1A complete.

## Context

All Network already derives automatic document positions from deterministic
seeds, a bounded memory cache, and a latest-result-wins ForceAtlas2 worker with
a soft folder prior. Persisting raw node, folder, or worker coordinates would
couple user intent to one topology, graph size, layout run, and renderer axis.
It would also blur the KG9 semantic-view, Graph Preferences, and automatic
layout-cache contracts.

## Decision

Spatial overrides are derived, workspace-scoped presentation intent. The v1
registry is a separate source-neutral package and supports only exact normalized
workspace-relative folder paths in All Network (`.` identifies the root).
Each entry stores a bounded normalized target center relative to the automatic,
pre-override document graph frame. Logical `x` means left/right and logical `y`
means top/bottom; the Sigma adapter owns its graph-axis sign conversion.

Automatic and displayed positions are distinct. Deterministic seeds, worker
input and output, and the automatic memory cache always use automatic positions.
Spatial composition runs afterward and rigidly translates every visible member
of an anchored folder. Diagnostics, node display sizes, cameras, and prior
translations do not contribute to the frame. Anchor changes submit no KG6,
topology, or ForceAtlas2 work.

The browser owns a separate workspace-keyed registry adapter. Stable declared
identities can persist it; transient and legacy reports use session-only state.
No raw coordinates enter KG9 view state or Graph Preferences. Exact folder path
identity deliberately does not survive a rename in v1: the old entry stays
dormant, and only the exact folder's return reactivates it. No fuzzy remapping is
attempted.

SPATIAL1B will provide the drag and temporary-preview interaction, using the
same pure explicit anchor-map composition with the preview winning for the
active folder. Saved Views remain later composition work and may eventually
reference, copy, or override an independently serializable spatial profile;
this decision defines no Saved View schema.

## Consequences

Empty registries preserve the existing renderer path. Automatic layouts remain
reusable across different anchor maps and cannot accumulate translated drift.
Focus Network and both Hierarchy presentations remain unchanged. Folder renames
need explicit future identity design, and users receive no production editing UI
until SPATIAL1B.
