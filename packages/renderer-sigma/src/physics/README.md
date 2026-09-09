# Continuous network physics

This folder owns the runtime-only ForceAtlas2 lifecycle used by temporary node
constraints. It does not own move gestures, Sigma presentation, camera state,
saved layout caches, or persisted Place offsets.

- `protocol.ts` defines and validates the versioned main-thread/worker boundary.
- `pull.ts` applies the All-network folder Pull field with iteration-normalized
  strength, independent of how often frames are published.
- `simulation.ts` owns the retained Graphology graph and the
  sleeping/hot/cooling/failed/disposed state machine. It uses only the public
  `forceAtlas2.assign` API.
- `index.ts` is the package export surface.

The browser worker owns scheduling. MOVE1B initializes the retained service only
while Move Files is selected, but initialization still constructs no Worker; the
first threshold-crossing pointer drag or keyboard nudge does. A sleeping
simulation schedules no work. A new begin during cooling reheats the same Worker.
Frames carry a monotonic interaction revision plus gesture/File identity.
Renderers may adopt lagging neighbor progress, but overlay the constrained File
at the newest target; update transport retains at most one in-flight and one
pending target. Renderers adopt coordinates imperatively, expose only coarse
lifecycle transitions, and must not persist frames. Failure preserves the last
adopted graph and is recovered explicitly by a fresh initialization.

All seeds explicitly label whether they began from an output-only M2 folder
snapshot. That automatic field may relax during transient Move; it is never
reapplied into the solver, so the normal finite-layout field remains free of
feedback accumulation.

Production canvases expose this lifecycle only for at most 100 visible nodes.
Larger views report `graph-too-large` before constructing the Worker; analyzer
fixtures remain free to probe the explicit failure boundaries at larger sizes.
