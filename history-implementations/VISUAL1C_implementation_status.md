# VISUAL1C implementation report

Status: **implemented and locally validated; PR/CI integration is recorded when
complete.**

## Implemented boundary

- The finite All layout protocol is schema 3 and accepts only resolved spatial
  settings. Its nodes no longer carry presentation size, and its fingerprint is
  namespaced `global-layout-v3`.
- Continuous All movement seeds use a neutral physics size because installed
  ForceAtlas2 runs with `adjustSizes: false`; Focus retains its semantic sizes.
- Global Visual settings stay in Sigma presentation reducers. Session updates
  coalesce through one animation-frame refresh and expose a dedicated
  `global-visual-refreshes` performance counter.
- Existing persisted settings, folder presets, per-File multipliers, diagnostic
  sizing, group styling, interaction state, and explicit spatial relayout remain
  compatible.

## Regression coverage

- Worker requests and fingerprints are byte-identical across visual-only
  variants and change for spatial variants.
- Global worker nodes omit display size while Local layout identity remains
  size-aware where required.
- Rapid Visual changes produce one reducer refresh, zero additional layouts,
  exact coordinate stability, and the latest requested presentation.
- Interaction classification and benchmark evidence distinguish visual-only
  refreshes from spatial layout work.

## Validation

The frozen-lockfile install passed. `pnpm check` passed formatting, lint, all
workspace typechecks, **1,720 tests across 206 files**, and the production web
build. `pnpm desktop:check` and `pnpm desktop:build` passed; the latter produced
the optimized Windows executable. A hidden release startup smoke kept that
executable alive for four seconds without an early exit or crash, then stopped
the exact smoke-test process.

The required small and medium Global renderer benchmarks and small general
performance benchmark passed. On the 500-node/499-edge medium Node sample, the
four presentation passes had median costs of **0.046 ms Base size, 0.039 ms Link
influence, 0.037 ms Link thickness, and 0.104 ms Label threshold**, versus
**181.745 ms** for the finite layout comparison. Each presentation record
reports zero projection, mapping, Graphology reconciliation, layout request, and
coordinate write operations, plus one Sigma Visual refresh.

Production-browser QA used both the product Synthetic Sample and the Sigma
harness. In the product, continuously changing all four Visual controls kept
the five visible node centers fixed while radii, thickness, and labels updated.
Reference Pull and Folder separation each visibly changed the settled spatial
arrangement. Search/centering, selection, Inspector, enlarged-radius hit
testing/hover, a Visual Group, per-File Size, Hide/unhide, and reload remained
functional; unhide and reload preserved the 1.50× File size. The 1,584-node /
10,000-edge production Sigma sample completed the four Visual refreshes in
**26.9–45.7 ms** with a highest uncontended rAF gap of **16.6 ms**. The same
harness measured its finite worker layout at **1,705.1 ms**.

## Operation counts

| Control | Additional finite layouts | Coordinate outcome |
| --- | ---: | --- |
| Base node size | 0 | exact x/y preserved |
| Link influence | 0 | exact x/y preserved |
| Link thickness | 0 | exact x/y preserved |
| Label threshold | 0 | exact x/y preserved |
| Reference Pull | 1 | intended relayout |
| Folder separation | 1 | intended relayout |

## Consumer audit

- Effective node radius remains the topology-degree/global-Visual result times
  the per-File multiplier; diagnostic targets retain the `0.62` base-size rule.
- Label eligibility receives final displayed radius. Node radius refreshes keep
  Sigma indexation enabled for label and picking data; thickness refreshes use
  Sigma's edge reducer without changing reference weight.
- Global density/camera fit continues to read topology geometry, so a Visual
  update cannot move the camera. Search centering likewise remains coordinate
  based.
- Group color, hover, selection, query Hide, Network Explorer, live topology
  replacement, pending-refresh filtering, cache hits, and warm starts retain
  their existing ownership and regression coverage.
- The legacy schema-v1 soft-attractor protocol is explicitly adapted from the
  spatial subset with fixed presentation baselines. The finite schema-v3 worker
  and cache identity contain no Visual fields or node display radii.

No dependency was added. Local overlap resolution for unusually large display
radii, SPATIAL1, Adaptive Layout, and Saved Views remain separate future work.
