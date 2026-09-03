# SPACING1A Focus + Network density decision spike

Status: **COMPLETE — choose a bounded camera-framing policy for SPACING1B.**

SPACING1A is synthetic diagnostic evidence only. It changes no production
layout, camera, renderer, cache, fingerprint, node-size, or persistence
behavior. The evidence supports option B at the camera/framing layer. It does
not support adaptive ForceAtlas2 settings or a ForceAtlas2 fork.

## 1. Current transform pipeline

The installed pipeline is Graphology ForceAtlas2 0.10.1 followed by Sigma
3.0.3:

```text
deterministic Local seed
→ production computeLocalLayout()
→ ForceAtlas2 (scaling 1.35, gravity 0.08, strong gravity,
   edge influence 1, hierarchy/reference multipliers 6/1)
→ translate every position so the Focus root is (0, 0)
→ Sigma graph extent
→ Sigma autoRescale + autoCenter into framed coordinates
→ camera matrix (stage padding 24)
→ viewport pixels
```

Sigma's default normalization divides both axes by the largest raw graph
extent and centers the result at `(0.5, 0.5)`. The product does not override
`autoRescale: true`, `autoCenter: true`, `itemSizesReference: "screen"`, or the
default square-root zoom-to-size function. Existing Fit resets the camera to
`x=0.5`, `y=0.5`, `ratio=1`, `angle=0`.

At camera ratio `r`, center-to-center pixel distance changes by `1/r`, while a
screen-referenced node radius changes by `1/sqrt(r)`. A larger camera ratio
therefore reduces whitespace faster than it reduces node radius.

## 2. Why sparse graphs look sparse

The visible problem is mainly framing and occupancy, not unexpectedly strong
few-body repulsion. Sigma fits every raw layout extent into the same framed
unit. A graph with 2–5 nodes therefore uses much of the same screen extent as a
graph with 20–50 nodes, but has far fewer nodes filling that area. Node sizes
remain screen-referenced at Fit ratio 1.

The result is a large nearest-neighbor distance relative to node diameter:
roughly 22–52 diameters for the connected 2–5-node cases, compared with 7.3
for the 20-node mixed case and 4.6 for the 50-node mixed case. ForceAtlas2
still determines useful relative shape, edge ratios, and cluster structure;
Sigma's normalization determines how aggressively that shape occupies the
viewport.

This answers the apparent paradox: fewer repulsive pairs do not imply a denser
screen. Raw scale is discarded by auto-rescale, and fewer marks occupy the
same fitted screen area.

## 3. Fixture and metric table

All fixtures use deterministic seeds, production node sizes and edge weights,
the unchanged production `computeLocalLayout()`, and the product's iteration
policy. Pixel metrics below use a 1200×800 reference viewport. B4 is the
diagnostic bounded hybrid described below.

| Fixture                   | Nodes | Edges | Components | B0 median NN px | B0 median edge px | B0 p90 root radius px | B4 ratio | B4 median NN px |
| ------------------------- | ----: | ----: | ---------: | --------------: | ----------------: | --------------------: | -------: | --------------: |
| two-reference             |     2 |     1 |          1 |          765.66 |            765.66 |                689.09 |     1.40 |          546.90 |
| three-chain               |     3 |     2 |          1 |          656.05 |            656.30 |              1,125.87 |     1.40 |          468.61 |
| three-star                |     3 |     2 |          1 |          575.64 |            575.64 |                575.64 |     1.40 |          411.17 |
| five-chain                |     5 |     4 |          1 |          280.32 |            325.03 |              1,058.35 |     1.40 |          200.23 |
| five-star                 |     5 |     4 |          1 |          424.44 |            429.62 |                436.42 |     1.40 |          303.17 |
| five-mixed-isolate        |     5 |     3 |          2 |          163.05 |            163.05 |                630.59 |     1.40 |          116.47 |
| eight-star                |     8 |     7 |          1 |          313.49 |            395.73 |                403.09 |     1.40 |          223.92 |
| ten-mixed                 |    10 |    10 |          1 |          126.99 |            141.85 |                677.80 |     1.40 |           90.71 |
| twenty-mixed              |    20 |    22 |          1 |           68.72 |            109.21 |                732.33 |     1.19 |           57.86 |
| fifty-mixed               |    50 |    60 |          1 |           42.93 |             98.48 |                647.88 |     0.93 |           46.05 |
| two-dense-clusters-bridge |    12 |    19 |          1 |          131.03 |            173.55 |                824.07 |     1.40 |           93.78 |
| long-chain                |    20 |    19 |          1 |          111.78 |            115.75 |                860.47 |     1.40 |           79.84 |
| root-weak-and-isolated    |     8 |     3 |          5 |          231.37 |            195.13 |                708.01 |     1.40 |          165.26 |
| hierarchy-heavy           |    12 |    12 |          1 |          126.47 |            136.17 |                451.25 |     1.02 |          124.01 |
| reference-heavy           |    12 |    22 |          1 |          213.26 |            297.79 |                382.25 |     1.40 |          152.33 |

The machine-readable ignored result also records node-kind counts, edge-kind
counts, graph-space p10/median/p90 nearest neighbors, hierarchy/reference edge
lengths, root radii, bounding dimensions, robust extent, node-relative ratios,
and equivalent 720×480 screen metrics.

## 4. Uniform-scale experiment

The same five-star ForceAtlas2 result was measured as `P` and `0.5 × P` using
Sigma's installed `createNormalizationFunction` and `matrixFromCamera`:

| State                                       | Maximum screen-position delta |
| ------------------------------------------- | ----------------------------: |
| normal mount / reset Fit (`ratio=1`)        |                          0 px |
| same explicit camera (`ratio=1.75`)         |                          0 px |
| same saved semantic viewport (`ratio=0.82`) |                          0 px |

Median node radius was 6.4 px in both Fit cases. Sigma auto-rescale expands the
half-sized raw extent back to the same framed extent before the camera runs.
Therefore the intuition “compress coordinates, then Fit zooms in and makes
nodes larger” is completely cancelled in the current pipeline. Coordinate
scaling would matter only if SPACING1B also disabled auto-rescale or supplied a
stable custom bounding box, which would be a broader and riskier change.

## 5. Candidate B rules

The spike simulated all candidates on identical ForceAtlas2 coordinates:

- **B0:** current camera ratio 1.
- **B1:** ratio from median connected-edge pixels against
  `min(180, 80 + 20 × sqrt(N))`.
- **B2:** ratio from median nearest-neighbor distance divided by representative
  node diameter. Its diagnostic target is `30 / sqrt(N)` diameters, solving
  for Sigma's `1/sqrt(ratio)` relative-density response.
- **B3:** ratio from p90 root radius against
  `min(720, 200 + 70 × sqrt(N))` pixels.
- **B4:** the median of the three raw B1/B2/B3 ratios, then one clamp.

These are decision-spike candidates, not production constants. B1 alone is
weak for isolates and long chains. B2 most directly describes what the eye
sees and is the best primary density metric. B3 prevents a nearest-neighbor
cluster from hiding an oversized overall scene. The median hybrid rejects one
topology-specific outlier without becoming an optimizer.

The artifact evaluates the requested bound families `0.5–1.5`, `0.6–1.4`, and
`0.7–1.3`. Wide bounds produce visibly stronger sparse correction; conservative
bounds leave more of the original whitespace. A provisional `0.7–1.4` bound
is the best implementation starting point: the sparse cases need the upper
bound, while the 20/50-node mixed cases stay near 1.19/0.93. No fixture asks
for an extreme transform.

## 6. Screen-space comparison

Run:

```bash
pnpm analyze:focus-spacing
```

Then open:

```text
output/spacing1a/focus-spacing-comparison.html
```

The self-contained HTML compares current Fit with all three B4 bound families
for a sparse star, mixed graph with an isolate, 10/50-node mixed graphs, and a
multi-component graph. It uses the same ForceAtlas2 coordinates, viewport,
node-size assumptions, and inline SVG renderer for every panel. It has no
network requests or private data.

Across all fixtures, the provisional hybrid changes median nearest-neighbor
distance from 213.26 px to 152.33 px and median connected-edge distance from
195.13 px to 139.38 px. The maximum pairwise relative-geometry error is
`0.00000006`, the Float32 matrix noise floor; angles, ordering, clusters, and
edge-length ratios are unchanged.

## 7. Edge cases

- **Two or three nodes:** all signals request more than the upper bound. A
  bound is essential because no density statistic is stable with so few
  samples.
- **Isolates / weak components:** nearest-neighbor and radius see them; an
  edge-only rule does not. B4 remains bounded at 1.4.
- **Long chains:** p90 radius and nearest-neighbor agree on mild compression;
  uniform camera framing preserves the elongated topology.
- **Two clusters plus bridge:** B4 reduces whitespace but preserves both
  clusters and the bridge exactly.
- **Hierarchy-heavy:** the edge signal alone would enlarge the graph, while
  radius and visual density keep the hybrid near neutral (1.02).
- **Reference-heavy:** the large edge/neighbor signals are constrained by the
  upper bound.
- **Dense 50-node mixed graph:** B4 is 0.93, so it is not crushed; it receives
  only a small counter-correction.
- **Viewport size:** ratios are derived in a canonical 1200×800 reference
  frame and reused at 720×480. This avoids making density policy depend on the
  user's window size.

## 8. Recommendation

Choose **B-camera**. Preserve ForceAtlas2 output and Sigma auto-rescale. Compute
one deterministic density ratio from a canonical reference frame after layout,
then use that ratio only as the target for the existing automatic Fit/framing
operation.

Use median nearest-neighbor distance per representative node diameter as the
primary signal, guarded by median connected-edge distance and p90 root radius.
Take the median of the three proposed ratios and clamp once. Begin SPACING1B
with `0.7–1.4`, keeping the constants centralized and covered by fixture tests.
The diagnostic formulas above are the initial implementation hypothesis; the
production change should name them as policy constants and retain the same
fixture oracle rather than burying magic numbers in UI code.

Do not scale coordinates, disable Sigma auto-rescale, change node sizes, or add
per-node displacement. This keeps normalization out of ForceAtlas2, layout
fingerprints, memory caches, and visual size overrides.

## 9. B versus C verdict

**B is sufficient.** The observed difference is screen occupancy, and a
bounded camera ratio changes it predictably while preserving all relative
ForceAtlas2 geometry. None of the synthetic topologies shows a qualitative
cluster, ordering, or isolate defect that requires different forces.

C is not justified. Reconsider a separate adaptive-ForceAtlas2 sensitivity
spike only if SPACING1B visual QA finds topology-specific overlap or malformed
relative geometry that a uniform camera transform cannot reconcile. If that
happens, investigate gravity and scaling ratio first, then edge weights; do not
fork ForceAtlas2.

## 10. SPACING1B handoff

SPACING1B should implement the following narrow contract:

1. Add a pure Local density-policy module beside the Local renderer. Input is
   the completed Local layout, root key, production node radii, edges, and a
   fixed 1200×800 reference frame; output is one finite camera ratio plus
   aggregate diagnostic signals. It must not return coordinates.
2. Reuse or faithfully isolate Sigma 3.0.3 normalization math so the policy
   measures the same framed scene. Keep the dependency/version contract near
   the module.
3. Compute B1 connected-edge, B2 nearest-neighbor/diameter, and B3 p90-root
   signals, select their median, and clamp once to `0.7–1.4`. Centralize every
   provisional constant and document its units.
4. Apply the result only in the existing automatic Fit target after a newly
   accepted Local layout. Manual pan/zoom and semantic viewport restoration
   retain their saved ratio and must not be overwritten. Decide explicitly in
   tests whether the user's manual Fit invokes the same density-aware target;
   the recommended behavior is yes.
5. Do not change `computeLocalLayout`, ForceAtlas2 settings, raw positions,
   root normalization, cache keys/fingerprints, size override behavior, or
   Global/Structured renderers.
6. Retain B0 for invalid/degenerate metrics and fail loudly in development for
   non-finite results. Two-node and disconnected cases must remain valid.
7. Add pure fixture tests for all 15 SPACING1A topologies, bounds, determinism,
   reference-frame invariance, geometry preservation, and no layout-fingerprint
   change. Add session/canvas tests for initial Fit, manual Fit, saved viewport,
   transitions, and resize behavior.
8. Run browser and desktop graphical QA on the highlighted sparse, isolate,
   long-chain, hierarchy-heavy, and 50-node cases before merging SPACING1B.

SPACING1A stops here. It does not implement this production contract.
