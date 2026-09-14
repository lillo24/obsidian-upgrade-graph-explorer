# HIER4A-PATCH2 nested Directional folder bands experiment

## Status

Implemented on `codex/hier4a-patch2-nested-directional` and ready for user
graphical review. This note records experimental evidence; it does not amend the
accepted HIER4A ADR or select Nested as product behavior.

## One-level hierarchy

Nested Directional mode derives parent candidates from exact normalized folder
keys after Adaptive Compass or Vertical Spine has produced final File-module
dimensions. Candidates are considered deepest first. Once a parent is
materialized, it is a top-level atomic unit and cannot itself be nested. The
validated plan therefore has at most one visible parent layer.

The focused root exact folder is excluded from parent construction. It remains
an independent band at the accepted root anchor and keeps its full normalized
workspace-relative path label. Non-root parent and child guides show only their
final path segment while retaining the full key in plan metadata and renderer
title data.

## Materialization and simplification

A parent container materializes after simplification when it has at least two
meaningful visual units. Direct Files form one unlabeled internal unit.
Immediate child folders form child-band units.

- Direct Files plus a sole one-File child lift that File into the direct unit;
  its exact source folder key remains in provenance.
- Direct Files plus a sole multi-File child preserve the child band.
- Two or more visible child folders preserve every sibling split, including
  singleton child folders.
- One child folder with no direct Files suppresses the redundant outer parent.
- Direct Files without a meaningful child use their ordinary exact band.

## Geometry and ordering

Parent and child rectangles are worker-owned structural geometry. Child and
direct units are collision-packed from actual final module heights with fixed
padding and gaps. A parent is atomic in top-level root balancing, so its packed
height is counted once.

Four deterministic forward/backward adjacent-swap sweeps may reorder units
inside a parent and top-level units around the root. Exact selected-backbone and
Focus-path crossings, adjacent-rank inversions, primary span, displacement, and
stable identity provide the ordering score. Folder containment is a harder
constraint than that score: the ND7 case deliberately retains an unavoidable
crossing rather than moving a File outside its exact child band. Secondary
connections never influence geometry.

The renderer consumes parent and child rectangles without deriving hulls. The
outer fill and border, child bands, and labels are pointer-inert. Direct units
have no invented folder label or graph identity. Folder Guides Off hides these
overlays without changing layout.

## Compatibility

The session-only Modular Preview selector compares `Flat` with `Nested (1
level)`. Nested is the experiment default in that mounted preview. The value is
part of the exact layout input/configuration identity, so the cache cannot
confuse the two geometries. It is not persisted.

Flat omits the optional hierarchy record and retains the accepted HIER4A
serialized schema and oracle hashes. The unchanged Soft isolation oracles pass;
Soft requests continue to use their existing display tree, force model, guide
compression, and context menus. Classic rendering, exact endpoint identity,
Adaptive Compass semantics, signed-rank X placement, and HIER5 routing scope are
unchanged.

## Automated evidence

ND1–ND15 cover sole-child simplification, meaningful multi-File children,
singleton sibling preservation, mixed direct/child units, redundant-parent
suppression, parent-local ordering, hard containment over crossings, root
exclusion, relative labels, deep-source selection, disclosure, hide/restore,
reroot, and Secondary invariance. The suite also covers cold-repeat,
model/projection input permutation, and worker/in-process determinism.

Validation on September 14, 2026:

- focus-schematic-layout: 12 files and 137 tests passed;
- renderer-reactflow: 23 files and 118 tests passed;
- web: 95 files and 710 tests passed;
- focus-schematic-bakeoff: 6 files and 11 tests passed;
- Directional Folder Bands benchmark: all hard gates passed for 47 On cases and
  1,113 visible Files;
- production worker small: 6 modules, 17 nodes, 16 edges, 60.8 ms compute and
  418.5 ms worker round trip;
- production worker medium: 3 modules, 14 nodes, 15 edges, 100.3 ms compute and
  478.4 ms worker round trip.

Timings are observations from the validation machine, not release thresholds.
No external dependency was added.

## Graphical evidence

The self-contained lab is generated with:

```text
pnpm generate:focus-schematic-nested-directional-folder-lab
```

It exposes ND1, ND3, ND4, ND6, ND7, ND8, ND9, and ND12 with Flat/Nested,
Folder Guides, and precise-link controls. Browser smoke verification confirmed
that scenarios populate, the comparison selector changes geometry, singleton
simplification is reported, and guide visibility changes presentation only.
User review of the lab and optimized application remains the acceptance gate.
The optimized Windows executable is produced at
`apps/desktop/src-tauri/target/release/icarus-graph-explorer-desktop.exe`; it
passed a hidden launch smoke check after the final build.

## Reproducibility

The exact implementation prompt is archived at
`history-implementations/HIER4A_PATCH2_nested_directional_folder_bands_codex_prompt.md`.
Its SHA-256 is:

```text
61551C5D0738CB809430181B48105EB7951DB9B49986146223153DC24FBE54FF
```
