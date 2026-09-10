# Focus Schematic renderer adapter

This lazy-only subpath owns production conversion from the HIER1/HIER3A
renderer-neutral result to validated React Flow data.

- `index.ts` derives worker dimensions from renderer card constants, reuses the
  normal projection mapping for card data, applies A1 positions, creates quiet
  module/filtered bridge nodes, maps exact attachment handles, places
  diagnostics, and validates the complete prepared graph.
- `focus-schematic.test.ts` covers exact File/Heading/Block geometry, fallback
  identity, filtered anonymity, diagnostic clearance, module-aware aggregate
  hover, direct-ring predicates, visible-structure boundary presentation,
  provenance continuity, and secondary zero-geometry influence.
- `folder-band-strips.tsx` renders the Directional macro's exact horizontal
  world-space guides.
- `folder-cluster-guides.tsx` builds child regions before parent regions from the
  nested displayed tree and final module rectangles. It preserves disconnected
  islands, fixed padding, containment, pointer-inert hulls, short accessible
  labels, displayed-depth styling, and renderer-only current/parent/sibling
  emphasis. Its pure actual-shape helper resolves pane context points by depth,
  area, and stable identity. Folder management is supplied through the shared
  context-menu request seam.

The mapper is the sole owner of optional modular entity metadata. It derives
module membership from HIER1 and direct-File ring visibility from the final
currently rendered reference edges. Classic mapping never receives these
fields.

Both guide shapes are pointer-inert viewport overlays behind edges and nodes.
The Soft guide's small HTML label uses passive text presentation while retaining
keyboard focus, a focus-visible outline, and pointer/keyboard context-menu
entry. Empty-area context targeting is handled separately by world-space
graph-pane hit testing. Guides are excluded from graph nodes, fitting, layout,
and cache identity.

Module boundary visibility is also renderer-only. `index.ts` derives the typed
`hasVisibleStructuralDescendants` marker from the module's currently visible
Heading/Block projection nodes. `nodes.tsx` makes a File-only boundary
transparent without removing its computed rectangle or attachment handles, so
root status, collapsed authored structure, references, and rings cannot keep an
empty boundary visible or perturb geometry.

The package root does not re-export this subpath, keeping it outside Classic
startup. Node/module geometry remains independent from future HIER4 folder
post-processing and HIER5 route rendering.
