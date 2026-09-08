# Desktop Workers

Status: **STABLE — stateful W1, stateless layout workers, and dormant continuous Network physics remain separate.**

This folder owns browser Worker transport code. Domain state, geometry, and
protocol behavior live in platform-independent packages; the web application
owns Worker lifecycle and literal Vite worker construction.

```text
workspace.worker.ts          Dedicated Worker entry and localized worker-global typing.
workspace-worker-client.ts   Promise client, response validation, and fatal transport cleanup.
workspace-worker-client.test.ts  Fake-transport correlation and failure tests.
dagre-layout.worker.ts       Stateless W3 request/response entry.
dagre-layout-worker-client.ts  Lazy latest-layout-wins lifecycle and instrumentation.
dagre-layout-worker-client.test.ts  Supersession, stale-result, failure, and reuse tests.
global-layout.worker.ts       Stateless production Global ForceAtlas2/folder-prior entry.
global-layout-worker-client.ts  Latest-result-wins replacement-worker client.
global-layout-worker-client.test.ts  Supersession, malformed output, and adoption tests.
global-spatial-influence.worker.ts  Separate soft-folder-attractor entry over base positions.
global-spatial-influence-worker-client.ts  Latest-result-wins replacement-worker client.
global-spatial-influence-worker-client.test.ts  Supersession, stale, malformed, and disposal tests.
local-layout.worker.ts        Stateless bounded Local hierarchy/reference ForceAtlas2 entry.
local-layout-worker-client.ts  Latest-result-wins Local replacement-worker client and structured failure.
local-layout-worker-client.test.ts  Supersession, schema-v2 validation, timeout, and disposal tests.
focus-schematic-layout.worker.ts  Stateless HIER3B A1 production entry.
focus-schematic-layout-worker-client.ts  Strict latest-result-wins Modular Preview client.
focus-schematic-layout-worker-client.test.ts  Supersession, stale, failure, responsiveness, and disposal tests.
network-physics.worker.ts    Retained public-ForceAtlas2 sleeping/hot/cooling lifecycle.
network-physics-worker-client.ts  Lazy strict TemporaryNodeConstraint adapter with rAF-coalesced adoption.
network-physics-worker-client.test.ts  Laziness, generation, coalescing, error, and disposal tests.
```

The worker is instantiated only after a local-vault open starts. Sample and
imported-report browser paths do not create it.

The Vite worker build uses the Markdown named-reference decoder's worker-safe
entry. `vite.config.ts` enforces that exact transitive boundary and rejects an
emitted worker chunk containing DOM construction; W1 must never evaluate
`document` or `window.document`.

The W3 worker is independent of source mode and is instantiated only when the
mounted graph first requests geometry. It is reused while idle. A newer request
actively terminates an in-flight worker and replaces it; generation and request
guards also reject late messages. Protocol, computation, construction, clone,
and transport failures are explicit. The renderer then uses its deterministic
grid fallback—never synchronous Dagre on the UI thread.

The Global layout worker receives only the renderer-sigma plain-data request.
Every semantic/layout change replaces active obsolete work; request IDs and
strict response validation prevent stale adoption. ForceAtlas2 and the selected
soft folder prior never run on the UI thread. A worker error remains explicit
while the last valid deterministic or committed positions stay visible. The
worker dependency graph is DOM-free and is checked by the same Vite production
boundary that protects W1.

The Global spatial-influence worker is separate from automatic Global layout.
It receives only stable node coordinates/sizes, reference endpoints/weights,
resolved pull memberships, graph-space targets/strengths, settings, iterations,
and a request ID. It receives no paths, labels, source content, camera, fixed
rules, styles, or UI state. Superseded work is terminated; stale success/failure
cannot be adopted. Failure leaves base positions plus fixed placements visible.

The Local worker is a fourth independent protocol; it does not overload Global
folder-prior settings. Its schema-v2 request receives stable node/edge roles,
hierarchy/reference weights, root key, seed positions, settings, and the exact
`local-fa2-convergence-v1` deterministic policy. One replacement worker reuses
one Graphology graph across 32-iteration public batches and sends one final
success or structured failure. The 2-second safety limit is runtime-only; a
`max-wall-time` response carries completed-batch evidence but no positions. A
new request terminates obsolete work, strict originating-request validation
rejects stale or inconsistent policy/counter/metric/node results, and errors
leave the last valid or immediate deterministic scene visible. The Local worker
is created only after Local Free is mounted; Structure startup and ordinary
Global use do not load it.

The Focus Schematic worker is a fifth independent protocol and loads only after
Focus + Hierarchy + Modular Preview mounts. Its version-1 request carries the
plain HIER1 model, Local projection, exact renderer dimensions, and frozen A1
settings. Both sides validate exact message shape; success is revalidated
against the originating input. A new request terminates obsolete compute,
generation/request guards reject stale messages, and unmount or presentation
change disposes the worker. Startup, clone, transport, runtime, malformed, and
computed-result failures remain explicit so the component can retain its last
valid graph or request session-only Classic fallback.

The continuous Network physics worker is dormant scaffolding for PHYSICS1. An
`initialize` call stores clone-safe Focus or All seed data in the client but
does not construct a Worker. The first valid temporary-constraint `begin`
starts it. The retained graph then publishes whole-graph frames while hot,
continues bounded convergence cooling after release, and schedules nothing
once sleeping. The client adopts at most one newest frame per animation frame;
worker coordinates remain session-only and never enter layout or spatial caches.
