# SPACING1B Network density framing

Status: **NATIVE QA PENDING — atomic All/Focus camera commits, diagnostics, and automated gates are complete on draft PR #60.**

SPACING1B corrects Network occupancy at the camera layer. It does not change
canonical topology, projection, Global or Local ForceAtlas2, dynamic Pull,
fixed folder placement, presentation settings, layout identity, position
caches, or persistence. All and Focus use separate policies and separate
page-lifetime 0–150% Sandbox strengths because All is rootless and can have no
edges, while Focus has a semantic root and a bounded neighborhood.

## Installed All pipeline

```text
documents-only Global projection
→ Global mapping
→ automatic ForceAtlas2 positions
→ optional dynamic folder Pull
→ optional fixed folder-placement composition
→ confirmed displayed positions
→ Sigma 3.0.3 autoRescale
→ Global camera ratio
```

The Global decision is measured only when confirmed displayed geometry becomes
authoritative. Exact cache restoration, fresh/topology-reconciled layout,
dynamic Pull, and fixed/dynamic composition therefore describe what the user
sees. Arrange Folders pointer preview does not measure or reframe each frame;
confirmation refreshes the stored decision for the next automatic adoption or
Fit without stealing a user-owned camera.

A direct production-normalization experiment compares `P` with `0.5 × P` under
the same Global camera and reports a `0 px` maximum screen delta. As in Local,
Sigma auto-rescaling neutralizes uniform coordinate scaling. This evidence
selects camera policy B rather than changing ForceAtlas2 coordinates.

## All policy

The fixed reference frame is 1200×800 with 24 px stage padding. The rootless
policy measures:

- median nearest-neighbor pixels divided by representative node diameter,
  normalized by `24 / sqrt(nodeCount)`;
- optional median connected-edge pixels, normalized by
  `min(180, 90 + 15 × sqrt(nodeCount))`;
- p95 radius around the coordinate-wise median center, normalized by
  `min(520, 260 + 40 × sqrt(nodeCount))`;
- a visibility floor equal to the ratio required to retain 95% of nodes inside
  the useful reference viewport.

It takes the median of the available spacing/extent signals, applies the
visibility floor, then clamps once to `0.7–1.4`. Edges are optional: independent
graphs with at least two valid positions produce real decisions. Empty and
single-node projections, invalid or incomplete positions, duplicate keys or
coordinates, missing edge endpoints, and non-finite/degenerate metrics return
an explicit fallback ratio 1 with a diagnostic reason.

Exact nearest-neighbor distances use a deterministic balanced k-d tree without
a new dependency. Construction is `O(N log² N)`; the full query pass is average
`O(N log N)` and worst-case `O(N²)`. The measured 5,000-node synthetic pass is
about 20 ms median on the recorded local machine.

## Focus parity

Focus retains its root-aware median of connected-edge, nearest-neighbor/node
diameter, and p90 root-radius signals with the same one-time `0.7–1.4` clamp.
Only Sigma normalization and robust math moved into shared primitives. The 15
SPACING1A fixtures preserve the previous raw/effective ratios within floating
point tolerance, and the existing Focus ownership, Fit, reference-line, and
size-override tests remain authoritative.

## Camera ownership and strengths

Each renderer owns an independent transient strength that defaults to 100%:

```text
effectiveRatio = 1 + (rawDecisionRatio - 1) × strength / 100
```

At 0%, Fit reproduces legacy ratio 1; at 100%, it uses that scope's automatic
decision. Values from 101–150% are Sandbox-only amplification of the correction
away from ratio 1; they do not redefine the production automatic policy.
Changing the mounted scope's slider immediately applies the ratio around the
current semantic/visual anchor and makes the camera user-owned, without layout,
Pull, or persistence work. Changing the unmounted scope stores only its
transient percentage until that renderer mounts.

Fresh mounts without a restored viewport and explicit Fit are auto-owned.
Wheel/pinch, pan, zoom buttons, centering/navigation, restored semantic
viewports, folder arrangement, and slider preview are user-owned. Later query,
topology, worker, Pull, or fixed-position completion updates the decision but
does not replace a user-owned camera. Fit recenters, resets angle, applies the
current effective ratio, and returns to automatic ownership.

## Atomic mutation and camera order

Sigma 3.0.3 listens to Graphology node, edge, and bulk-attribute events and
calls `refresh({ schedule: true })`. Those mutation-triggered requests are the
authoritative process/render boundary for confirmed topology and full-position
commits; the application does not add a second explicit refresh. Before the
first mutation, each Network session registers the matching `afterProcess`
camera repair and `afterRender` completion. Sigma therefore computes the new
normalization, repairs the semantic anchor and ratio, and only then draws the
first visible changed-graph frame.

All query anchoring prefers a selected survivor, then an explicitly known
semantic/history survivor, then the nearest viewport-center survivor with a
stable key tie-break. When no old node survives (including an empty result), the
new scene is centered at the existing camera ratio without inventing a semantic
relationship. Focus retains its selected-node, otherwise root, policy. Dynamic
Pull, fixed placement, folder clustering, reference pull, folder separation,
and accepted worker layouts all inherit the same full-position transaction;
sparse pointer preview remains its existing single explicit partial refresh.

## Synthetic matrix and performance

`pnpm analyze:network-spacing` writes aggregate, deterministic evidence to the
ignored `output/spacing1b-global/` directory. Its 29 fixtures cover 1 and
2/3/5/10/20/50 independent nodes; connected chain/star/mixed graphs;
components, isolates, dense clusters, long-chain, and reference-heavy graphs;
weak/strong folder clustering; dynamic Pull; fixed and combined composition;
query-reduced sparsity; and 100/500/1,000-node stress scenes. A 5,000-node case
isolates density cost.

| Nodes |    Median |       p95 |
| ----: | --------: | --------: |
|   100 |  0.395 ms |  1.385 ms |
|   500 |  1.656 ms |  1.710 ms |
| 1,000 |  3.066 ms |  3.856 ms |
| 5,000 | 19.655 ms | 23.088 ms |

The operation oracle records zero Global ForceAtlas2 requests, zero dynamic
Pull requests, and zero spatial persistence writes for strength-only changes.

## Sandbox and QA diagnostics

Sandbox makes ownership explicit: Focus Root appearance is separate, Network
Density contains distinct All and Focus controls, and existing physics/visual
controls are labelled All Network. Those controls still apply only when
Scope = All and Layout = Network; this task does not generalize them to Focus.
Reset Sandbox restores both density strengths to 100% without touching Trackpad
Zoom, source state, queries, history, vault data, Local layout selection, or
persisted spatial folder intent.

While PR #60 is a draft, each mounted renderer publishes runtime-only raw,
effective, camera, fallback, and fallback-reason diagnostics. All also reports
node, edge, and isolate counts. The callbacks are deduplicated display evidence;
they are not density input, camera policy, stored preference, or telemetry.
