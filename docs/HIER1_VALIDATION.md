# HIER1 validation

HIER1 adds `@icarus-graph-explorer/focus-schematic`, the public KG6 document
neighborhood description, neutral folder-key ownership, semantic and layout
validators, aggregate summaries, quality/stability evaluators, synthetic F1–F18
coverage, a Markdown integration fixture, and a repeatable benchmark.

The model is plain deterministic JSON. File modules retain visible, context,
and filtered presentation states; exact folder ancestry; internal hierarchy;
cross-file and internal reference provenance; diagnostics and external
ambiguity candidates; incoming/outgoing distance; placement eligibility;
Focus-path roles; secondary relationships; and deterministic parent candidates.

Runtime dependency review confirms the package depends only on core and
view-projection and adds no external dependency. ESLint rejects renderer,
layout, platform, source-adapter, persistence, and filesystem imports from
production package code. A source scan confirms the web app, React Flow
renderer, and Dagre package do not import it.

Validation commands and aggregate benchmark results are recorded in the HIER1
pull request. No private paths, titles, raw targets, screenshots, or topology
are committed. The benchmark uses synthetic names and emits counts and timings
only.

Synthetic median/p95 milliseconds from the implementation worktree were:

| Profile | Modules / entities / references |   Neighborhood |          Detail |  Model prepared | Independent validation |    Prepared total |
| ------- | ------------------------------: | -------------: | --------------: | --------------: | ---------------------: | ----------------: |
| small   |                  32 / 160 / 163 |  0.260 / 2.251 |   1.241 / 3.282 |   0.856 / 1.913 |          1.505 / 2.236 |    6.086 / 14.091 |
| medium  |             320 / 1,920 / 1,991 |  2.345 / 7.294 | 12.708 / 24.702 | 11.957 / 22.946 |        19.040 / 22.135 |  63.433 / 107.560 |
| hub     |           1,000 / 4,000 / 4,238 | 9.756 / 12.889 | 35.727 / 46.064 | 48.099 / 52.260 |        70.620 / 84.046 | 242.103 / 260.773 |

The prepared path was faster than unprepared construction at every profile;
the hub model completed with 1,000 modules and 1,240 relationships. Timings are
development evidence rather than merge thresholds.

Production behavior is unchanged: All + Hierarchy remains experimental, Focus

- Hierarchy uses the current flat React Flow mapping and HIER0 collision-safe
  local-structured Dagre path, and Network, QUERY1, Visual Groups, view-state,
  SPATIAL1, and persistence schemas are untouched.

HIER2 remains responsible for the layout bake-off, equal-mutual side choice,
filtered-path visual treatment, and explicit routing.
