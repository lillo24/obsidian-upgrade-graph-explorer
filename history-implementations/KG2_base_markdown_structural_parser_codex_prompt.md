# KG2 — Base Markdown Structural Parser

**Task type:** feature / parsing foundation / source-processing architecture

## Goal / success outcome

Implement the first source-neutral Markdown parser package for `icarus-graph-explorer`.

KG2 should take one already-normalized workspace-relative Markdown file path plus its source text and produce a deterministic, source-position-aware **parsed document structure** containing:

- the document extent;
- the document’s root-level Markdown heading hierarchy;
- each section’s heading title and Markdown heading level;
- the exact heading syntax span;
- the full section extent;
- nested section children.

The parser must remain independent from:

- Obsidian syntax and resolution behavior;
- canonical entity identity assignment;
- workspace-wide resolution;
- graph rendering;
- UI/platform code.

The main success criterion is that later KG3/KG4 work can consume KG2’s structural output without having to rediscover where sections begin/end or how heading hierarchy works.

Do **not** implement Obsidian wikilinks, canonical references, block IDs, workspace resolution, or graph UI in this task.

---

# Current evidence

Repository: `lillo24/icarus-graph-explorer`

KG1 was merged into `main` via PR #2 at merge commit:

`35b78a86fb0a15a6bfa62c17521a4ce981126ae2`

The merged repository currently has:

- a pnpm workspace;
- `apps/web`;
- framework-independent `packages/core`;
- canonical schema version 1;
- runtime validation;
- synthetic model fixture conventions;
- architecture/roadmap/ADRs;
- strict lint/typecheck/test/build validation;
- project-local agent guidance.

Important current core contracts:

```ts
type EntityKind = 'document' | 'section' | 'block';

interface DocumentEntity {
  id: EntityId;
  kind: 'document';
  source: SourceLocation;
}

interface SectionEntity {
  id: EntityId;
  kind: 'section';
  parentId: EntityId;
  title: string;
  level: number;
  source: SourceLocation;
}
```

Core source semantics are already established:

- workspace paths are normalized and workspace-relative;
- path separator is `/`;
- line/column are 1-based;
- optional offsets are 0-based JavaScript UTF-16 code-unit indexes;
- spans are half-open: start inclusive, end exclusive.

The representative KG1 snapshot already models a parent section span as extending across nested children until the next same/higher-level heading or end-of-document. KG2 should make the Markdown structural rule that produces such spans explicit and tested.

The roadmap now says:

> **KG2 — Base Markdown structural parser**
> Parse files and heading hierarchies with source locations using generic Markdown behavior.

The repository architecture requires parsers/source adapters to depend toward `packages/core`, never the reverse.

---

# Required first step

Before editing:

1. inspect the current `main`;
2. read:
   - `AGENTS.md`;
   - `docs/ARCHITECTURE.md`;
   - `docs/ROADMAP.md`;
   - relevant ADRs;
   - `packages/core/src/model/README.md`;
   - `packages/core/src/model/source.ts`;
   - `packages/core/src/model/entities.ts`;
   - `tests/fixtures/workspaces/README.md`;
   - root/package/workspace tooling;
3. inspect current dependency versions and the repository’s package conventions;
4. verify the working tree is clean and based on latest `main`.

If the repository state materially differs from the evidence above, adapt to the actual repository rather than forcing this prompt’s guessed file layout.

Follow the repository branch/PR/merge workflow in `AGENTS.md`.

---

# Key architectural decision for KG2

## Do not make the Markdown parser emit canonical `DocumentEntity` / `SectionEntity` IDs yet

KG1 intentionally deferred durable identity assignment.

KG2 should therefore introduce a **parser intermediate representation** rather than inventing canonical IDs from paths/titles/offsets.

Do not generate permanent IDs from:

```text
notes/A.md#Heading
```

or from source offsets.

Those would become incorrect identity assumptions before KG9’s stable-identity work and KG4’s canonical assembly responsibilities.

A suitable structural output is conceptually:

```ts
interface ParsedMarkdownDocument {
  readonly path: WorkspacePath;
  readonly span: SourceSpan;
  readonly sections: readonly ParsedMarkdownSection[];
}

interface ParsedMarkdownSection {
  readonly title: string;
  readonly level: number;

  // Exact syntax occupied by the Markdown heading itself.
  readonly headingSpan: SourceSpan;

  // Full logical section:
  // heading start -> next heading whose level <= this level, or EOF.
  readonly span: SourceSpan;

  readonly children: readonly ParsedMarkdownSection[];
}
```

Naming may differ if repository conventions suggest something clearer.

This is not a command to add unrelated fields.

The parser representation should stay:

- plain-data;
- serializable;
- deterministic;
- source-neutral;
- easy for KG3/KG4 to transform later.

Do not put the mdast AST into the canonical core schema.

---

# Parser package boundary

A separate workspace package is now justified because Markdown parsing has a real dependency and responsibility boundary.

A probable home is:

```text
packages/parser-markdown/
```

with a package name similar to:

```text
@icarus-graph-explorer/parser-markdown
```

This package may depend on:

```text
@icarus-graph-explorer/core
```

for the established source/path types.

`packages/core` must not depend on the parser.

The parser package must not import:

- React;
- React DOM;
- React Flow / xyflow;
- Sigma;
- Graphology;
- Tauri;
- Obsidian APIs/packages;
- `apps/web`.

If the existing lint architecture makes it straightforward, add a lightweight mechanical boundary rule for the new parser package rather than relying only on documentation.

Do not add a large architecture-lint dependency only for this.

---

# Markdown parsing library choice

Re-check the exact current package documentation/version before installing dependencies.

At prompt-writing time, the strongest fit appears to be the `syntax-tree` / unified ecosystem.

For KG2, prefer the lowest-level tool that matches the actual need.

The current official `remark-parse` documentation explicitly notes that when code wants to access and manually handle the syntax tree without needing remark’s plugin-processing abstraction, `mdast-util-from-markdown` is the direct option.

`mdast-util-from-markdown` also exposes the micromark/mdast extension seam needed by future syntax work, which makes it a good likely foundation for KG3 without requiring KG2 to install Obsidian behavior now.

Probable dependencies:

- `mdast-util-from-markdown`;
- `mdast-util-to-string` if it is useful for robust heading-title extraction;
- associated type packages only where they are not already transitively/explicitly available and current TypeScript usage requires them.

Do **not** add `unified` + `remark-parse` just because they appeared in an earlier architecture brainstorm if `mdast-util-from-markdown` cleanly satisfies the task with fewer layers.

Conversely, if repository/version investigation shows that using `unified` is materially cleaner for the extension boundary we need, use it and explain the reason in the final report.

Do not install:

- `remark-gfm`;
- frontmatter plugins;
- Obsidian/wikilink plugins;
- React Flow;
- Graphology;
- Tauri;
- Sigma;
- GSAP.

KG2 is generic Markdown structure only.

---

# Markdown semantics to implement

## 1. Base syntax

Parse base Markdown according to the parser library’s normal CommonMark behavior.

Do not invent a regex heading parser.

The structural parser should consume proper Markdown syntax so that:

- headings inside fenced code are not headings;
- escaped syntax behaves like Markdown;
- ATX headings work;
- Setext headings work;
- inline formatting in heading content is parsed correctly.

## 2. Which headings define document sections

For KG2, the document structural outline should be based on **root-level Markdown heading nodes**.

Do not treat heading-looking text inside containers such as:

- fenced code;
- block quotes;
- quoted examples;
- other nested structures

as top-level document sections merely because they contain `#`.

This should be driven by the AST structure, not by line scanning.

If the parser library represents a construct in a surprising way, add a fixture explaining the chosen generic Markdown behavior.

Do not add Obsidian-specific exceptions in KG2.

## 3. Heading title

The section `title` should represent the human-readable textual content of the Markdown heading, not its raw Markdown delimiters.

For example:

```md
## Hello *world*
```

should produce a title equivalent to:

```text
Hello world
```

rather than:

```text
## Hello *world*
```

Use a maintained mdast utility such as `mdast-util-to-string` if that gives the correct source-neutral semantics more robustly than custom recursive string handling.

Do not implement Obsidian heading-anchor normalization/slugs in KG2.

Duplicate titles are valid.

Empty titles are valid if the underlying Markdown parser recognizes them as headings and the KG1 contract permits them.

## 4. Hierarchy

Use heading level to derive section nesting.

Example:

```md
# A
## B
#### C
## D
# E
```

should conceptually become:

```text
A (h1)
  B (h2)
    C (h4)
  D (h2)
E (h1)
```

Skipped heading levels are valid because KG1 explicitly permits them.

The parent of a new heading is the nearest preceding heading with a lower level that is still open.

A heading with no eligible parent becomes a document-root section.

Do not create synthetic missing headings for skipped levels.

## 5. Document span

`ParsedMarkdownDocument.span` should cover the full source text.

For a non-empty document:

```text
start = beginning of source
end   = EOF
```

For an empty document, represent a valid zero-length half-open span.

Preserve KG1 point conventions exactly:

- line/column 1-based;
- offset 0-based UTF-16 code units;
- end exclusive.

Do not normalize the Markdown source text before computing offsets.

In particular, source offsets must continue to index the original JavaScript string.

## 6. Heading span

`headingSpan` should be the exact source span supplied by the parser for the heading construct.

It should describe the heading syntax itself, not the entire following section.

This distinction is important because the full section span has a different boundary rule.

For Setext headings, ensure the heading span covers the source representation recognized by the parser, including the underline as reflected by its AST position.

## 7. Section span

The section’s full `span` begins at the heading’s start point.

It ends immediately before the next root-level heading whose heading level is **less than or equal to** the current section’s level.

If no such heading exists, it ends at document EOF.

Therefore parent section spans intentionally overlap child section spans.

Example:

```md
# A          <-- A start
text
## B         <-- B start
text
## C         <-- B end, C start
text
# D          <-- A end, C end, D start
```

Expected:

```text
A.span = # A start -> # D start
B.span = ## B start -> ## C start
C.span = ## C start -> # D start
D.span = # D start -> EOF
```

This is the behavior implied by the existing representative KG1 snapshot and should now become an explicit Markdown parser contract.

Do not instead stop a parent section at the start of its first child.

## 8. Preamble

Markdown before the first root-level heading belongs to the document, not to a synthetic section.

Do not create an artificial `"Preamble"` heading/entity.

KG3/KG4 will later be able to attribute references found before the first heading to the document itself.

KG2 only needs to preserve enough structure/span information to make that possible.

---

# Extension seam for KG3

KG3 will need to interpret Obsidian-specific syntax, including frontmatter and wikilinks.

There is an important edge case:

```md
---
title: Example
---
# Real heading
```

Pure CommonMark can interpret some frontmatter-looking text differently from an Obsidian-aware Markdown parser, including interactions with Setext-heading syntax.

KG2 must remain generic CommonMark, but **do not design the package so KG3 is forced to rewrite the entire structural algorithm** just to supply syntax extensions.

Keep the implementation layered enough that later work can reuse:

```text
Markdown syntax tree
        ↓
heading/section structure derivation
```

with an extended syntax tree if KG3 needs it.

Possible implementation shapes include:

- one internal AST parse step plus one independently testable structure-derivation step;
- a lower-level structure builder that accepts an mdast Root;
- another similarly narrow seam.

Do not create a generic plugin platform in KG2.

Do not expose third-party AST details as a long-term stable API unless that is actually required. It is fine for mdast to remain an implementation/source-processing detail.

The goal is simply: do not fuse “parse CommonMark text” and “derive section hierarchy” so tightly that KG3 must duplicate the hierarchy logic.

---

# References and blocks: deliberately out of KG2

KG1 defines canonical `Reference` and `BlockEntity`, but KG2 should **not** populate them yet.

Do not extract:

- standard Markdown links;
- images/embeds;
- Obsidian wikilinks;
- Obsidian embeds;
- block IDs;
- link targets;
- aliases;
- target headings.

Reason: KG2’s gate is structural correctness. Reference extraction/adapter semantics and ownership should be introduced when the source-adapter contract is designed, without mixing them into the first parser milestone.

However, do not design the parser output in a way that would make precise future ownership impossible.

Exact section spans and the heading tree are the key foundation for later attribution.

If inspection of existing architecture makes extracting standard Markdown references mandatory for KG2, stop and surface that conflict instead of silently expanding scope.

---

# Workspace path contract

The parser API should accept an already-normalized `WorkspacePath`.

Do not add filesystem path normalization, absolute-path discovery, or source-provider logic in KG2.

A likely API is conceptually:

```ts
parseMarkdownDocument({
  path,
  source,
})
```

where `path` is already workspace-relative and normalized.

Do not read files from disk inside the parser.

The parser should be a pure transformation over provided data.

Do not store absolute machine paths.

---

# Error behavior

Markdown itself is permissive, so many malformed-looking strings are valid Markdown and should simply produce a valid AST/structure.

Do not invent “invalid Markdown” errors for ordinary CommonMark text.

Failures that should be loud/actionable include situations where:

- required AST positional information is unexpectedly absent;
- parser output violates KG1 source-point/span invariants;
- an internal structural assumption is impossible.

Do not silently replace missing positions with `{line: 1, column: 1}` or empty arrays that look successful.

Include the workspace-relative path in thrown/returned parser errors when useful.

Use the repository’s existing error-handling rules from `AGENTS.md`.

---

# Parser intermediate contract

The exact API is yours to refine after inspecting repository conventions.

Keep it small.

Likely concepts:

```text
ParsedMarkdownDocument
ParsedMarkdownSection
MarkdownParseInput
```

Potentially a narrow parse/structure error type if real failure modes warrant it.

Do not add:

- canonical entity IDs;
- workspace IDs;
- references;
- blocks;
- graph edges;
- renderer metadata;
- mutable AST state;
- view state.

Keep arrays/read-only data deterministic.

The parser result should be JSON-serializable even if the internal mdast tree used during parsing is not part of the returned stable contract.

---

# Testing / fixture strategy

Evolve the existing:

```text
tests/fixtures/workspaces/
```

convention rather than creating a parallel fixture system.

Committed fixtures must remain synthetic/private-safe.

Prefer small cases with a README describing the rule being tested.

A useful parser fixture shape may now become:

```text
tests/fixtures/workspaces/<case>/
  README.md
  input/
    A.md
  expected/
    structure.json
```

Use this only where golden JSON materially improves readability.

Do not make every tiny unit test filesystem-fixture based; focused inline/table tests are also appropriate.

The expected structure format should represent **parser intermediate output**, not pretend to be a canonical snapshot.

---

# Required parser scenarios

Cover at least the following behaviors with focused tests/fixtures.

## A. Empty document

Input:

```text
""
```

Expected:

- valid zero-length document span;
- no sections.

## B. Preamble only

Markdown text with no heading.

Expected:

- document span covers all source;
- no synthetic section.

## C. Simple ATX hierarchy

```md
# A
## B
### C
## D
# E
```

Verify:

- parent/child structure;
- levels;
- section spans;
- heading spans.

## D. Skipped levels

```md
# A
### C
###### F
## B
```

No synthetic missing levels.

Hierarchy follows nearest valid lower-level ancestor.

## E. Duplicate headings

```md
## Details
text
## Details
```

Both sections exist independently.

Title is not identity.

## F. Setext headings

```md
Title
=====

Subtitle
--------
```

Verify they are recognized as heading levels 1 and 2 according to CommonMark and that their heading spans are correct.

## G. Inline heading formatting

Examples such as:

```md
# Hello *world*
## `code` and [label](target)
```

Verify human-readable title extraction.

Do not resolve the link.

## H. Fenced code false positives

```md
```text
# Not a section
```
# Real section
```

Only the actual Markdown heading becomes a section.

## I. Nested/quoted heading-looking content

Include a heading inside a block quote or another nested flow construct.

Verify the documented KG2 rule: only document-root heading nodes define the document’s section hierarchy.

## J. Parent/child section extent

Use a hierarchy where:

- parent contains children;
- sibling child closes prior child;
- new root closes all preceding descendants.

Assert exact offsets.

## K. EOF without trailing newline

The last section must end exactly at source length.

## L. LF vs CRLF

Verify offsets still index the original source string and line/column semantics remain consistent.

Do not normalize line endings before parsing.

## M. Unicode / surrogate pair

Include an emoji or another non-BMP character before/inside a heading.

Verify offsets follow JavaScript UTF-16 code-unit indexing as required by KG1.

## N. Heading-like syntax that is not a heading

Add at least one generic Markdown case such as escaped heading markers or HTML heading text to ensure structure follows the AST, not pattern matching.

---

# Performance constraints for KG2

Correctness dominates here.

Still avoid obviously wasteful algorithms.

The parser should not repeatedly rescan the full source once per heading.

A clean O(source + headings) or equivalent AST-based pass is sufficient.

Do not:

- introduce workers;
- implement incremental parsing;
- cache ASTs globally;
- add Rust/WASM;
- benchmark million-node cases.

KG10/KG12 own those concerns later.

A small deterministic benchmark is not required in KG2.

---

# Skills

No new agent skill is required for KG2.

Existing repository-local skills can remain installed, but neither is central to this parser task.

Do not install a Markdown/parser skill unless repository instructions explicitly require one and there is a concrete verified benefit.

Do not install Vercel deployment, Tauri, React Flow, Sigma, Graphology, or database skills.

---

# Documentation updates

After implementation, reconcile earlier docs rather than only appending new claims.

Likely updates:

## `packages/parser-markdown/README.md`

This should become the main parser map.

Briefly document:

- what the package owns;
- file map;
- CommonMark scope;
- root-level heading rule;
- title semantics;
- heading span vs section span;
- path/source-point conventions;
- what remains deliberately KG3+.

## `docs/ARCHITECTURE.md`

Update the status/current implementation section and make parser-stage structure concrete where appropriate.

Do not rewrite stable KG1 model decisions unless KG2 reveals an actual contradiction.

## `docs/ROADMAP.md`

After validation/merge, mark KG2 complete and KG3 next if that matches the repository’s existing milestone-status pattern.

## ADR

Do **not** create an ADR merely for using `mdast-util-from-markdown`.

Create/update an ADR only if KG2 resolves an expensive architectural choice, for example if the parser intermediate boundary materially changes the source-processing architecture.

## fixture docs

Update the workspace fixture README once real parser fixtures exist.

---

# Dependency discipline

New parser dependencies are expected.

Before adding them:

- inspect their current maintained version;
- inspect exact-version docs/compatibility;
- confirm license is acceptable;
- keep versions consistent with repository pinning policy;
- add only what KG2 actually uses.

In the final report list every dependency added and why.

Do not perform unrelated dependency upgrades.

---

# Scope

## In scope

- new generic Markdown parser package;
- source-text → mdast parsing through a maintained parser;
- parser intermediate structural contracts;
- document span;
- root-level heading discovery;
- heading title extraction;
- heading spans;
- section hierarchy;
- section full-span derivation;
- deterministic tests and synthetic workspace fixtures;
- parser package documentation;
- lightweight dependency-boundary enforcement where appropriate;
- architecture/roadmap reconciliation;
- standard repository validation;
- branch/commit/PR/merge/cleanup per `AGENTS.md`.

## Explicitly out of scope

Do not implement:

- Obsidian wikilinks;
- Obsidian embeds;
- YAML/frontmatter semantics;
- aliases;
- tags;
- explicit block IDs;
- canonical `Reference` production;
- canonical entity ID assignment;
- workspace scanner;
- target resolver;
- backlinks;
- canonical full workspace snapshot assembly from Markdown;
- browser folder access;
- Tauri;
- file watching;
- incremental parsing;
- persistence;
- React Flow;
- Sigma;
- Graphology;
- graph projection;
- graph UI;
- real Icarus vault content;
- source writes;
- cloud/backend;
- AI semantics.

Do not start KG3 in the same plan.

---

# Implementation guidance

## 1. Inspect and establish ownership

Confirm the repository boundaries and create the parser package only if it is the cleanest owner for Markdown behavior.

Do not put parser dependencies into `packages/core`.

## 2. Verify parser library

Check current official docs and exact versions.

Prefer direct mdast parsing if it gives a smaller, more explicit dependency surface.

## 3. Define parser IR

Write the source-neutral parsed-document/section contract before adding transformation helpers.

Document headingSpan vs full section span.

## 4. Separate syntax parsing from structure derivation

Keep enough separation that KG3 can later supply extended Markdown syntax without duplicating heading/section logic.

Avoid designing a generic plugin system.

## 5. Implement hierarchy + spans

Use AST positions and an efficient heading stack/boundary strategy.

Do not regex-scan source headings.

## 6. Build fixtures/tests

Start with the exact edge cases listed above.

When the parser library behaves unexpectedly, capture the behavior in a small synthetic regression case.

## 7. Reconcile docs

Re-read KG1 architecture after implementation and update wording that became concrete.

Do not leave older contradictory descriptions in place.

## 8. Validate and inspect diff

Run focused parser tests plus repository-wide checks.

Inspect the final diff for accidental scope expansion.

Follow the branch/PR merge/cleanup workflow.

---

# Validation

Run the repository-required validation from `AGENTS.md`/README.

At minimum, based on the current repo:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
git diff --check
```

Also run focused parser-package tests/typecheck using the actual workspace package scripts you introduce, for example equivalents of:

```bash
pnpm --filter @icarus-graph-explorer/parser-markdown typecheck
pnpm exec vitest run packages/parser-markdown
```

Do not copy these command names blindly if the implemented package scripts differ.

Verify at least:

1. empty file span correctness;
2. ATX + Setext parsing;
3. hierarchy with skipped levels;
4. duplicate titles;
5. root-only section behavior;
6. headingSpan vs section span;
7. parent spans include descendants;
8. EOF without newline;
9. CRLF preservation;
10. UTF-16 offset semantics;
11. parser output JSON serialization;
12. parser package does not import forbidden outer-layer dependencies;
13. `packages/core` remains unchanged in dependency direction;
14. no private Icarus content appears in fixtures.

If CI is part of the repository workflow, ensure PR and post-merge CI pass before reporting the plan as fully complete.

---

# Exit gate

KG2 is complete when all of the following are true:

- a source-neutral Markdown parser package exists;
- it accepts source text and an already-normalized workspace-relative path;
- it uses a real Markdown parser rather than heading regexes;
- it returns plain serializable parser IR without canonical IDs;
- document extent is exact;
- root-level heading hierarchy is correct;
- ATX and Setext headings are supported;
- human-readable heading titles are extracted consistently;
- heading syntax span and full section span are distinct and tested;
- parent section spans extend through descendants until a same/higher heading or EOF;
- preamble remains document-level content;
- line/column/UTF-16 offset semantics match KG1;
- skipped heading levels and duplicate titles work;
- code/quoted false positives are avoided through AST structure;
- KG3 can reuse the structural derivation without needing to duplicate the algorithm;
- no Obsidian/reference/resolver/platform/renderer behavior was introduced;
- synthetic fixtures are private-safe;
- repository-wide validation passes;
- docs are reconciled;
- PR is merged and branch cleanup is complete according to repo workflow.

Do not begin KG3 automatically.

---

# Final report

Report:

## 1. Summary

What KG2 added and its public parser entry point.

## 2. Parser contract

Explain the parser input and returned intermediate representation.

Explicitly state why it does not emit canonical IDs.

## 3. Markdown semantics

Explain:

- root-level heading rule;
- ATX/Setext support;
- title extraction;
- hierarchy;
- headingSpan;
- section span;
- preamble behavior;
- line ending / UTF-16 position behavior.

## 4. Parser technology

List exact dependency versions added.

Explain why the selected parsing layer was chosen over alternatives considered.

## 5. Architecture seam for KG3

Explain how future frontmatter/Obsidian syntax can extend or feed the parser without duplicating section derivation.

Do not speculate beyond what the implemented seam actually supports.

## 6. Fixtures/tests

List the important synthetic cases and focused test counts.

## 7. Files changed

List important new/modified files.

## 8. Validation

List every command actually run and its result, including PR/post-merge CI if applicable.

## 9. Documentation reconciliation

State what earlier architecture/roadmap wording changed because KG2 made it concrete.

## 10. Deviations / warnings

Report any place where repository evidence caused a change from this prompt.

Surface any behavior that KG3 must handle carefully, especially frontmatter/CommonMark interactions.

## 11. KG3 handoff

State precisely what source-neutral structural information is now available to the Obsidian adapter and what remains intentionally unresolved.

Do not implement KG3 automatically.
