# PHYSICS1 — Continuous Network simulation

PHYSICS1 supplies the real, transient physical layer required by MOVE1B. It
does not expose a Move control, persist a node position, or replace the finite
Focus and All layout workers used by ordinary browsing.

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

The adapter drops old generations, non-increasing frame numbers, frames for a
superseded constraint sequence, and frames whose node set differs from the seed.
Worker frames are coalesced to the newest value and adopted at most once per
`requestAnimationFrame`.

## Focus and All seeds

Focus seeds from its last accepted Local Network coordinates. The edge weights
already include the current hierarchy/reference multipliers. Only document
nodes are constraint eligible; Heading, Block, and diagnostic nodes remain in
the simulation but cannot be constrained.

All seeds from `latestDynamicPositions`, before fixed Place composition. It
receives only resolved Pull member keys, targets, and strengths—never paths,
query state, source Markdown, or rule resolution logic. Only Global document
nodes are constraint eligible.

The canvas integration is present behind `temporaryConstraintActive`, whose
default is `false`. Web views supply the real lazy Worker factory, but ordinary
product UI never enables it. Thus normal browsing retains the existing finite
workers and creates no PHYSICS1 Worker. MOVE1B owns the later visible mode.

## Pull and Place

Current static Pull applies gain `0.55 × strength` with a cap of
`0.60 × graph RMS × strength` at a defined four-iteration correction quantum.
PHYSICS1 converts that to a per-physical-iteration correction:

```text
gain₁ = 1 - (1 - 0.55 × strength)^(1/4)
cap₁  = 0.60 × graph RMS × strength / 4
```

The correction follows each public iteration, so publishing every 1, 2, 4, or
8 iterations produced identical coordinates in the cadence bake-off. Pull
stays soft, affects only resolved winning groups directly, and allows connected
nonmembers to react through reference physics.

Place is excluded from the worker seed. At activation, the canvas captures the
winning displayed translation for each placed node. MOVE1A subtracts it once
from the displayed pointer target. PHYSICS1 simulates that dynamic target, and
the renderer adds the same translation once to every displayed frame. Place is
therefore neither fed back into physics nor inverted twice.

## Cooling policy

Hot frames never stop for convergence while a constraint exists. Release uses
canonical 32-iteration endpoints and three consecutive full stable checks:

- Focus uses root-translation alignment, previous-root RMS normalization,
  all-node p90 `0.00512`, and degree-0/1 maximum `0.01024`.
- All uses centroid alignment, previous-centroid RMS normalization, the same
  p90/low-degree guards, and normalized centroid drift `0.00512`.

Focus retains its 1,000 / 600 / 240 deterministic iteration classes and
two-second wall limit. Interactive All needs a distinct tail from the finite
seeded base layout: measurements required 1,920 iterations with Pull off,
3,616 with one Pull, and 3,680 with competing Pulls. Its continuous caps are
8,192 / 1,024 / 256 for ≤1,000 / ≤5,000 / >5,000 nodes, with the existing
five-second wall limit. Reaching either cap is an explicit `max-iterations` or
`max-wall-time` failure, never a sleeping success.

## Rendering, camera, and storage

The client updates Sigma coordinates imperatively. Local and Global sparse
adoption touches only node x/y and incident-edge indexation. It performs no
camera write, Fit, density measurement/framing, React state update, layout
cache write, dynamic Pull cache write, spatial registry write, view/history
write, or source write. Closing or remounting can therefore forget the transient
state and return to normal accepted layout coordinates, as Move is not Pin.

## Development lab

During Vite development only, open `/?physics1-lab`. The lab uses the real
Worker/client and offers deterministic Focus chain, star, weak-link, isolate,
and multiple-isolate fixtures plus All medium Pull-off, Pull-on, competing-Pull,
cross-reference, and Place-layer cases. Drag a node or use **Run scripted drag**
or **Run scripted cancel** to observe hot, cooling, and sleeping states; the
invalidation control terminates and reinitializes the retained worker. The route
is selected through a development-only dynamic import and adds no normal
product control.

## Evidence summary

Windows/Node measurements on 2026-09-08 are local evidence and fluctuate with
JIT and machine load:

| Nodes / edges | Four-iteration worker turn | Iterations/s | Whole-frame bytes | Main adoption map |
| ------------: | -------------------------: | -----------: | ----------------: | ----------------: |
|     100 / 196 |                   0.144 ms |    27,855.15 |             5,997 |          0.019 ms |
|     500 / 988 |                   3.395 ms |     1,178.24 |            30,303 |          0.059 ms |
| 1,000 / 1,978 |                  82.941 ms |        48.23 |            60,606 |          0.067 ms |
| 5,000 / 9,898 |                  73.525 ms |        54.40 |           305,678 |          0.407 ms |

No large graph silently switches to neighborhood-only physics. Lower publish
rates at scale are a measured consequence of whole-graph semantics and remain
visible evidence for MOVE1B product decisions.
