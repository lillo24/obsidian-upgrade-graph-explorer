# CONVERGENCE1C — Global folder-macro convergence

CONVERGENCE1C replaces All Network's fixed one-shot ForceAtlas2 budget with a
bounded, schema-v2 worker lifecycle. The production policy is
`global-fa2-folder-convergence-v1`. It remains a finite replacement-worker job,
not a persistent simulation.

## Macro decision

The evidence gate evaluated 18 deterministic synthetic fixtures. Exactly one
candidate passed every gate: **M2, an output-only fixed folder field**.

| Candidate | Definition                                                                                          | Decision                                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| M0        | Repeat the current prior after every FA2 batch.                                                     | Rejected: folder strength grows with duration; maximum forced-duration spread `0.20687`.                                                   |
| M1        | Spend five prior applications early, then use a pure FA2 tail.                                      | Rejected: 3/5/8/12-step output changes materially; maximum spread `0.49730`.                                                               |
| M2        | Run pure FA2 and derive every accepted snapshot through one fixed prior transform without feedback. | Selected: maximum spread `0.02956`, 16/18 fixtures stable, zero false early stops, exact reruns, preserved setting and reference ordering. |
| M3        | Attract each batch toward a frozen initial semantic target.                                         | Rejected: only 8/18 fixtures stable, with false early stops and quality/setting-order failures.                                            |

Run `pnpm analyze:global-convergence` to regenerate the ignored JSON and HTML
evidence under `output/convergence1c/`. The decision rubric allows a
deterministic `max-iterations` result: caps are accepted bounded outcomes, while
false `stable` results, wall-time aborts, and malformed responses are failures.

## Folder semantics

One application of the previous `chunked-prior` transform was:

```text
r = 1 - folderCohesion + (withinFolderSpacing - 1) × 0.012
s = folderCohesion × 0.16 × betweenFolderSpacing × graphRmsScale
p' = folderCentroid + r × (p - folderCentroid) + folderDirection × s
```

Five same-frame applications compose the radial term as `r⁵` and, at fixed
scale, translate a folder five times. The former production algorithm also ran
FA2 between applications and recomputed centroids/scale, so its exact result
was nonlinear.

M2 applies exactly one transform to each completed output snapshot. Its output
never feeds the working Graphology graph. Therefore cohesion, within-folder
spacing, separation, and deterministic folder direction have the same semantic
strength whether convergence checks 3, 5, 8, or 12 macro-steps. References
remain the only graph edges; strong cross-folder references can still pull
clusters together. Root-level files receive pure FA2 positions.

## Production policy

Each request constructs one Graphology graph and reuses it:

```text
32 public ForceAtlas2 iterations
→ derive one output-only folder field (or identity for reference-only)
→ snapshot
→ centroid-aligned movement measurement
```

A full macro-step is stable when all-node normalized p90 is at most `0.00512`,
the degree-0/1 maximum is at most `0.01024`, and normalized raw centroid drift
is at most `0.00512`. Three consecutive full macro-steps stop as `stable`.
Movement removes centroid translation only and normalizes by the previous
frame's RMS radius, floored at `1e-6`; rotation and scale changes remain visible.

Caps are 640 iterations through 1,000 nodes, 120 through 5,000, and 80 above
5,000. A final partial batch receives the complete output field and is accepted
as `max-iterations`, but cannot increment the stable count. The 5,000 ms safety
limit is checked only after a complete nonterminal macro-step. A timeout returns
a structured `max-wall-time` failure without positions, cache adoption, or
partial display.

## Worker, cache, and composition

Global request/result/failure schema 3 carries convergence and macro versions,
lifecycle counters, stop reason, final movement evidence, and timings. The
request's settings are restricted to folder clustering, folder cohesion,
reference link force, within-folder spacing, and between-folder spacing; its
nodes carry no display radius. The client validates the complete response
against the originating request. `global-layout-v3` fingerprints include
topology, edge weights, resolved physics, the full policy, and macro identity.
They exclude warm coordinates, visual-only settings, camera/density state,
timings, dynamic Pull, and fixed Place. Older cache keys therefore cannot
collide.

Exact hits still restore settled base coordinates without a worker. Explicit
Re-layout evicts the exact key and warm-starts from current base automatic
coordinates. A worker result is adopted once, then existing SPATIAL2 composition
remains `base → dynamic Pull → fixed Place`. FLICKER1's atomic process/render
and camera-neutral geometry adoption remain authoritative. Density framing is
measured after final displayed composition and is not layout identity.

## Scope

Local/Focus policy `local-fa2-convergence-v1` is unchanged. This work adds no
dependency, semantic folder edge, private vault data, streaming batch result,
persistent worker, SPATIAL2 dynamic convergence, or PHYSICS1 lifecycle.
