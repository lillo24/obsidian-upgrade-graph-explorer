# 0026 — Saved View profiles are layout-appropriate snapshots

Status: accepted for SAVED1B implementation; release merge remains subject to
the repository's browser/native acceptance gate.

## Decision

SAVED1B advances the workspace-scoped Named Saved Views registry from schema v1
to schema v2. Every newly captured entry includes one strict discriminated
profile selected by the saved Scope × Layout:

- All Network stores the complete validated `GlobalLayoutSettings` value and a
  validated snapshot of committed normalized folder Pull/Place rules.
- Focus Network stores only Reference Pull, Base node size, Link thickness, and
  Label threshold. Apply merges those values into the current global settings
  while preserving every All-only control.
- Focus Hierarchy stores only its appearance, implementation, and modular
  hierarchy presentation policies.
- All Hierarchy stores an explicit empty profile and never enables its exposure
  gate.

Schema-v1 registries are validated against their original exact fields and
migrated only in memory. Loading does not rewrite storage. A later explicit
mutation writes schema v2; profile-less entries retain semantic-only SAVED1A
matching and Apply behavior until Update replaces their snapshot.

Profile Apply is one web-owned transaction across independent storage owners.
The complete target is validated first, exact previous bytes are read before
writes, changed spatial state is written before Graph Preferences, and any
successful earlier write is rolled back if a later write fails. In-memory
preference, spatial, semantic, presentation, selection, and history adoption
happens only after durable writes succeed. This is best-effort single-process
recovery over browser storage, not a claim of database atomicity; rollback
failure is explicit.

The quick switch is a native select beside the existing management button. Its
label is derived from the current canonical semantic snapshot plus the applicable
profile. Duplicate-equivalent entries choose the first deterministic
alphabetical name. No active Saved View identity is persisted, and startup
restores ordinary Current View/preferences/spatial state without applying a
named entry.

## Excluded ownership

Profiles never contain Trackpad Zoom, the All-Hierarchy exposure gate, Saved
Filters, Visual Groups, per-File size overrides, individual File movement or
positions, raw renderer coordinates, Network Explorer disclosure, search,
selection/Inspector state, panels, maximized mode, temporary physics/editing
state, source/identity state, or AI/Argument Workspace state.

## Consequences

- Exact reapply can skip preference/spatial writes and graph/camera work.
- Network visual-only changes continue through VISUAL1C presentation refresh;
  physics and spatial changes retain existing latest-generation layout and final
  semantic viewport ownership.
- A failed profile write cannot be presented as a successful semantic Apply.
- Saved Filters, Visual Groups, size overrides, and Current View keep their
  existing independent keys and recovery actions.
- SAVEDUX1 animation, PIN1 persistent individual positions, and AUTO1 adaptive
  layout selection remain separate future work.

## Rejected alternatives

- Persisting an active Saved View name would become stale after query, camera,
  preference, or spatial edits.
- Capturing all Graph Preferences would overwrite machine interaction choices
  and product exposure policy.
- Storing raw coordinates would couple a Saved View to renderer internals and
  begin PIN1 implicitly.
- Applying profile controls as sequential UI actions would create intermediate
  projections/layouts and transient camera states.
- Treating independent localStorage keys as atomically transactional would make
  a stronger guarantee than the platform supplies.
