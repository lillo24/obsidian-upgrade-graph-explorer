# HIER3B-FIX1 Validation

## Gate status

The center-spine and module-aware hover implementation is complete. Focused and
complete repository checks, browser interaction QA, and the optimized desktop
build pass. The user gave final graphical approval on September 4, 2026.

Baseline main commit: `764754220d62f1a18ee8cd3672f914a2c4c2564e`.

## Center-spine contract

A visible File module with at least two top-level center-lane structural
branches lays out each branch independently with public Dagre TB geometry. A
deterministic source-contiguous cut minimizes maximum vertical extent, then
above/below imbalance and total height. Branch rectangles are centered on the
single File card and stacked with the existing separation values. Side lanes
are then anchored to the final center-parent Y positions and the complete
module bounds, padding, and diagnostic reserve are recomputed.

After macro positions exist, exactly one forward and one backward pass may swap
adjacent branches inside the same above or below stack. A swap is accepted only
when precise non-secondary selected-backbone/Focus-path evidence strictly
improves endpoint crossings, adjacent-rank inversions, or vertical alignment.
No branch can cross the File. Macro rank assignment and left/center/right lane
semantics are unchanged.

The selected strategy remains `A1-endpoint-facing-split-lanes`. Its explicit
implementation revision is now `2`; exact cache keys include that revision, so
revision-1 entries cannot hit. A0 remains available through the development
comparison alias.

## Geometry evidence

The repository-owned `CS1`–`CS6` corpus covers the five-Heading case, outgoing
fan, mixed two-sided module, nested branches, non-root module, and diagnostic
reserve. All cases have zero module overlap, node overlap, containment failure,
invalid lane transition, obstructed selected attachment, endpoint crossing,
and adjacent-rank inversion.

Representative local Windows/Node measurements on September 4, 2026:

| Profile            | Uniform center baseline | Center spine | Crossing / inversion | Dagre calls |
| ------------------ | ----------------------: | -----------: | -------------------: | ----------: |
| CS1, five branches |               488 × 504 |    256 × 656 |                0 / 0 |           8 |
| CS2, outgoing fan  |               488 × 600 |    256 × 752 |                0 / 0 |          10 |
| CS3, two-sided     |               488 × 504 |    256 × 656 |                0 / 0 |          10 |
| CS4, nested        |               720 × 408 |   256 × 1040 |                0 / 0 |           6 |
| 20 branches        |              488 × 1944 |   256 × 2096 |                0 / 0 |          22 |
| 100 branches       |              488 × 9624 |   256 × 9776 |                0 / 0 |         102 |

The expected trade is visible: center modules become substantially narrower
and may become taller. These timings and dimensions are diagnostic evidence,
not CI thresholds.

## Module-aware hover and direct File ring

Prepared modular entity nodes carry explicit module ownership. File nodes use
module-aggregate hover; Heading and Block nodes use exact hover. Aggregate File
hover emphasizes the module's entity nodes and boundary, every currently
rendered module-incident reference edge, opposite external endpoints, and
internal hierarchy edges. It expands one external hop only. Classic nodes omit
the metadata and retain their existing exact incident-neighborhood behavior.

The direct File ring is present only when a modular File has visible structural
children and a currently rendered reference edge is directly incident to that
File node. Hidden secondary, Heading-owned, Block-owned, hierarchy, and module
fallback endpoints do not create it. The SVG stroke sits outside the measured
card rectangle, exposes a single labelled keyboard target, and uses a narrow
renderer context for transient direct-only hover. Its hit stroke occupies the
border gap; pointer-down, click, and double-click stay local to that target,
while the higher card surface keeps its normal click and double-click behavior.

The FH regression cases prove aggregate File coverage, exact Heading/Block
hover, collapsed/expanded underlying ReferenceId continuity, display-aware
secondary ring behavior with byte-identical node geometry, fallback safety,
same-module handling, accessible focus/blur, and click isolation. Hover changes
only renderer classes and performs no projection, HIER1 model construction,
worker request, layout, or cache mutation.

## Automated commands

Passing release-candidate checks:

```text
pnpm install --frozen-lockfile
pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout
pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow
pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web
pnpm --filter @icarus-graph-explorer/focus-schematic-bakeoff typecheck
pnpm benchmark:focus-schematic-center-spine
pnpm benchmark:focus-schematic-endpoints -- --profile fixtures
pnpm benchmark:focus-schematic-endpoints -- --profile stability
pnpm benchmark:focus-schematic-endpoints -- --profile medium
pnpm benchmark:focus-schematic-endpoints -- --profile hub
pnpm benchmark:focus-schematic-production-worker -- --profile small
pnpm benchmark:focus-schematic-production-worker -- --profile medium
pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:performance -- --profile small
pnpm check
pnpm desktop:check
pnpm desktop:build
```

`pnpm check` passed formatting, lint, all workspace typechecks, 1,569 tests, and
the production web build. The optimized executable is
`apps/desktop/src-tauri/target/release/icarus-graph-explorer-desktop.exe`.

## Browser QA

The synthetic 12-node, 11-edge Focus view loaded through the production modular
worker. Its five top-level Headings appeared in one center column, with two above
and three below the File; module and entity rectangles did not overlap. File-card
hover highlighted the module, all displayed module relationships, and their
opposite endpoints. Exact Heading hover highlighted only its incident
neighborhood. Keyboard focus on the ring highlighted one direct File reference
and its opposite File, without changing geometry.

Browser hit-testing resolved the ring's border gap to its SVG stroke and the card
interior to the File article. The Secondary Links toggle left every rendered node
transform byte-identical. Switching to Classic removed the ring and preserved
the existing Classic hover behavior.

## Optimized desktop QA

The final release build preserved the approved center-spine geometry, aggregate
File hover, exact Heading/Block hover, direct-File ring interaction, Secondary
Links geometry invariance, and Classic behavior. The user approved the optimized
desktop result on September 4, 2026.

## Deferred boundaries

HIER4 owns soft same-folder vertical coherence after signed-rank and endpoint
readability constraints. It must not add fake edges or override macro truth.

HIER5 owns connector routing. Direct means a simple direct connector;
Electronic means orthogonal horizontal/vertical geometry with square corners;
Electronic — Rounded uses the same orthogonal route with rounded styling.
HIER5 must also cover four stacked Files whose semantic references currently
share a SmoothStep corridor: routes need distinct identities, usable hit
targets, channel separation when paths coincide, and clear target branching.
A wider invisible hit stroke alone cannot repair exactly overlapping paths.

No HIER4 folder positioning or HIER5 routing is implemented in this change.

## Prompt archive

The exact implementation prompt is archived at
`history-implementations/HIER3B_FIX1_center_spine_module_hover_codex_prompt.md`.
Its SHA-256 is
`2F79FAAF4CE372E6BC0F6E7862326C8F854453EAD2820A9EFD07BF5D742212C3`.
