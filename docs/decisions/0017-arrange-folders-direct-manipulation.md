# ADR 0017: Arrange folders by direct manipulation

**Status:** Accepted — SPATIAL1B complete.

## Context

ADR 0016 separated automatic All Network geometry from durable normalized
exact-folder target centers. It deliberately supplied no production editing
interaction. Direct manipulation must preserve that separation, remain usable
without a pointer, avoid accidental selection/Focus navigation, and not turn
pointer movement into projection, topology, or ForceAtlas2 work.

## Decision

1. Arrange Folders exists only in All Network. Focus Network and both Hierarchy
   presentations receive no mode, registry, or controls.
2. Entry is explicit and disabled with an explanation until Sigma is ready, the
   current automatic layout is committed, at least one canonical File is
   visible, and the spatial session is editable. Corrupt data has a separate
   recovery action.
3. A draggable unit is one exact normalized workspace folder. Only canonical
   visible document nodes are members; headings, blocks, diagnostics, parent
   folders, and nested folders are excluded. `.` is the root folder key.
4. State ownership is split by frequency and responsibility: the web reducer
   owns inactive/active plus the active folder, React owns accessible controls
   and the persistence transaction, and the imperative Sigma session owns
   prime/drag/commit/cancel pointer state and animation-frame coalescing.
5. Pointer down captures immutable automatic positions, the currently displayed
   folder center, and pointer-to-graph coordinates. A 3 px viewport threshold
   distinguishes click from drag. Every preview derives from that captured base,
   so there is no initial jump or cumulative translated drift.
6. Preview math emits only the active folder's coordinates. At most one preview
   is applied per animation frame. After validating the complete sparse set, the
   session changes only renderer-owned x/y fields and requests one Sigma partial
   refresh containing moved nodes and incident edges.
7. Arrange owns node input. Selection, single-click reveal, double-click Focus,
   context click, and wheel zoom are suppressed while it is active. Stage drag
   remains Sigma camera pan. Leaving Arrange restores the ordinary interaction
   contract.
8. The visual treatment is a non-semantic torch: exact active-folder Files and
   their internal/incident edges remain prominent, unrelated content fades, and
   Visual Group base accents remain intact. A pointer-following DOM overlay is
   decorative and ignores pointer events.
9. Pointer release or keyboard Save submits exactly one normalized anchor to the
   existing write-before-adopt spatial session. The preview remains displayed
   until the confirmed registry is rendered. Write failure, thrown mutation, or
   a different authoritative map restores the last confirmed composition and
   reports an actionable error.
10. Escape cancels a primed, dragging, or keyboard preview without leaving the
    mode; an idle Escape exits. Window blur, document hiding, topology change,
    layout/re-layout, scope/presentation change, active-folder disappearance,
    and session disposal cancel unfinished movement.
11. The equivalent DOM workflow lives in the canvas panel and Network Explorer.
    Exact folder actions, a root fallback, persistent-position markers, arrow
    nudges of 0.02 (Shift: 0.10), Save, Cancel, Done, Reset folder, and confirmed
    Reset all are keyboard reachable and announce results.
12. Reset and corrupt recovery mutate only the independent spatial registry.
    Graph Preferences, KG9 view state, navigation history, queries, Visual
    Groups, per-File size overrides, automatic caches, and Named Saved Views
    are neither cleared nor merged.
13. The operation oracle requires zero KG6 projection, mapping, topology
    reconciliation, full spatial composition, and automatic layout per preview.
    Sigma 3.0.3 still requires indexed partial processing for correct moved-node
    picking, labels, and incident-edge geometry; its possible internal graph
    scan is measured in the production browser/Tauri harness and documented as
    a library limitation rather than hidden as sparse application work.

## Consequences

Folder arrangement composes with automatic layout without changing canonical or
projected topology. Exact-path rename behavior remains the v1 dormant/reactivate
policy. One large folder can still require a large sparse coordinate update, and
Sigma indexation can dominate the pure preview math; runtime evidence therefore
remains necessary. Individual-node dragging and Saved View schemas remain out of
scope.

## Rejected alternatives

- Always-on node dragging was rejected because it conflicts with selection,
  Focus activation, camera navigation, and the folder-level intent model.
- Persisting live Graphology/ForceAtlas2 coordinates was rejected because those
  values are topology-, renderer-, and run-specific.
- Re-running ForceAtlas2 while dragging was rejected because it breaks rigid
  exact-folder motion and the zero-layout interaction contract.
- React state on every pointer move was rejected because the imperative renderer
  already owns the high-frequency geometry and refresh boundary.
