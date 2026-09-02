Implement a small interaction milestone: NETWORKZOOM1 — smoother, finer-grained Network wheel zoom.

Repository: lillo24/icarus-graph-explorer

First sync and inspect actual latest main. At prompt-writing time main is:
ce256cd6b89bebf0b1288af3dff6fb0045ae9b5b

Do not overwrite newer concurrent work. Read AGENTS.md and inspect the current Network/Sigma zoom implementation and tests before changing anything.

Problem
========

In Network layout, ordinary wheel zoom feels much too coarse: one wheel increment changes zoom by a visibly large step.

Hierarchy/React Flow feels substantially smoother and more gradual.

This is NOT asking to make zoom slower in every circumstance. The goal is:

- coarse mouse-wheel/notch input → smaller, more gradual zoom steps;
- precision touchpad input → retain smooth high-resolution behavior;
- pinch/Ctrl-wheel behavior → do not regress;
- pointer anchoring → remain correct;
- zoom direction → unchanged;
- zoom in/out symmetry → remain sensible;
- All Network and Focus Network → consistent because they share the Sigma precision-wheel helper.

Current relevant code includes:

packages/renderer-sigma/src/precision-wheel-zoom.ts
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/local-session.ts
packages/renderer-sigma/src/interaction.test.ts

Also inspect the React Flow reference behavior:

packages/renderer-reactflow/src/viewport-navigation.ts
packages/renderer-reactflow/src/GraphCanvas.tsx

Do NOT blindly copy React Flow's formula. Use it only as a product-feel/reference comparison.

Current Sigma helper has roughly:

LINE_HEIGHT_PIXELS = 16
MAX_EVENT_DELTA_PIXELS = 240
MIN_EVENT_DELTA_PIXELS = 0.5
GLOBAL_ZOOM_SENSITIVITY = 0.0017

and computes:

ratio × exp(deltaPixels × sensitivity)

Root requirement
================

Fix the perceived coarse stepping without damaging high-resolution wheel/touchpad input.

Before choosing constants, inspect the actual event normalization assumptions.

Important: do not assume coarse mouse wheels always arrive as deltaMode=1.

On Windows/browser/Tauri they may also arrive as larger repeated deltaMode=0 events.

Therefore a solution that merely changes:

LINE_HEIGHT_PIXELS = 16 → 8

is insufficient unless evidence/tests show that this covers the actual coarse input.

Prefer a bounded/nonlinear normalization strategy where appropriate:

small/high-resolution deltas
→ remain essentially linear and precise

large single-event/coarse deltas
→ compressed/capped to a smaller effective zoom step

The exact formula/constants are yours to choose after inspection and testing.

Do not create device sniffing or platform-specific hacks.

Desired product behavior
========================

For tiny trackpad deltas, preserve the existing ability to make tiny zoom changes.

For a typical mouse-wheel notch / coarse event, aim for a noticeably smaller step than today.

The exact number is not sacred, but visually one notch should feel like a small navigation increment, not jumping to a different scale.

A reasonable target for testing is approximately a 3–6% ratio change per ordinary coarse wheel notch rather than large ~10–20% jumps.

Do not force exact equivalence with Hierarchy's mathematical zoom ratio; match perceived granularity.

Keep zoom centered around the cursor exactly as now.

Do not introduce animation/inertia merely to hide large steps. Fix the input-to-ratio mapping itself.

Trackpad modes
==============

Preserve existing product semantics:

scroll-zoom mode:
ordinary wheel/trackpad vertical input zooms.

pinch-zoom mode:
ordinary non-Ctrl wheel input pans;
Ctrl/pinch wheel input zooms.

Do not change the preference schema or its UI.

Do not add a new zoom-sensitivity setting. This should be a corrected default interaction, not another user preference.

All Network + Focus Network
===========================

The shared helper is used by both Sigma Network presentations.

The fix should normally apply consistently to:

All + Network
Focus + Network

Do not fix Global while leaving Local/Focus Network with the old coarse behavior.

Do not change Network layout, projection, Graphology topology, ForceAtlas, selection, hover, Visual Groups, QUERY1, or semantic viewport persistence.

Operation invariant
===================

Wheel zoom remains a pure camera/high-frequency interaction.

It must cause:

projection +0
Graphology reconciliation +0
layout request +0
workspace work +0

Only camera/render/semantic viewport observation are expected.

Do not add React state updates per wheel event.

Tests
=====

Expand the pure interaction tests around precision-wheel-zoom.

At minimum cover:

1. Tiny delta remains nonzero and precise.
2. Multiple tiny pixel deltas scale smoothly.
3. Coarse deltaMode=1 wheel event is compressed to a modest step.
4. Coarse/high-magnitude deltaMode=0 event is also bounded/compressed appropriately.
5. Positive/negative equivalent deltas remain directionally symmetric.
6. Very large pathological events remain bounded.
7. Reversal-tail stabilization still works.
8. Zero/non-finite input remains safe.
9. Current min/max camera constraints remain the renderer's responsibility and still work.
10. All Network and Focus Network continue consuming the same normalization contract.
11. Zoom operation contract remains projection/reconciliation/layout = 0.

Avoid tests that simply assert implementation constants with no behavioral meaning.

Prefer assertions like:

coarse notch at ratio 1
→ next ratio is within a deliberate modest range

rather than only:

CONSTANT === X

If an existing test currently hardcodes GLOBAL_ZOOM_SENSITIVITY = 0.0017, update it only if the final design actually changes that constant.

Implementation preference
=========================

Do not globally reduce GLOBAL_ZOOM_SENSITIVITY as the first solution, because that may unnecessarily degrade precision touchpad responsiveness.

Prefer correcting coarse-event normalization/compression while retaining fine input resolution.

If profiling/manual evidence shows a small global sensitivity adjustment is also warranted, keep it minimal and justify it.

Do not add dependencies.

Do not change Sigma itself.

Do not use browser/OS device detection.

Do not introduce a custom animation loop.

Manual QA
=========

Build/run the actual optimized Windows desktop application.

Compare Hierarchy and Network using the same physical device.

Test separately:

A. ordinary mouse wheel if available;
B. precision touchpad two-finger wheel/scroll in scroll-zoom mode;
C. precision touchpad in pinch-zoom mode;
D. pinch/Ctrl-wheel zoom;
E. zoom in and zoom out;
F. cursor-point anchoring;
G. All Network;
H. Focus Network.

The main subjective gate is:

Network no longer jumps in large discrete-feeling zoom steps and is reasonably comparable in granularity to Hierarchy.

But also verify:

- tiny touchpad movements are still responsive;
- no jitter on direction reversal;
- no accidental pan/zoom ownership change;
- no camera reset;
- no layout restart;
- no new console errors.

If native QA requires my subjective confirmation before merge, stop at that gate and give me the executable path plus a very short checklist.

Validation
==========

Run focused Sigma tests and then normal repo gates:

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma
pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check

Run existing relevant renderer/interaction benchmarks if appropriate, but do not invent a timing gate for wheel sensitivity.

Update renderer documentation if it currently documents the accepted zoom constants/curve.

Archive this prompt under the repository's implementation-history convention.

Then commit, PR, CI, merge, post-merge CI, and cleanup according to repository workflow.

Do not start another KG14 milestone automatically.

Final report
============

Report:

- root cause;
- old normalization/step behavior;
- new normalization/curve;
- coarse-wheel behavior;
- precision-touchpad behavior;
- pinch behavior;
- whether both All Network and Focus Network use the fix;
- camera anchoring;
- operation-count invariants;
- tests;
- native QA;
- dependencies/schema changes (expected none);
- PR/merge/post-merge CI;
- any remaining interaction caveat.
