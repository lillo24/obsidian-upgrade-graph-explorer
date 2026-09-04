# HIER3B Validation

## Gate status

Automated, production-browser, optimized desktop build, and user graphical/native
gates pass. The user approved the release candidate on September 4, 2026.
HIER3B is complete; HIER3C is next and has not started.

## Automated coverage

The HIER3B suites cover:

- legacy, Classic, Modular Preview, malformed preference, unrelated-save, and
  Sandbox reset behavior under the unchanged v1 key;
- exact protocol request/response validation, successful and failed compute,
  malformed response, startup/transport failure, supersession, cancellation,
  disposal, and stale-generation rejection;
- exact cache hits, layout-relevant misses, corrupt-entry invalidation, and
  bounded LRU eviction;
- renderer-derived dimensions, exact A1 File/Heading/Block positions, symmetric
  handles, hierarchy attachments, precise and internal references, filtered
  bridges, truthful fallback edges, secondary zero-geometry influence, module
  backgrounds, root identity, and collision-safe diagnostics;
- Classic default, lazy Modular selection, no history checkpoint, semantic
  transition-anchor handoff, and session-only Classic fallback with the preview
  preference retained.

Focused package typechecks and tests are followed by the complete repository
and desktop gates listed below. No timing threshold is introduced.

```text
pnpm install --frozen-lockfile
pnpm --filter @icarus-graph-explorer/focus-schematic typecheck
pnpm exec vitest run packages/focus-schematic
pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout
pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow
pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web
pnpm benchmark:focus-schematic-endpoints -- --profile small
pnpm benchmark:focus-schematic-endpoints -- --profile medium
pnpm benchmark:focus-schematic-endpoints -- --profile hub
pnpm benchmark:focus-schematic-production-worker -- --profile small
pnpm benchmark:focus-schematic-production-worker -- --profile medium
pnpm benchmark:focus-schematic-production-worker -- --profile hub
pnpm benchmark:focus-schematic-production-worker -- --profile supersession
pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:performance -- --profile small
pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

## Production-browser evidence

The local production path was exercised with the bundled synthetic diagnostic
sample:

- Classic was selected by default.
- Settings exposed Classic and Modular Preview separately from Show All
  Hierarchy.
- Modular loaded a real HIER1/A1 worker result and rendered File module
  boundaries, exact cards, references, and all diagnostic states.
- File disclosure added a Heading through a new modular request without a blank
  frame.
- Secondary links Off→On left all 13 React Flow node IDs/transforms byte-equal.
- Fit, selection, disclosure, Inspector-compatible identities, and controls
  remained available.
- Classic→Modular and Modular→Classic retained the Source root screen center to
  less than 0.001 px in the measured runs.
- The browser console reported no warning or error entries.

## Bundle evidence

The optimized web build emitted independent chunks for:

```text
Classic W3 worker                         50.02 kB
Modular Focus Schematic worker           97.77 kB
Classic LocalStructuredGraphView          0.99 kB
ModularStructuredGraphView               77.80 kB
main application                         722.65 kB
```

Names contain content hashes and may change. The important result is that both
the modular component and modular worker are separate lazy chunks; Classic
startup does not import the Focus Schematic model/layout/mapper path.

## Native graphical evidence

The user reviewed the final optimized executable with ordinary content rather
than fixture IDs and approved all of the following:

- one Heading linking to a Heading in another File;
- incoming Files on the left, Focus File centered, outgoing Files on the right;
- a multi-hop middle File with incoming-facing and outgoing-facing endpoints;
- exact Block endpoints;
- an anonymous filtered bridge with no hidden File title/path;
- unresolved, ambiguous, and invalid diagnostics visible and selectable;
- disclosure without a root camera jump;
- Classic↔Modular screen-context preservation;
- Secondary links adding context without node movement;
- current touchpad pan/zoom behavior.

The user confirmed that all native graphical checks passed on September 4, 2026.
