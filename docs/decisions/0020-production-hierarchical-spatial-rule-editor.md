# ADR 0020: Production hierarchical spatial-rule editor

**Status:** Proposed — implementation complete; mandatory native interaction QA pending.

## Context

SPATIAL2A established serializable Pull/Place rules, deepest-wins hierarchical
scope, a separate dynamic worker/cache, and exact post-dynamic placement. The
product still exposed only the older exact Place interaction. Production
authoring must expose the completed model without adding a second scope
semantics, persisting resolved members, or running dynamic work on pointermove.

## Decision

1. All Network Arrange owns one production editor for Dynamic pull and Fixed
   placement. Existing rules load unchanged; an unruled folder starts as a
   transient Pull/exact draft at its displayed center with strength 70.
2. Strength 70 remains the default after the private-safe 60/70/80 comparison:
   it materially improves target response over 60, and no evidence requires 80
   as the initial strength. Pull and automatic folder-clustering strengths stay
   independent.
3. Product scope presets are This folder (exact), Folder + subfolders (full
   subtree), and Custom (direct-root inclusion plus excluded subtrees).
   Membership is declarative folder intent, never a persisted File-ID list.
4. Custom exclusions remain a minimal antichain. Re-inclusion below an excluded
   ancestor is not represented; the nearest blocking ancestor must be enabled.
5. The deepest matching child rule remains the sole authority. Parent editing,
   preview, reset, or removal does not alter or move child-rule-owned members.
6. Active scope visualization distinguishes included, excluded, child-owned,
   and unrelated nodes plus internal, boundary, child-owned, and unrelated
   edges. Visual Group colors and per-File sizes remain intact.
7. Graph-click selection is only a shortcut for toggling folder subtrees or the
   entire direct-root group. A bounded DOM folder tree is the accessible,
   keyboard-operable authoring surface.
8. The spatial target marker is directly draggable with pointer capture. Pull
   pointer/keyboard editing changes only draft target intent and moves zero graph
   nodes. Place marker drag, or dragging an effective selected File, retains the
   immediate rigid preview over deepest-wins members. Pointermove never invokes
   the Pull worker.
9. Behavior, scope, exclusions, and strength remain draft-only. Pull refinement
   starts after Apply or release; confirmed geometry remains visible during Pull
   editing and changes only when matching authoritative output adopts. Stale
   generations cannot clear it.
10. Place remains exact post-dynamic composition. A Place-only edit with an
    unchanged Pull fingerprint requests zero dynamic workers.
11. Complete rule writes are transactional and durable writes occur before
    adoption. Failure restores confirmed geometry; session-only and corrupt
    states remain explicit. Reset one targets any exact-root rule; Reset all is
    separately confirmed.
12. Query/live changes re-resolve declarative membership and cancel unfinished
    preview. Drafts survive only while the exact normalized root exists. Rename
    has no fuzzy reconciliation and the old rule remains dormant.
13. The spatial schema remains v2. No raw coordinates, resolved members,
    schema-v3 Saved View state, individual-node movement, or new runtime
    dependency is introduced.
14. Release remains gated on native mouse/precision-touchpad interaction in the
    optimized Tauri executable; browser and startup smoke are not substitutes.
15. Applying authoritative spatial coordinates preserves the user's raw
    graph-space viewport center, scale, and angle while Sigma recomputes its
    normalization. Repair is armed before coordinate mutation and occurs after
    processing but before drawing. It applies to Pull, Place, cache-hit, remove,
    and reset adoption, including the final-rule transition to an empty registry.
    The mutation cause, not only the new anchor/rule count, selects this path.
    Explicit Fit, Search center, initial framing, pan/zoom, and later camera
    transitions keep camera ownership.
16. SPATIAL2B retains the SPATIAL2A whole-graph settlement path. It introduces
    no connected-component freeze, continuous simulation lifetime, reheating,
    cooling, or hard-constraint neighbor reaction. Those policies remain owned
    by PHYSICS1/CONVERGENCE integration; MOVE1A's temporary constraint seam is
    not reused for spatial-rule target authoring.
17. Draft PR #60 / FLICKER1 remains the long-term owner of atomic Network camera
    transactions. SPATIAL2B keeps only the raw-frame repair needed for spatial
    normalization. FLICKER1 integration must absorb that repair callback into
    its single pre-mutation transaction and replace SPATIAL2B's refresh fallback;
    the two systems must not be nested as competing camera owners.

## Consequences

The production surface can author every SPATIAL2 rule while retaining one
source-neutral model and the existing write-before-adopt boundary. Scope changes
are cheap visual/draft work, target movement is immediate, and only committed
Pull intent starts asynchronous graph reaction. Full-folder trees remain
bounded in the DOM, while 5,000-node dynamic settling remains an explicit scale
limit rather than an interactive promise.

Until the native gate passes, SPATIAL2B and this ADR remain release candidates;
the implementation PR must stay draft and unmerged.
