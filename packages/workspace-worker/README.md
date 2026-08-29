# Workspace Worker

Status: **STABLE — KG12B1 transactional W1 worker contracts are covered by state-machine and transport tests.**

This platform-independent package owns the versioned plain-data protocol and
state machine for moving KG10 workspace processing plus diagnostic report
construction off the UI thread. It deliberately has no browser Worker global,
filesystem access, Tauri handle, React value, or synchronous production
fallback.

```text
main thread prepare request
  → worker-held candidate engine/report/catalog
  → main persists catalog
  → commit acknowledgement
  → main adopts the visible report
```

Only one mutation candidate may be pending. Persistence failure discards it;
a transport failure after persistence requires a replacement worker initialized
from the durable catalog and a fresh full source inventory.

## File map

```text
src/
  protocol.ts     Versioned structured-clone request, response, and processor contracts.
  validation.ts   Shallow boundary validation for untrusted worker messages.
  transport.ts    Ordered bounded request/response framing and reassembly.
  runtime.ts      EMPTY/COMMITTED/PENDING state machine and KG10/diagnostics ownership.
  in-process.ts   Asynchronous test transport using the same protocol runtime.
  index.test.ts   State, failures, cloneability, and direct-pipeline correctness oracles.
  index.ts        Intentional public exports.
```

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/workspace-worker typecheck
pnpm exec vitest run packages/workspace-worker
pnpm check
```
