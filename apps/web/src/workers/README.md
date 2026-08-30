# Desktop Workers

Status: **STABLE — KG12B keeps stateful W1 and stateless W3 worker lifecycles separate.**

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
