# MOVE300A — All Network 300-node Move boundary implementation

## Result

- All + Network temporary File Move supports one through 300 visible
  simulation nodes.
- Focus + Network remains limited to one through 100 visible simulation nodes.
- `simulation.ts` owns the policy through
  `NETWORK_PHYSICS_ALL_SUPPORTED_NODE_LIMIT`,
  `NETWORK_PHYSICS_FOCUS_SUPPORTED_NODE_LIMIT`,
  `networkPhysicsSupportedNodeLimit(mode)`, and
  `networkPhysicsNodeCountIsSupported(mode, nodeCount)`.
- Global and Local canvases pass explicit `all` and `focus` modes. No canvas or
  UI component duplicates raw 100/300 support checks.
- `graph-too-large` remains fail-closed above the active mode's boundary, and
  the UI reports the matching All or Focus limit.

This is a conservative release/real-vault QA boundary. It is not a claim that
300 is a universal solver or rendering cliff.

## Automated evidence

The centralized policy covers All counts 0, 1, 100, 101, 299, 300, and 301,
and Focus counts 0, 1, 99, 100, 101, and 300. Renderer-level tests exercise the
actual capability paths:

- Global 300: available and initializes dormant simulation state;
- Global 301: `graph-too-large` and no simulation initialization;
- Local 100: available and initializes dormant simulation state;
- Local 101: `graph-too-large` and no simulation initialization.

The same tests assert that no `begin` occurs merely because a supported canvas
is ready. Existing worker-client coverage continues to require actual movement
before the browser Worker is constructed.

`pnpm analyze:physics1` now includes fail-loud 300-node All and All+Pull
begin/update/end trials through `ContinuousNetworkSimulation`. Both validated
every frame against the production protocol, retained the exact current
session/simulation generations and complete node set, kept finite coordinates,
moved a neighbor, held the updated File target with zero error, and slept after
release:

| Probe | Cooling iterations | Local cooling time | Target error | Neighbor response |
| --- | ---: | ---: | ---: | ---: |
| All, no Pull | 3,552 | 1,397.494 ms | 0 | 38.335 graph units |
| All + Pull | 6,400 | 2,981.894 ms | 0 | 56.736 graph units |

Timings are September 14, 2026 local evidence only and have no CI threshold.
The retained simulation accepts no layout-cache, persistence, source, history,
or camera owner, so the probe has no surface through which to mutate them.

Validation completed:

- `pnpm install --frozen-lockfile` — passed.
- Focused policy/canvas/UI tests — 3 files, 72 tests passed.
- `pnpm exec vitest run packages/renderer-sigma` — 57 files, 434 tests passed.
- `pnpm exec vitest run apps/web` — 95 files, 710 tests passed.
- `pnpm analyze:physics1` — passed, including both 300-node probes.
- `pnpm benchmark:file-move` — passed; 10,000 samples remained coalesced to
  three commands.
- `pnpm check` — passed: formatting, lint, workspace typechecks, 260 test
  files/2,113 tests, and the production web build.
- `pnpm desktop:check` — passed, including 16 Rust tests.
- `pnpm desktop:build` — passed with a fresh optimized executable.
- `git diff --check` — passed.

## Native QA handoff

Fresh executable:

`C:\Users\leona\Documents\GitHub\icarus-graph-explorer-move300a\apps\desktop\src-tauri\target\release\icarus-graph-explorer-desktop.exe`

- Size: 13,526,528 bytes
- SHA-256: `E1B19C9BEF7B8F4255344B12D55A7A468780B4044B384D5E02AC5AB89532C1DE`

Real-vault checklist:

1. Open the real vault.
2. Select **All** scope and **Network** layout.
3. Read the `N nodes · M edges` value under Workspace controls. `N` is the
   current visible projection count used one-for-one by the Network physics
   support gate; report this value rather than the vault's Markdown file count.
4. Confirm `N` is at most 300.
5. Drag a connected File, a weakly connected File, and an isolated or
   near-isolated File if one is available.
6. For each drag, confirm the File tracks the pointer, neighbors react, the
   camera/UI remains responsive, and release looks acceptable and settles.
7. Confirm there is no obvious multi-second freeze and no failure banner or
   **Retry Move**, unless an existing explicit physics cap genuinely fails.
8. Repeat with the folder Pull/clustering state normally used by the vault.

## Scope confirmation

No ForceAtlas2 settings, hot-step cadence, convergence thresholds/caps, Pull,
Place, folder clustering, gesture/pointer semantics, camera/density behavior,
cache/persistence semantics, or worker protocol changed. This change only makes
the release availability policy mode-specific, updates its explanation and
evidence, and raises All from 100 to 300. Focus remains 100. PIN1 and saved node
positions remain out of scope.

## Merge state

The branch and PR must remain draft and unmerged until the real-vault All
Network check is acceptable and the user explicitly approves merge. No further
scale increase should begin automatically.
