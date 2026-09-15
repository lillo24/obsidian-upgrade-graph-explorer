# Continuous network physics

This folder owns the runtime-only ForceAtlas2 lifecycle used by temporary node
constraints. It does not own move gestures, Sigma presentation, camera state,
saved layout caches, or persisted Place offsets.

- `protocol.ts` defines and validates the versioned main-thread/worker boundary.
- `pull.ts` applies the All-network folder Pull field with iteration-normalized
  strength, independent of how often frames are published.
- `dynamic-coupling.ts` classifies stable undirected reference components. Its
  active-closure resolver remains available for MOVE300B diagnostic comparison;
  production MOVE300C uses the seed-lifetime component membership as a soft
  reference frame instead of freezing the off-closure set.
- `simulation.ts` owns the retained Graphology graph and the
  sleeping/hot/cooling/failed/disposed state machine. It uses only the public
  `forceAtlas2.assign` API.
- `index.ts` is the package export surface.

The browser worker owns scheduling. MOVE1B initializes the retained service
whenever supported All or Focus Network movement is armed, but initialization
still constructs no Worker; the first threshold-crossing pointer drag or
keyboard nudge does. Arrange Folders temporarily suspends this ownership. A sleeping
simulation schedules no work. A new begin during cooling reheats the same Worker.
Frames carry a monotonic interaction revision plus gesture/File identity.
Renderers may adopt lagging neighbor progress, but overlay the constrained File
at the newest target; update transport retains at most one in-flight and one
pending target. Renderers retain exact raw coordinates separately from the
browser-owned velocity-preserving release follower, adopt presentation
coordinates imperatively, expose only
coarse raw lifecycle/presentation transitions, and must not persist frames.
Failure preserves the last adopted graph and is recovered explicitly by a fresh
initialization.

All seeds explicitly label whether they began from an output-only M2 folder
snapshot. That automatic field may relax during transient Move; it is never
reapplied into the solver, so the normal finite-layout field remains free of
feedback accumulation.

MOVE300C supersedes MOVE300B's hard off-closure freeze. Every All node now
participates in every physical ForceAtlas2 step, so isolates and disconnected
components can respond to nearby moved geometry. A finite component-centroid
stabilizer then translates each undirected reference component toward the
centroid captured from the accepted simulation seed. The reference lasts for
the retained simulation generation and is never re-captured at gesture start or
release, preventing repeated-gesture ratcheting. Per physical iteration the
correction is 1.5% of centroid error, capped at 1.5% of the seed's graph-space
RMS radius. A multi-iteration no-Pull cooling batch uses the mathematically
equivalent compounded gain and linearly accumulated cap; Pull cooling retains
one-step cadence. This is deliberately weaker than authored Pull and is neither
an exact recenter nor a per-node pin. Folder membership alone still creates no
runtime coupling.

Cooling measures every node that continues to move. A released degree-zero File
therefore rejoins the same whole-graph force system and cools normally instead
of sleeping immediately or being restored to either its seed or released
coordinate. Safety caps and lifecycle states are unchanged.

Production canvases expose this lifecycle for one to 100 visible simulation
nodes in Focus and one to 300 in All. An empty startup projection cannot
initialize the worker, while views above the active mode's limit report
`graph-too-large` before constructing it. The All 300-node value is a release/QA
boundary rather than a solver cliff; analyzer fixtures remain free to probe the
explicit failure boundaries at larger sizes.
