# ADR 0019: Temporary File movement contract

**Status:** Accepted — MOVE1A complete.

## Context

Network Files need direct physical movement without turning a drag into saved
geometry, competing with Arrange Folders, or coupling pointer code to the
continuous simulation/cooling implementation being developed under PHYSICS1.
SPATIAL2A also means the position shown by Sigma may include a fixed Place
translation above the dynamic simulation layer.

## Decision

1. Move means one temporary physical constraint. Release or cancellation ends
   the constraint and automatic physics may move the File again. It writes no
   spatial registry, view state, history checkpoint, layout cache, or source.
2. Pin is a later durable semantic and is not inferred from drag completion.
3. Display composition is `P = D + T`, where `D` is the current dynamic layer
   (including Pull) and `T` is the one winning fixed Place translation actually
   applied by composition. The simulation target is therefore `C = Ptarget - T`.
   Nodes without Place use identity. Pull is not inverted.
4. The source-neutral spatial package indexes applied translations by node.
   Duplicate folders or a node present in multiple applied groups are errors.
5. Renderers call a plain begin/update/end consumer port carrying schema,
   session and simulation generations, gesture ID, monotonic sequence, stable
   node key, simulation-space target, and explicit end reason. The port carries
   no Graphology/Sigma/worker object, physics tuning, source text, or coordinate
   persistence.
6. A pure idle/primed/dragging reducer owns the 3 px viewport threshold,
   pointer-to-node grab offset, stale-event rejection, and one active File.
   Live Sigma viewport-to-graph conversion occurs for each accepted sample.
7. Begin is immediate at threshold. Later targets coalesce to the latest
   animation frame. Release flushes that update before one end; cancellation
   drops pending updates and performs idempotent cleanup. React does not render
   for raw pointer samples.
8. All and Focus Sigma sessions expose the same optional fake-backed seam.
   Only canonical document/File nodes are eligible; Focus headings, blocks, and
   diagnostics are not. Stage panning remains available when no eligible node
   owns the pointer.
9. File movement and folder arrangement are mutually exclusive. Click and
   document double-click keep existing behavior below threshold; a real drag
   suppresses its trailing click and Focus activation.
10. Escape, pointer/stage loss, blur, visibility loss, workspace/scope/layout/
    topology/spatial invalidation, mode change, consumer failure, and disposal
    end the constraint. A later implementation may rebase across invalidation,
    but MOVE1A cancels conservatively.
11. Capability unavailability is explicit. MOVE1A installs no real simulation
    adapter and no visible pencil/Edit control.
12. PHYSICS1 retains simulation lifetime, reheating, convergence, cooling, and
    node reaction policy. MOVE1B will bind the completed adapter and add the
    production editing surface. PIN1 remains later.

## Consequences

The coordinate and interaction contracts can be tested now without claiming a
working production Move feature. The port can be implemented by PHYSICS1
without moving renderer state or spatial persistence into the physics layer.
Runtime WebGL/cooling evidence becomes a MOVE1B gate, not fake-physics evidence
for this foundation.

## Rejected alternatives

- Saving x/y on release was rejected because it silently turns Move into Pin.
- Removing parent Place or Pull effects during drag was rejected because it
  changes authored spatial intent and risks double inversion.
- Mutating Sigma coordinates directly was rejected because other nodes could
  not react through the future physical simulation.
- Sending every pointer event directly was rejected because it creates an
  unbounded hot path and makes renderer/worker backpressure implicit.
