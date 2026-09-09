# Focus Schematic renderer adapter

This lazy-only subpath owns production conversion from the HIER1/HIER3A
renderer-neutral result to validated React Flow data.

- `index.ts` derives worker dimensions from renderer card constants, reuses the
  normal projection mapping for card data, applies A1 positions, creates quiet
  module/filtered bridge nodes, maps exact attachment handles, places
  diagnostics, and validates the complete prepared graph.
- `focus-schematic.test.ts` covers exact File/Heading/Block geometry, fallback
  identity, filtered anonymity, diagnostic clearance, module-aware aggregate
  hover, direct-ring predicates, provenance continuity, and secondary
  zero-geometry influence.
- `folder-band-strips.tsx` renders the Directional macro's exact horizontal
  world-space guides.
- `folder-cluster-guides.tsx` derives singleton, capsule, hull, and disconnected
  Soft macro regions from effective visible spatial groups and final module
  rectangles. Its small label chip exposes one-level promotion, promotion with
  workspace-known siblings, and reset; the hull remains pointer-inert. Tests
  cover strengths 0, 25, 50, 75, and 100 without geometry mutation plus
  keyboard interaction and merged-guide identity.

The mapper is the sole owner of optional modular entity metadata. It derives
module membership from HIER1 and direct-File ring visibility from the final
currently rendered reference edges. Classic mapping never receives these
fields.

Both guide shapes are pointer-inert viewport overlays behind edges and nodes;
only the Soft guide's small HTML label/control surface accepts input. Guides are
excluded from graph nodes, fitting, layout, and cache identity.

The package root does not re-export this subpath, keeping it outside Classic
startup. Node/module geometry remains independent from future HIER4 folder
post-processing and HIER5 route rendering.
