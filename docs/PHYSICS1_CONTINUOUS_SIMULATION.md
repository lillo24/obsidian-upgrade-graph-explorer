# PHYSICS1 — Continuous Network simulation

PHYSICS1 supplies the real, transient physical layer activated by MOVE1B. The
simulation package itself exposes no product control, persists no node position,
and does not replace the finite Focus and All layout workers used by ordinary
browsing.

## Architecture decision

The installed `graphology-layout-forceatlas2@0.10.1` exposes two relevant
public entry points. Its worker supervisor has only `start`, `stop`, `kill`, and
`isRunning`; it has no supported step/frame command or moving hard-constraint
API. Although package source recognizes a `fixed` node attribute internally,
that behavior is absent from the public types and documentation and is not used.

PHYSICS1 therefore retains one Graphology graph in a dedicated browser Worker
and calls only public `forceAtlas2.assign`. While a constraint is hot it runs
four one-iteration calls per worker turn. Before and after every physical
iteration it reasserts the constrained target; one whole-graph frame is then
published. Candidate public call quanta 1, 2, 4, and 8 were compared. A single
iteration is the only boundary that permits target reassertion between every
physical step. Published target error was exactly zero on chain, star, weak,
isolate, multiple-isolate, and medium fixtures, while adjacent nodes moved.

Run `pnpm analyze:physics1` to regenerate the ignored JSON evidence at
`output/physics1/candidate-analysis.json`. It is an investigative benchmark,
not a CI timing gate.

## Ownership and lifecycle

The clone boundary uses Network physics schema 2. Temporary constraint commands
retain their independent schema 1 contract.

The browser client stores a clone-safe seed but does not construct a Worker.
The first valid `begin` creates the Worker, sends the seed, then sends the
constraint. The retained worker state is:

```text
sleeping → hot-constrained → cooling → sleeping
                         ↘ failed
any nonterminal state → disposed
```

- `sleeping` schedules no timer and performs zero ForceAtlas2 work.
- `begin` requires schema 1, matching session/simulation generations, sequence
  zero, a known constraint-eligible canonical File, finite coordinates, and no
  active constraint.
- `update` requires the same gesture/node/generations and a strictly increasing
  sequence. The new target replaces the prior target.
- `end` clears the target and starts cooling from current physical coordinates;
  it never rolls back. Exact repeated cleanup is idempotent.
- semantic input changes call `invalidate`, terminate stale work, and seed a
  new generation only when the capability is active again.
- a malformed or execution failure is explicit. Failed work cannot look settled.

Every frame carries a simulation-local interaction revision, gesture id, active
File key, and last incorporated command sequence. The adapter rejects old
generations, interaction revisions, gesture/File identities, non-increasing
frame numbers, impossible lifecycle/constraint combinations, and frames whose
node set differs from the seed. The same checks run when a frame arrives and
again when its animation-frame callback adopts it, so a queued frame cannot
cross a release or a second gesture.

Pointer targets and neighbor progress have separate display guarantees. The
adapter may adopt a current-gesture frame computed for an older target, but it
replaces the constrained File's position with the newest main-thread target.
Thus neighbor motion remains visible when the Worker trails the pointer, while
the File itself remains exact. A target update no longer cancels an already
queued display frame.

Constraint transport is bounded. One update may be in flight and only the
newest later update is retained; a release flushes that newest target before the
end command. Begin/end/invalidate ordering is never coalesced away. Hot Worker
frames are still coalesced to the newest valid value and adopted at most once
per `requestAnimationFrame`. Hot turns are paced to at most one scheduled turn
per 16 ms so the Worker does not intentionally allocate and clone whole-graph
frames faster than a typical display can consume them.

## Focus and All seeds

Focus seeds from its last accepted Local Network coordinates. The edge weights
already include the current hierarchy/reference multipliers. Only document
nodes are constraint eligible; Heading, Block, and diagnostic nodes remain in
the simulation but cannot be constrained.

All seeds from `latestDynamicPositions`, before fixed Place composition. It
receives only resolved Pull member keys, targets, and strengths—never paths,
query state, source Markdown, or rule resolution logic. Only Global document
nodes are constraint eligible.

When automatic M2 folder clustering is active, those dynamic positions are the
already-shaped, output-only M2 snapshot. Activation therefore has no coordinate
jump. PHYSICS1 deliberately marks the seed as `seeded-output-relaxation`: it
does not reapply M2 per tick or feed shaped output into ForceAtlas2. Automatic
folder contraction/separation may temporarily relax during Move and cooling;
the change is session-only and the normal finite All layout restores the M2
field after invalidation/remount. This is an explicit compatibility limit, not
a claim that live physics retains the automatic field.

The canvas integration is present behind `temporaryConstraintActive`, whose
default is `false`. In production that compatibility prop means direct dragging
is available: Web views enable it in supported Network layouts and suspend it
only while Arrange Folders owns input. Arming initializes clone-safe seed state
but constructs no Worker. Mount, hover, click, double-click, and sub-threshold
movement therefore retain the finite-worker boundary; the first threshold-
crossing drag or keyboard nudge creates the PHYSICS1 Worker.

## Pull and Place

PHYSICS1 uses a deliberate four-iteration reference quantum and converts Pull
to a per-physical-iteration correction:

```text
gain₁ = 1 - (1 - 0.55 × strength)^(1/4)
cap₁  = 0.60 × graph RMS × strength / 4
```

The correction follows each public iteration. Tests and the candidate analyzer
exercise the production seed factories and group-centroid function with near (unclipped), far
(clipped), and multiple displaced groups; publishing every 1, 2, 4, or 8
iterations produces identical coordinates because publication is outside the
simulation. This proves publication independence, not numerical identity with
the static spatial Pull pipeline, whose usual 30 iterations over six
corrections is a five-iteration cadence. Pull stays soft, affects only resolved
winning groups directly, and allows connected nonmembers to react through
reference physics.

Place is excluded from the worker seed. At activation, the canvas captures the
winning displayed translation for each placed node. MOVE1A subtracts it once
from the displayed pointer target. PHYSICS1 simulates that dynamic target, and
the renderer adds the same translation once to every displayed frame. Place is
therefore neither fed back into physics nor inverted twice.

## Cooling policy

Hot frames never stop for convergence while a constraint exists. Release uses
canonical 32-iteration endpoints and three consecutive full stable checks:

- Focus uses root-relative shape movement, previous-root RMS normalization,
  all-node p90 `0.00512`, degree-0/1 maximum `0.01024`, and an additional raw
  root-displacement guard of `0.00512` in the displayed fixed frame. The added
  guard prevents rigid visible translation from looking settled without
  forcing the root back to zero.
- All uses centroid alignment, previous-centroid RMS normalization, the same
  p90/low-degree guards, and normalized centroid drift `0.00512`.

Focus retains its 1,000 / 600 / 240 deterministic iteration classes and
two-second wall limit. Interactive All needs a distinct tail from the finite
seeded base layout: measurements required 1,920 iterations with Pull off,
3,616 with one Pull, and 3,680 with competing Pulls. Its continuous caps are
8,192 / 1,024 / 256 for ≤1,000 / ≤5,000 / >5,000 nodes, with the existing
five-second wall limit. Only a complete 32-iteration endpoint can increment or
reset the stable streak; the 8-, 24-, and 16-iteration tails of the Focus
1,000 / 600 / 240 caps preserve the prior count and cannot become the third
stable batch. Reaching either cap is an explicit `max-iterations` or
`max-wall-time` failure, never a sleeping success.

## Rendering, camera, and storage

The client updates Sigma coordinates imperatively. Local and Global sparse
adoption touches only node x/y and incident-edge indexation. It performs no
camera write, Fit, density measurement/framing, React state update, layout
cache write, dynamic Pull cache write, spatial registry write, view/history
write, or source write. Closing or remounting can therefore forget the transient
state and return to normal accepted layout coordinates, as Move is not Pin.

Release has a separate presentation layer because raw 32-iteration cooling
endpoints can be both physically far apart and computed faster than a display
callback. Raw validated frames remain authoritative for convergence and future
physics seeds. Display starts from the last presented coordinates and chases
only the newest valid raw target with cubic smoothstep time progress, no queued frame
history, and a displacement-derived duration capped at 120 ms. Tiny changes can
complete on the next frame; there is no minimum animation duration. Re-grabbing
during catch-up makes the held File exact immediately and bridges only the other
visible nodes for at most 80 ms. Reduced-motion skips decorative catch-up and
adopts the accepted raw result. Cancellation, failure, invalidation, and
disposal cancel pending display callbacks. The solver call boundaries, complete
32-iteration convergence checks, iteration/wall caps, camera, Pull, Place, and
M2 composition are unchanged.

## MOVE1B production activation

GraphExplorer owns only the transient Arrange Folders input owner. File dragging
is an ordinary supported All/Focus Network interaction with no Edit or Move
mode. Entering Arrange Folders ends any File gesture and invalidates its
simulation ownership before the existing saved-rule editor takes over; exiting
re-arms direct movement. The Network Explorer keyboard action starts the same
MOVE1A coordinator directly and sends viewport-relative nudges rather than
writing Sigma positions.

React observes capability, raw sleeping/hot/cooling/failed/disposed transitions,
and a distinct idle/settling presentation state. Hot, cooling, and catch-up
frames remain imperative. A failure ends the
gesture, leaves the last valid graph visible, and exposes an explicit retry that
reinitializes the retained service. Exit and invalidation do not restore, freeze,
or persist coordinates.

Production Move is enabled only when the current simulation has at most 100
visible nodes. Larger views report `graph-too-large`, construct no continuous
Worker, and show the supported limit. The development lab and analyzer can
still exercise larger retained simulations as explicit evidence.

The MOVE1B native-QA correction reproduced release independently of UI state.
`handle(end)` was coordinate-identical to the last hot worker state on every
fixture, ruling out rollback, cache restoration, and M2/Place recomposition at
that boundary. The first canonical 32-iteration endpoint nevertheless moved a
node by 32.56, 42.68, and 35.80 graph units on the Focus chain, star, and
single-isolate fixtures, and by 20.62 and 14.74 units on All cross-reference and
All Place-layer fixtures. Four eager endpoints before one display opportunity
raised the largest All cross-reference gap to 40.03 units. A client regression
then reproduced one visible jump from `x=11` directly to `x=50` when three valid
cooling results arrived before the display callback. The correction retains
those raw physical results and call boundaries while presenting bounded
intermediate coordinates; unsupported reset/camera explanations remain ruled
out by source-path tests rather than inferred from scheduling alone.

## Development lab

During Vite development only, open `/?physics1-lab`. The lab uses the real
Worker/client and offers deterministic Focus chain, star, weak-link, isolate,
and multiple-isolate fixtures plus All medium Pull-off, Pull-on, competing-Pull,
cross-reference, and Place-layer cases. Drag a node or use **Run scripted drag**
or **Run scripted cancel** to observe hot, cooling, and sleeping states; the
invalidation control terminates and reinitializes the retained worker. The route
is selected through a development-only dynamic import and adds no normal
product control.

## Evidence summary and limit

Windows/Node measurements on 2026-09-08 are local evidence and fluctuate with
JIT and machine load:

`pnpm analyze:physics1` retains a warm repeated `assign(graph, 4)` scale
microbenchmark for investigation, with three warmups and twelve measured p50/p95
samples per size. Its output labels synchronous assign time, theoretical call
rate, JSON-estimated bytes, and array-to-Map time literally. It does **not** call
that data Worker-step, structured-clone, Sigma adoption, rendering, or sustained
frame-rate evidence.

The direct release probe slept for 100-node Focus, All, and All-with-Pull. Its
500-node Focus and All-with-Pull cases failed at the iteration/wall guard, as did
the 1,000-node Focus and 1,000/5,000-node All cases. Repeated 500-node All
without Pull runs straddled the five-second wall boundary. This evidence selects
the conservative 100-node product boundary.
No larger graph silently switches to neighborhood-only physics. End-to-end
command latency, neighbor-frame age, dropped frames, structured cloning,
validation/adoption, Sigma rendering, and release-to-sleep p50/p95 at supported
boundaries remain a release-evidence requirement. Until that browser/native
measurement exists, the project does not claim continuous-drag scale readiness
from the Node microbenchmark. Native pointer/touchpad acceptance remains the
merge gate for MOVE1B.
