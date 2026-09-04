# Spatial overrides

Source-neutral, workspace-scoped folder position intent. This package owns the
schema, hierarchical membership, fixed composition, and direct-manipulation
geometry. It does not own canonical knowledge, projection, workers, renderer
instances, browser storage, source files, or persisted raw coordinates.

```text
base automatic positions
  → dynamic soft-pull positions
  → fixed-placement composition
  → displayed positions
```

## File map

```text
src/types.ts       Schema-v2 rules, normalized anchors, frames, and results.
src/folder-key.ts  Exact workspace-relative folder-key validation/derivation.
src/scope.ts       Segment-safe depth, descendant, subtree, and exclusion rules.
src/registry.ts    V1 migration, strict v2 validation, serialization, pure edits.
src/resolution.ts  Most-specific winning rule and visible membership groups.
src/geometry.ts    Base frame, fixed composition, and displayed-to-dynamic inverse.
src/preview.ts     Sparse exact-folder preview geometry and bounded nudges.
src/index.ts       Public source-neutral interface.
*.test.ts          Migration, scope, resolution, geometry, and compatibility tests.
```

Schema v2 stores `workspaceId` and `allNetwork.folderRules`. Each normalized
root folder has at most one rule. `behavior: "place"` is fixed rigid placement;
`behavior: "pull"` is dynamic soft attraction and requires an integer strength
from 0 through 100. Strength is forbidden for Place. Targets remain finite
logical anchors in `[-2, 2]`, with positive X right and positive Y visually down.

Scopes are either exact or subtree. A subtree independently controls direct
files at its root and a sorted antichain of excluded strict-descendant subtrees.
Comparisons respect path segments: `Theory/A` descends from `Theory`, while
`Theory-Old` does not. Root `.` covers every normalized folder. Parent and child
rules may overlap, but every document gets only its deepest matching rule; rules
with no visible winners remain stored and inactive. Query/hide changes and exact
folder renames therefore do not delete intent, and exact path reuse reactivates
it without fuzzy reconciliation.

Schema-v1 `{folderKey, anchor}` entries are accepted only at the read boundary
and deterministically become `place + exact` rules in memory. Serialization is
always v2. Registries and nested values are sorted, deeply frozen, JSON and
`structuredClone()` safe. The compatibility anchor API projects only
`place + exact`: Arrange writes/replaces that one root rule, while compatibility
remove/clear operations do not silently delete pull or subtree intent.

The automatic target frame is the bounding box of visible canonical document
positions before either override layer. Diagnostics, display-only radii,
camera, and prior translations are excluded. Fixed groups compute their current
center from the dynamic layer, then apply one shared translation to the target
in the base frame. No parent/child rule is applied twice and no displayed output
is fed back into either upstream layer.

SPATIAL1B preview geometry remains the current production authoring path. When a
dynamic layer exists, it supplies the current member positions while the target
frame remains the base automatic frame. Every pointer/keyboard sample derives a
sparse shared translation from captured geometry; graph coordinates remain
memory-only.

MOVE1A also indexes the winning translations returned by fixed composition.
For a displayed File target `P` and its applied Place translation `T`, the
temporary simulation target is `C = P - T`; a node without Place uses identity.
The index rejects duplicate folders and nodes shared by more than one applied
group rather than guessing a winner. Pull output already belongs to the dynamic
layer and is never inverted. This geometry remains pure and source-neutral.
