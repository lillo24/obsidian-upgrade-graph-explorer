# VISUAL1B implementation checkpoint

Status: **Draft — independent foundation implemented; shared action UI and QA pending.**

Baseline: `main` at `d7107e5` (KG14B2, PR #50). KG14B3 action-menu work was active
in a separate checkout during this implementation. That checkout and its branch
were left untouched. This draft deliberately does not introduce a competing
row/context menu and must not merge as a completed VISUAL1B feature.

## Implemented

- Source-neutral `presentation-overrides` package: strict v1 registry,
  deterministic serialization, duplicate/unknown-field/bounds validation,
  pure mutation and sparse canonical-Document reconciliation.
- Separate workspace persistence and keyed app sessions: stable identities
  save locally; samples/transient reports remain session-only. Corrupt values
  are untouched and edits blocked; failed saves retain confirmed sizes.
- All Network formula: `clamp(automatic VISUAL1A size × scale, 2, 24)`.
  Focus Network: existing File/root base × scale with the same cap and a root
  minimum of 8.4. Custom scales range from 0.5 to 2.5; Auto removes the entry.
  Headings, blocks, diagnostics, Hierarchy, and group-color precedence are
  unchanged. Final sizes enter normal layout requests and fingerprints.
- Controlled, accessible Auto/Custom editor content, ready for the shared menu.
- No external dependency added; one internal workspace package. No new cache,
  coordinates, hidden registry, projection policy, or view-state schema change.

## Validation so far

- Frozen-lockfile install, full `pnpm check`, and `pnpm desktop:check` passed.
- Full repository suite: 931 tests across 106 files passed.
- 52 focused tests pass for registry/session/editor/mapping/identity behavior.
- Small Global and Local renderer benchmarks passed. Local evidence (not CI
  thresholds): 100-node All mapping median 0.281 ms; 13-node Focus topology
  mapping median 0.015 ms. These benchmark runs use the existing Auto path;
  a 10,000-entity operation-count test separately proves sparse override lookup.
- `pnpm desktop:build` passed and produced an optimized Windows executable.
- CI results will be recorded before handoff.
- Browser/native interaction QA **not run or passed** for this incomplete UI.

## Remaining gate

1. Update onto merged KG14B3 and reuse its single action menu and canonical row
   EntityId seam. Add File-only Size, custom indicator, and safe editor lifetime
   and focus behavior without changing selection/centering semantics.
2. Test right-click/button/keyboard equivalence, virtualized target removal,
   query Hide/unhide preservation, sidebar reopen and All/Focus reuse.
3. Run completed-feature browser/release native QA, rerun checks and CI, then
   merge only when the gates pass. Native interaction is manual user QA.

Manual positions/pinning (SPATIAL1), Saved Views, Adaptive Layout, per-heading
sizes, and other presentation overrides remain parked.
