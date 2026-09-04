# FOLDERQUERY1 — Exact Folder-Subtree Queries + Network Explorer Hide Folder

**Task type:** query-language extension / Network Explorer interaction / Visual Groups compatibility / UI recovery flow

## Goal / success outcome

Add first-class, safe folder-subtree semantics to QUERY1 and use them for Network Explorer folder actions.

The core product behavior should be:

```text
right-click folder in Network Explorer
→ Hide folder
→ current applied query AND NOT folder="Integrating the ideas"
```

where:

```text
folder="Integrating the ideas"
```

means every canonical entity whose source file is inside that folder or any descendant folder.

The same QUERY1 predicate must work everywhere QUERY1 already works:

```text
Advanced Query
Saved Queries
Visual Groups
projection filtering
navigation/filter compatibility
```

Example Visual Group:

```text
GROUP "Theory"
query:
folder="Integrating the ideas"
OR folder="Y-General thoughts"
```

Do not add a second folder-filter language for Visual Groups.

Do not implement folder hiding through existing substring `path:"..."` because generated Hide actions need exact deterministic folder identity.

---

## Current evidence

Inspect current `main` before implementation; newer merged work overrides this prompt.

At plan-writing time:

```text
main = 836c465ea3143e769b7ee1937261b2a43cd80587
```

### QUERY1

`packages/graph-query` currently supports:

```text
path:"Notes"
→ case-insensitive path substring

path="Notes/Foo.md"
→ exact canonical WorkspacePath
```

alongside `AND / OR / NOT`, `title`, `text`, `kind`, and `level`.

The exact-path predicate and source-neutral exclusion helpers already exist for `Hide file`.

Preserve all existing query semantics.

### Visual Groups

Visual Groups compile/evaluate through `@icarus-graph-explorer/graph-query`.

Therefore `folder=` should become available to Visual Groups through QUERY1 itself. Do not create Visual-Group-specific folder matching.

### Network Explorer

The Network Explorer already contains a real source-folder tree.

`apps/web/src/network-explorer-folders.ts` defines folder rows with exact source paths. Folder rows are UI/navigation structures derived from canonical source paths; they are not canonical graph entities.

Preserve that architecture.

### Folder identity

Core already owns normalized exact folder keys:

```text
WorkspaceFolderKey
isNormalizedWorkspaceFolderKey(...)
workspaceFolderKeyFromPath(...)
```

Prefer the core folder-key contract for QUERY1 rather than creating another parser.

### Existing File actions

Network Explorer node actions already support:

```text
Focus
Inspect
Hide file
Size
```

Current context targeting is node-only. Extend it cleanly to folders rather than pretending a folder is a node.

### Concurrent work

At plan-writing time PR #60 (`SPACING1B`) is open. It touches Focus Network renderer/camera/performance code and some docs, but not the primary QUERY1/Network Explorer folder-action files.

Do not modify/delete its branch or worktree. Rebase/update before final merge.

---

## Scope / non-scope

### In scope

- exact folder-subtree QUERY1 predicate;
- canonical folder-key validation;
- parser / AST / formatter / evaluator;
- source-neutral add/list/remove folder-exclusion operations;
- Network Explorer folder right-click/context menu;
- accessible keyboard path to the same folder menu;
- Hide folder;
- hidden-folder recovery/unhide UI;
- Saved Query compatibility;
- Visual Group compatibility;
- projection/navigation parity;
- tests, docs, browser/native QA.

### Out of scope

Do not implement:

- folder graph nodes;
- fake folder graph edges;
- folder clustering changes;
- SPATIAL folder offset/dragging changes;
- per-folder Group storage outside QUERY1;
- automatic Visual Group creation from folders;
- folder rename persistence/remapping;
- glob/regex syntax;
- generic filesystem search syntax;
- adaptive layout;
- Saved Views.

Do not change ordinary `path:"..."` or `path="..."` semantics.

---

# Implementation guidance

## 1. Add one explicit folder-subtree predicate

Add:

```text
folder="Integrating the ideas"
```

Semantics:

```text
entity source file folder
is exactly "Integrating the ideas"
OR is a descendant of it
```

Examples:

```text
folder="Theory"

Theory/A.md
→ match

Theory/Sub/B.md
→ match

Theory-old/C.md
→ no match

Archive/Theory/D.md
→ no match
```

This is a path-segment subtree, not string-prefix matching.

For:

```text
folder="A/B"
```

match:

```text
A/B/X.md
A/B/C/Y.md
```

but not:

```text
A/BB/X.md
A/B-old/X.md
```

## 2. Folder identity and case behavior

Use normalized `WorkspaceFolderKey` from core.

Prefer case-sensitive canonical identity, analogous to exact `path="..."`.

Document:

```text
path:"notes"
→ case-insensitive contains search

path="Notes/Foo.md"
→ exact canonical File path

folder="Notes"
→ exact canonical folder subtree
```

Do not lowercase generated folder keys.

## 3. Root folder semantics

Core uses `"."` as the workspace-root folder key.

Support it consistently if core validation already treats it as canonical.

Recommended:

```text
folder="."
→ all source-backed entities in the workspace
```

Do not add a synthetic root row merely for this feature.

## 4. Distinct AST predicate

Add a distinct predicate type, conceptually:

```ts
{
  kind: 'folder-predicate'
  value: WorkspaceFolderKey
}
```

Do not overload exact path.

File identity and folder subtree identity must remain structurally distinct.

## 5. Parser behavior

Accept canonical syntax:

```text
folder="A/B"
```

Canonical formatter always quotes the folder.

Do not add `folder:"..."` substring behavior in this slice.

Reject malformed keys using the core contract, including absolute paths, empty segments, `.`/`..` traversal inside non-root paths, backslashes, and drive prefixes.

## 6. Evaluation

Evaluate against the canonical source path of each addressable entity.

Thus:

```text
folder="Theory"
```

matches the Document, Sections, and Blocks sourced from:

```text
Theory/File.md
Theory/Sub/Other.md
```

This is desired for filtering, Hide folder, and Visual Groups.

Do not involve projection-only diagnostic nodes in QUERY1.

## 7. Source-neutral folder exclusion helpers

Mirror/generalize exact-path exclusion helpers with equivalents such as:

```ts
addFolderExclusion(...)
removeFolderExclusion(...)
listFolderExclusions(...)
```

Managed UI clauses are only top-level AND-chain clauses:

```text
NOT folder="A/B"
```

Do not treat arbitrary nested `NOT folder=` clauses as UI-managed hidden folders.

Reuse/generalize the exact-path helper architecture if that stays clean.

## 8. Generated Hide Folder operation

Examples:

```text
documents AND NOT path="Private.md"
+ Hide folder Theory

→ documents
  AND NOT path="Private.md"
  AND NOT folder="Theory"
```

No active query:

```text
Hide folder Theory
→ NOT folder="Theory"
```

Duplicate Hide is idempotent.

Never string-concatenate query text. Use AST operations and canonical formatting.

## 9. Query bounds

Generated operations must respect normal QUERY1 length / AST / nesting limits.

If Hide folder would exceed them:

- return explicit failure;
- keep the current applied query unchanged.

Do not truncate existing terms.

---

# Network Explorer folder actions

## 10. Generalize context target

Current targeting is node-only.

Generalize to a discriminated target:

```ts
type NetworkExplorerContextTarget =
  | { kind: 'node'; node: NetworkExplorerNode }
  | { kind: 'folder'; folder: NetworkExplorerFolder }
```

or equivalent.

Do not fabricate `EntityId` / `ProjectionNodeId` for folders.

## 11. Right-click folder

Right-clicking a folder row should open the same Network Explorer context-menu system.

Also support:

```text
Shift+F10
ContextMenu/Menu key
```

on folder rows.

At minimum expose:

```text
Hide folder
```

If SPATIAL1B already has Arrange Folder through another explicit row affordance, do not redesign it here unless reuse is trivial and clearly beneficial.

## 12. Hide-folder eligibility

Normally enabled if:

- row is a real source folder;
- same folder is not already managed-hidden;
- folder does not contain the current Focus source file;
- generated query stays valid.

If the focused source file is inside the folder subtree, disable with clear reason:

```text
Change Focus before hiding the folder that contains the focused file.
```

Do not silently exit Focus.

## 13. Hide complete subtree, not visible sidebar children

The action must use one `folder=` predicate, not enumerate currently visible Files.

This ensures collapsed descendants and future newly added Files remain hidden.

Example:

```text
Theory/
  A.md
  HiddenNested/
    B.md
```

Hide Theory must exclude both A and B even if HiddenNested is collapsed.

---

# Hidden-folder recovery

## 14. User must be able to unhide disappeared folders

After hiding, the folder row disappears from the projection/sidebar.

Generalize current hidden-File recovery into something like:

```text
Hidden
├─ Files
│  ├─ Foo.md      Restore
│  └─ Bar.md      Restore
└─ Folders
   ├─ Theory      Restore
   └─ Archive     Restore
```

or an equally compact UI.

Derive this from:

```text
listExactPathExclusions(...)
listFolderExclusions(...)
```

Do not persist a separate hidden-folder registry.

## 15. File and Folder exclusions compose independently

Example:

```text
NOT folder="Theory"
AND NOT path="Other/Foo.md"
```

Restoring Theory leaves the File exclusion unchanged.

If:

```text
NOT folder="Theory"
AND NOT path="Theory/Special.md"
```

then restoring Theory leaves Special.md hidden.

Do not infer intent and remove unrelated managed clauses.

## 16. Nested folder exclusions

Allow correctness even if redundant:

```text
NOT folder="Theory"
AND NOT folder="Theory/Drafts"
```

Avoid adding an obviously redundant descendant exclusion if an ancestor folder is already hidden when easy to detect.

Do not implement a broad Boolean simplifier merely to minimize query text.

---

# Visual Groups

## 17. `folder=` must work directly in Visual Groups

Examples:

```text
folder="Learning"
```

```text
folder="Integrating the ideas"
OR folder="Y-General thoughts"
```

```text
folder="Theory"
AND sections
```

No new Group schema.

Visual Groups remain classification/style only; `folder=` must not imply physical clustering.

## 18. Saved Queries

Saved Queries persist canonical QUERY1 strings.

`folder=` must save/load/round-trip without rewriting old queries or bumping schema unless current architecture strictly requires it.

---

# Projection / live behavior

## 19. Renderer-independent query

Folder evaluation belongs in QUERY1 and the canonical filtering path.

Do not add Sigma-, React Flow-, or sidebar-specific folder filtering.

## 20. Live vault behavior

With:

```text
folder="Theory"
```

active:

```text
add Theory/New.md
→ it matches automatically

move Theory/New.md → Archive/New.md
→ it stops matching
```

No query rewrite.

Folder rename remains path-semantic:

```text
Theory → Models
```

does not rewrite `folder="Theory"`.

Do not add fuzzy folder rename reconciliation in this milestone.

Document this limitation.

---

# Query help

## 21. Add compact help

Show:

```text
path:"memory"
Path contains "memory" (case-insensitive)

path="Notes/Memory.md"
Exact File path

folder="Notes"
Folder and all descendants
```

Expose the same syntax in Visual Group query help.

Do not claim full Obsidian-search compatibility.

---

# Architecture constraints

Keep distinct:

```text
folder query
→ source-path filtering/classification

Network Explorer folder
→ navigation/action row

Visual Group
→ query-defined visual style

folder clustering
→ layout prior

SPATIAL folder anchor
→ user position override
```

Same folder does not imply a graph edge, Visual Group, or fixed physical cluster.

---

# Tests

## QUERY1 parser/formatter

Cover:

- `folder="Theory"`;
- nested folders;
- canonical quoting;
- case preservation;
- invalid folder keys;
- root behavior;
- Boolean precedence;
- parse/format/parse;
- old canonical strings unchanged.

## Evaluator

Fixture:

```text
Theory/A.md
Theory/Sub/B.md
Theory-old/C.md
Archive/Theory/D.md
Root.md
```

Prove `folder="Theory"` matches only A/B and their Sections/Blocks.

## Exclusion operations

Cover:

- empty query + hide;
- AND;
- OR wrapping;
- File + Folder exclusions;
- duplicate hide;
- list/restore;
- sole exclusion → no query;
- nested user-authored `NOT folder=` not treated as managed;
- query-limit failure;
- deterministic formatting;
- immutability.

## Network Explorer

Cover:

- folder rows resolve to folder action targets;
- File actions unchanged;
- right-click folder;
- Shift+F10 folder;
- exact folder key callback;
- focused-containing folder disabled;
- stale/virtualized folder menu closes safely after query update.

## Hidden recovery

Cover:

- Files/Folders listed separately or clearly differentiated;
- restoring one type leaves the other unchanged;
- nested File/Folders compose;
- no duplicate recovery entries.

## Visual Groups

Prove folder query parity for direct/nested Files and their Sections/Blocks, and no sibling-prefix false match.

## Saved Queries

Round-trip `folder=` without regression.

## Live behavior

Where practical:

```text
active folder="Theory"
→ add Theory/New.md
→ appears
→ move out
→ disappears
```

No query mutation.

---

# Performance

Do not scan the filesystem or sidebar folder tree while evaluating a query.

Use already-available canonical `WorkspacePath` and core folder-key helpers.

Run current QUERY1/projection performance checks.

No new CI timing threshold.

---

# Concurrent work / merge discipline

Before final integration:

1. sync latest `main`;
2. inspect concurrent work touching `NetworkExplorer.tsx`, `network-explorer-context.ts`, `GraphExplorer.tsx`, or `packages/graph-query`;
3. do not modify/delete other worktrees;
4. rebase/update after concurrent merges;
5. resolve documentation overlap semantically;
6. rerun focused + full validation.

---

# Suggested implementation sequence

1. Sync current main.
2. Inspect QUERY1 AST/parser/evaluator/exact-path helpers.
3. Inspect core folder-key contract.
4. Add `folder=` AST/parser/formatter/evaluator.
5. Add folder exclusion helpers.
6. Add graph-query tests.
7. Add Saved Query + Visual Group parity.
8. Generalize Network Explorer context target to node/folder.
9. Add accessible `Hide folder`.
10. Wire it to AST-based applied-query mutation.
11. Generalize hidden recovery to Files + Folders.
12. Add Focus protection/stale-menu behavior.
13. Add DOM/virtualization tests.
14. Run query/projection benchmarks.
15. Run full repo validation.
16. Browser QA.
17. Native/release QA if required.
18. Archive this prompt under `history-implementations/`.
19. Open PR; merge only when instructed.
20. Do not start another feature automatically.

---

# Validation

Use current `AGENTS.md` as authoritative.

Expected focused commands include current equivalents of:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/graph-query typecheck
pnpm exec vitest run packages/graph-query

pnpm --filter @icarus-graph-explorer/visual-groups typecheck
pnpm exec vitest run packages/visual-groups

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Also run current QUERY1/projection benchmark commands.

Manual/browser scenarios:

```text
1. right-click Theory
2. Hide folder
3. Theory + nested Files disappear
4. Theory-old remains
5. Hidden recovery → Restore Theory
6. subtree returns
7. Focus a File inside Theory
8. Hide Theory disabled
9. Advanced Query: folder="Theory"
10. Saved Query round-trip
11. Visual Group: folder="Theory"
12. nested folder query
13. existing Hide File still works
14. combine Hide File + Hide Folder
15. live add/move under active folder query
16. no console warnings/errors
```

---

# Final report

Report:

1. exact `folder=` semantics;
2. parser/AST/evaluator changes;
3. folder exclusion operations;
4. Network Explorer context-menu behavior;
5. hidden-folder recovery;
6. Focus protection;
7. Visual Groups/Saved Queries compatibility;
8. live behavior;
9. path-based folder-rename limitation;
10. files changed;
11. tests/checks/benchmarks/QA;
12. dependencies added, if any;
13. follow-up work.

Do not start follow-up work automatically.
