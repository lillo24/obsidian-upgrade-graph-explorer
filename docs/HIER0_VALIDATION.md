# HIER0 implementation and validation

Validation date: 2026-09-03. Implementation started from `b81cc2c`, then
integrated `495a7a1` (PR #53) and `8637dcb` (PR #51). This report records
the implementation, measured checks, and user-verified release QA.

**Status: implementation and release QA passed; ready to merge.**

## 1. Product exposure

- All opens Network by default. Whole-vault Hierarchy is retained and exposed
  when Experimental is enabled, or as session recovery if All Network fails.
- Focus continues to offer Network and Hierarchy normally.
- HIER1 File modules, semantic ranks, folder bands, and new routing are deferred.

## 2. Experimental preference

`showExperimentalAllHierarchy` defaults to false in
`icarus.graph-explorer.preferences.v1`. Absent and non-boolean values load as
false. Neither the preference key nor view-state schema v3 changes.

Settings > Sandbox contains a collapsed, transient Experimental disclosure.
The checkbox is labelled **Show All Hierarchy** and explains that Focus
Hierarchy remains available normally. The same control works in maximized
Settings. One `updateGraphPreferences` callback patches the complete current
record, preserving all other settings. Storage errors keep the session change
and surface the existing warning.

## 3. Availability policy and entry-point inventory

`exploration-model.ts` owns `allHierarchyAvailable` and
`resolveAvailablePresentationMode`. Callers reconcile missing entities first.

| Entry point               | Policy and evidence                                                                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hydration / reload        | Hidden saved All Hierarchy starts visibly in Network while retaining disclosure and renderer viewport metadata; legacy Focus Hierarchy remains local. Pure and rendered hydration tests cover both preferences. |
| Layout controls           | All hides the Hierarchy button completely while Off; Focus always exposes it. All experimental/recovery buttons have explicit accessible context.                                                               |
| Direct mode callback      | Resolves the request before preparing a destination.                                                                                                                                                            |
| Exact Search              | A Heading/Block from All while Off uses `planLocalEntityNavigation`, enters Focus Hierarchy on its File, and selects/centers the exact node.                                                                    |
| Inspector / breadcrumbs   | Share `navigateToEntity`; explicit Open full hierarchy is gated separately.                                                                                                                                     |
| Back / Forward            | Normalize inaccessible presentations, coalesce adjacent equivalent checkpoints created by normalization, and preserve semantic/query state and renderer bookmarks.                                              |
| Focus exit                | Normalizes the prior All checkpoint; without one, resolves the preferred All layout through availability.                                                                                                       |
| Live Focus-root removal   | Reconciliation drops the missing root and selects an available All mode.                                                                                                                                        |
| All Network failure       | Exposes Hierarchy for recovery, disables/explains Network, and leaves the experimental preference unchanged.                                                                                                    |
| Focus renderer failure    | Offers the available other Focus layout and Return to All; full Hierarchy appears only when available.                                                                                                          |
| Disable active experiment | Uses the ordinary anchored transition to Network once, retaining disclosure and the Hierarchy viewport; failed Network keeps recovery Hierarchy with an explanation.                                            |
| Reset current view        | Uses available All Network, or recovery Hierarchy when necessary.                                                                                                                                               |

Enabling and disabling while inactive cause zero new projections in the DOM
interaction tests. Structure projection is now computed only when Structure
is actually visible. The checkbox itself does not create navigation history.

## 4. Synthetic overlap diagnosis before changes

The unmodified bundled sample was measured with mapped fixed dimensions and
browser `getBoundingClientRect()`. The `[[Note]]` ambiguity and invalid
`../Outside` reference remain intact.

| Phase / presentation                      | Positive-area overlap pairs before HIER0                         |
| ----------------------------------------- | ---------------------------------------------------------------- |
| All Hierarchy, Files only, Dagre entities | 0                                                                |
| All Hierarchy, after diagnostics          | 1 entity/diagnostic                                              |
| Focus Source, depth 3, immediate seed     | 9: 1 entity/entity, 1 entity/diagnostic, 7 diagnostic/diagnostic |
| Focus Source, depth 3, Dagre entities     | 0                                                                |
| Focus Source, depth 3, after diagnostics  | 3 entity/diagnostic                                              |
| Existing fallback grid                    | 0                                                                |

In All, the ambiguous Note diagnostic intersected `folder-a/Note.md`. One
browser measurement put the File at `(666.82, 151.6, 174.35, 51.41)` and the
diagnostic at `(693.65, 151.6, 165.41, 46.94)` in scaled screen pixels.
In Focus, the measured final pairs were Nested/ambiguous Note,
Nested/invalid ../Outside, and Target/ambiguous Note.

These establish actual rectangle collisions (classes A/B/C in the plan).
The compact duplicate Files also had indistinguishable title-only labels
(class F). The diagnostic's existing layered ambiguity border resembled
another card (class E), but no independent decorative collision was established.
No generic Dagre spacing or decorative status treatment was changed.

## 5. Immediate seed correction

The existing depth assignment is retained. Each column uses its maximum actual
node width; rows use the sum of actual heights. Clear gaps are 58 px between
columns and 24 px between rows. Deterministic ordering and final root
normalization keep the root at `(0, 0)` with complete finite coordinates.
Complexity is O(nodes + edges + sorting). No DOM measurement or new worker is
used for this immediate seed.

## 6. Final diagnostic placement

Dagre still receives only entities, with unchanged layout options. A
renderer-owned spatial occupancy index reserves every entity rectangle.
Diagnostics are ordered by source and ID; every accepted diagnostic is then
reserved too. Collisions move the candidate below occupied bottoms. After
32 blocked candidates, a new column beyond the occupied right edge guarantees
termination. Missing-source diagnostics use a deterministic outer lane.

The geometry utility validates finite positive rectangles, supports
non-negative clearance, distinguishes touching from positive-area overlap,
and sorts overlap pairs deterministically. The documented 16 px clearance
allows two 7 px outlines plus 2 px space. It runs during layout adoption,
not hover/selection/pan/zoom.

## 7. Geometry evidence after changes

| Graph / check                                     | Nodes | Seed overlaps | Adopted overlaps | Fallback overlaps |
| ------------------------------------------------- | ----: | ------------: | ---------------: | ----------------: |
| Synthetic All, Files only                         |    13 |             0 |                0 |                 0 |
| Synthetic Focus Source, depth 3                   |    12 |             0 |                0 |                 0 |
| Delayed fake-worker mounted React Flow regression |    11 |             0 |                0 |               n/a |

The All seed entry above exercises the shared packing function; the product's
immediate seed is used by Focus Hierarchy. Synthetic checks use an independent
exhaustive oracle. Mixed dimensions (including a 340 px wide card), 240
diagnostics across 13 entities, missing sources, reversed input edge ordering,
and extended/compact fallback grids also pass clearance checks.

The fake-worker test holds a promise unresolved, verifies every rendered seed
rectangle while Updating layout is visible, resolves a real Dagre output,
and verifies the adopted rectangles. It does not depend on catching one frame.
Production browser measurements found zero pairs in All (13), Focus depth 3
(12), and exact Block Focus with a Visual Group and selection (15).

## 8. Duplicate compact File labels

The two compact candidates display `Note · folder-a` and `Note · folder-b`.
The suffix uses the existing shortest unique parent-folder computation, with
no resolver changes. It occupies a small second line within the unchanged
156 × 46 px card; a one-line attempt clipped the distinguishing suffix and
was rejected during browser QA. Unique Files stay title-only; extended cards
and compact Heading/Block presentation are unchanged. Full paths remain in
the accessible name and title. Root/nested/unique cases have rendering tests.

## 9. Cache and performance

The private local-structured fingerprint version changes from 1 to 2.
It still excludes labels, queries, camera state, and selection. There is no
public schema change or new CI timing threshold.

Median milliseconds from the existing local renderer benchmark:

| Profile / phase                    | Before |  After |
| ---------------------------------- | -----: | -----: |
| Small: deterministic seed          |  0.015 |  0.020 |
| Small: Dagre worker equivalent     |  4.866 |  5.313 |
| Small: apply + root normalization  |  0.018 |  0.056 |
| Medium: deterministic seed         |  0.050 |  0.058 |
| Medium: Dagre worker equivalent    | 23.741 | 23.828 |
| Medium: apply + root normalization |  0.075 |  0.212 |

Adoption now pays for collision reservation but remains below 0.3 ms on these
profiles. An earlier run overlapped Rust compilation and was discarded as
contended; the table uses the uncontended rerun. `benchmark:performance` small
also completed. Existing highlight operation tests preserve zero additional
layouts for hover/selection; HIER0 does not change pan/zoom handlers.

## 10. Accessibility and responsive QA

Production browser QA exercised the disclosure with Enter, verified
`aria-expanded`, labelled checkbox state and experimental/recovery layout
names, and used the full paths on both Note candidates. At a verified
640 × 480 viewport, the page had no horizontal overflow and the final
Experimental checkbox remained reachable through Settings scrolling in both
normal and maximized layouts. Also inspected at 1000 × 600. Focus/selection,
Visual Group accents, and diagnostic ambiguity treatments remain visible.

## 11. Checks, browser QA, and native release gate

Automated/local checks run:

- `pnpm install --frozen-lockfile`
- Renderer and web typechecks and focused Vitest suites
- `pnpm benchmark:local-renderer -- --profile small`
- `pnpm benchmark:local-renderer -- --profile medium`
- `pnpm benchmark:performance -- --profile small`
- `pnpm check` (format, lint, recursive typecheck, tests, production build)
- `pnpm desktop:check`
- `pnpm desktop:build`
- `git diff --check`

After integrating PR #51, the full suite reported 123 passing files and 1,073
passing tests. The repeated desktop check passed; the repeated optimized build
produced `apps/desktop/src-tauri/target/release/icarus-graph-explorer-desktop.exe`.

Production browser QA covered default gate, enable without switching, true
and false reload persistence, disable while active, Focus availability,
Search Heading/Block selection, Inspector/breadcrumb navigation, Focus exit,
Back/Forward normalization, actual rectangles, duplicate labels, short/narrow
Settings, and maximization. The normal production tab reported no console
errors. A separate loopback static server deliberately returned HTTP 503 for
the All Network chunk: recovery Hierarchy rendered with the experiment Off.
The expected failed import was explicit in the UI. That temporary harness is
outside the repository and is not application instrumentation.

**Native release interaction QA: passed.** On 2026-09-03, the user reported
that the complete release checklist passed against the current optimized
executable:

1. Start with a clean preference profile; verify All Network only and normal
   Focus Hierarchy availability.
2. Enable/disable the experiment, restart for both values, and verify active
   disable recovery and saved preferences.
3. Inspect Source, both Note candidates, selected ambiguity, and disclosure
   with real pointer and keyboard input; verify no card collisions.
4. Check Network touchpad behavior and VISUAL1A. Check the preserved VISUAL1B
   Network size control after integrating PR #51.
5. While Focus Hierarchy is open, update/remove its root only in a disposable
   synthetic vault and verify safe live recovery. Inspect normal runtime
   console output where available.

PR CI passed before this QA record update. The resulting documentation commit
must pass its fresh CI before merge; post-merge CI and cleanup remain separate
gates.

## 12. Changed files and ownership

- Application policy: `exploration-model.ts`, `navigation-history.ts`,
  `components/GraphExplorer.tsx`.
- Product controls: `components/ExplorationControls.tsx`,
  `components/GraphSettings.tsx`, `preferences/graph-preferences.ts`.
- Renderer geometry/presentation: `geometry.ts`, `layout.ts`,
  `local-structured-layout.ts`, `nodes.tsx`, `styles.css` in renderer-reactflow.
- Tests: application hydration, preferences, controls, real availability
  transitions, sample geometry, renderer geometry, compact labels, and
  delayed-worker seed adoption. Existing App assertions explicitly opt in
  only where they test whole-vault Hierarchy behavior.
- Documentation: closest application/components/preferences/renderer READMEs,
  `ARCHITECTURE.md`, `PRODUCT_QUALITY_AUDIT.md`, and this report.
- The exact approved prompt is archived under `history-implementations/`.

## 13. Dependencies

External additions from HIER0: **zero**. No manifest, lockfile, or Dagre version
change. DOM tests use the happy-dom dependency already merged by PR #53.
No parser, resolver, canonical model, sample-report, or source-write change.

## 14. Concurrent and user-owned work

PR #51 was left untouched by this task and subsequently merged by its own
workflow. HIER0 integrated it and preserves `usePresentationOverrides`, both
Network renderer props, and Network Explorer's size controls. PR #54 and its
worktree remain separate. No unrelated worktree, AGENTS.md, or ROADMAP edit
was made by HIER0. The prompt archive matches the supplied file byte for byte.

## 15. Follow-up

Pass the fresh PR CI, merge, verify post-merge CI, and clean up this task's
branch/worktree. HIER1 — Focus Schematic model + quality harness — is the next
planned task; it was not started.
