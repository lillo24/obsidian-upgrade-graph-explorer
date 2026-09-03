# Spatial overrides

Source-neutral, workspace-scoped user presentation intent for manual spatial
placement. This package does not own canonical knowledge, KG6 projection,
renderer instances, ForceAtlas2 state, browser storage, or source files.

```text
automatic layout
  → normalized All Network folder anchors
  → displayed positions
```

## File map

```text
src/types.ts       Schema-v1 registry, normalized anchors, frames, and results.
src/folder-key.ts  Exact workspace-relative folder-key validation/derivation.
src/registry.ts    Strict validation, deterministic serialization, pure edits.
src/geometry.ts    Automatic document frame, inverse normalization, composition.
src/index.ts       Public source-neutral interface.
*.test.ts          Registry and deterministic geometry contracts.
```

Schema v1 stores only `workspaceId` and `allNetwork.folderAnchors`. A root file
uses folder key `.`, while nested folders use exact normalized paths such as
`Theory/Language`. Leading/trailing slashes, backslashes, drive prefixes, empty
segments, and `.`/`..` segments are rejected. Folder identity is deliberately
path-based in v1: rename creates a new identity, the old entry remains dormant,
and exact path reuse can reactivate it. There is no fuzzy reconciliation and no
canonical folder entity.

Anchor X/Y values are finite and bounded to `[-2, 2]`. Positive X means right;
positive Y means visually down. The automatic frame is the bounding box of
visible canonical document positions before overrides. Diagnostics are excluded.
Each half extent has a deterministic minimum of `1`, including empty, singleton,
line, and nearly degenerate graphs. A renderer supplies the sign of graph-space Y
that appears visually down; Sigma 3.0.3 uses `-1`.

Composition translates every visible document in one exact folder by the same
delta, preserving cluster shape. Other folders and diagnostics are unchanged.
Inactive folder entries remain stored. Overlap is accepted user intent: this
package performs no collision solving or post-override physics. The inverse
target helper clamps finite drag targets to the v1 bounds for SPATIAL1B.

Registries are deterministically ordered, deeply frozen on construction, JSON
round-trip and `structuredClone()` safe. Absence means automatic placement; no
explicit Auto entry or raw graph coordinate is stored. `mergeFolderClusterAnchorMaps`
lets a future temporary drag preview win over persisted anchors without reading
storage inside geometry.
