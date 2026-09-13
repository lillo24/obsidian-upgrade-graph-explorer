# SAVEDUX1 implementation report

Status: **implemented, locally and production-browser validated, built as an
optimized Windows executable, and accepted by PR CI; native visual/interaction
acceptance remains gated.**

Implementation branch: `codex/savedux1-saved-view-transition`

[Draft PR #100](https://github.com/lillo24/obsidian-upgrade-graph-explorer/pull/100)
is the isolated integration vehicle.

The branch was created from `main` commit
`eb7d8006e4881a32d06547a4752109cff058e838` in a dedicated worktree. The
integration PR remains draft until the native checklist below is accepted.

## Visual design

The retained effect is a 360 ms dark ink/glass acknowledgement over the actual
graph stage. Eight small, statically clipped shards retract toward the stage
center while the Saved View name performs a restrained anticipation and exits
right above the subtitle **View loaded**. The React surface remains mounted for
390 ms so the final CSS frame completes before cleanup.

At widths up to 420 pixels, two shards are hidden and the copy width contracts.
Long names remain on one line and use ellipsis. The effect uses the existing
graph-stage positioning context in normal and maximized modes, so it neither
changes layout dimensions nor assumes that screen center is graph center.

## Trigger and readiness semantics

- Explicit quick-switch and manager Apply both use the existing shared Apply
  transaction. The transition is emitted only after validation, durable profile
  work, semantic adoption, history/selection handling, and the existing success
  announcement complete. A failed Apply emits nothing.
- Startup uses the existing exact derived matching truth after synchronous
  Current View, preference/spatial, and Saved View hydration. A session-only ref
  permits at most one startup presentation for the keyed source session. It does
  not reapply the view, write storage, or request graph work. An unmatched
  Current View emits nothing.
- The product-transaction seam was chosen because there is no narrower shared
  final-renderer-ready signal worth coupling this decorative effect to. The
  short overlay naturally covers the beginning of accepted layout adoption
  without polling, blocking Apply, or changing renderer protocols.

No active Saved View identity or animation bookkeeping is persisted.

## Accessibility and reduced motion

The overlay is `aria-hidden="true"`, contains no focusable controls, and has
`pointer-events: none`. It does not add a live region or duplicate the existing
Apply announcement.

`prefers-reduced-motion: reduce` removes every shard and replaces title,
subtitle, and plate motion with a 180 ms opacity-only acknowledgement. Focused
tests inspect that rule directly. The available production-browser control did
not expose media-preference emulation, so that branch was not visually captured
in Chromium and remains covered structurally rather than claimed as an
interactive browser observation.

## Performance and lifecycle

- Mounted DOM: 13 elements total: one overlay, one shard container, eight shard
  spans, one copy container, one title, and one subtitle. At 320 pixels, six of
  the eight shards are displayed.
- Animated CSS properties: `transform` and `opacity` only. Polygon clips and
  gradients are static.
- No Canvas, WebGL animation, particle system, SVG morph, blur,
  `backdrop-filter`, animated shadow, dependency, `requestAnimationFrame`, JS
  frame loop, readiness polling, or animation queue was introduced.
- One bounded timeout removes the overlay. Replacing a transition clears the
  old timer; the parent's monotonic token check also prevents a stale completion
  from removing newer content.
- Integration instrumentation records zero projection, layout, spatial-worker,
  camera, or persistence work caused by the visual state change. Exact Apply and
  startup operation snapshots remain unchanged around the transition itself.

## Production-browser QA

QA used the minified Vite production build with the real graph renderers.

- Normal 1280×720, large 1600×1000, 320×640, and maximized graph surfaces
  passed. The overlay rectangle matched the graph-stage rectangle in each mode;
  the narrow viewport had no horizontal overflow.
- All Network, Focus Network, and Focus Hierarchy were exercised. Experimental
  All Hierarchy was unavailable in the Synthetic Sample; the overlay has no
  renderer-mode branch and existing four-way Saved View behavior remains under
  integration coverage.
- Quick switches A → B, B → A, rapid A → B → A, and manager Apply all showed the
  truthful final name. Rapid switching left one overlay with the latest token.
- Short names and the 59-character
  `All network — architecture and unresolved references overview` were tested;
  the long title stayed bounded with ellipsis.
- Zoom was clicked successfully while the overlay was active. The overlay kept
  `pointer-events: none`, and focus remained on the actual control.
- The Saved View control remained immediately left of Search with an 8-pixel
  desktop gap. Neither control moved during the transition.
- Reload restored an exact matching Saved View without an Apply announcement or
  write. The 390 ms startup overlay is directly asserted by integration tests;
  the automation's navigation wait outlasted it, so no startup screenshot is
  claimed.
- A deliberately unmatched Current View reloaded to **Current View** with zero
  overlays.
- Toggling Unresolved created no transition, kept the shell and graph stage
  visible, and did not reproduce the prior white screen.
- Browser warnings/errors after the full pass: zero.

## Validation

- `pnpm install --frozen-lockfile`: passed; no dependency or lockfile change.
- Focused transition and Saved View integration suites: **2 files / 31 tests
  passed**.
- `pnpm exec vitest run apps/web`: **96 files / 717 tests passed**.
- `pnpm check`: formatting, lint, all workspace typechecks, **261 files / 2,097
  tests**, and the minified production web build passed.
- `pnpm desktop:check`: Rust formatting/check and **16 tests passed**.
- `pnpm desktop:build`: optimized Windows no-bundle build passed.
- Optimized executable startup smoke: remained alive for five seconds, then the
  exact smoke process was stopped.
- `pnpm benchmark:global-renderer -- --profile small`: passed.
- `pnpm benchmark:local-renderer -- --profile small`: passed.
- `git diff --check`: passed before this report and is rerun during final
  inspection.
- PR #100 CI at head `7f50332`: `validate` passed in 2m42s and `desktop` passed
  in 6m30s. This CI-evidence-only documentation follow-up is validated on its
  own resulting head before handoff.

Fresh optimized executable:

```text
C:\Users\leona\Documents\GitHub\icarus-graph-explorer-savedux1\apps\desktop\src-tauri\target\release\icarus-graph-explorer-desktop.exe
SHA-256: 7B8196787DBC67D8C923399AA1566591E398E38EF9E4315FEE1167273895ABAC
Size: 13,527,552 bytes
Built UTC: 2026-09-13T12:16:04.6684055Z
```

## Native acceptance gate

Native computer control is disabled in this environment. The optimized build
and startup smoke passed, but physical WebView motion, pointer/keyboard input,
and perceived smoothness are not recorded as passing. The PR therefore remains
draft for this checklist:

1. Open a vault whose Current View exactly matches a Saved View; confirm one
   quick load animation.
2. Switch Saved View A → B; confirm a fast animation with no lag.
3. Switch B → A quickly; confirm the latest animation wins with no stacking.
4. Pan or zoom immediately; confirm interaction stays smooth.
5. Toggle Unresolved or Ambiguous once; confirm no animation and no white
   screen.
6. Confirm Saved View remains immediately left of Search.

## Files changed

Product orchestration and presentation:

- `apps/web/src/components/GraphExplorer.tsx`
- `apps/web/src/components/SavedViewTransitionOverlay.tsx`
- `apps/web/src/App.css`
- `apps/web/src/components/README.md`

Regression coverage:

- `apps/web/src/components/SavedViewTransitionOverlay.test.tsx`
- `apps/web/src/components/saved-views-integration.test.tsx`

Documentation and traceability:

- `docs/PRODUCT_QUALITY_AUDIT.md`
- `docs/ROADMAP.md`
- `history-implementations/SAVEDUX1_lightweight_saved_view_transition_animation_codex_prompt.md`
- `history-implementations/SAVEDUX1_implementation_status.md`

## Dependencies and fallback decision

No dependency was added, removed, or updated. The static jagged retract effect
was retained because production-browser QA found it stable, bounded, responsive,
and non-blocking; the text-only fallback was not needed.

The supplied prompt is archived byte-for-byte with SHA-256
`16A80DC3F6B4C2E7623260B2EF1764FD6FCD04CED015E9F1C0D55A6D0003F280`.

## Remaining separate work

- Native acceptance, merge, post-merge CI, and task worktree/branch cleanup.
- Automatic last-vault reopen, PIN1, and AUTO1 remain separate and were not
  started.
