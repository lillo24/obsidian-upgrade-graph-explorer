# MOVE1B QA correction implementation

## Outcome

The draft MOVE1B branch now treats temporary File movement as an ordinary
interaction in every supported, ready All or Focus Network. There is no Edit
Network or Move Files prerequisite. The explicit All-only Arrange Folders tool
still owns saved Pull/Place/custom-scope editing, and the Network Explorer keeps
the keyboard Move File action and failure Retry Move path.

Release continuity is corrected in the browser client without changing the
Worker scheduler, ForceAtlas2 assignments, Pull cadence, or convergence rules.
The user-approved held-drag path remains immediate and exact.

## Confirmed release diagnosis

Deterministic baseline probes established two contributors and ruled out a
state reset:

| Fixture | First canonical cooling endpoint, maximum graph displacement | Four eager endpoints before one display opportunity |
| --- | ---: | ---: |
| Focus chain | 32.56 | 34.70 |
| Focus star | 42.68 | 50.13 |
| Focus single isolate | 35.80 | 38.08 |
| All cross-reference | 20.62 | 40.03 |
| All Place layer | 14.74 | 16.88 |

For every fixture, `handle(end)` was coordinate-identical to the last hot state.
Release caused no remount, seed initialization, finite-layout/cache restoration,
camera write, automatic-M2 reapplication, or Place translation recomposition.
The first physical 32-iteration endpoint can nevertheless be large, while the
zero-delay Worker can publish several valid endpoints before one browser paint.
The prior newest-only display adoption therefore made valid physics look like a
single jump. A failing baseline regression reproduced `x=11 → x=50` when three
cooling frames arrived before the next animation callback.

The final pending pointer target remains flushed before `end`. The worker's last
raw position may still trail the exact immediate File preview; this is expected
transport lag, not a rollback.

## Correction

The browser client now keeps raw and presented positions separate:

- exact validated Worker frames continue to feed raw canvas state, future seeds,
  convergence, and physics composition;
- hot frames preserve newest-target overlay and lagging-neighbor adoption;
- cooling presents only the newest valid raw target from the last actually
  displayed coordinates, with one current/target pair and no frame queue;
- elapsed-time cubic smoothstep uses displacement relative to seed RMS scale,
  has no minimum duration, and is capped at 120 ms per catch-up target;
- exact raw final coordinates are presented before the display scheduler stops;
- re-grab immediately makes the held File exact and bridges other visible nodes
  for at most 80 ms;
- reduced-motion adopts raw results directly;
- re-grab, cancellation, failure, invalidation, and disposal cancel obsolete
  presentation work.

Raw lifecycle and presentation `idle`/`settling` state remain distinct. React
receives only coarse status changes; whole-graph coordinates stay on imperative
client/canvas/session paths. The existing schema-2 interaction revision,
gesture/File identity, receipt/adoption validation, bounded update queue,
full-batch convergence, root-drift guard, Pull, Place, M2, camera, cache, and
persistence boundaries are unchanged.

## Browser evidence

Ignored instrumentation on the production Worker/client/Sigma path used a fixed
1280×720 viewport and fitted camera. It recorded raw receipt, presentation, and
Sigma `afterRender` screen coordinates, then was removed before the clean build.

| Measurement | Direct-adoption control | Corrected All | Corrected Focus |
| --- | ---: | ---: | ---: |
| Last drag preview → immediate release | 0 | 0 | 0 |
| First presented cooling displacement | 14.40 graph units | 0 | 0 |
| First corresponding Sigma displacement | 190.84 px | 0 px | 0 px |
| Rendered displacement p95 / max | 190.84 / 190.84 px | 23.92 / 26.91 px | 39.21 / 39.21 px |
| Render gap p95 / max | 18.3 / 18.3 ms | approximately 20 / 20 ms | 19 / 19 ms |
| Release → raw sleep | 111.5 ms / 640 iterations | 226.5 ms / 1,344 iterations | 70.9 ms / 448 iterations |
| Release → exact presented result | 126.4 ms | 356.9 ms; Sigma render 374.4 ms | 200.2 ms |
| Trace raw → presentation counts | 21 → 7 post-release | 56 → 26 for the full gesture; 20 cooling/sleep presentations | 15 → 11 post-release |

The control intentionally disabled catch-up on the same production client to
isolate presentation sampling. Pixel values are fixture/camera observations,
not universal limits. The corrected first visible release frame is continuous;
later steps show the accepted graph traveling rather than hiding the physical
motion. A clean production build then passed direct All and Focus drags,
Arrange-Folders enter/Done/exit, and console-error smoke checks with no QA query
code present.

The Arrange smoke check also caught and fixed one direct-toolbar boundary bug:
React's click event was reaching the optional folder-key argument. The control
now invokes the zero-argument entry explicitly, and a regression asserts that
toolbar entry begins with no active folder rather than treating the event as a
folder identity.

## Validation

- `pnpm install --frozen-lockfile` — passed.
- Focused direct-interaction/client regressions — 4 files, 55 tests passed.
- `pnpm exec vitest run packages/renderer-sigma` — 54 files, 382 tests passed.
- `pnpm exec vitest run apps/web` — 65 files, 504 tests passed.
- `pnpm analyze:physics1` — passed; all 100-node Focus, All, and All-with-Pull
  probes slept.
- `pnpm benchmark:file-move` — passed; 10,000 pointer samples remained bounded
  to three emitted commands.
- `pnpm benchmark:local-renderer -- --profile small` — passed.
- `pnpm benchmark:global-renderer -- --profile small` — passed.
- `pnpm benchmark:global-renderer -- --profile medium` — passed.
- `pnpm check` — passed: formatting, lint, all workspace typechecks, 205 test
  files/1,701 tests, and the production Web build.
- `pnpm desktop:check` — passed: Rust formatting and `cargo check`.
- `pnpm desktop:build` — passed with a fresh optimized executable.
- `git diff --check` — the implementation diff passes when the exact prompt
  archive is excluded. The full committed range reports only the two
  source-authored Markdown hard-break spaces on prompt lines 5–6; removing them
  would violate the required byte-for-byte normalized archive.

## Product boundary and remaining acceptance

Direct movement remains fail-closed above 100 visible simulation nodes, with a
reachable explanation and no Worker construction. The analyzer exercised the
exact 100-node boundary in Focus, All, and All-with-Pull; the bundled production
browser fixture is smaller, so 100-node browser interaction remains in the
native checklist rather than being inferred from Node or renderer benchmarks.
The earlier saved-Pull browser fixture also preserved the last valid graph and
surfaced Retry Move on a genuine cooling-cap failure. Place was covered by the
deterministic release fixture and existing integration suites.

Native QA remains pending. The fresh optimized Windows executable is
`apps/desktop/src-tauri/target/release/icarus-graph-explorer-desktop.exe`
(11,491,840 bytes, SHA-256
`A1FC4F785DD998C98C041FF0839BCC3DA3E82B08C9A0788F820C27C5F4BE4543`). It
was built from the validated working tree immediately before its two focused
commits; those commits contain the same source. PR #80 must remain draft and
unmerged until the user explicitly accepts it; PIN1 has not started.
