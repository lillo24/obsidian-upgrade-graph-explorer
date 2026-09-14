# NETWORKVIEW1B startup viewport diagnosis

Diagnosis recorded before the production behavior change on 2026-09-12.

## Root cause

The transient `.network-editing-controls__status` element participates in the
wrapping `.graph-toolbar` layout. At widths where that text occupies another
line, the transition from `simulation-not-running` (`Waiting for Network
layout…`) to `available` removes content and changes the toolbar and graph-stage
heights. If capability adoption occurs after the surface reveal, the unchanged
Sigma camera and normalization frame are projected into a physically different
surface, producing the reported small slide/zoom.

## Measured event order

An optimized Synthetic Sample browser build at 1280×720 was run with the
opt-in startup trace. The normal run removed the status before reveal, so its
46.4 px shell shift was hidden and the reveal-to-+500 ms interval was stable.
The QA-only capability-adoption seam then delayed only the same real status
transition by 150 ms:

```text
t=98.2 ms   surface reveal
             toolbar 105.6 px; stage/surface y=160.0, height=560.0 px
             status="Waiting for Network layout…"
t=228.4 ms  status removed
             toolbar 59.2 px; stage/surface y=113.6, height=606.4 px
t=229.0 ms  ResizeObserver reported the surface change
```

The exact element/state transition therefore changed toolbar height by
-46.4 px and stage/surface height by +46.4 px. The surface top moved -46.4 px.

## Camera, normalization, geometry, and visual deltas

Across that post-reveal transition:

```text
camera                    (0.5, 0.5, ratio 1, angle 0) → unchanged
customBBox x              [-26.48108296, 2.77567237] → unchanged
customBBox y              [-2.20271438, 27.88213656] → unchanged
representative raw x/y    unchanged for all five Synthetic Sample nodes
Global LOD                regional → unchanged
automatic Fit/Center      none after reveal
normalization rebase      none after reveal
```

The renderer still reported 1280×560 at the first post-shift samples while its
surface DOM rect had already become 1280×606.4. That mismatch makes the
physical projection change visible without any logical camera or node change.

At 1440×900 the status fit without increasing toolbar height (59.2 px both
before and at reveal). At 390×844 the natural status transition reduced the
toolbar from 316.8 px to 264.8 px and increased the stage from 464.8 px to
516.8 px, but the normal worker ordering completed that transition before the
measured reveal. This confirms the issue is width- and ordering-dependent.

## Rejected hypotheses

- No second automatic Fit or Center occurred after reveal.
- `customBBox` and the live graph extent did not change after reveal.
- Final node coordinates did not change after reveal.
- LOD did not transition after reveal.
- The optimized browser emitted no window-resize event in the observation
  window. Native startup still needs a separate smoke/report, but a native
  resize is not required to reproduce this race.

## Fix boundary

`NetworkEditingControls` owns the transient readiness/status presentation, and
the web shell owns toolbar participation. The smallest correct fix is to keep
that status accessible and visible while presenting it as a bounded overlay
below the stable toolbar shell that cannot change toolbar flow or cover wrapped
controls. No delayed second Fit or fixed startup wait is needed.

## Post-fix verification

The same optimized 1280×720 delayed-capability reproduction passed for 514.7 ms
after reveal with zero camera commands, camera delta, customBBox change, raw-node
delta, shell/renderer delta, screen-node delta, LOD change, or window resize.
The status remained visible across the delayed transition while toolbar height
stayed 59.2 px and stage height stayed 606.4 px.

The responsive delayed-startup matrix also passed at 1440×900, 900×720, and
390×844. At the 900 px wrap breakpoint the stable toolbar/stage heights were
105.6/560.0 px; at 390 px they were 264.8/516.8 px. A 900 px visual check with
the QA status held for two seconds confirmed that the badge floats below the
toolbar without obscuring wrapped controls.

The exact-cache All remount exposed one independent one-shot ordering issue:
an initial semantic viewport restored the anchor before reveal, then the same
Center request replayed 0.3 ms after reveal. Although its measured movement was
only 0.000153 px, the canvas now recognizes the matching anchor/ratio as already
satisfied and consumes the request. The cached trace now passes for 513.1 ms
with one reveal and all stability deltas zero. Untouched startup followed by an
explicit Fit is likewise idempotent: camera, customBBox, raw nodes, and viewport
node positions all have zero delta.

An explicit 1280→1100 px user resize during the observation window correctly
failed the ordinary fixed-viewport oracle (180 px shell/renderer delta and one
window-resize event), but caused no camera command, customBBox change, or raw-node
change. This distinguishes legitimate later reflow from startup instability.
Optimized Chrome at 1536×791 and DPR 1.25 passed the 510.7 ms trace with a clean
warning/error console.
