# 0023 — Continuous Network physics through public ForceAtlas2 assignments

Status: accepted; production activation is implemented in draft MOVE1B and
remains gated on native acceptance.

## Decision

Use one retained Graphology graph in a lazy browser Worker. During an active
temporary constraint, execute public `forceAtlas2.assign` one physical
iteration at a time, reasserting the target before and after each iteration.
Publish after four such iterations. On release, use the established mode-correct
32-iteration displacement checks until three full stable checks, a deterministic
iteration cap, or an explicit wall-time failure.

Focus's live check supplements root-relative shape movement with raw normalized
root displacement. Partial cap tails preserve rather than increment the stable
streak. Frames carry a monotonic interaction revision and gesture/File identity;
the client may adopt lagging same-gesture neighbor progress while overlaying the
File at its newest target. Update transport is bounded to one in-flight and one
newest pending target.

All includes resolved Pull attractors as an iteration-normalized soft field.
All seeds before Place; the main-thread renderer applies the already-resolved
fixed Place translation after every dynamic frame. Continuous frames are
session-only and camera-neutral.

An All seed can begin from the output-only M2-shaped snapshot. Activation is
coordinate-identical, but the automatic folder field is intentionally allowed
to relax during live physics and is restored by the next normal finite layout.
Reapplying shaped output into the working graph remains forbidden.

## Rejected alternatives

- The package's public worker supervisor lacks supported stepping, frame, and
  moving hard-constraint commands.
- The implementation's internal matrix and undocumented `fixed` attribute are
  package-private behavior and would create a version-fragile dependency.
- Public 2/4/8-iteration calls leave multiple physical iterations between
  target reassertions. Evidence showed increasing pre-reassertion drift.
- A ForceAtlas2 fork, private iterate import, custom solver, or second force
  engine was unnecessary because the public single-iteration candidate passed.

## Consequences

- Normal browsing remains on the finite Focus/All layout workers and creates no
  continuous worker until a real constraint begins.
- Whole-graph reaction is preserved, including large graphs; reduced-scope
  simulation is not introduced silently.
- Public calls rebuild ForceAtlas2's adaptive private matrix per call. This is
  accepted and measured rather than hidden behind a private API.
- Live Pull strength uses a deliberate four-iteration reference, independent of
  worker message or browser frame cadence. It does not claim numerical identity
  with the static Pull correction cadence.
- Interactive All has a separate 8,192 / 1,024 / 256 cooling cap because its
  arbitrary post-drag states and active Pull require more tail work than finite
  seeded base layouts. The five-second failure boundary remains authoritative.
- Production activation is limited to 100 visible nodes. Direct 500/1,000/5,000
  release probes remain diagnostic; larger product views surface
  `graph-too-large` before Worker construction.
- MOVE1A remains the source of truth for gesture threshold, coalescing,
  generation/sequence commands, arbitration, and displayed-to-dynamic inversion.
- MOVE1B may activate the dormant capability but must not reinterpret these
  lifecycle, coordinate, camera, or storage contracts.
- Raw lifecycle and convergence stay authoritative even when MOVE1B uses a
  bounded browser-only catch-up to present valid cooling results. Eased
  coordinates never become simulation input or cache state.
