# Dagre layout

Status: **STABLE — KG12B2 plain geometry and worker protocol boundary.**

This package owns the source-neutral, serializable Dagre input/output contract
and the exact structural/focus geometry settings. It has no React, React Flow,
projection, browser Worker, application, or filesystem dependency.

```text
src/types.ts           Plain node, edge, input, output, and protocol types.
src/validation.ts      Boundary validation and exact output-coverage checks.
src/protocol.ts        Versioned request/response validation without execution.
src/compute.ts         Synchronous Dagre algorithm; imported only by workers and benchmarks.
src/worker-runtime.ts  Stateless request handler used by browser and Node workers.
src/index.ts           Dagre-free public protocol/validation entry.
src/compute.test.ts    Geometry, validation, cloneability, and protocol oracles.
```

Normal renderer code imports the package root, which deliberately does not
re-export the synchronous compute function. Workers and diagnostic benchmarks
use the explicit `./compute` or `./worker-runtime` subpath so Dagre does not
enter the ordinary main-thread graph bundle.
