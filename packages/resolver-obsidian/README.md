# Obsidian Workspace Resolver

Status: **STABLE — KG4 canonical assembly and conservative resolution policy are fixture-backed.**

This package consumes a complete in-memory set of KG3
`ParsedObsidianDocument` values and produces a validated schema-v1
`KnowledgeSnapshot`. It owns Obsidian-specific workspace matching while its
output remains source-neutral core data.

Dependency direction remains inward:

```text
resolver-obsidian → adapter-obsidian → parser-markdown → core
```

The resolver does not parse or read files, access the Obsidian runtime, mutate
source, persist identity, or build renderer/Graphology state.

## File map

```text
packages/resolver-obsidian/
  package.json       Workspace-only runtime dependencies and package export.
  tsconfig.json      Strict framework-independent TypeScript settings.
  src/
    index.ts         Intentional public exports.
    types.ts         Result, diagnostic, and replaceable ID-provider contracts.
    ids.ts           Default deterministic transient snapshot identity.
    spans.ts         Half-open UTF-16 source geometry helpers.
    input.ts         Fatal parsed-workspace invariant checks and diagnostic forwarding.
    workspace.ts     Canonical entity assembly and temporary workspace indexes.
    paths.ts         Wikilink and Markdown file-candidate policies.
    resolution.ts    File, heading-path, and explicit-block target resolution.
    resolve.ts       Public orchestration and final core runtime validation.
    index.test.ts    Synthetic workspace resolution and failure coverage.
```

## Public contract

```ts
resolveObsidianWorkspace({
  workspaceId,
  documents,
  idProvider?,
}): WorkspaceResolutionResult
```

The caller supplies already-parsed documents. Success returns a runtime-validated
`KnowledgeSnapshot` plus resolver and forwarded adapter diagnostics. Fatal
assembly problems return `{ ok: false, diagnostics }` without a partial or empty
snapshot.

A valid snapshot may still contain `unresolved`, `ambiguous`, or `invalid`
canonical references. Those are source facts, not assembly failure.

## Canonical assembly

- Documents are sorted by normalized workspace path.
- KG2 section hierarchy is flattened in source pre-order without reconstructing
  it from titles.
- Every valid KG3 explicit block anchor becomes a canonical block whose source
  span is exactly the `^block-id` marker. KG4 does not claim that marker span is
  the full Markdown block.
- Every parsed reference occurrence becomes a distinct canonical reference.
- Entities are ordered as documents, sections, then blocks; each category uses
  document-path and source order. References use source path and source offset.
- The finished snapshot must pass `validateKnowledgeSnapshot()` before success.

Block entities are parented to the deepest containing section or their document.
Reference source ownership similarly uses the deepest section that completely
contains the reference's half-open span; preamble references belong to the
document. A nearby block marker is not enough evidence to make a block the
source owner.

## Transient IDs

`transientSnapshotIdProvider` encodes a JSON tuple of workspace ID, source path,
entity kind, and source offset. Block IDs also include the explicit block label.
The same parsed workspace produces the same IDs, and distinct occurrences must
produce distinct IDs.

These IDs are snapshot identity only. They are not promised to survive file or
heading renames, insertion before a source construct, or block relocation. The
small `SnapshotIdProvider` interface lets KG9 replace this policy without
rewriting resolution.

## Resolution policy

KG4 implements a conservative Obsidian-compatible subset and exposes ambiguity
instead of claiming undocumented tie-breaker parity.

### Wikilinks

- `Note` and `Note.md` match Markdown documents by basename.
- Bare duplicate basenames remain ambiguous.
- `./` and `../` targets resolve exactly from the source document folder;
  traversal above the workspace root is invalid.
- Folder-qualified targets prefer an exact vault-relative path, then an exact
  source-relative path, then matching path suffixes. Equal best candidates stay
  ambiguous.
- Explicit non-`.md` extensions are unresolved as unsupported because KG4 has
  no attachment inventory.
- Matching is exact and case-sensitive; there is no fuzzy normalization.

### Markdown links

Local Markdown destinations resolve as paths relative to the source document.
Path and heading components are percent-decoded for matching, while canonical
`rawTarget` remains unchanged. Malformed percent encoding and workspace escape
are invalid. `+` is not treated as a space.

### Headings and blocks

One heading component matches exact section titles. Multiple components match a
contiguous structural title chain; a supplied chain may start below the document
root but may not skip hierarchy. Duplicate matches remain ambiguous.

Heading or block evidence is evaluated across every viable file candidate, so
it may safely narrow an ambiguous basename. Only explicit KG3 block anchors are
addressable, and duplicate block IDs remain multiple ambiguous candidates.

## Alias correction

YAML aliases remain adapter metadata for future search, suggestions, labels, and
unlinked mentions. They are deliberately absent from resolver file indexes.
Persisted `[[Alias]]` text does not resolve merely because a document declares
that alias; the interoperable authored form is `[[Target|Alias]]`.

## Diagnostics

Fatal diagnostics cover invalid workspace identity, duplicate/invalid document
paths, incompatible source geometry, ID-provider failures/collisions, and final
canonical validation failure. They prevent snapshot return.

Non-fatal diagnostics cover unresolved, ambiguous, invalid, and unsupported
targets and forward KG3 diagnostics with source path, span, severity, and the
original adapter code. Canonical references also carry concise stable reasons.

## KG5 handoff

KG5 can inspect canonical documents, sections, marker-backed blocks, exact
source-owner references, every resolution state/candidate, source spans, and
separate resolver/adapter diagnostics. Real-vault validation should test
platform case sensitivity, partial-path tie-breaking, heading compatibility,
and attachment inventory behavior before any policy becomes more permissive.

## Local validation

Run from the repository root:

```bash
pnpm --filter @icarus-graph-explorer/resolver-obsidian typecheck
pnpm exec vitest run packages/resolver-obsidian
pnpm check
```
