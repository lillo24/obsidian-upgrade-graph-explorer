# 0021 — Camera-neutral Network geometry adoption

Status: accepted for camera-neutral coordinate adoption; its density-based Fit
policy is superseded by ADR 0024.

## Decision

Density measurement and camera framing are separate operations. Global and
Local Sigma sessions may apply automatic density framing once for a fresh
initial presentation. Every later authoritative coordinate adoption updates
the stored density decision but preserves the already-presented raw graph-space
viewport center, visual scale, and angle.

Explicit Fit, Density framing, semantic navigation/center, restored viewports,
and user pan/zoom remain camera-owning actions. Fit does not grant the next
geometry result permission to reframe.

The implementation uses a shared one-shot position-camera intent policy and
FLICKER1's existing pre-mutation atomic transaction. The first accepted
presentation establishes a Sigma custom bounding box. Later coordinate
adoption keeps that presented normalization extent and camera x/y/ratio/angle
unchanged, so preserving the raw frame requires no derived camera write and
cannot run into Sigma's bounded ratio. ADR 0024 now defines explicit and startup
Fit as a full-view ratio after rebasing the extent; Density remains separate.

## Consequences

- Re-layout and physics-setting order can move nodes but cannot reframe an
  already presented graph.
- Dynamic Pull, Fixed Placement, removal, reset, and cache-hit adoption retain
  their raw-frame contract through the stable presented extent.
- Density evidence remains current for the next explicit Fit or Density action.
- Topology transitions retain FLICKER1's survivor/semantic fallback policy.
- Repeated finite ForceAtlas2 geometry drift is left to CONVERGENCE1C.
