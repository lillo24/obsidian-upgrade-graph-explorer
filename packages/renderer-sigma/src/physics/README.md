# Continuous network physics

This folder owns the runtime-only ForceAtlas2 lifecycle used by temporary node
constraints. It does not own move gestures, Sigma presentation, camera state,
saved layout caches, or persisted Place offsets.

- `protocol.ts` defines and validates the versioned main-thread/worker boundary.
- `pull.ts` applies the All-network folder Pull field with iteration-normalized
  strength, independent of how often frames are published.
- `dynamic-coupling.ts` classifies undirected reference components and extends
  the gesture-active set through effective Pull memberships.
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
pending target. Renderers retain exact raw coordinates separately from bounded
display catch-up, adopt presentation coordinates imperatively, expose only
coarse raw lifecycle/presentation transitions, and must not persist frames.
Failure preserves the last adopted graph and is recovered explicitly by a fresh
initialization.

All seeds explicitly label whether they began from an output-only M2 folder
snapshot. That automatic field may relax during transient Move; it is never
reapplied into the solver, so the normal finite-layout field remains free of
feedback accumulation.

During All Move, only the constrained File's undirected reference component
and components coupled to it through positive-strength resolved Pull
memberships are dynamic. All other nodes stay at their gesture-start transient
coordinates around every public ForceAtlas2 iteration, while remaining in the
retained graph so their repulsion still affects the active region. This same
stabilization remains in force through bounded cooling and is cleared only
after sleep, invalidation, failure, disposal, or replacement by a new gesture.
Folder membership alone never creates runtime coupling.

On release, a one-node degree-zero All dynamic region with no effective Pull
has no active relationship to cool. It therefore sleeps immediately at the
exact released coordinate instead of repeatedly restarting whole-graph
repulsion against the stabilized background. Multi-node and Pull-coupled
regions retain normal bounded cooling.

Production canvases expose this lifecycle for one to 100 visible simulation
nodes in Focus and one to 300 in All. An empty startup projection cannot
initialize the worker, while views above the active mode's limit report
`graph-too-large` before constructing it. The All 300-node value is a release/QA
boundary rather than a solver cliff; analyzer fixtures remain free to probe the
explicit failure boundaries at larger sizes.
