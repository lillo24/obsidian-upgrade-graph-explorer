# MOVE300A — Raise All Network temporary File Move boundary to 300 nodes

**Task type:** narrow product-capability change / release-boundary experiment

## Goal / success outcome

Allow temporary File movement in **All + Network** when the active physics simulation contains up to **300 visible simulation nodes**, instead of the current shared 100-node release boundary.

The immediate purpose is practical validation on the user's real vault, which has roughly 255 Markdown files and currently hits:

```text
File movement supports up to 100 visible nodes in this release.
```

Important: the relevant quantity is the actual **visible simulation node count**, not the number of `.md` files. Use the renderer/physics count already used by the current capability gate.

Desired product policy for this task:

```text
All + Network
  <= 300 visible simulation nodes
  → temporary File Move available

  > 300
  → graph-too-large
  → no continuous physics Worker

Focus + Network
  retain the existing <= 100 boundary for now
```

This is deliberately a conservative experiment, not a claim that 300 is a proven universal performance limit.

Do not redesign or retune PHYSICS1.

---

## Current repository evidence

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Current `main` at plan-writing time:

```text
7980c2e6d6a3c1ea5872023a05e1625b03be637d
```

Current production code has a shared boundary in:

```text
packages/renderer-sigma/src/physics/simulation.ts

NETWORK_PHYSICS_SUPPORTED_NODE_LIMIT = 100
networkPhysicsNodeCountIsSupported(...)
```

Both:

```text
GlobalGraphCanvas
LocalGraphCanvas
```

currently call the same support helper and expose `graph-too-large` above that limit.

Current documentation explicitly describes 100 as an initial release boundary rather than a physical impossibility. The continuous physics implementation itself already has larger deterministic work caps; the 100-node value is the product availability gate.

There is currently an unrelated draft PR:

```text
#100 — SAVEDUX1
```

Preserve it and any other concurrent worktree/branch. Re-check current `main` and open PRs before implementation and again before merge.

---

## Scope

### In scope

- make the physics support boundary **mode-specific**;
- All + Network limit = **300**;
- Focus + Network limit remains **100**;
- update capability messages/tests/docs accordingly;
- add focused boundary tests around 100/101 and 300/301;
- run a targeted 300-node physics/Move validation;
- build a fresh optimized desktop executable for user QA;
- leave the PR unmerged until the user tests the real All graph and explicitly accepts it.

### Out of scope

Do not change:

- ForceAtlas2 settings;
- PHYSICS1 hot-step cadence;
- cooling/convergence thresholds or caps;
- worker protocol;
- Pull or Place behavior;
- folder clustering;
- pointer/gesture semantics;
- camera/density behavior;
- File Move persistence semantics;
- Focus support boundary;
- large-graph neighborhood simulation;
- automatic adaptive limits;
- PIN1 or saved node positions.

Do not optimize unrelated code merely because this exposes a larger graph.

---

## Implementation guidance

### 1. Replace the single shared release cap with an explicit mode-aware policy

Prefer one authoritative API, for example:

```ts
NETWORK_PHYSICS_FOCUS_SUPPORTED_NODE_LIMIT = 100
NETWORK_PHYSICS_ALL_SUPPORTED_NODE_LIMIT = 300

networkPhysicsSupportedNodeLimit(mode)
networkPhysicsNodeCountIsSupported(mode, nodeCount)
```

Exact naming is flexible.

Avoid duplicating raw `100` / `300` checks independently inside canvases.

The mode should correspond to the existing PHYSICS1 modes:

```text
focus
all
```

Keep validation for invalid node counts.

If the current type architecture makes a mode-parameterized helper awkward, choose an equally centralized alternative after inspecting the repository.

### 2. Global capability

`GlobalGraphCanvas` should use the All limit.

Required boundary:

```text
299 → available
300 → available
301 → graph-too-large
```

No Worker should be created merely because the capability is available; preserve the existing lazy first-real-drag behavior.

### 3. Focus capability

`LocalGraphCanvas` remains unchanged semantically:

```text
99  → available
100 → available
101 → graph-too-large
```

Do not broaden Focus simply because the old constant was shared.

### 4. User-facing explanation

Where the UI currently says:

```text
File movement supports up to 100 visible nodes in this release.
```

make the message truthful to the current scope.

When All is active and blocked:

```text
File movement supports up to 300 visible nodes in All Network in this release.
```

When Focus is blocked:

```text
File movement supports up to 100 visible nodes in Focus Network in this release.
```

If the current UI can express this more compactly without ambiguity, use the existing style.

Do not hide `graph-too-large`; it remains a deliberate fail-closed capability reason.

### 5. Tests

Add/update focused tests for the centralized support policy and both renderer capability paths.

At minimum:

```text
All:
0     → unsupported if zero remains invalid by current contract
1     → supported
100   → supported
101   → supported
299   → supported
300   → supported
301   → unsupported

Focus:
1     → supported
99    → supported
100   → supported
101   → unsupported
300   → unsupported
```

Preserve existing tests that assert:

- graph-too-large creates no continuous Worker;
- ordinary hover/select/click does not create the Worker;
- first valid drag lazily creates it;
- capability recovery occurs when visible count falls back under the active limit.

Update any hardcoded 100-node UI assertion so it checks the correct active-mode message.

### 6. Targeted 300-node evidence

Do not launch another large performance research project.

Add or extend the smallest existing PHYSICS1/MOVE analyzer to exercise **300 visible All nodes** through the real physics algorithm, preferably including:

```text
All Network
All + Pull
```

Check:

- begin/update/end succeeds;
- constrained File target remains exact;
- neighbors react;
- release reaches sleeping or reports the existing explicit failure;
- no malformed/stale protocol result;
- finite coordinates;
- no cache/persistence mutation.

Record timing only as local evidence. Do not add a CI timing threshold.

If the 300-node synthetic case fails existing deterministic physics correctness/cooling contracts, stop and report rather than weakening those contracts.

### 7. Real-vault user acceptance gate

Build a fresh optimized desktop executable.

The PR should remain **draft/unmerged** until the user performs this native check on the real vault:

```text
1. Open the real vault.
2. Scope = All.
3. Layout = Network.
4. Confirm the graph is under/equal to 300 visible simulation nodes.
5. Drag several Files, including:
   - a connected File;
   - a weakly connected File;
   - an isolated/near-isolated File if available.
6. Confirm:
   - dragged File tracks pointer;
   - neighbors react;
   - UI/camera remains responsive;
   - release looks acceptable and settles;
   - no obvious multi-second freeze;
   - no failure banner / Retry Move unless the existing physics cap genuinely fails.
7. Test with folder Pull/clustering state currently used by the vault.
```

Report the **actual visible simulation node count** during this test if it is available from existing diagnostics. Do not infer it solely from `277 .md files`.

If the real ~255-file vault feels acceptable, the user may approve merge with 300 as the new All release boundary.

If it feels poor, leave the PR draft and report what failed. Do not silently tune physics.

---

## Documentation

Update the closest truthful docs:

```text
docs/PHYSICS1_CONTINUOUS_SIMULATION.md
docs/PERFORMANCE.md
docs/ARCHITECTURE.md
docs/decisions/0024-production-network-editing-and-temporary-file-move.md
```

Only change sections that describe the release support boundary.

State clearly:

```text
Focus temporary Move: <=100 visible simulation nodes
All temporary Move:   <=300 visible simulation nodes
```

and that 300 is a release/QA boundary, not a claim of a physical solver cliff.

Do not rewrite historical implementation prompts.

Archive this exact prompt under:

```text
history-implementations/
```

using a suitable name.

---

## Validation

Use current repository equivalents and `AGENTS.md`.

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/renderer-sigma
pnpm exec vitest run apps/web

pnpm analyze:physics1
pnpm benchmark:file-move

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Also run the focused 300-node All probe described above.

No new external dependency.

No timing-based CI gate.

---

## Exit gate

This task is ready for user QA only when:

1. All support limit is 300.
2. Focus support limit is still 100.
3. Limits are centralized rather than duplicated magic numbers.
4. 300 All nodes are accepted.
5. 301 All nodes fail as `graph-too-large`.
6. 100 Focus nodes are accepted.
7. 101 Focus nodes fail as `graph-too-large`.
8. Above-limit views create no continuous physics Worker.
9. Worker remains lazy for supported views until a real drag.
10. Current Move gesture semantics are unchanged.
11. Current PHYSICS1 algorithms/settings are unchanged.
12. Pull/Place composition is unchanged.
13. Camera/density behavior is unchanged.
14. No persistence/cache semantics change.
15. Focused 300-node All physics probe passes.
16. `pnpm check` passes.
17. Desktop check/build pass.
18. Fresh executable is produced.
19. PR remains draft/unmerged pending real-vault user acceptance.
20. Unrelated PR #100/worktrees/user files remain untouched.

After user approval:

```text
merge
→ verify post-merge CI
→ remove task branch/worktree
```

Do not start another scale increase automatically.

---

## Final report

Report:

### Result
- All limit:
- Focus limit:
- Actual centralized API/constant design:

### Automated evidence
- 300-node All:
- 301-node rejection:
- Focus 100/101:
- PHYSICS1 analyzer:
- tests/builds:

### Native QA handoff
- executable path;
- exact real-vault checklist;
- how to see/report actual visible simulation node count, if available.

### Scope confirmation
Explicitly confirm that no ForceAtlas2, convergence, Pull, Place, camera, persistence, or worker-protocol behavior changed.

### Merge state
Keep draft until the user explicitly says the real All graph is acceptable.
