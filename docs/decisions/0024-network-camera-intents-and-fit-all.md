# 0024 — Network camera intents and Fit all

Status: accepted for implementation and browser/native QA; amends ADR 0021's
Fit framing policy.

## Decision

The visible **Fit** action and the fresh-source startup Fit mean **Fit all**:
after the latest authoritative displayed coordinate generation is committed,
the Network session rebases Sigma's presentation extent to every displayed node
and resets the camera to the full-view ratio of `1`. Sigma's 24 px stage padding
matches the maximum supported Network node radius, so node circles remain inside
the stage. Labels are opportunistic and are not part of the fit guarantee.

Fresh Global and Local mounts use one authoritative initial-presentation
transaction. Deterministic seeds and intermediate base geometry remain valid
solver input, but the Sigma surface and its controls stay withheld until the
current accepted geometry has rendered, replaced any provisional `customBBox`,
and applied the startup Fit All camera. Global binds that transaction to the
same topology/layout/Pull/Place generation that gates Center and Fit; Local binds
it to the accepted layout generation. An exact cache hit takes the same commit
path without requesting new layout work.

If manual camera input supersedes the startup Fit, the transaction still makes
the final extent authoritative but restores the raw graph-space center, scale,
and angle across the normalization change. Once the first presentation is
committed, later layout, spatial editing, live update, and movement frames keep
their existing camera-neutral behavior and never rebase merely because geometry
changed.

Density framing remains a separate composition control. Its 0–150% preview may
choose a tighter or looser ratio while preserving the current semantic screen
anchor; Fit never reads that density ratio.

Global final-geometry readiness is generation-specific across topology,
automatic layout, Dynamic Pull, and fixed Place composition. Center and Fit
wait for the current generation rather than accepting any prior spatial commit.
If the generation changes while an animated Center is in flight, the old attempt
is not acknowledged as complete and the still-current request is retried against
the new final geometry.

Camera commands are consumable application intents. Global and Local Network
canvases acknowledge completed Center and Fit requests so a remount cannot replay
them. A newer semantic Center or explicit Fit replaces the older pending camera
intent. A fresh-source automatic Fit additionally yields immediately to newer
manual wheel, drag, touch, density, zoom, or arrangement camera ownership.

Two-finger pan is calculated entirely in Sigma framed coordinates. Wheel line
and page deltas are first converted to CSS pixels on both axes; raw Graphology
distances never enter camera `x` or `y`.

## Consequences

- Outlier node circles remain visible after startup Fit and explicit Fit.
- Density framing can still intentionally trade peripheral visibility for a
  different composition, but it is no longer mislabeled as Fit.
- All → Focus/Hierarchy → All cannot replay a completed Global startup Fit or
  Center request.
- Search, history restore, and Fit wait for the latest final Global geometry.
- Manual navigation during slow startup cannot be overwritten by the queued
  automatic Fit.
- Pan sensitivity is independent of raw graph extent, camera angle, and wheel
  delta mode.
- An immediate explicit Fit after untouched startup is idempotent: it reuses the
  already-authoritative extent and camera target.
- All and Focus Network use renderer-local icon viewport controls for zoom, Fit,
  and the app-owned maximize/restore action. Arrange Folders remains a separate
  tool. The tiny SVG paths are duplicated from the established Hierarchy visual
  language to avoid a Sigma-to-React-Flow dependency.
