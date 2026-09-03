# Presentation overrides

Source-neutral, workspace-scoped user presentation intent; not canonical
knowledge, projection state, graph preferences, or a spatial registry.

- `src/types.ts` owns the v1 registry and renderer-neutral size multiplier map.
- `src/registry.ts` validates, deterministically serializes, edits, and reconciles
  entries. Only opaque WorkspaceId/EntityId and a finite 0.5–2.5 multiplier are
  persisted. Unknown fields are rejected. Auto removes an entry; custom 1× is
  valid and deliberately distinct from Auto.
- `src/index.ts` is the public interface; `src/registry.test.ts` covers the contract.

Missing entities remain stored but inactive, without path/title remapping. Only
canonical Documents receive active overrides. Projection/query membership never
prunes the registry. The app owns storage and eligibility; Network renderers
consume the sparse map in their ordinary size/layout mapping. No React, storage,
source adapter, query, projection, or renderer dependencies belong here.

Normalized folder anchors deliberately live in the separate
`@icarus-graph-explorer/spatial-overrides` registry. Per-File multipliers affect
display size only; they neither contribute to the automatic spatial frame nor
alter folder translations. Neither registry clears or serializes the other.
