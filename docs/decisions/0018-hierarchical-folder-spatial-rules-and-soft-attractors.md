# ADR 0018: Hierarchical folder spatial rules and soft attractors

**Status:** Accepted — SPATIAL2A complete.

## Context

SPATIAL1 stores durable exact-folder fixed targets and SPATIAL1B authors them by
direct manipulation. The next foundation must express inherited folder scope
and dynamic graph-aware attraction without persisting renderer coordinates,
breaking existing fixed intent, or turning the production Arrange surface into
an unreviewed SPATIAL2B editor.

## Decision

1. Spatial storage advances to schema v2 with one Pull or Place rule per
   normalized root folder. V1 anchors migrate in memory to Place plus exact;
   reads do not write and all later serialization is v2.
2. Exact and subtree scopes are source-neutral. Subtrees independently include
   direct root files and contain a sorted minimal antichain of excluded strict
   descendants. Root `.` covers all normalized folders.
3. Folder comparisons are segment-safe. Identity remains exact path based;
   missing/query-hidden rules are dormant and may reactivate, while rename has
   no fuzzy reconciliation.
4. Overlap resolves per document by deepest matching rule. Parent and child
   effects never add together, and equal-depth ambiguity is prevented by the
   one-rule-per-root invariant.
5. Position ownership has three strict layers: base automatic, dynamic pull,
   and displayed fixed composition. No downstream layer is accepted as an
   upstream seed or cache value.
6. Pull compute is a separate All Network worker/cache from base Global layout,
   Local layout, Dagre, and workspace compute. Focus Network and both Hierarchy
   presentations receive no spatial worker or registry.
7. Worker messages contain only stable keys, x/y/automatic size, semantic edge
   endpoints/weights, resolved pull memberships, graph-space targets/strengths,
   validated settings, iterations, algorithm version, and request ID.
8. The selected algorithm alternates ForceAtlas2 chunks with one shared bounded
   centroid translation per disjoint pull group. Continued ForceAtlas2 lets
   connected outside nodes react and changes internal geometry.
9. Pull gain is `0.55 × strength/100`, capped per chunk at
   `0.60 × graph RMS scale × strength/100`. Strength zero bypasses refinement;
   strength 100 remains a soft constraint rather than exact placement.
10. Candidate A (interleaved) is selected over Candidate B (move then relax)
    because deterministic aggregate evidence retained lower normalized target
    error while preserving outside reaction. No new force library is added.
11. The dynamic fingerprint includes base fingerprint/coordinates, semantic
    edges, resolved pull membership, targets/strengths, settings, iterations,
    algorithm, and version. Fixed rules, camera, selection, styles, display-only
    sizes, labels, and sidebar state are excluded.
12. Requests are latest-result-wins. Superseded/stale success or failure is not
    adopted, disposal terminates active work, source changes clear dynamic cache
    state, and failure visibly falls back to base plus fixed placement.
13. Fixed groups use current dynamic centers but normalized targets derived from
    the base document frame. Every member gets one shared translation and no
    fixed placement is applied twice.
14. Compatibility anchor APIs expose only Place plus exact. Current Arrange
    writes/replaces that one root rule and reset operations do not silently
    delete Pull or subtree rules. No production behavior selector is added.
15. Automatic folder clustering, QUERY1/hide, Visual Groups, per-File display
    sizes, viewport/history, and persistence sessions remain independent.
    Pull strength does not rewrite automatic folder-clustering strength.
16. The development harness owns behavior/scope/exclusion/strength QA and
    aggregate metrics. SPATIAL2B may design production editing later; SAVED1
    remains later and no saved-view schema is introduced.

## Consequences

Existing fixed registries retain exact behavior while hierarchical and dynamic
intent can be seeded and exercised end to end. Dynamic work is bounded,
memory-only, private-safe, and graph-aware, but it adds a second Global worker
pass whenever effective pull intent changes. Browser/Tauri QA remains necessary
for WebGL, worker/CSP, RAF, and physical-input evidence.

## Rejected alternatives

- Additive parent/child forces were rejected because they make scope order hard
  to explain and can amplify constraints unexpectedly.
- Synthetic anchor nodes were rejected because ForceAtlas2 0.10.1 exposes no
  pinned external-force primitive and extra nodes introduce graph artifacts.
- One rigid post-layout offset was rejected because outside connected nodes do
  not react and the result is indistinguishable from fixed placement.
- Persisting resolved members or dynamic coordinates was rejected because both
  are projection/topology specific and would become stale.
