# HIER4B-PATCH2 — Exclude Focus/Root File from Soft Folder Attraction

**Goal:** In Soft Folder Clusters, the focused/root File must remain a neutral fixed anchor and must **not contribute to folder-attraction centroids or folder-force group membership**.

Current behavior is subtly wrong: the root module is fixed at `(0,0)` and is not itself moved by folder force, but it is still included when folder-group centroids are calculated. This biases other Files in the same displayed folder toward the Focus/root position.

## Required semantics
```arduino
Root File
→ remains fixed Focus anchor
→ participates normally in topology/reference springs
→ participates normally in hop-distance/root semantics
→ remains part of the displayed folder hierarchy / folder guides
→ DOES NOT participate in Soft folder-attraction groups or centroids

Root Headings / Blocks
→ never independent folder-cluster members
→ remain internal geometry of the root File module
```

This patch is **only about folder-force influence**. Do not remove the root File from folder guides, display-tree membership, canonical folder identity, context menus, or topology.

## Implementation

Inspect current `main`, especially:
```
packages/focus-schematic-layout/src/soft-clusters.ts
```

`hierarchyFolderGroups(...)` currently derives groups from `focusSchematicSoftFolderScopeMemberships(...)`. Make the force-group assembly explicitly aware of:
```
input.model.rootModuleId
```

and filter that module out **before** deciding whether a folder has enough members to exert attraction.

Example:
```less
Folder A:
- Focus/root File
- File B

force members after root exclusion:
- File B

result:
no Folder A attraction group
```

because a one-member group cannot attract anything.

But:
```arduino
Folder A:
- Focus/root File
- File B
- File C

force members:
- File B
- File C

centroid:
computed from B + C only
```

The root must not bias that centroid toward `(0,0)`.

Do **not** change the generic displayed-folder membership helper unless necessary. Prefer keeping:
```scss
focusSchematicSoftFolderScopeMemberships(...)
```

truthful about hierarchy membership and filtering the root only at the **Soft force-group layer**.

## Metrics/evidence consistency

Any Soft metrics or runtime evidence that reuse `hierarchyFolderGroups(...)` must use the same root-excluded force groups.

Do not report the root as a folder-force participant if it no longer influences the force.

Visual/display membership metrics may still count it where semantically appropriate.

## Cache/version

This changes Soft geometry, so inspect:
```
FOCUS_SCHEMATIC_SOFT_CLUSTER_ALGORITHM_VERSION
```

and bump the Soft algorithm/cache version if that is the repository's cache invalidation seam.

Do not invalidate Directional layout behavior unnecessarily.

## Required tests

1. **Root + one same-folder File**&#x20;
```
strength 100
```

must create no attraction from that folder.

2. **Root + two same-folder Files**&#x20;

B/C attract toward each other; their centroid excludes root.

3. **Non-root repeated folder**&#x20;

Existing H1 attraction remains unchanged.

4. **Root remains visually in its folder**&#x20;

Display tree/folder guide membership unchanged.

5. **Root Heading/Block descendants**&#x20;

never appear as independent folder-force members.

6. **Strength 0**&#x20;

unchanged.

7. **Directional Bands**&#x20;

byte-identical / unchanged.

8. &#x20;Deterministic cold-repeat result.&#x20;

## Non-scope

Do not touch:
```
Adaptive Compass × Soft work
HIER4B-SPACING
island splitting / unified regions
folder guide rendering
context menus
routing
HIER5
```

If the Adaptive Compass patch is being developed on another branch, keep this patch isolated and small so it can be rebased/cherry-picked cleanly.

## Validation

Run repository-current equivalents of:
```sql
pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout
pnpm check
git diff --check
```

Desktop build is optional if the change is fully covered by layout tests; do it if repository policy requires it.

## Documentation

Add one concise note to HIER4B documentation:
```csharp
In Focus Soft Folder Clusters, the Focus/root File remains a topology anchor
and visible folder member but is excluded from folder-attraction centroids
and force membership.
```

Archive the prompt as:
```
history-implementations/HIER4B_PATCH2_exclude_root_from_soft_folder_force_codex_prompt.md
```

Report SHA-256.

## Final report

Return:
```sql
branch / commit
exact root-exclusion implementation
tests
Soft algorithm-version/cache change, if any
Directional regression status
prompt SHA
```

No PR/merge unless explicitly requested.
