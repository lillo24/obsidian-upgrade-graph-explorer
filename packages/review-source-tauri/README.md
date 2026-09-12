# Tauri Git Review Source

Status: **REVIEW2 complete — bounded native capture and REVIEW1 mapping are test-backed.**

This outer adapter prepares real local Git evidence for the headless AI Review
engine. It owns the TypeScript/native bridge, runtime validation, lifecycle,
and mapping into `GitHistoryReviewSource`; it does not own model execution,
the compiler, React, graph state, or repository mutation.

```text
src/
  types.ts       Version-1 root-free session, preparation, inventory, capture, error, and limit contracts.
  bridge.ts      Narrow injectable Tauri invoke bridge; no shell/process surface.
  validation.ts  Runtime validation of untrusted native responses and contained paths.
  mapping.ts     Honest source/diff/manifest mapping into REVIEW1 and prompt preparation.
  provider.ts    Opaque session/preparation/request lifecycle, cancellation, and late-result checks.
  index.ts       Intentional public exports.
  provider.test.ts  Browser, bridge, lifecycle, mapping, export, and scripted-engine coverage.
```

The Rust owner is
`apps/desktop/src-tauri/src/review_source.rs`. It runs a resolved Git executable
with argument arrays, a scrubbed environment, literal pathspecs, helper- and
replacement-disabling settings, no optional locks or lazy fetch, and bounded
time/stdout/stderr. The webview receives only dedicated commands; no general
shell/process permission is installed.

## Caller flow

The existing vault must already be selected and have a durably committed
workspace identity. Native opening verifies both Tauri's process-local
filesystem scope and the exact app-local workspace registry association.
Absolute paths occur only in that opening call and never enter captured source,
REVIEW1 prompts, or exports.

```ts
const provider = createReviewSourceProvider();
if (!provider.isSupported()) throw new Error('Desktop capture required');

const session = await provider.openAuthorizedSession(identitySession);
try {
  const prepared = await session.prepareLastCommits(3);
  const context = await session.listAdditionalFiles(prepared.preparationId, {
    query: 'axiom',
    limit: 50,
  });
  const capture = await session.capture(
    prepared.preparationId,
    [prepared.changedFiles[0]!.path, context.files[0]!.path],
    { signal },
  );
  const frozen = prepareCapturedReviewInput(capture.native, {
    additionalRequest,
    models,
  });
  // The later overlay may now pass the same capture.source to ReviewEngine.
} finally {
  await session.dispose();
}
```

Preparing chooses the last 1–10 commits from pinned local `HEAD` before any
file filtering. Traversal follows first parents; a merge counts once and is
compared with its first parent. Full IDs and every actual parent are retained,
ordered oldest to newest, and the base is the oldest commit's first parent.
A range reaching the real root is explicitly `root-range-unsupported` because
REVIEW1 requires a real base commit. Detached HEAD is supported without a
branch name. Shallow/partial missing history or objects never triggers a fetch.

Changed paths aggregate every selected commit, including paths later deleted.
Additional context files are pageable/searchable from the pinned HEAD tree
without loading content. Capture reads strict-UTF-8 blobs from that exact tree
and one deterministic patch per selected path per affecting commit, so an edit
and revert remain visible. Complete files are retained once. Empty source blobs
are valid; deleted paths retain patches without invented source text.

Renames deliberately use `--no-renames` and are represented as delete/add.
This is deterministic and turns a cross-vault move into only its in-scope
endpoint. Hidden paths and `node_modules` follow the shared vault discovery
policy. Symlinks, submodules, binary/NUL data, invalid UTF-8, alternate object
stores, unusual non-UTF-8 names, oversized evidence, and unsupported metadata
redirection fail or appear as explicit unavailable/excluded entries.

Working-tree/staged/untracked contents are never read as review material. A
warning reports their presence while sources still come from pinned objects.
If HEAD advances after preparation, capture continues from retained pinned
objects and sets `headAdvanced`; if those objects disappear, it fails rather
than mixing revisions. `completeness` means complete for the explicitly
selected paths, never the repository. This adapter never sets
`acceptIncomplete` for a caller.

## Finite limits and errors

- 4 active sessions and 4 retained preparations per session
- 1–10 commits, 32 selected files, 20,000 inventory entries
- 200 files per page, 512 KiB per blob and per patch
- 900 KiB total material, 8 MiB bounded Git inventory output
- 10 seconds per Git command and 30 seconds per prepare/capture operation

Errors distinguish unsupported runtime, authorization/permission, unavailable
Git/repository/HEAD/history/object, root boundary, invalid selection/path/UTF-8,
unsupported files/layouts, size/time limits, stale preparation, cancellation,
Git command failure, and invalid native envelopes. Browser import is safe;
opening returns `unsupported-runtime` without invoking native code.

## Reproducible smoke and validation

The smoke creates and removes a disposable synthetic Git repository and calls
the production Rust preparation/capture core. It prints commit count/full IDs,
paths, bytes, and completeness; it performs no model call.

```bash
pnpm --filter @icarus-graph-explorer/review-source-tauri example
pnpm exec vitest run packages/review-source-tauri packages/ai-review
pnpm desktop:check
```

Any scripted model output in tests remains labelled
`SYNTHETIC REVIEW OUTPUT — NOT AN AI CONCLUSION`.
