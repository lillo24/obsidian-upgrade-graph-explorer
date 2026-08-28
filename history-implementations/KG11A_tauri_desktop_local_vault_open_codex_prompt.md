# KG11A — Tauri Desktop Foundation + One-Shot Local Vault Open

**Task type:** desktop/platform integration / local source-provider boundary / private app-local identity persistence

## Why KG11 is split

KG11 crosses several new boundaries at once: Tauri/Rust shell, native folder selection, scoped filesystem access, recursive vault discovery, private app-local identity persistence, browser integration, and later live file watching.

Split it into:

```text
KG11A — desktop shell + secure one-shot local vault open
KG11B — recursive watching + event coalescing + live KG10 updates/resync
```

Do not start KG11B automatically. After KG11A, `ROADMAP.md` should show KG11 **in progress**, with KG11A complete and KG11B next.

## Goal

Implement:

```text
Tauri desktop app
→ Open Vault
→ native directory dialog
→ session-scoped filesystem access
→ recursive Markdown/non-Markdown inventory
→ load/create app-local workspace identity
→ KG10 initializeObsidianWorkspaceEngine()
→ stable snapshot + catalog
→ persist catalog/registry app-locally
→ build in-memory ObsidianDiagnosticReport
→ existing KG6/KG7/KG8/KG9 UI
```

Keep the app read-only with respect to the selected vault. Ordinary browser mode must continue working with the current sample/report workflow.

KG11A is intentionally **one-shot acquisition**: automatic filesystem watching belongs to KG11B.

---

# Current repository evidence

Repository: `lillo24/icarus-graph-explorer`

KG10 merged through PR #14 at `1f4f79956a93d7eb5eb543ac05b6950262140b90`.

The current roadmap has:

```text
KG10 — Complete
KG11 — Tauri local-vault workflow — next
KG12 — Performance + worker hardening
```

The current browser app stores one validated `ObsidianDiagnosticReport` and renders the product from it. Do not replace this application model in KG11A.

KG10 already exposes enough runtime data:

```text
engine.snapshot
engine.identityCatalog
engine.resolutionDiagnostics
engine.parsedDocuments()
```

so a local vault can be converted into the existing in-memory report without reparsing.

Other UI cleanup may be happening concurrently. Keep KG11A UI changes narrow: source/open controls, source status, and session orchestration only. Rebase onto the latest `main` before final integration and preserve newer UX work.

Before editing, inspect:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- ADR 0006 and 0007
- `apps/web/README.md`
- `apps/web/src/App.tsx`
- KG9B persistence code
- `packages/diagnostics-obsidian`
- `packages/workspace-engine-obsidian`
- `packages/stable-identity`
- `tools/vault-diagnostics/src/discovery.ts`
- `tools/vault-diagnostics/src/identity-store.ts`
- package/workspace/CI configuration

---

# Tauri version/docs rule

Use Tauri v2 and verify current compatible package versions during implementation. Do not blindly copy stale examples.

Official sources:

- https://v2.tauri.app/
- https://v2.tauri.app/start/create-project/
- https://v2.tauri.app/plugin/dialog/
- https://v2.tauri.app/plugin/file-system/
- https://v2.tauri.app/security/capabilities/
- https://v2.tauri.app/start/prerequisites/

At planning time the npm ecosystem is around:

```text
@tauri-apps/api           2.11.x
@tauri-apps/cli           2.11.x
@tauri-apps/plugin-dialog 2.7.x
@tauri-apps/plugin-fs     2.5.x
```

Verify and pin current compatible versions.

Important documented behavior: paths selected through the dialog are added to filesystem scope for the current process/session, but that dynamic scope is not persisted after restart.

Use that security model. Do not grant broad `$HOME/**`, `C:/**`, or equivalent read access merely to reopen a vault automatically.

No useful installable Tauri agent skill was found. Use official docs and package types as source of truth.

---

# Desktop structure

Add a dedicated shell, preferably:

```text
apps/
  web/
  desktop/
    package.json
    README.md
    src-tauri/
      Cargo.toml
      tauri.conf.json
      capabilities/
      src/
```

The desktop shell must host the **existing** `apps/web` Vite frontend. Do not duplicate or move the React product into a starter-template frontend.

Add clear scripts equivalent to:

```text
pnpm desktop:dev
pnpm desktop:build
pnpm desktop:check
```

`pnpm dev` must remain ordinary browser development.

Keep Rust minimal: initialize Tauri/plugins/configuration. Do not port Markdown parsing, resolution, identity, diagnostics, or graph logic to Rust.

Expected dependencies are limited to current compatible versions of:

```text
@tauri-apps/api
@tauri-apps/cli
@tauri-apps/plugin-dialog
@tauri-apps/plugin-fs

tauri
tauri-plugin-dialog
tauri-plugin-fs
```

Do not add store/opener/updater/log/watcher libraries unless actual KG11A implementation proves one necessary.

Filesystem `watch` support is KG11B.

---

# Capabilities/security

Tauri v2 permissions and filesystem scopes are separate requirements.

Use the smallest capabilities needed for:

```text
native directory open dialog
read directory metadata/content inside the explicitly selected root
read/write app-specific private state
```

The intended access pattern is:

```text
user clicks Open Vault
→ native dialog
→ selected root is dynamically scoped for this session
→ source provider reads it
```

App-private registry/catalog files belong in Tauri application data directories.

Do not use `withGlobalTauri` unless needed.

Do not statically scope the user's whole home drive.

Because dialog scopes are session-only, KG11A should **not** silently auto-read the last arbitrary vault after process restart. The user may reselect it; the private registry can still recover the stable workspace/catalog afterward.

---

# New package: `source-provider-tauri`

Create a Tauri-specific outer package, likely:

```text
packages/source-provider-tauri/
@icarus-graph-explorer/source-provider-tauri
```

Likely dependencies:

```text
core
stable-identity
@tauri-apps/api
@tauri-apps/plugin-dialog
@tauri-apps/plugin-fs
```

No React, React Flow, projection, inspection, diagnostics UI, Graphology, or Sigma dependency.

The package acquires sources/private identity state; it does **not** own KG10. The web/application layer can pass the returned source inventory/catalog into `workspace-engine-obsidian`.

Use a small API conceptually like:

```ts
selectVaultDirectory()
discoverSelectedVault(selection, options?)
loadOrPrepareWorkspaceIdentity(selection)
commitWorkspaceIdentity(session, nextCatalog)
```

Representative values:

```ts
interface VaultSelection {
  rootPath: string        // private absolute platform path
  displayName: string
}

interface VaultSourceInventory {
  markdownDocuments: readonly { path: WorkspacePath; source: string }[]
  nonMarkdownPaths: readonly WorkspacePath[]
}
```

Absolute root paths may exist in the Tauri session and private registry only. They must never enter canonical snapshots, diagnostic reports, KG9A catalogs, or KG9B saved view state.

---

# Testable Tauri bridge

Unit tests must not require a real Tauri runtime.

Wrap the narrow native surface behind an internal injectable bridge for:

```text
open directory dialog
read directory
read file bytes
lstat/stat if needed
app-data mkdir/read/write/rename
path join/normalize/basename
```

Production uses official Tauri APIs; tests use a fake.

Do not turn this into a universal filesystem framework.

---

# Vault discovery contract

Match the current trusted `tools/vault-diagnostics/src/discovery.ts` semantics:

- recursive traversal;
- hidden entries skipped;
- `node_modules` skipped;
- optional normalized workspace-relative excludes;
- symlinks not followed;
- `.md` matching case-insensitively;
- strict UTF-8 Markdown decoding;
- deterministic path ordering;
- non-Markdown paths inventoried without reading binary contents.

Do not ingest `.obsidian`, `.git`, etc. through hidden directories.

Do not use `.obsidian/graph.json` as source scope.

Do not hard-code Icarus-specific excludes.

If duplicating discovery policy would create drift, extract only the small **pure** rules/helpers from the Node scanner into a source-neutral helper used by both Node and Tauri. Keep Node/Tauri I/O separate.

For strict UTF-8, prefer reading bytes and:

```ts
new TextDecoder('utf-8', { fatal: true })
```

unless the current official Tauri API is proven equivalently strict.

Do not follow symlinks outside the selected root.

---

# Private workspace registry

Create a versioned app-local registry, conceptually:

```ts
interface TauriWorkspaceRegistry {
  schemaVersion: 1
  workspaces: readonly {
    rootPath: string
    workspaceId: WorkspaceId
  }[]
}
```

This is private **platform metadata**, so it may contain the absolute selected root path. It must not contain source body, snapshots, reports, or view state.

Store it under application-local data, outside the vault.

Use one deterministic lexical/platform normalization policy for matching a reselected root. Do not fuzzy-match old roots.

If the root folder is moved/renamed and no exact normalized registry entry matches, treat it as a new association in KG11A. Document this limitation; do not fingerprint the entire vault to guess.

---

# App-local stable identity catalogs

Store one KG9A catalog per registered workspace, e.g.:

```text
<AppLocalData>/
  workspaces.json
  identity/
    <workspace-id>.json
```

Use existing KG9A validation. Do not put absolute root paths inside the catalog.

For a new root:

1. generate a new opaque workspace ID in the outer Tauri/app boundary;
2. create/prepare an in-memory catalog;
3. discover sources;
4. initialize KG10;
5. only after successful processing, commit catalog + registry association.

Use an injectable deterministic ID factory in tests; no UUID dependency is needed.

For a known root:

1. load registry entry;
2. load/validate catalog;
3. initialize KG10 with stored workspace ID/catalog;
4. commit the next catalog only after success.

Missing/corrupt/incompatible state must fail explicitly. Do not silently recreate identity.

---

# Safe app-local writes

Use a temporary sibling + rename/replace style for registry/catalog updates where supported.

Do not silently truncate valid state.

For a brand-new association, prefer:

```text
write validated catalog
→ update registry
```

so a registry never points to a catalog that was never written. An orphaned unreferenced catalog after a registry failure is safer than the reverse.

No database/store plugin is needed.

---

# Explicit identity reset recovery

The desktop app now owns KG9A catalog persistence, so this is the correct layer for a deliberate recovery action.

Provide an explicit, secondary action such as:

```text
Reset local identity for this vault
```

when catalog/registry corruption requires recovery.

Require clear confirmation because stable IDs and prior saved view continuity change.

Keep it distinct from KG9B's:

```text
Reset saved view
```

Reset identity should generate a new workspace ID/catalog and, if practical, clear the old KG9B saved view for the previous workspace ID.

Do not make identity reset a primary routine control.

---

# Truthful stable/transient provenance

An in-memory report may say:

```text
identity.stability = "stable"
```

only when app-local workspace/catalog persistence succeeds.

If processing succeeds but identity persistence fails, preferred safe fallback is:

```text
show the vault for this session
mark identity as transient
show a nonfatal warning
```

Failing the entire open is also acceptable if a clean transient downgrade is impractical.

Never claim stable identity after a failed catalog/registry write.

---

# Application integration

Preserve the existing browser report application.

Add a Tauri-only flow:

```text
Open Vault
→ source-provider inventory
→ workspace identity session
→ initializeObsidianWorkspaceEngine()
→ buildObsidianDiagnosticReport({
     snapshot: engine.snapshot,
     diagnostics: engine.resolutionDiagnostics,
     documents: engine.parsedDocuments(),
     nonMarkdownPaths,
     identity
   })
→ set current report
```

Do not serialize that report to disk.

Do not parse the documents again for diagnostics.

Use `engine.parsedDocuments()`.

Use current documented Tauri runtime detection such as `isTauri()`. Avoid undocumented globals. Prefer a dynamic import for the Tauri provider if that keeps browser mode clean.

Opening a vault should behave like loading a new workspace:

- replace current report;
- reset transient search/selection;
- let existing KG9B hydration restore the stable workspace view;
- leave graph/projection semantics unchanged.

---

# UI

Keep changes minimal.

In Tauri runtime add:

```text
Open Vault
```

near the current source controls.

Keep Sample/Open Report available unless newer UI cleanup deliberately changes their placement.

Show concise loading/error/source status.

Use only safe display name/basename in normal UI; do not expose the full absolute root path by default.

Browser privacy wording and desktop local-vault wording must remain accurate:

```text
browser report: selected JSON stays local
desktop vault: selected vault is read locally and not uploaded
```

Cancellation is not an error.

A failed vault open should preserve the last valid report when possible.

Do not add permanent development explanations.

---

# Errors

Handle at least:

- dialog cancel;
- unreadable root/subdirectory;
- unsafe path;
- symlink policy failure;
- malformed UTF-8 Markdown;
- malformed registry;
- missing/corrupt catalog;
- KG10 initialization failure;
- diagnostic-report build failure;
- app-local identity write failure.

Do not show a success-shaped empty graph after failure.

---

# Explicit KG11A non-goals

Do **not** implement:

- `watch` / `watchImmediate`;
- filesystem event coalescing;
- live KG10 updates;
- out-of-sync rescan;
- source snippets/preview;
- open/reveal in Obsidian;
- `plugin-opener`;
- source editing;
- automatic vault reopening without re-authorization;
- vault-local `.icarus` metadata;
- `plugin-store`;
- updater/release/signing;
- KG12 workers/performance changes.

---

# Tests

## `source-provider-tauri`

Using a fake native bridge, cover:

- dialog cancel;
- valid selection/display name;
- recursive Markdown discovery;
- hidden dirs and `node_modules` skipped;
- configured excludes;
- case-insensitive `.md`;
- deterministic ordering;
- non-Markdown inventory;
- invalid UTF-8;
- unreadable entries;
- symlink not followed;
- new registry/workspace allocation;
- same root reuses workspace ID;
- different root gets different ID;
- malformed/unsupported registry rejection;
- valid catalog load;
- missing/corrupt known catalog rejection;
- safe catalog replacement failure behavior;
- catalog never contains absolute root path.

## Web integration

Cover:

- ordinary browser works without Tauri;
- Open Vault only available in Tauri runtime;
- cancellation changes nothing;
- success initializes KG10 once;
- diagnostic report uses engine parsed documents;
- successful identity commit marks stable;
- identity-write failure follows chosen stable/transient policy;
- opening vault resets transient report/search/selection state;
- KG9B saved view restores for known stable workspace;
- source errors preserve prior valid report;
- Sample/Open Report remain functional.

---

# Desktop validation / CI

Add a minimal Tauri compile gate.

Local checks should include:

```text
cargo fmt --check
cargo check
desktop dev smoke
desktop build/no-bundle smoke
```

The existing browser/core CI should remain fast/reliable.

If practical, add a separate Tauri CI job using current official prerequisites (Rust + WebKitGTK/system packages on Ubuntu, or another evidence-backed runner) instead of bloating the main validation job.

No signing/installer/release pipeline.

Actual desktop smoke:

1. launch native app;
2. native window loads existing frontend;
3. Open Vault opens native directory selector;
4. select synthetic vault;
5. graph loads;
6. `pnpm dev` still works in browser.

---

# Real Icarus validation

Validate through **desktop Open Vault**, not by loading the old JSON report.

Aggregate checks:

```text
Markdown documents
canonical entities
references
source acquisition time
KG10 initialization time
diagnostic construction time
identity reused/new counts
```

Then:

1. close/restart desktop app;
2. reselect the same vault;
3. registry recognizes the same workspace;
4. existing identity catalog is reused;
5. unchanged entity/reference identity churn is zero;
6. existing KG9B saved view restores for that workspace.

Do not expose private paths/note names in the final report.

Do not commit registry/catalog/report/source data.

---

# ADR 0008

Add a concise ADR recording:

1. Tauri v2 wraps the existing Vite/React frontend.
2. Source acquisition remains an outer platform adapter.
3. User-selected session scope is preferred to blanket filesystem access.
4. Automatic broad reopen is deferred.
5. Absolute root → workspace ID mapping is private app-local platform metadata.
6. KG9A catalogs remain outside Markdown/vault.
7. Stable report provenance is claimed only when catalog persistence succeeds.
8. KG10 remains the in-memory processing engine.
9. Watching/live updates are KG11B.

---

# Documentation / roadmap

Likely update:

```text
apps/desktop/README.md
packages/source-provider-tauri/README.md
apps/web/README.md
README.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
docs/decisions/0008-*.md
eslint.config.*
.github/workflows/ci.yml
package.json
pnpm-lock.yaml
```

Document:

```text
browser mode:
  report/sample

desktop KG11A:
  report/sample + native one-shot Open Vault

KG11B:
  live watch/update
```

After completion:

```text
KG11 — In progress
KG11A — Complete
KG11B — Next
```

Do not mark KG12 next yet.

---

# Scope summary

## In scope

- Tauri v2 shell around current frontend;
- dialog + secure selected-root read access;
- Tauri source-provider package;
- KG5-compatible discovery semantics;
- app-local workspace registry;
- app-local KG9A catalogs;
- safe stable workspace creation/reuse/reset;
- KG10 initialization;
- in-memory diagnostic report;
- minimal Open Vault UI;
- browser fallback;
- KG9B restoration;
- desktop compile/CI smoke;
- synthetic and private real-vault validation;
- ADR/docs/roadmap.

## Out of scope

- watchers/live updates;
- open-in-source;
- source snippets/editing;
- automatic secure reopen;
- saved filesystem scope;
- store/updater/opener plugins;
- release pipeline;
- partial resolver changes;
- workers/KG12.

---

# Suggested implementation sequence

1. Reconcile latest `main` and concurrent UX work.
2. Add `apps/desktop` Tauri shell around `apps/web`.
3. Configure minimal capabilities and dialog/fs plugins.
4. Build testable `source-provider-tauri`.
5. Match/refactor KG5 discovery policy.
6. Implement registry/catalog app-local storage.
7. Implement stable workspace orchestration.
8. Initialize KG10 and build in-memory report.
9. Add minimal Tauri Open Vault UI.
10. Add corruption/write-failure recovery.
11. Test KG9B restore on known workspace.
12. Run unit/web/Tauri synthetic QA.
13. Run private Icarus open/reopen validation.
14. Add desktop CI/check.
15. Add ADR/docs and mark KG11A complete.
16. PR → CI → merge → post-merge CI → cleanup.

---

# Validation commands

Use repository-equivalent commands, approximately:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/source-provider-tauri typecheck
pnpm exec vitest run packages/source-provider-tauri

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web
pnpm --filter @icarus-graph-explorer/web build

cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --check
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
git diff --check
```

Also run the final chosen:

```text
desktop dev smoke
desktop build/compile smoke
synthetic directory Open Vault
real private Icarus Open Vault
restart + reselect same vault
```

PR CI and post-merge `main` CI must pass.

---

# Exit gate

KG11A is complete only when:

1. Tauri v2 desktop shell exists and reuses `apps/web`.
2. Ordinary browser mode still works.
3. Tauri/plugin versions are pinned/documented.
4. No blanket home/filesystem read scope is granted.
5. Native folder selection authorizes the chosen root for the session.
6. Tauri platform APIs remain outside core/domain packages.
7. Source-provider tests require no native runtime.
8. Discovery matches KG5 hidden/node_modules/exclude/symlink/UTF-8 semantics.
9. Non-Markdown inventory remains path-only.
10. Absolute root paths never enter canonical/report/catalog/view data.
11. A validated private app-local workspace registry exists.
12. A known selected root reuses its stable workspace ID.
13. Unknown/root-moved locations are not fuzzy-guessed.
14. KG9A catalogs remain app-local and outside the vault.
15. Corrupt/missing known identity state does not silently reset.
16. Explicit recovery/reset is safe and distinct from Reset saved view.
17. Registry/catalog writes are failure-safe.
18. KG10 initializes directly from discovered sources.
19. Diagnostics reuse `engine.parsedDocuments()` with no second parse.
20. Report stability is truthful about persistence success/failure.
21. Desktop Open Vault loads the existing graph/inspector.
22. Browser Sample/Open Report remains functional.
23. Failed opens preserve the prior valid report when possible.
24. Restart + reselect same vault reuses identity.
25. KG9B saved view restores for that stable workspace.
26. No watcher/live update/source-write code is introduced.
27. Tauri compile/check and desktop smoke pass.
28. Real private Icarus open/reopen aggregate validation passes.
29. No private artifacts are committed.
30. Existing KG1–KG10 tests remain green.
31. ADR/docs are reconciled.
32. KG11 remains in progress; KG11A complete; KG11B next.
33. PR CI/post-merge CI pass.
34. Branch cleanup/worktree are clean.

Do not begin KG11B.

---

# Final report

Report:

## 1. Summary
Desktop/local-vault capability now available.

## 2. Desktop architecture
`Tauri shell → Tauri source provider → KG10 → in-memory report → existing UI`.

## 3. Versions/dependencies
Exact Tauri/plugin versions/licenses.

## 4. Security/capabilities
Selected-folder session scope, app-data permissions, absence of blanket read access.

## 5. Source-provider contract
Selection, discovery, UTF-8, symlinks, non-Markdown inventory, fake bridge.

## 6. Workspace identity storage
Registry/catalog schemas/locations, new/existing/reset flow, safe writes, root-move limitation.

## 7. App integration
Runtime detection, Open Vault, browser fallback, no duplicate parsing.

## 8. Persistence behavior
Stable/transient reporting and KG9B restore after restart/reselection.

## 9. Real Icarus QA
Aggregate scale/timings and first/second-session identity/view restoration. No private names.

## 10. Dependencies / skills
Confirm official Tauri docs were used and no arbitrary Tauri repository skill was added.

## 11. Tests / CI
All commands, desktop smoke, browser regression, PR/post-merge CI.

## 12. Privacy
No upload, vault write, private artifact commit, or absolute-path leakage into canonical/report/catalog/view data.

## 13. Files changed
Important desktop/provider/web/docs/CI areas.

## 14. ADR / roadmap
`KG11A complete`, `KG11B next`, `KG11 in progress`.

## 15. Deviations / warnings
Folder re-selection requirement, root relocation limitation, Tauri CI/platform issues, source acquisition timings, identity-write downgrade policy, KG11B blockers.

## 16. KG11B handoff
State that KG11B can rely on the desktop shell, currently selected root/provider session, stable app-local workspace/catalog identity, retained KG10 engine, and existing UI. It should acquire/coalesce filesystem changes, call KG10, preserve KG9 view state, and use full resync for out-of-sync watcher conditions.

Do not implement KG11B automatically.
