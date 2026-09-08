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

The browser worker owns scheduling. A sleeping simulation schedules no work;
renderers adopt returned coordinates imperatively and must not persist them.
