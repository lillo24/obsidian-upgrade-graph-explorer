# 0024 — Production Network editing and temporary File movement

Status: accepted for implementation; release remains gated on native acceptance.

## Decision

`GraphExplorer` owns one transient Network editing state with Move Files as the
default tool. All Network exposes Move Files and the existing Arrange Folders
tool; Focus Network exposes Move Files only. Tool, scope, layout, source, and
workspace transitions clear the old renderer gesture through the shared
transition boundary before new props take effect. The existing dirty folder-rule
guard remains authoritative when leaving Arrange Folders.

Pointer and Network Explorer keyboard movement use the same MOVE1A coordinator,
three-pixel threshold, displayed-to-dynamic inversion, and PHYSICS1 service.
Entering editing creates no Worker. The first real move lazily creates one
Worker; later moves reheat it, release starts bounded cooling, and sleep stops
scheduled work. Whole-graph frames remain imperative, while React observes only
coarse capability and lifecycle changes.

Same-gesture progress frames may trail the newest pointer sequence: the client
still adopts their neighbor motion while overlaying the active File at the
newest target. A simulation-local interaction revision and gesture/File
identity prevent frames crossing release or later gestures, and constraint
updates are bounded to one in flight plus one newest pending target.

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
- A large-graph neighborhood fallback would change PHYSICS1 semantics without
  explicit product approval.

## Consequences

- Normal browsing and editing entry preserve the finite-layout performance
  boundary; continuous work begins only after actual movement.
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
