# REVIEW2 — Real local Git source capture

Status: **Complete — implementation and automated validation passed.**

REVIEW2 adds the desktop source-preparation layer between an authorized KG11
vault and the REVIEW1 engine. The public flow opens an opaque native session,
prepares a pinned first-parent range of 1–10 commits, enumerates changed and
additional Markdown paths, captures exact HEAD blobs plus every affecting
per-commit patch, maps the evidence into `GitHistoryReviewSource`, and disposes
the session.

The implementation is split deliberately:

- `packages/review-source-tauri` owns the root-free TypeScript contract,
  injected invoke bridge, native response validation, lifecycle/cancellation,
  capture-to-REVIEW1 mapping, and browser-unsupported behavior.
- `apps/desktop/src-tauri/src/review_source.rs` owns selected-root and private
  registry authorization, standard Git/worktree discovery, hardened read-only
  Git subprocesses, pinned inventory/blob/patch capture, finite limits, and
  real disposable-repository tests.
- `packages/ai-review` accepts legitimate empty source blobs and retains one
  additive version-1 Git capture manifest. Diff material, IDs, path scope,
  completeness confirmation, and range provenance remain strict.

History is chosen before files. It follows first parents, counts a merge once,
stores all real parent IDs, orders commits oldest to newest, and derives the
base from the oldest selected commit's first parent. Root ranges are explicitly
unsupported; detached HEAD is supported; shallow/partial missing objects never
cause a fetch. Capture remains pinned when current HEAD advances.

Working-tree, staged, and untracked content is excluded with a warning. Hidden
paths, `node_modules`, symlinks, submodules, binary/NUL blobs, invalid UTF-8,
alternate object stores, traversal, non-UTF-8 paths, and over-limit evidence
are excluded or fail explicitly. Renames use documented delete/add semantics,
including at nested-vault boundaries. No shell/process capability, network,
model call, compiler-store change, graph/UI change, or user-repository write is
introduced.

Validation includes native real-Git cases for count/range, merge first-parent,
edit/revert, pinned HEAD, dirty worktrees, contexts/deletion/rename/empty files,
repository/history errors, nested vaults, linked worktrees, literal paths,
binary/path rejection, cancellation, helper defenses, shallow/missing objects,
special tree modes, paging, and finite size limits. TypeScript tests cover
bridge identity, browser support, disposal/late results, REVIEW1 preparation,
scripted execution, and Markdown/JSON export. The runnable smoke uses only a
disposable synthetic repository:

```bash
pnpm --filter @icarus-graph-explorer/review-source-tauri example
```

The visible review workspace/results, durable local run history, and verified
live-provider wiring remain later tasks. Source capture alone does not complete
those features.
