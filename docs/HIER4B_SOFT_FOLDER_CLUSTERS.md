# HIER4B Soft Folder Clusters

Status: **UNDER EVALUATION — live Modular Preview wired for real-vault QA.**

HIER4B evaluates a second macro-layout family for Modular Focus Hierarchy.
Directional Folder Bands remains the Modular Preview default, and Classic Focus
Hierarchy remains the product default until HIER3C. Soft Folder Clusters is now
available only through the Sandbox/Experimental Modular macro-layout control so
real-vault interaction can inform the later adoption decision.

## Semantic model

Soft Folder Clusters treats macro position as a two-dimensional visual aid.
Authored reference arrows still point from source to target, but module `x` and
`y` do not encode incoming or outgoing direction. Placement aggregates only
selected-backbone and Focus-path connections into undirected module pairs and
computes minimum undirected hop distance from the Focus root. Secondary
connections, Visual Groups, hover state, routing state, camera state, and
Network state have zero geometry influence.

The solver combines five bounded terms:

1. A primary-topology spring pulls connected module rectangles toward a
   dimension-aware separation. Parallel connections use
   `min(4, 1 + log2(count))`, so multiplicity has useful but capped influence.
2. A soft radial term prefers `minimumHopDistance × 520 px` from the Focus
   root. This is a preference, not a ring constraint.
3. A linear-time centroid term attracts modules sharing the same exact
   `folderKey`. Filtered bridge modules never enter a centroid. Singleton
   folders have exactly zero folder force.
4. A weak stable seed and compactness term limits gratuitous movement.
5. Collision passes use final variable module rectangles and a 72 px target
   gap. A bounded deterministic spiral pack closes dense-hub collisions.

The Focus File center is translated to `(0, 0)` after packing. This is a global
translation, so anchoring cannot introduce a collision.

## Strength

The lab exposes `0`, `25`, `50`, `75`, and `100`; the live slider accepts every
normalized value from 0 through 100 and starts at 50. Strength
scales only exact-folder centroid attraction. At `0`, the solver never reads a
folder key for seeding, placement, or packing; changing every folder identity
therefore produces byte-identical macro geometry. `100` remains a soft force:
topology, hop distance, rectangle validity, and the stable anchor can still
split a folder when the graph requires it.

## Deterministic joint layout

The algorithm is stateless and contains no random source, convergence loop, or
force-layout dependency. A stable hash of module identity creates the initial
2D seed. Each module-pair list, folder membership list, collision pair, and
packing order is sorted by stable ID.

Adaptive Compass and macro placement alternate in two fixed rounds:

```text
stable seed
→ Adaptive Compass
→ 36 relaxation/collision iterations
→ Adaptive Compass
→ 18 relaxation/collision iterations
→ final exact endpoint attachments
```

The lab also exposes Vertical Spine as an internal-layout comparator. Adaptive
Compass with Crossing optimized order is the HIER4B default. Evidence records
the fixed `36 + 18` schedule, collision checks/corrections, Compass assignment
count, and branch-region churn between the two rounds. The implementation does
not perform HIER5 obstacle routing or HIER3C product-default work.

## Folder guides

The persisted Folder guides toggle defaults to On and remains renderer-only.
Directional Bands uses the accepted horizontal strips. Soft Folder Clusters
instead derives spatial regions from final displayed File-module rectangles and
exact visible HIER1 folder membership. Singleton folders receive padded rounded
regions, pairs receive compact rounded capsules, and larger local groups receive
deterministic convex outlines. Clearly separated same-folder islands render as
separate regions when joining them would span too much empty space or enclose a
different folder's module.

The overlay is created only after a current layout has been adopted. It is
pointer-inert, excluded from graph nodes and fit bounds, and never enters
projection, model creation, worker requests, cache identity, convergence, or
geometry. Filtered modules are excluded before grouping, and no path is reparsed
to recover folder identity.

## Ownership

`packages/focus-schematic-layout/src/soft-clusters.ts` owns the renderer-neutral
solver and evidence. `soft-cluster-fixtures.ts` owns SC1–SC24 and the stability
pairs. The bakeoff tool continues to own the JSON benchmark and self-contained
HTML lab. The version-4 Modular worker owns macro dispatch; React supplies only
the persisted macro, normalized strength, internal-layout, and Heading-order
policies. The exact page cache ignores stored strength for Directional Bands and
includes it for Soft Folder Clusters.

The real preview uses the current projection, module dimensions, exact endpoint
plan, React Flow mapper, disclosure/reroot/filter behavior, and Secondary edge
presentation. Its Folder guides switch between Directional strips and Soft
spatial regions without requesting layout. Strength and policy changes replace
pending worker generations; layout remains stateless and the latest request is
the only adoptable result.
No private vault path, name, content, topology, or screenshot is committed.

The adoption decision is deliberately open. Graphical review must choose one
of `ADOPT_SOFT_FOLDER_CLUSTERS`, `SOFT_CLUSTERS_REQUIRE_TUNING`,
`KEEP_DIRECTIONAL_BANDS_ONLY`, or `SOFT_CLUSTERS_REQUIRE_REDESIGN`, and record a
preferred strength when relevant.
