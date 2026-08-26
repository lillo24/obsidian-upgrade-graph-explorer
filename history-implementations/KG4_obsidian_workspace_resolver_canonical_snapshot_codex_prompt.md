# KG4 — Obsidian Workspace Resolver + Canonical Snapshot Assembly

**Task type:** workspace resolution / canonical assembly / source-to-domain integration

## Goal

Implement the first workspace-wide resolver for `icarus-graph-explorer`.

KG4 should consume a complete in-memory set of `ParsedObsidianDocument` values produced by KG3 and assemble a valid canonical `KnowledgeSnapshot` from KG1.

The output must:

- create canonical `DocumentEntity`, `SectionEntity`, and addressable `BlockEntity` records;
- assign deterministic **transient** canonical IDs suitable for one snapshot;
- map every parsed reference occurrence to the most-specific canonical source owner that can be established safely;
- resolve file, heading-path, and block targets against the provided workspace;
- preserve `resolved`, `unresolved`, `ambiguous`, and `invalid` outcomes explicitly;
- preserve every source occurrence rather than deduplicating links;
- retain exact source spans;
- return resolver/assembly diagnostics separately from canonical source truth;
- validate the final snapshot using KG1 runtime validation before reporting success.

KG4 is the first phase where:

```text
source structure + source references + whole-workspace context
                         ↓
                 canonical source truth
```

actually becomes available.

KG4 must remain:

- filesystem-independent;
- UI-independent;
- renderer-independent;
- deterministic;
- read-only;
- local-first;
- plain-data/serializable at its canonical boundary.

Do not implement graph rendering, vault folder access, persistence, file watching, or real-vault UI in this task.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

KG3 was merged through PR #4 at merge commit:

`59746a4d2b8a94fedd7b839f84fc974f1cf98bd2`

The current dependency chain is:

```text
adapter-obsidian → parser-markdown → core
```

KG3 exposes:

```ts
parseObsidianDocument({ path, source }): ParsedObsidianDocument
```

with the current source-adapter contract conceptually:

```ts
interface ParsedObsidianDocument {
  readonly structure: ParsedMarkdownDocument;
  readonly metadata: ParsedObsidianMetadata;
  readonly references: readonly ParsedSourceReference[];
  readonly blockAnchors: readonly ParsedObsidianBlockAnchor[];
  readonly diagnostics: readonly ObsidianParseDiagnostic[];
}

interface ParsedObsidianMetadata {
  readonly aliases: readonly string[];
  readonly frontmatterSpan?: SourceSpan;
}

interface ParsedSourceReference {
  readonly kind: 'link' | 'embed';
  readonly syntax: 'wikilink' | 'markdown';
  readonly sourceSpan: SourceSpan;
  readonly rawTarget: string;
  readonly target: ParsedInternalTarget;
  readonly displayText?: string;
}

type ParsedInternalTarget =
  | { readonly kind: 'file'; readonly file: string }
  | {
      readonly kind: 'heading';
      readonly file?: string;
      readonly headings: readonly string[];
    }
  | {
      readonly kind: 'block';
      readonly file?: string;
      readonly blockId: string;
    };

interface ParsedObsidianBlockAnchor {
  readonly blockId: string;
  readonly markerSpan: SourceSpan;
}
```

KG3 deliberately does not:

- resolve links;
- assign canonical IDs;
- select reference source owners;
- assemble canonical snapshots.

The current canonical KG1 `Reference` is:

```ts
interface Reference {
  readonly id: ReferenceId;
  readonly kind: 'link' | 'embed';
  readonly sourceEntityId: EntityId;
  readonly rawTarget: string;
  readonly sourceSpan: SourceSpan;
  readonly resolution: ReferenceResolution;
}

type ReferenceResolution =
  | { readonly status: 'resolved'; readonly targetEntityId: EntityId }
  | { readonly status: 'unresolved'; readonly reason?: string }
  | {
      readonly status: 'ambiguous';
      readonly candidateEntityIds: readonly EntityId[];
      readonly reason?: string;
    }
  | { readonly status: 'invalid'; readonly reason: string };
```

The roadmap marks KG4 as the next milestone:

> Resolve workspace references into explicit states and produce serializable snapshots.

---

# Required first step

Before editing:

1. sync/inspect the actual latest `main`;
2. verify the working tree is clean;
3. read:
   - `AGENTS.md`;
   - `docs/ARCHITECTURE.md`;
   - `docs/ROADMAP.md`;
   - relevant ADRs;
   - `packages/core/src/model/*`;
   - `packages/core/src/model/README.md`;
   - `packages/parser-markdown/README.md`;
   - `packages/adapter-obsidian/README.md`;
   - `packages/adapter-obsidian/src/types.ts`;
   - existing workspace fixture conventions;
   - current lint/package boundary patterns;
4. inspect current tests and package scripts before introducing a new package.

Follow the repository branch/PR/merge/cleanup workflow in `AGENTS.md`.

If repository-owned decisions materially differ from this prompt, surface the conflict and follow the most recent explicit architectural contract unless that would make the task internally inconsistent.

---

# Important correction discovered after KG3

Do **not** use Obsidian note aliases as ordinary persisted link-target resolution keys.

Current official Obsidian alias documentation explains that selecting an alias in link suggestions creates a link such as:

```md
[[Artificial Intelligence|AI]]
```

rather than:

```md
[[AI]]
```

The alias is used as display/suggestion metadata. It is not a reason for KG4 to silently resolve a persisted raw destination `[[AI]]` to a file whose YAML alias happens to be `AI`.

Therefore:

```text
aliases = useful document metadata
aliases ≠ canonical file-target matching key in KG4
```

This corrects an earlier loose roadmap phrase about “alias matching”.

Keep aliases available in parsed metadata for:

- future search;
- unlinked mentions;
- UI labels/suggestions;
- possible future compatibility work.

But do not resolve persisted source targets by alias in KG4.

Update architecture/roadmap wording if it currently implies alias-target resolution.

This is a deliberate evidence-based refinement, not an optional interpretation.

---

# Official Obsidian resolution evidence and uncertainty policy

Before final implementation, re-check current official Obsidian documentation.

Current official docs establish:

- `[[Note]]` and `[[Note.md]]` are valid internal links;
- folder-qualified links such as `[[folder/Note]]` are valid;
- same-file headings use `[[#Heading]]`;
- cross-file headings use `[[Note#Heading]]`;
- nested headings may use multiple `#` components;
- block references use `#^block-id`;
- Markdown-format internal links are also valid;
- files other than Markdown generally require an extension;
- the official CLI documents `file=<name>` as using the same link resolution as wikilinks, matching by file name without requiring full path or extension.

However, Obsidian's exact tie-breaking behavior for every ambiguous partial path is not fully specified in public help.

The project's architecture rule remains:

> Accuracy is more important than plausible guesses.

Therefore:

- implement behavior that is directly supported by documented syntax and deterministic workspace evidence;
- when multiple equally plausible candidates remain, return `ambiguous`;
- do not reproduce undocumented “first result wins” behavior;
- do not silently choose based on array order;
- do not invent fuzzy matching.

KG5 is specifically intended to compare the model against a real vault and expose cases where resolver compatibility needs refinement.

---

# Package ownership

A new source-specific resolver package is justified.

Preferred direction:

```text
packages/resolver-obsidian/
```

with package name approximately:

```text
@icarus-graph-explorer/resolver-obsidian
```

Dependency direction:

```text
resolver-obsidian
  → adapter-obsidian
  → parser-markdown
  → core
```

The package should output source-neutral canonical core data while owning the Obsidian-specific interpretation needed to reach that data.

This is preferable to pretending the resolution algorithm is generic when it currently consumes Obsidian source-adapter IR.

Do not prematurely introduce a universal resolver abstraction.

If later another source adapter needs similar assembly behavior, shared pieces can be extracted based on evidence.

The resolver package must not import:

- React;
- React DOM;
- apps/web;
- React Flow / xyflow;
- Sigma;
- Graphology;
- Tauri;
- browser filesystem APIs;
- Node filesystem APIs;
- Obsidian application runtime/API.

Add a lightweight mechanical boundary rule consistent with current ESLint patterns.

---

# Public resolver API

The exact names may change after repository inspection.

A likely public entry is conceptually:

```ts
resolveObsidianWorkspace({
  workspaceId,
  documents,
}): WorkspaceResolutionResult
```

where:

```ts
workspaceId: WorkspaceId
documents: readonly ParsedObsidianDocument[]
```

The resolver receives already-parsed documents.

It must not read source files.

It must not call `parseObsidianDocument()` internally unless the repository architecture already explicitly wants a convenience wrapper. The stable KG4 responsibility is **parsed workspace → canonical snapshot**.

Keep parsing and workspace resolution separately testable.

---

# Result contract

Do not return a success-shaped partial snapshot when assembly invariants fail.

Prefer a discriminated result such as conceptually:

```ts
type WorkspaceResolutionResult =
  | {
      readonly ok: true;
      readonly snapshot: KnowledgeSnapshot;
      readonly diagnostics: readonly WorkspaceResolutionDiagnostic[];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly WorkspaceResolutionDiagnostic[];
    };
```

Names may differ.

A valid snapshot may still contain:

- unresolved references;
- ambiguous references;
- invalid reference resolutions;
- adapter warnings/errors that do not make the structural workspace impossible.

Those are legitimate canonical facts.

A result should fail entirely when the workspace cannot be assembled into a valid canonical snapshot, for example:

- duplicate parsed document paths;
- impossible source structure;
- internally colliding generated IDs;
- final `validateKnowledgeSnapshot()` failure.

Do not hide such failures by returning an empty snapshot.

---

# Diagnostics

Resolver/assembly diagnostics are not part of the canonical snapshot schema.

Keep them separate.

Likely categories include:

- duplicate source document path;
- invalid target path normalization;
- target path escapes workspace root;
- unsupported non-Markdown target;
- file target not found;
- ambiguous file target;
- heading not found;
- ambiguous heading target;
- block not found;
- ambiguous block target;
- reference source span not owned by its source document;
- adapter diagnostic forwarded/contextualized;
- final canonical validation failure.

Avoid duplicating information unnecessarily:

- a canonical `unresolved` reference can carry a concise reason;
- a resolver diagnostic can carry richer actionable context/source path if useful.

Do not create hundreds of tiny error codes in KG4.

---

# Canonical IDs: deterministic now, stable later

KG4 must assign canonical IDs because the KG1 snapshot requires them.

KG9 still owns identity stability across renames and normal edits.

Therefore KG4 IDs must be explicitly documented as:

> deterministic transient snapshot identity, not durable workspace identity.

Do not claim they survive:

- file rename;
- heading rename;
- insertion before a heading;
- block relocation.

## Recommended seam

Create a very small ID-provider contract so KG9 can later replace the transient policy without rewriting resolver logic.

Conceptually:

```ts
interface SnapshotIdProvider {
  documentId(...): EntityId;
  sectionId(...): EntityId;
  blockId(...): EntityId;
  referenceId(...): ReferenceId;
}
```

Use a deterministic default implementation.

Do not add UUID persistence or fuzzy identity matching.

A reasonable default can use stable-within-source facts such as:

```text
document: workspace-relative path
section: document path + heading start offset
block: document path + block marker start offset + blockId
reference: document path + reference start offset
```

Use escaping/encoding robust enough to avoid delimiter collisions.

Do not depend on the string format outside the resolver package.

Tests should treat IDs as opaque except where deterministic repeatability itself is under test.

If a simpler deterministic implementation better fits the current codebase, use it.

The key contract is:

```text
same parsed workspace → same IDs
different occurrences → unique IDs
IDs are not promised durable across edits
```

---

# Canonical entity assembly

## Document entities

Create one `DocumentEntity` per parsed Markdown document.

Source:

```text
path = structure.path
span = structure.span
```

No document title is currently part of the KG1 canonical schema.

Do not derive a title field by changing schema v1.

## Section entities

Flatten the KG2 nested section tree into canonical `SectionEntity` records.

Each section gets:

- transient entity ID;
- `kind: 'section'`;
- parent canonical document/section ID;
- title;
- heading level;
- full logical `span` from KG2;
- same normalized workspace path as document.

Preserve KG2 hierarchy exactly.

Do not reconstruct hierarchy from heading titles.

Duplicate titles remain valid.

## Block entities

KG3 intentionally records only explicit block marker spans and does not guess full content extents.

KG4 nevertheless needs a canonical target entity if a valid link resolves to an explicit block ID.

Create a canonical `BlockEntity` for each **valid explicit block anchor occurrence** using the source facts actually known.

Current conservative interpretation:

```text
BlockEntity.source.span = exact block marker span
```

not a guessed whole paragraph/list/callout extent.

Parent the block entity to the deepest document/section owner that safely contains the marker span.

Document this clearly:

> In schema v1/KG4, an addressable block entity is backed by the explicit Obsidian anchor marker span; richer block-content extent is deferred.

Do not silently treat marker span as though it were the full block content.

Duplicate block IDs remain multiple canonical block entities so a target can become `ambiguous`.

Invalid block markers diagnosed by KG3 must not become valid canonical block entities.

If the actual KG3 IR includes invalid anchors separately, inspect it carefully and preserve only validated anchors as addressable blocks.

---

# Source ownership of references

Each canonical reference requires:

```text
sourceEntityId
```

KG3 gives an exact source span but no canonical ID.

Determine source ownership using source geometry.

## Required rule

For a parsed reference occurrence in document D:

1. verify the reference span is within D's document span;
2. find the deepest KG2 section whose full section span contains the entire reference span;
3. if such a section exists, use that canonical section ID;
4. otherwise use the document entity ID.

Because KG2 parent spans overlap descendants, choose the deepest containing section.

Do not choose by heading text.

Do not assign a block entity as source owner in KG4 solely because a marker is nearby.

KG3 does not currently establish full block content extent, so there is not enough evidence to prove a reference belongs to a canonical block.

This may be upgraded later when reliable block extents exist.

### Boundary behavior

Define half-open containment precisely.

A reference is contained when:

```text
owner.start <= reference.start
reference.end <= owner.end
```

using offsets when present.

All current parser/adapter spans have offsets; fail loudly if KG4 receives incompatible position data rather than inventing ownership.

Test references:

- in preamble;
- directly under root heading;
- in nested section;
- at a sibling boundary;
- inside a heading itself.

A reference inside heading syntax should belong to that heading's section because the section starts at the heading start.

---

# Canonical reference occurrences

Create one canonical `Reference` per parsed reference occurrence.

Do not deduplicate repeated links.

For two identical source links at different offsets:

```md
[[Target]]
...
[[Target]]
```

produce two distinct canonical references.

Canonical fields:

```text
id              transient deterministic occurrence ID
kind            link/embed
sourceEntityId  selected owner
rawTarget       adapter-provided raw target
sourceSpan      exact occurrence span
resolution      KG4 result
```

Do not add display text or syntax kind to core schema v1.

Those source-specific facts remain in adapter IR and can be exposed by diagnostics/debug tooling later if needed.

Do not change core schema merely to retain them unless actual product requirements prove canonical source truth loses necessary information.

---

# File-target resolution

Resolution behavior must depend on reference syntax where needed.

A wikilink target and a Markdown-link destination do not necessarily use identical path rules.

Keep the policy explicit and independently testable.

---

# Wikilink file resolution

A KG3 wikilink file component may look like:

```text
Note
Note.md
folder/Note
folder/Note.md
../Other/Note
./Note
```

## Normalize extension

For Markdown documents:

```text
Note
Note.md
```

may both match `Note.md`.

Do not blindly append `.md` to targets with another explicit extension such as:

```text
image.png
document.pdf
```

The current canonical model contains Markdown documents only.

Non-Markdown targets should therefore remain canonical references with an explicit unresolved reason such as:

```text
"Target type is not represented by the current Markdown-document model."
```

Do not label them “missing” when KG4 was never given an attachment inventory.

This applies especially to real Obsidian embeds such as `![[image.png]]`.

## Explicit relative path

If the wikilink file component begins with:

```text
./
../
```

resolve it relative to the source document's folder.

Normalize `.` / `..` segments.

If the path escapes the workspace root, return `invalid`.

Do not silently clamp it to root.

## Folder-qualified non-dot path

For a target such as:

```text
folder/Note
```

support deterministic matching against normalized document paths.

Prefer the strongest workspace evidence.

A practical conservative policy is:

1. exact vault-relative path match, with Markdown extension equivalence;
2. source-relative exact path match if distinct and syntactically plausible;
3. unique path-suffix match;
4. if multiple candidates remain at the same best specificity, `ambiguous`.

Do not choose one based on input array order.

Document the actual implemented precedence.

If real Obsidian behavior is better established from official evidence during implementation, follow that evidence and document it.

## Bare filename

For:

```text
[[Note]]
```

match Markdown documents by basename without requiring `.md`.

If exactly one candidate exists:

```text
resolved
```

If none:

```text
unresolved
```

If several share the basename:

```text
ambiguous
```

Do not guess a nearest file unless current official evidence and a tested rule justify the behavior.

This deliberately favors visible uncertainty over undocumented tie-breaking.

---

# Markdown-link file resolution

KG3 standard Markdown links contain CommonMark-decoded destination semantics while percent encoding remains present.

For local Markdown links:

```md
[Target](../folder/Target.md)
[Target](Target.md)
[Target](folder/Target.md)
```

treat the path as a Markdown path relative to the source document unless the destination clearly represents a vault-root form supported by the actual adapter contract.

Use URL/path semantics carefully:

- split path and fragment using the already-parsed KG3 target where possible;
- safely percent-decode path/fragment components for matching;
- preserve `rawTarget` unchanged in canonical output;
- malformed percent encoding should become `invalid`, not crash;
- normalize `.` and `..`;
- reject paths escaping the workspace root.

Do not URL-decode wikilink target text merely because Markdown links need decoding.

Keep syntax-specific normalization separated.

---

# Alias policy

Again:

```text
YAML aliases must NOT be file-target resolution keys.
```

Test this explicitly.

Synthetic example:

```text
Dog.md:
aliases:
  - Doggo

Source.md:
[[Doggo]]
```

KG4 should **not** resolve `[[Doggo]]` to `Dog.md` merely because `Doggo` is an alias.

The official Obsidian authoring flow would create something like:

```md
[[Dog|Doggo]]
```

and KG3 already separates display text from actual target.

This should become a regression test so later “helpful” refactors do not reintroduce alias matching.

---

# Heading resolution

A heading target first needs a target document.

For:

```md
[[#Heading]]
```

the target document is the source document.

For:

```md
[[Target#Heading]]
```

resolve `Target` using the appropriate file-resolution policy first.

If the file target is ambiguous, the heading target is ambiguous across candidate documents unless heading information narrows it safely.

Do not arbitrarily choose a file first.

## One heading segment

Given one target document and:

```text
headings = ["Details"]
```

match KG2 canonical sections by exact human-readable title.

If:

- one matching section → resolved;
- zero → unresolved;
- several → ambiguous.

Do not silently choose the first duplicate heading.

## Multiple heading segments

For:

```md
[[Target#Parent#Child]]
```

use KG2 hierarchy.

Match an actual structural heading chain.

A valid candidate must have heading ancestry corresponding to the supplied ordered segments.

Do not generate heading slugs.

Do not use substring matching.

Do not flatten all titles and ignore hierarchy.

The implemented direct/ancestral-chain rule should be documented and tested.

If official Obsidian behavior around skipped intermediate heading segments is not documented, use a conservative exact ordered-chain interpretation rather than guessing.

## Matching normalization

Do not perform fuzzy matching.

Avoid automatic case folding or punctuation normalization unless official tested evidence supports it.

The adapter already gives human-readable heading target components; match them consistently against KG2 `title`.

If Markdown-link heading fragments require percent decoding, do that as syntax-specific normalization before exact title matching.

If implementation encounters a clearly documented Obsidian normalization rule, add focused tests and document it.

---

# Heading ambiguity across file candidates

Do not discard useful evidence.

Example workspace:

```text
A/Note.md
  # Alpha

B/Note.md
  # Beta
```

Reference:

```md
[[Note#Alpha]]
```

The bare file target `Note` is ambiguous, but the full file+heading target may identify only:

```text
A/Note.md / Alpha
```

KG4 may safely resolve the complete target if exactly one canonical section across all viable file candidates satisfies the entire requested target.

Similarly, if two candidate documents both contain `#Alpha`, remain ambiguous.

This is better than resolving the file component independently and stopping immediately.

The same principle applies to block targets.

---

# Block resolution

For:

```md
[[#^block-id]]
```

search block anchors in the source document.

For:

```md
[[Target#^block-id]]
```

resolve candidate target documents, then match explicit block entities by exact `blockId`.

If one complete file+block candidate remains:

```text
resolved
```

If none:

```text
unresolved
```

If several:

```text
ambiguous
```

This includes duplicate block IDs within one file.

Do not silently select the first anchor.

Do not infer undocumented block IDs from paragraph text.

Only KG3 explicit valid block anchors are addressable.

---

# Candidate handling and ambiguity

Use stable deterministic candidate ordering for diagnostics/output.

For example sort by:

```text
workspace path
then source start offset
```

Canonical `ambiguous.candidateEntityIds` must contain distinct IDs.

Do not let Set/Map iteration accidently define user-visible ambiguity order.

A candidate set of one is `resolved`, not `ambiguous`.

A candidate set of zero is `unresolved`, not an empty ambiguous result.

This must satisfy KG1 runtime validation.

---

# Resolution reason strings

The canonical model currently stores free-text reason strings.

Use concise stable reasons.

Do not include volatile machine-specific paths.

Examples:

```text
"No matching Markdown document."
"Multiple Markdown documents match this target."
"No matching heading in candidate document."
"Multiple sections match this heading target."
"No matching explicit block anchor."
"Target escapes the workspace root."
"Non-Markdown targets are not represented in schema v1."
```

Diagnostic messages may be richer.

Do not make tests brittle against full prose unless the reason text is intentionally part of the public contract.

Prefer testing resolution status/code via resolver diagnostics where possible.

---

# Invalid resolution

Use canonical:

```text
status: "invalid"
```

when the parsed source occurrence exists but cannot represent a valid workspace target after normalization.

Examples can include:

- local path traverses above workspace root;
- malformed percent encoding in a Markdown destination;
- internal resolver invariant fails for that occurrence.

Do not use `invalid` merely because the target does not exist.

Missing target = `unresolved`.

Multiple plausible targets = `ambiguous`.

Unsupported-but-valid attachment target = generally `unresolved` with an explicit unsupported-model reason.

KG3 malformed syntax that produced only a diagnostic and no parsed reference does not need a fabricated canonical reference.

---

# Adapter diagnostics

KG3 documents may already contain diagnostics.

Do not throw them away.

Include them in KG4 result diagnostics with source document context.

However, do not automatically fail canonical assembly merely because a document has:

- malformed YAML aliases but trustworthy body structure;
- duplicate block-ID warning;
- unsupported search-shortcut diagnostic;
- unterminated comment warning

if KG3 has already produced a structurally trustworthy parsed document.

Fatality should depend on whether KG4 can build a valid canonical snapshot.

Preserve severity where useful.

Do not copy diagnostics into canonical core fields.

---

# Duplicate document paths

Two parsed documents with the same normalized `structure.path` cannot form a valid canonical workspace.

This should be a fatal assembly error.

Do not:

- merge them;
- choose the last one;
- rename one;
- return a snapshot that core validation will reject.

Fail explicitly with an actionable diagnostic.

---

# Snapshot determinism

Given the same:

```text
workspaceId
parsed documents
```

KG4 should produce byte-for-byte-equivalent JSON after `JSON.stringify` when input semantic ordering is the same.

Prefer a deterministic canonical ordering:

- documents by normalized workspace path;
- sections in source order / hierarchy traversal;
- blocks in source order;
- references in source document path then source-span order.

Do not depend on caller document-array ordering for final canonical ordering unless the architecture intentionally says so.

This will make:

- fixtures readable;
- regression diffs stable;
- worker/cache behavior easier later.

---

# Input mutation

Do not mutate `ParsedObsidianDocument` input values.

Treat KG3 output as immutable source facts.

The resolver can build maps/indexes internally.

Canonical output arrays should be newly constructed.

No Graphology dependency is needed.

Use ordinary Maps/Sets internally if useful; canonical output remains plain arrays/objects.

---

# Runtime indexes

KG4 may build internal temporary indexes such as:

```text
document by path
documents by basename
sections by document/title
blocks by document/blockId
canonical entity by transient source locator
```

These are implementation details.

Do not persist them inside `KnowledgeSnapshot`.

Do not add Graphology.

Do not create a general index package yet.

---

# Core schema changes

Default assumption:

```text
schema v1 is sufficient for KG4.
```

Do not change core merely because the resolver wants convenience fields.

In particular, do not add:

- alias;
- filename;
- extension;
- reference syntax;
- display text;
- unresolved parsed target structure;
- block ID

to canonical entities/references without a demonstrated source-truth requirement.

If KG4 discovers that a valid canonical snapshot loses essential information required by KG5/graph behavior, stop and explain the exact mismatch before changing schema version 1.

Do not silently upgrade the schema.

---

# Source span validation

All current KG2/KG3 spans include UTF-16 offsets.

KG4 should use offsets for containment and deterministic source locators.

Before use, assert:

```text
start.offset and end.offset exist
0 <= start.offset <= end.offset <= document.end.offset
```

and that the reference/anchor path belongs to the parsed document that contains it.

If a parsed reference span falls outside the document extent, treat that as a fatal/invariant diagnostic rather than assigning it to the document anyway.

Do not create fallback source points.

---

# Workspace input validation

Validate resolver input before assembly.

At minimum:

- workspace ID non-empty;
- document paths unique;
- parsed document structure path matches any package-level document identity assumptions;
- references and block anchors fall inside the owning parsed document;
- section source spans are coherent enough for ownership mapping.

Do not duplicate all KG1 structural validation logic manually.

Reuse existing parsed contracts and final `validateKnowledgeSnapshot()`.

Add only resolver-specific checks needed before canonical assembly.

---

# Synthetic workspace fixtures

KG4 is workspace-wide, so fixtures now become central.

Extend:

```text
tests/fixtures/workspaces/
```

with several small multi-file cases.

Prefer independent cases rather than one huge synthetic vault.

Suggested fixtures:

```text
resolution-basic/
resolution-ambiguous-files/
resolution-headings/
resolution-blocks/
resolution-paths/
resolution-attachments/
```

Every committed case must remain synthetic and private-safe.

Do not commit Icarus theory content.

---

# Required test scenarios

Cover at least the following.

## A. Basic file resolution

Workspace:

```text
A.md
B.md
```

A contains:

```md
[[B]]
[[B.md]]
```

Both resolve to the B document entity.

## B. Repeated occurrence preservation

Two `[[B]]` occurrences become two canonical references with distinct IDs.

## C. Preamble source ownership

Reference before first heading maps to A's document entity.

## D. Nested section source ownership

Reference inside nested section maps to deepest containing canonical section.

## E. Reference in heading syntax

A reference parsed within a heading belongs to that section.

## F. Duplicate filename ambiguity

```text
folder-a/Note.md
folder-b/Note.md
Source.md
```

`[[Note]]` is ambiguous under the conservative resolver unless another target component narrows it.

## G. Path-qualified resolution

Test:

```text
[[folder-a/Note]]
[[folder-a/Note.md]]
```

against duplicate basenames.

## H. Relative path resolution

From a nested source document, test:

```text
[[../folder-b/Note]]
```

and/or Markdown relative path syntax actually supported by KG3.

## I. Workspace traversal invalidity

A target attempting to escape the vault root becomes `invalid`.

## J. Alias is not target matching

Target document:

```yaml
aliases:
  - Alternate
```

Reference:

```md
[[Alternate]]
```

must not resolve solely through alias metadata.

Also test:

```md
[[Target|Alternate]]
```

resolves through the real target.

## K. Same-file heading

```md
[[#Details]]
```

resolves to the canonical section.

## L. Cross-file heading

```md
[[Target#Details]]
```

resolves to the target section.

## M. Duplicate heading ambiguity

Two sections named `Details` in one target document make a one-segment heading target ambiguous.

## N. Multi-heading disambiguation

```text
# Parent A
## Details

# Parent B
## Details
```

A target equivalent to:

```md
[[Target#Parent B#Details]]
```

must resolve to the correct nested section.

## O. Ambiguous file narrowed by heading

```text
A/Note.md -> # Alpha
B/Note.md -> # Beta
```

`[[Note#Alpha]]` may resolve uniquely to A/Note's Alpha section even though `[[Note]]` alone is ambiguous.

## P. Same-file block

```md
[[#^abc]]
```

resolves to explicit block anchor.

## Q. Cross-file block

```md
[[Target#^abc]]
```

resolves to the target block entity.

## R. Duplicate block ambiguity

Two `^abc` anchors remain distinct block entities and block target is ambiguous.

## S. Nonexistent file

Valid source link becomes canonical `unresolved`.

## T. Nonexistent heading

File resolves, heading does not → `unresolved`.

## U. Nonexistent block

File resolves, block does not → `unresolved`.

## V. Non-Markdown embed

```md
![[image.png]]
```

remains a canonical reference but does not pretend the attachment is missing from a Markdown-only input inventory.

Use a reason that states the target type is not represented.

## W. Markdown link path

```md
[Target](../Target.md)
```

resolves according to relative Markdown path semantics.

## X. Markdown percent encoding

A filename/heading containing spaces should resolve from valid `%20` Markdown destination syntax.

Malformed percent encoding becomes `invalid`.

## Y. Determinism

Resolve the same workspace twice.

Canonical IDs, ordering, snapshot JSON, and statuses are identical.

## Z. Input order independence

Provide the same parsed documents in different input-array order.

If the intended public contract promises canonical ordering, output should remain equivalent.

## AA. Final core validation

Every successful resolver result must pass:

```ts
validateKnowledgeSnapshot(snapshot)
```

## AB. JSON round trip

```text
snapshot → JSON.stringify → JSON.parse → validateKnowledgeSnapshot
```

must succeed.

## AC. Duplicate parsed document path

Whole workspace resolution fails explicitly.

## AD. Adapter diagnostics forwarding

A non-fatal KG3 diagnostic remains visible in KG4 result diagnostics without preventing a valid snapshot.

---

# Real Icarus vault

KG5, not KG4, is the milestone for systematic real-vault validation.

Do not make KG4 depend on direct access to:

`lillo24/Icarus-OR-The_APP-`

If available, Codex may inspect a small number of real paths/links to sanity-check assumptions, but:

- do not commit private content;
- do not encode Icarus-specific filenames as resolver rules;
- do not change generic policy merely because one current vault happens not to exercise an ambiguity.

Any real-vault bug that becomes a regression test must be reduced to a synthetic fixture.

---

# Performance

KG4 can use whole-workspace indexing because resolution is inherently workspace-wide.

Build indexes once.

Avoid:

```text
for each reference:
  scan every document
  scan every section
  scan every block
```

A reasonable approach:

```text
documents
  → file/path indexes
  → canonical entity/source indexes
  → heading indexes
  → block indexes
  → resolve each occurrence
```

Complexity should be roughly proportional to:

```text
documents + entities + anchors + references + candidate matches
```

rather than full-vault scanning per link.

Do not introduce:

- workers;
- incremental updates;
- persistent caches;
- Graphology;
- database;
- Rust/WASM.

KG10/KG12 own later incremental/performance hardening.

---

# Skills

No new repository-local agent skill is required for KG4.

Do not install:

- Vercel deployment tooling;
- graph skills;
- Tauri skills;
- database/backend skills;
- Playwright merely for this resolver milestone.

The existing React/web-design skills may remain installed but are irrelevant to this task.

---

# Documentation updates

After implementation, reconcile earlier docs.

Likely changes:

```text
packages/resolver-obsidian/README.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
README.md
tests/fixtures/workspaces/README.md
eslint.config.*
```

Potentially update an existing ADR if it currently states a now-refined resolution policy.

Create a new ADR only if KG4 establishes an expensive long-term decision not already represented.

A small resolver implementation policy does not automatically need an ADR.

## Resolver README should document

- package ownership;
- public entry point;
- input/output contracts;
- transient ID policy;
- canonical entity assembly;
- source-owner rule;
- wikilink resolution policy;
- Markdown-link resolution policy;
- heading/block ambiguity;
- alias non-resolution policy;
- non-Markdown-target policy;
- diagnostics;
- KG5 handoff.

Be explicit that:

> KG4 implements a conservative Obsidian-compatible resolution subset and exposes ambiguity rather than claiming undocumented tie-breaker parity.

---

# Scope

## In scope

- new Obsidian workspace resolver package;
- workspace parsed-document indexing;
- transient deterministic ID provider/policy;
- canonical document/section/block assembly;
- exact reference source ownership;
- canonical reference occurrence creation;
- wikilink file matching;
- Markdown path resolution;
- heading resolution;
- multi-heading resolution;
- block-anchor resolution;
- explicit unresolved/ambiguous/invalid states;
- attachment/non-Markdown unresolved policy;
- deterministic ordering;
- adapter diagnostic forwarding;
- final snapshot runtime validation;
- synthetic multi-file fixtures/tests;
- architecture/roadmap/README reconciliation;
- branch/PR/CI/merge/cleanup.

## Out of scope

Do not implement:

- filesystem folder scanning;
- source file reading;
- browser directory picker;
- Tauri;
- file watching;
- incremental workspace updates;
- durable IDs across edits;
- persistence;
- view state;
- Graphology;
- backlinks index as a separate persisted feature;
- graph projection;
- React Flow;
- Sigma;
- search UI;
- inspector UI;
- real-vault diagnostic UI;
- source writes;
- cloud/backend;
- alias-based persisted link resolution;
- fuzzy file/heading matching;
- AI semantics.

Do not start KG5 automatically.

---

# Suggested implementation sequence

## 1. Inspect + reconcile

Confirm KG1–KG3 contracts and current branch state.

## 2. Define resolver result + diagnostics

Establish clear success/failure behavior before implementation.

## 3. Implement transient ID policy

Keep it deterministic, opaque, and replaceable later.

## 4. Assemble canonical entities

Documents → sections → explicit block anchors.

Build source locator → canonical ID indexes.

## 5. Implement reference source ownership

Deepest containing section or document.

## 6. Build workspace indexes

Path/basename/heading/block indexes.

## 7. Implement file-target normalization/resolution

Separate wikilink and Markdown path behavior.

## 8. Implement heading/block target resolution

Allow complete target information to narrow ambiguous file candidates.

## 9. Create canonical references

One occurrence each, with explicit resolution status.

## 10. Validate final snapshot

Use core runtime validation.

Fail if canonical assembly is invalid.

## 11. Add synthetic multi-file fixtures/tests

Cover all required ambiguity/path/ownership cases.

## 12. Documentation consistency pass

Re-read earlier architecture text.

In particular remove/clarify any implication that aliases are ordinary link-target resolution keys.

## 13. Validate → PR → merge → cleanup

Follow `AGENTS.md`.

---

# Validation

Run focused resolver checks plus repository-wide checks.

At minimum, equivalents of:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/resolver-obsidian typecheck
pnpm exec vitest run packages/resolver-obsidian

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check

git diff --check
```

Also run focused KG1/KG2/KG3 regression tests if public contracts are touched.

Ensure:

- PR CI passes;
- merge completes;
- post-merge `main` CI passes;
- feature branches are deleted;
- local `main` matches `origin/main`;
- working tree is clean.

Do not claim full completion before post-merge CI if repository workflow requires it.

---

# Exit gate

KG4 is complete when:

1. A separate workspace resolver package exists.
2. It consumes parsed KG3 documents rather than reading files.
3. It emits a KG1-valid canonical `KnowledgeSnapshot`.
4. Canonical IDs are deterministic and explicitly transient.
5. KG9 can later replace identity policy without rewriting target resolution.
6. Documents and section hierarchy are preserved exactly.
7. Explicit block anchors become conservative addressable block entities without guessed content extents.
8. Every parsed reference occurrence becomes a distinct canonical reference.
9. Reference source ownership uses deepest safely containing section or document.
10. Bare unique filenames resolve.
11. Duplicate filenames become ambiguous unless the complete target disambiguates them.
12. Path-qualified/relative targets are handled deterministically.
13. Markdown path percent-decoding is deliberate and tested.
14. Workspace-escaping paths become invalid.
15. YAML aliases are **not** used as ordinary persisted target resolution keys.
16. Same-file/cross-file heading links resolve.
17. Duplicate headings become ambiguous.
18. Multi-heading paths use hierarchy.
19. Heading/block information can narrow ambiguous file candidates safely.
20. Same-file/cross-file block links resolve only against explicit valid anchors.
21. Duplicate block anchors become ambiguous.
22. Missing valid targets are unresolved rather than invalid.
23. Non-Markdown targets do not pretend to be missing Markdown files.
24. Input order does not cause arbitrary target selection.
25. Adapter diagnostics remain visible separately from canonical truth.
26. Fatal assembly problems do not return success-shaped partial snapshots.
27. Final snapshot passes runtime validation and JSON round trip.
28. No renderer/platform/persistence dependency is introduced.
29. Architecture/roadmap docs are reconciled.
30. PR/post-merge CI pass and branch cleanup is complete.

Do not begin KG5 automatically.

---

# Final report

Report:

## 1. Summary

Public resolver entry point and the canonical output it now enables.

## 2. Package / dependency boundary

Explain why the resolver is Obsidian-specific while its output remains source-neutral.

## 3. Canonical assembly

Explain creation of:

- documents;
- sections;
- block entities;
- canonical references.

## 4. ID policy

Explain exact transient ID strategy and what stability it does/does not promise.

## 5. Source ownership

Explain deepest-section/document rule and boundary semantics.

## 6. Resolution semantics

Explain separately:

- wikilink file matching;
- Markdown path matching;
- headings;
- multi-headings;
- blocks;
- ambiguity;
- invalidity;
- unsupported non-Markdown targets.

## 7. Alias correction

Explicitly confirm aliases are metadata, not persisted link-target matching keys, and update the relevant architecture documentation.

## 8. Diagnostics

Explain successful-with-diagnostics vs fatal assembly failure.

## 9. Fixtures/tests

List multi-file synthetic cases and focused test counts.

## 10. Dependencies

List any added dependency.

Ideally KG4 should need no major runtime dependency beyond existing workspace packages.

Explain any new one.

## 11. Files changed

Important files/packages only.

## 12. Validation

List every command actually run, PR CI, merge, post-merge CI, branch cleanup.

## 13. Documentation reconciliation

State what earlier wording changed, especially around alias resolution and concrete workspace resolution policy.

## 14. Deviations / uncertainty

Report any place where current official Obsidian behavior was not fully documented and the resolver intentionally chose ambiguity rather than guessing.

## 15. KG5 handoff

State precisely what the diagnostic explorer can now inspect:

- canonical documents/sections/blocks;
- exact source-owner references;
- explicit resolution states;
- ambiguous candidate IDs;
- unresolved/invalid reasons;
- source spans;
- resolver/adapter diagnostics.

Also list the known compatibility questions KG5 should test against the real Icarus vault.

Do not implement KG5 automatically.
