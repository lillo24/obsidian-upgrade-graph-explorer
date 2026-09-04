# Focus Schematic renderer adapter

This lazy-only subpath owns production conversion from the HIER1/HIER3A
renderer-neutral result to validated React Flow data.

- `index.ts` derives worker dimensions from renderer card constants, reuses the
  normal projection mapping for card data, applies A1 positions, creates quiet
  module/filtered bridge nodes, maps exact attachment handles, places
  diagnostics, and validates the complete prepared graph.
- `focus-schematic.test.ts` covers exact File/Heading/Block geometry, fallback
  identity, filtered anonymity, diagnostic clearance, and secondary
  zero-geometry influence.

The package root does not re-export this subpath, keeping it outside Classic
startup. Node/module geometry remains independent from future HIER4 folder
post-processing and HIER5 route rendering.
