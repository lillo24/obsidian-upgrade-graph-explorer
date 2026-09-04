# HIER2 validation

Status: **local evidence and required user graphical review complete; PR CI,
merge, and post-merge CI remain pending.**

## Scope and production isolation

HIER2 adds `@icarus-graph-explorer/focus-schematic-layout` and the
development-only `focus-schematic-bakeoff` tool. A production-boundary test
scans apps and packages and proves no production source imports the new layout
package. The reusable package rejects renderer, app, W3, view-state, Tauri,
and platform imports. Production Focus Hierarchy, current W3, HIER0 collision
adoption, All-Hierarchy gating, Network, SPATIAL1, QUERY1, Visual Groups,
view-state, and persistence schemas are unchanged.

The lockfile retains `@dagrejs/dagre` 3.1.1. No external package was added;
the new workspace importers reuse existing pinned dependencies.

## Automated evidence

Focused package and tool tests cover:

- exact explicit-dimension coverage, ordering, finite positive geometry, and
  renderer-baseline drift;
- non-mutual planning, stronger equal-mutual candidate choice, rank load,
  stable final tie, one monotonic parent, acyclicity, and JSON round-trip;
- one-node, nested Heading/Block, sibling order, two-sided, multihop, mutual,
  filtered, diagnostic-reserve, containment, clearance, root normalization,
  route evidence, and cold determinism;
- D0 current-wrapper use and honest F14 unsupported status;
- public compound ownership, precise endpoints, filtered anchor, complete
  candidate coverage, and visible hard-gate failures;
- source-order public constraints and secondary-edge coordinate isolation;
- production import isolation.

The frozen evidence corpus contains F1–F18, 24 deterministic generated seeds,
S1–S10, eight 24-module runs, five 120-module runs, and one 500-module hub.
Heavy runs use worker isolation with 8 s/15 s hard timeouts. No timeout fired.

Strategy A passed 42/42 fixed/generated cases, 8/8 small cases, 5/5 medium
cases, and the hub. B passed only 11/42 fixed/generated hard gates and no scale
hard-gate profile. D0 passed 8/42 modular gates and reports F14 unsupported. Full tables,
raw metrics, stability, dynamic, route, and maintainability evidence are in
`HIER2_LAYOUT_BAKEOFF.md`.

## Visual lab

Generate the self-contained synthetic lab with:

```bash
pnpm generate:focus-schematic-layout-lab -- --out output/hier2-layout-lab
```

Serve `output/hier2-layout-lab` locally and open `index.html`. The lab includes
all F fixtures, a 48-module hub, S1/S3 before/after revisions, D0/A/B/C status,
compact/context filtered policies, compact/normal configurations, approximate
and native edges, module bounds, folder labels, and secondary-link toggles.
Output is gitignored and contains no private vault data.

Agent production-browser QA inspected F4, F5, F7, F9, F11, F13, F14 under
both filtered policies, hub-48, and both S1/S3 revisions. Controls updated the
panels correctly, failure/unsupported states were visible, and no console or
rendering blocker was observed. User graphical review then accepted Strategy A
as the HIER2 winner, citing no overlap and sensible root/rank positioning.

## Commands run before the review gate

The following completed successfully during implementation:

```bash
pnpm install --frozen-lockfile                         # baseline before edits
pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm --filter @icarus-graph-explorer/focus-schematic-bakeoff typecheck
pnpm exec vitest run packages/focus-schematic-layout tools/focus-schematic-bakeoff
pnpm benchmark:focus-schematic-layout -- --profile fixtures
pnpm benchmark:focus-schematic-layout -- --profile small
pnpm benchmark:focus-schematic-layout -- --profile medium
pnpm benchmark:focus-schematic-layout -- --profile hub
pnpm benchmark:focus-schematic-layout -- --profile stability
pnpm generate:focus-schematic-layout-lab -- --out output/hier2-layout-lab
pnpm install --frozen-lockfile
pnpm exec vitest run packages/focus-schematic
pnpm benchmark:focus-schematic -- --profile small
pnpm benchmark:focus-schematic -- --profile medium
pnpm benchmark:focus-schematic -- --profile hub
pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:performance -- --profile small
pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

The full check covered formatting, lint, recursive typechecks, 154 Vitest files
with 1,309 tests, and the 585-module web production build. The desktop check and
no-bundle release build completed successfully. An ordinary production-browser
smoke loaded the unchanged app and exercised Focus + Hierarchy without a
console or rendering blocker. Repository CI remains a post-PR gate.

## Privacy

Fixtures use names such as Root, A, and synthetic seeded IDs. Reports expose
only synthetic geometry and aggregate metrics. No real path, title, target,
workspace topology, screenshot, or vault-derived artifact is committed.
