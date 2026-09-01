# Desktop Workers

Status: **STABLE — stateful W1 and stateless Structure/Global/Local layout workers remain separate.**

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
local-layout.worker.ts        Stateless Local hierarchy/reference ForceAtlas2 entry.
local-layout-worker-client.ts  Latest-result-wins Local replacement-worker client.
local-layout-worker-client.test.ts  Supersession, malformed output, and failure tests.
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

The Local worker is a fourth independent protocol; it does not overload Global
folder-prior settings. It receives stable node/edge roles, hierarchy/reference
weights, root key, seed positions, iterations, and bounded settings only. A new
request terminates obsolete work, strict request IDs reject stale adoption, and
errors leave the immediate deterministic scene visible. The Local worker is
created only after Local Free is mounted; Structure startup and ordinary Global
use do not load it.
