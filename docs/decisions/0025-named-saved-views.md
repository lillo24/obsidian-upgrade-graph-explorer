# 0025 — Named Saved Views are semantic bookmarks

Status: accepted for implementation; merge remains gated on native acceptance.

## Decision

SAVED1A introduces Named Saved Views as a separate, workspace-scoped schema-v1
registry over the existing schema-v3 renderer-independent view-state contract.
Each immutable entry contains a trimmed unique name, the user-facing
Network/Hierarchy layout, and a semantic snapshot of Scope, disclosure, Focus,
filters/query, presentation mode, and Structure/Global/Local viewport bookmarks.
The registry is not an extension of the automatic KG9 Current View record.

The registry is eligible only for explicitly stable workspaces with writable
browser storage. It is keyed by encoded WorkspaceId, strictly validated, capped
at 50 entries, deterministically sorted, and written before a candidate is
adopted in memory. Invalid stored bytes remain untouched and block mutations.
Explicit two-step recovery deletes only the Named Saved Views key.

Applying an entry is one graph-context transaction. The web layer reconciles it
against the current canonical workspace, resolves presentation availability,
cancels temporary File movement, exits Arrange Folders, clears graph selection,
adopts the applied query into its editor, restores semantic viewport intent, and
establishes a new empty Back/Forward baseline. Ordinary KG9 autosave then records
the reconciled result as the Current View. Reapplying an exact semantic match
skips projection/layout and viewport work while retaining the explicit
selection/history reset.

Graph Preferences, Saved Filters, Visual Groups, File size overrides, folder
spatial rules, exact renderer coordinates, search, selection, history stacks,
and transient editing state do not enter a Named Saved View. Focus's live
Network/Hierarchy choice is owned by the preferred Focus layout in Graph
Preferences, so applying a Focus entry may update only that one preference
field. All other preference fields remain unchanged.

Save is a snapshot operation only. It writes the Named Saved Views registry and
does not change current projection, layout, camera, selection, history, or
Current View. Update replaces an entry from the current graph; Rename changes
only its name; Delete removes only that entry.

## Rejected alternatives

- Reusing the single Current View key would conflate automatic resume with
  explicit user-authored bookmarks and make independent recovery impossible.
- Capturing the full Graph Preferences, Visual Groups, size, or spatial
  registries would silently create SAVED1B profile semantics and unclear
  ownership.
- Persisting renderer coordinates or raw transforms would couple saved data to
  Sigma/React Flow implementation details and make reconciliation brittle.
- Pushing Apply onto existing Back/Forward stacks would mix an explicit context
  jump with prior-session navigation and create surprising traversal.
- Silently rewriting a corrupt registry as empty would be a success-shaped data
  loss failure.

## Consequences

- Current View and Named Saved Views have distinct labels, keys, failure states,
  reset actions, and tests.
- All four Scope × Layout combinations can be named and restored while using
  current data, preference, group, size, and spatial registries.
- Stored snapshots remain immutable until an explicit Update.
- Source evolution may remove stale entities or make a presentation unavailable;
  reconciliation is visible and never uses fuzzy identity replacement.
- SAVED1B remains the separate future decision for optional presentation or
  spatial profile composition.
