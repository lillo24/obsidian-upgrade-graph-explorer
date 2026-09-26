# Tauri Argument Workspace Persistence

This package owns the desktop storage adapter for the source-neutral
`ArgumentLibraryStore` contract.

- `src/index.ts` defines a narrow injectable filesystem/app-data bridge, the
  production Tauri implementation, strict load classification, expected-snapshot
  saves, and temporary-sibling replacement.
- `src/index.test.ts` verifies the adapter without a native runtime.

Schema-v6 data lives at `argument-workspace/library-v6.json` under
application-local data. It is independent of the selected vault, graph view
state, and workspace identity catalog. When v6 is absent, load prefers a valid
`library-v5.json`, then v4, v3, v2, and v1, performs the core deterministic migration, writes v6 through
a temporary sibling, and keeps the old file as a
recoverable copy. Migration failure leaves the source untouched. Loads
preserve corrupt/future bytes for explicit recovery. Saves validate and
serialize before writing, compare the current on-disk descriptor with the
caller's expectation, write a unique temporary sibling, then rename it over the
confirmed v6 file. A failure removes the temporary file where possible and
never adopts or overwrites corrupt input.

The adapter does not scan or resolve a vault. Later source integration should
implement the core package's separate `LinkedTheorySourceProvider` using the
host's already-authorized source infrastructure.
