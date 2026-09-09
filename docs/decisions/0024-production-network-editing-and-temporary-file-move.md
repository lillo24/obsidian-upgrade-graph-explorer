# 0024 — Production Network editing and temporary File movement

Status: accepted for implementation; release remains gated on native acceptance.

## Decision

Temporary File movement is an ordinary interaction in every supported, ready
All or Focus Network. It has no Edit Network entry, Move Files mode, or Done
shell. `GraphExplorer` retains transient ownership state only for the explicit
All-only Arrange Folders tool. Entering that tool ends the current File gesture,
invalidates temporary simulation ownership, and suspends direct dragging. Exit
re-arms direct movement after the renderer is ready. Scope, layout, source, and
workspace transitions still clear the old gesture before new semantic input is
adopted, and the existing dirty folder-rule guard remains authoritative.

Pointer and Network Explorer keyboard movement use the same MOVE1A coordinator,
three-pixel threshold, displayed-to-dynamic inversion, and PHYSICS1 service.
Arming direct movement creates no Worker. The first real move lazily creates one
Worker; later moves reheat it, release starts bounded cooling, and sleep stops
scheduled work. Whole-graph frames remain imperative, while React observes
coarse capability, raw lifecycle, and distinct presentation-settling changes.

Same-gesture progress frames may trail the newest pointer sequence: the client
still adopts their neighbor motion while overlaying the active File at the
newest target. A simulation-local interaction revision and gesture/File
identity prevent frames crossing release or later gestures, and constraint
updates are bounded to one in flight plus one newest pending target.

Native QA reproduced two release contributors without finding a coordinate
reset. First, a canonical 32-iteration physical endpoint can be far from the
release frame. Second, zero-delay cooling can produce several valid endpoints
before one browser paint, and newest-only adoption collapses them into a larger
visible jump. The solver, Pull cadence, full 32-iteration convergence checks,
and safety caps remain unchanged. The client keeps exact raw frames for future
seeds and presents only the newest valid cooling target through a bounded,
time-based, scale-relative catch-up capped at 120 ms. It keeps no animation
queue and reaches the exact raw result. Re-grab makes the File exact immediately
and bridges other nodes for at most 80 ms. Reduced-motion skips the decorative
catch-up. Eased coordinates never enter physics, finite-layout, or dynamic-Pull
caches.

Release probes establish 100 visible nodes as the initial shared Focus/All Move
support boundary. Larger views report `graph-too-large` and do not construct the
continuous Worker; this is preferable to presenting a normal tool that reaches
a known cap or wall failure after release.

Release means return the File to automatic physical behavior. Move never writes
source Markdown, history, view state, layout caches, spatial rules, or persistent
coordinates. Pull and Place keep their established meanings. A service failure
ends the gesture, retains the last valid graph, and offers an explicit retry.

The accessible Network Explorer action is available only for canonical File
nodes. Its relocated controller uses viewport-relative 8-pixel arrow nudges,
32 pixels with Shift, Enter/Space to release, and Escape to cancel, without
recentering or depending on a virtualized row remaining mounted.

## Rejected alternatives

- Directly mutating Sigma coordinates would bypass dynamic-coordinate inversion,
  simulation reaction, and generation-safe arbitration.
- A second keyboard-only simulation or per-row controller would split lifecycle
  ownership and break under virtualization.
- Saving the release position would silently turn Move into the separate PIN1
  feature.
- Feeding every frame through React would put whole-graph animation on the
  reconciliation path.
- Replacing public `assign(32)` with repeated smaller public calls would change
  ForceAtlas2 adaptive call boundaries, so it was not treated as a presentation
  correction.
- A large-graph neighborhood fallback would change PHYSICS1 semantics without
  explicit product approval.

## Consequences

- Normal browsing and direct-movement arming preserve the finite-layout
  performance boundary; continuous work begins only after actual movement.
- All and Focus share one behavioral contract, while Arrange Folders remains an
  All-only persistent rule editor.
- The last dynamic frame is intentionally session-only and may be forgotten on
  invalidation or remount.
- An All Move begins exactly from the current output-only M2 snapshot, but the
  automatic folder field may relax temporarily while live physics runs. It is
  not reapplied per frame because doing so would restore accumulated field
  feedback; invalidation/remount returns to the finite M2 layout.
- Production browser QA and an optimized Windows build are required before the
  draft is handed off. Merge remains blocked until explicit native
  pointer/touchpad acceptance.
