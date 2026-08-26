# KG3 — Obsidian Syntax Adapter

**Task type:** source-adapter implementation / syntax extraction / parser integration

## Goal

Implement the first Obsidian-specific source adapter for `icarus-graph-explorer`.

KG3 should take one already-normalized workspace-relative Markdown path plus the original source string and produce an **Obsidian-aware parsed document** that preserves KG2's document/section structure while additionally extracting the source-specific information needed by KG4:

- YAML frontmatter relevant to identity/resolution, especially document aliases;
- Obsidian wikilinks;
- Obsidian embeds;
- file targets;
- same-file heading targets;
- cross-file heading targets;
- multi-heading/subheading targets;
- block-reference targets;
- wikilink display text after `|`;
- explicit Obsidian block-ID markers/anchors;
- standard Markdown links/images in a form that KG4 can later consider alongside wikilinks;
- exact source spans and parse diagnostics.

KG3 must **not resolve targets against the workspace** and must **not assign canonical entity IDs**.

The central contract is:

```text
source text
   ↓
Obsidian-aware syntax interpretation
   ↓
KG2-compatible document/section structure
   +
unresolved source references / aliases / block anchors / diagnostics
   ↓
KG4 workspace resolver + canonical assembly
```

The adapter must remain read-only, deterministic, serializable, and independent from UI/renderers/platform APIs.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

KG2 is merged into `main` through PR #3 at merge commit:

`e710cc8c8b66166fd84c450d34f0583bee21d52e`

The repository currently contains:

```text
packages/core/
packages/parser-markdown/
apps/web/
```

KG2's public parser is:

```ts
parseMarkdownDocument({ path, source }): ParsedMarkdownDocument
```

with parser IR conceptually:

```ts
interface ParsedMarkdownDocument {
  readonly path: WorkspacePath;
  readonly span: SourceSpan;
  readonly sections: readonly ParsedMarkdownSection[];
}

interface ParsedMarkdownSection {
  readonly title: string;
  readonly level: number;
  readonly headingSpan: SourceSpan;
  readonly span: SourceSpan;
  readonly children: readonly ParsedMarkdownSection[];
}
```

KG2 deliberately does not assign canonical IDs.

Important existing KG2 implementation facts:

- base Markdown parsing uses `mdast-util-from-markdown` 2.0.3;
- title extraction uses `mdast-util-to-string` 4.0.0;
- `parse.ts` performs CommonMark source → mdast;
- `structure.ts` independently performs mdast root → section hierarchy;
- only root-level mdast headings form document sections;
- section spans include descendants and close at the next same/higher heading or EOF;
- mdast is not part of the long-term public parser contract.

KG2's package README explicitly states that an Obsidian-aware entry must apply syntax handling before reusing structure derivation.

The roadmap marks:

```text
KG2 — complete
KG3 — next: Obsidian syntax adapter
KG4 — workspace resolver + canonical snapshot
```

---

# External context / first real dataset

The separate private Icarus vault/repository is the first real consumer:

`lillo24/Icarus-OR-The_APP-`

**KG3 must not require direct access to that repository to build or test.** All committed tests must remain synthetic.

However, current Icarus repository evidence was inspected while preparing this plan. The vault genuinely uses the syntax KG3 is meant to support, including examples equivalent to:

```md
---
aliases:
  - Liking
---

[[Emotions]]

[[Foundational Patterns#Binary Pattern Shades|here]]

[[#Shared]]

[[Innate Setup - Underlying Patterns#Foundational Underlying Patterns|Foundational Pattern]]

![[simplified_happiness_formula.png|663]]

![[first_happiness_formula.png]]

[[#^345abf]]

^345abf
```

So heading links, same-file links, display aliases, embeds, YAML aliases, and block references are not hypothetical requirements.

If Codex can access the Icarus repository during implementation, it may use a **small number of real files as local/manual validation inputs only**. Do not copy private theory text into committed fixtures.

If external access is unavailable, continue using the syntax examples and synthetic cases in this prompt; it is not a blocker.

---

# Official Obsidian behavior to respect

Before implementing, re-check current official Obsidian documentation rather than relying only on this prompt.

At prompt-writing time, official Obsidian documentation specifies:

- file wikilinks:
  - `[[Note]]`
  - `[[Note.md]]`
  - `[[folder/Note]]`
- same-note headings:
  - `[[#Heading]]`
- other-note headings:
  - `[[Note#Heading]]`
- nested/subheading paths can contain multiple `#` separators:
  - `[[Note#Parent#Child]]`
- block targets use:
  - `[[Note#^block-id]]`
  - `[[#^block-id]]`
- display text uses:
  - `[[Note|Custom name]]`
  - `[[Note#Heading|Section name]]`
- prefixing an internal link with `!` embeds it:
  - `![[Note]]`
- block IDs may use Latin letters, numbers, and dashes;
- Obsidian also supports Markdown-format internal links;
- YAML properties/frontmatter are used for reusable aliases.

Do not claim full Obsidian compatibility beyond tested behavior.

---

# Core boundary

KG3 is a **source adapter**, not a canonical model extension.

Do not change `packages/core` merely to make adapter implementation convenient unless a concrete contradiction in the existing canonical contract is discovered.

Core already owns:

```text
Document
Section
optional Block
Reference
SourceSpan
resolution states
KnowledgeSnapshot
```

KG3 should produce source-adapter IR that KG4 can transform into those canonical contracts.

Do not create canonical `Reference` objects yet because every canonical reference already requires a resolution outcome, and workspace resolution belongs to KG4.

Do not generate canonical IDs.

---

# Recommended package ownership

A separate package is now justified:

```text
packages/adapter-obsidian/
```

with a name similar to:

```text
@icarus-graph-explorer/adapter-obsidian
```

Expected dependency direction:

```text
core
  ↑
parser-markdown
  ↑
adapter-obsidian
```

or equivalently:

```text
adapter-obsidian
  → parser-markdown
  → core
```

The adapter may use source-parser extension dependencies directly where required.

It must not depend on:

- React;
- React DOM;
- apps/web;
- React Flow / xyflow;
- Sigma;
- Graphology;
- Tauri;
- browser filesystem APIs;
- Node filesystem APIs;
- Obsidian's application runtime/API package.

This is a parser/source adapter for Obsidian syntax. It is **not an Obsidian plugin**.

Add the same kind of lightweight `no-restricted-imports` safeguard already used for core/parser-markdown if it fits the existing ESLint architecture.

---

# Important KG2 → KG3 seam

There is one architectural issue to resolve deliberately.

KG2 currently keeps `deriveMarkdownStructure(root, ...)` internal to `packages/parser-markdown`, while KG3 needs an Obsidian-aware syntax tree to flow through the exact same structural algorithm.

Do **not** duplicate the KG2 section-hierarchy/span algorithm in the Obsidian adapter.

Choose the narrowest clean integration seam after inspecting the package.

Acceptable directions include:

### Option A — dedicated parser integration subpath

Expose a clearly documented package-level integration API from `parser-markdown`, for example conceptually:

```text
@icarus-graph-explorer/parser-markdown/mdast
```

that allows another parser/source adapter package to derive `ParsedMarkdownDocument` from an mdast root.

Keep the ordinary public `parseMarkdownDocument()` unchanged.

The mdast integration surface should be explicitly documented as parser-integration infrastructure, not canonical domain API.

### Option B — source-neutral extension-aware parse hook

Keep mdast encapsulated inside `parser-markdown`, but add a narrow generic way for an outer adapter to supply parser extensions/options and reuse the same derivation.

Do not make the API Obsidian-specific.

### Option C — similarly narrow refactor

If inspection reveals a cleaner boundary, use it.

Whatever you choose:

- parser-markdown must remain usable independently as a CommonMark parser;
- core must remain unaware of mdast;
- adapter-obsidian must not copy KG2's hierarchy implementation;
- document/heading spans must remain exactly compatible between the CommonMark and Obsidian-aware entries.

If the cleanest solution requires a small documented parser-markdown public-surface change, that is in scope.

---

# Dependency / parser strategy

## Frontmatter

The KG2 handoff identified a concrete CommonMark conflict:

```md
---
title: Example
---
# Real heading
```

Under plain CommonMark, frontmatter-like source can participate in Setext-heading interpretation.

KG3 must remove that false structural interpretation by parsing YAML frontmatter as syntax **before section structure is derived**.

Prefer official/current syntax-tree packages in the same ecosystem already used by KG2, likely:

- `micromark-extension-frontmatter`;
- `mdast-util-frontmatter`;

and a maintained safe YAML parser if actual property values need parsing, likely:

- `yaml`.

Verify exact current versions, API, ESM/TypeScript compatibility, and licenses before adding them.

Do not write a home-grown YAML parser.

Do not make generic `parser-markdown` interpret YAML by default: CommonMark behavior must stay independently testable.

## Wikilinks

Do **not automatically install** the old `micromark-extension-wiki-link` / `mdast-util-wiki-link` packages.

At prompt-writing time, the commonly surfaced wiki-link packages are old and their documented alias syntax uses `:` rather than Obsidian's `|`; they are not a safe assumption for exact Obsidian semantics such as:

```text
[[File#Heading|Alias]]
[[File#^block]]
![[image.png|663]]
```

Evaluate them if useful, but do not force the project through a library whose grammar does not match the source format.

A small, well-tested adapter-owned wikilink tokenizer/scanner is acceptable and may be preferable.

### Strong preferred strategy for wikilink extraction

Use the Markdown AST to determine **where scanning is semantically allowed**, then parse Obsidian link syntax in those eligible source/text ranges.

This gives us both:

- correct Markdown shielding;
- exact control over Obsidian syntax.

For example:

- scan ordinary textual content;
- allow links inside paragraphs, emphasis, list items, block quotes/callouts, and headings;
- do not treat link-looking text inside inline code or fenced code as links;
- do not scan YAML frontmatter as body references;
- do not scan Obsidian comments;
- preserve exact original source offsets.

Avoid a naive whole-file `\[\[.*\]\]` regex.

Avoid parsing the entire vault with one giant regular expression.

A small lexical parser/state machine over eligible source ranges is preferred when syntax escaping/nesting makes regex brittle.

---

# Adapter output contract

The exact names are for Codex to refine.

Keep the output plain, deterministic, source-position-aware, and serializable.

A reasonable direction is conceptually:

```ts
interface ParsedObsidianDocument {
  readonly structure: ParsedMarkdownDocument;
  readonly metadata: ParsedObsidianMetadata;
  readonly references: readonly ParsedSourceReference[];
  readonly blockAnchors: readonly ParsedObsidianBlockAnchor[];
  readonly diagnostics: readonly ObsidianParseDiagnostic[];
}
```

Do not add fields without a concrete KG3/KG4 need.

## Metadata

Likely initial metadata:

```ts
interface ParsedObsidianMetadata {
  readonly aliases: readonly string[];
  // add tags only if actual implementation evidence justifies them
}
```

The exact frontmatter span/raw YAML may also be useful if it clearly improves diagnostics.

Do not expose an arbitrary unvalidated YAML object as canonical truth merely because it is easy.

If you preserve generic frontmatter, make it explicitly adapter-source metadata with a JSON-safe contract.

For KG4, document aliases are the important field.

Support the Obsidian forms actually allowed/tested, at least:

```yaml
aliases:
  - Liking
```

and if official/current Obsidian behavior supports scalar alias form, test it too.

Normalize only what Obsidian semantics require. Do not case-fold aliases or resolve them here.

## References

A source reference should preserve at least:

```text
kind: link | embed
syntax: wikilink | markdown
sourceSpan
rawTarget
parsed target components
optional display text
```

A likely target union is conceptually:

```ts
type ParsedInternalTarget =
  | {
      kind: 'file';
      file: string;
    }
  | {
      kind: 'heading';
      file?: string;            // absent = same source document
      headings: readonly string[];
    }
  | {
      kind: 'block';
      file?: string;            // absent = same source document
      blockId: string;
    };
```

This is guidance, not required naming.

Preserve enough raw data that KG4 can reproduce Obsidian target-resolution rules without reparsing source syntax.

### Important separation

KG3 determines:

> “This is syntactically a link to file X / heading Y / block Z.”

KG4 determines:

> “In this workspace, that syntactic target resolves uniquely to canonical entity E.”

Do not cross that boundary in KG3.

## Display text

For:

```md
[[Example|Custom name]]
[[Example#Details|Section name]]
```

preserve the display portion separately from the target.

For embeds such as:

```md
![[image.png|663]]
```

the part after `|` may be display/size syntax depending on target type.

KG3 does not need to fully interpret visual embed sizing. Preserve it without corrupting the actual target.

Do not let `|663` become part of the filename.

## Raw target

Keep raw target text before workspace resolution.

Do not silently:

- append `.md`;
- strip folder paths;
- case-fold names;
- URL-decode wikilink target names;
- resolve aliases;
- choose same-named documents.

Those are KG4 concerns unless official syntax parsing itself requires a transformation.

---

# Standard Markdown links

Obsidian supports both wikilink and Markdown internal-link formats.

KG3 should therefore extract standard Markdown `link` and `image` AST nodes as source references too.

Examples:

```md
[Custom name](Example.md)
[Section name](Example.md#Details)
![Image](assets/image.png)
```

Do not resolve them.

Preserve:

- syntax = markdown;
- raw/decoded target carefully;
- source span;
- display/alt text where useful;
- link vs embed/image distinction.

### External links

Do not turn KG3 into a web-link crawler.

For obvious external schemes such as:

```text
https:
http:
mailto:
obsidian:
```

either:

- omit them from the internal-reference list; or
- retain them in a clearly separate source-reference category if the implemented contract benefits from that.

Choose one behavior deliberately and test/document it.

The graph's initial purpose is workspace structure, not external URL visualization.

Relative/local Markdown targets should remain available to KG4.

---

# Heading target syntax

Support syntactic forms including:

```md
[[#Heading]]
[[File#Heading]]
[[File#Parent#Child]]
[[File#Heading|Display]]
[[#Parent#Child|Display]]
```

Do not resolve heading titles to KG2 sections.

Preserve individual heading segments if multiple `#` components are used.

Do not generate Obsidian heading slugs.

Obsidian links use heading text semantics, and the exact resolution/matching policy belongs to KG4.

### Search shortcuts

Obsidian's editor supports search-oriented entry syntax such as:

```text
[[## heading]]
[[^^block]]
```

These are not ordinary durable resolved targets in the same sense.

Do not silently treat them as normal heading/block targets.

If encountered in persisted source:

- classify them as unsupported/diagnostic, or
- preserve a clearly separate target form.

Do not guess.

---

# Block targets and block anchors

There are two separate concepts:

## Block target in a link

Examples:

```md
[[File#^abc123]]
[[#^quote-of-the-day]]
```

Parse the target syntactically into:

```text
optional file
blockId
```

Do not resolve it yet.

## Explicit block-ID marker in source

Examples from official Obsidian behavior can include:

```md
Paragraph text. ^abc123
```

or a separate marker line used for structured blocks:

```md
> quoted content

^quote-id
```

The Icarus vault also contains standalone markers such as:

```md
^345abf
```

Capture explicit block anchors with exact source spans.

### Do not overclaim block ownership

The precise “which full Markdown block does this marker identify?” rule has edge cases for paragraphs, lists, quotations, callouts, tables, and standalone markers.

KG3 must own source syntax, but it does **not** need to invent unsupported semantic certainty.

Use a contract that can preserve certainty explicitly, for example conceptually:

```ts
interface ParsedObsidianBlockAnchor {
  readonly blockId: string;
  readonly markerSpan: SourceSpan;
  readonly blockSpan?: SourceSpan;
}
```

or another representation where the anchor marker is always known and the associated content span is present only when confidently derived.

If block-to-content ownership is implemented, test it against official Obsidian rules.

If ambiguous/unsupported forms remain, emit a diagnostic rather than silently attaching the marker to the wrong block.

This is especially important because a wrong block association would later create incorrect graph edges.

KG4 can resolve a block-target link to a parsed block anchor even if rich block extent remains conservative.

Do not force every marker into a canonical `BlockEntity` in KG3.

---

# Reference source ownership

The end product needs exact section-level backlinks.

KG3 does **not** need canonical entity IDs to preserve source ownership.

Each extracted reference must retain an exact `sourceSpan`.

KG4 can later determine the most-specific canonical owner using:

```text
reference source span
+
KG2 section spans
+
parsed block anchors
```

This naturally handles:

- preamble link → document;
- section link → deepest containing section;
- potentially block-contained link → block if a confident block entity exists.

Do not create temporary permanent IDs from heading titles/offsets merely to attach references during KG3.

You may add an adapter-local derived locator if implementation needs one, but it must be clearly transient and not canonical identity.

---

# YAML/frontmatter behavior

Frontmatter should be recognized only in the document-leading position supported by the chosen frontmatter syntax extension.

Do not scan arbitrary `---` separators in the body as YAML.

At minimum extract and validate aliases.

Important behaviors to test:

```yaml
---
aliases:
  - Liking
  - Associated Preference
---
```

and supported scalar form if official behavior/library allows it.

Handle:

- no frontmatter;
- empty frontmatter;
- unknown properties;
- malformed YAML;
- aliases with non-string values;
- duplicate aliases;
- quoted aliases;
- CRLF;
- Unicode.

### Malformed YAML

Do not crash with an unhelpful library stack trace.

Return or throw an actionable adapter diagnostic containing the workspace-relative path and frontmatter location.

Decide whether malformed frontmatter:

- prevents the whole document from producing adapter output; or
- yields structure/references plus a frontmatter diagnostic.

Prefer the behavior that preserves trustworthy partial source facts without creating success-shaped fake metadata.

Document and test the choice.

---

# Obsidian comments

Obsidian supports comments delimited by:

```text
%% comment %%
```

Links inside comments should not become graph references.

Support source-aware exclusion of comments, including multiline comments if current Obsidian behavior supports them.

Do not implement comment rendering; only prevent false reference extraction and optionally preserve diagnostics for malformed/unclosed comments if useful.

Do not confuse literal `%%` inside code with comments.

---

# Callouts, quotes, lists, and headings

Do not use KG2's “root-level headings only” rule as a reason to discard references inside nested Markdown containers.

For example, an Obsidian callout is usually represented using blockquote-style syntax:

```md
> [!info]
> See [[Target]]
```

The `[[Target]]` reference is still real and should be extracted.

Likewise, links inside:

- block quotes;
- list items;
- emphasis/strong text;
- headings

should be discoverable unless shielded by code/comment/frontmatter syntax.

Section ownership later comes from source spans.

---

# Parsing strategy and source spans

Exact source provenance is critical.

Every extracted reference/anchor/diagnostic should use KG1's established convention:

- workspace-relative path supplied by caller;
- lines/columns 1-based;
- offsets 0-based UTF-16;
- half-open spans;
- original source text, without newline normalization.

Avoid rescanning the complete source independently for every link.

A clean strategy is:

1. parse the document once with Obsidian-aware frontmatter handling;
2. derive KG2 structure once;
3. traverse AST/source ranges once for standard Markdown references and eligible text;
4. scan eligible source/text ranges for wikilinks/comments/block markers;
5. sort extracted adapter facts by source offset for deterministic output.

Use a precomputed line-start index if converting offsets back to line/column repeatedly.

Do not introduce workers/incremental parsing yet.

---

# Diagnostics

KG3 should introduce a small adapter-level diagnostic model if needed.

Examples worth representing:

- malformed YAML frontmatter;
- malformed or unterminated wikilink-looking syntax;
- unsupported persisted search shortcut;
- invalid block ID characters;
- duplicate explicit block IDs in one document;
- block marker whose content association is uncertain, if that association is attempted.

Keep diagnostic taxonomy small and actionable.

Include:

- code;
- source span when available;
- human-readable message.

Do not create canonical `ReferenceResolution.invalid` yet; that mapping belongs to KG4.

Do not treat every arbitrary `[[` in prose as catastrophic if Obsidian itself would simply treat it as text. Align severity with actual source semantics.

---

# Obsidian-specific parser IR

Keep source-specific types out of `packages/core`.

They belong under `adapter-obsidian`.

Likely concepts:

```text
ParsedObsidianDocument
ParsedObsidianMetadata
ParsedSourceReference
ParsedReferenceTarget
ParsedObsidianBlockAnchor
ObsidianParseDiagnostic
```

Names can differ.

The package's root exports should expose only the stable KG3 adapter contract.

Keep scanner/tokenizer helpers internal.

Do not export mdast nodes as part of the main adapter result.

---

# Real-vault compatibility observations

The first Icarus dataset demonstrates several practical details the synthetic suite should cover without copying private prose.

## YAML aliases

Observed shape:

```yaml
---
aliases:
  - Liking
---
```

## File link

```md
[[Emotions]]
```

## Heading + display alias

```md
[[Foundational Patterns#Binary Pattern Shades|here]]
```

## Same-file heading

```md
[[#Shared]]
```

## Embed with display/size component

```md
![[simplified_happiness_formula.png|663]]
```

## Same-file block target + explicit marker

```md
[[#^345abf]]

^345abf
```

Build synthetic equivalents.

Do not commit the real filenames/theory text unless they are already generic enough and there is a clear reason; prefer neutral fixture names such as `A.md`, `Target.md`, `Section One`.

---

# Fixture strategy

Extend the existing:

```text
tests/fixtures/workspaces/
```

convention.

Add small Obsidian-focused synthetic cases.

Possible shape:

```text
tests/fixtures/workspaces/obsidian-links/
  README.md
  input/
    A.md
    B.md

tests/fixtures/workspaces/obsidian-frontmatter/
  README.md
  input/
    A.md

tests/fixtures/workspaces/obsidian-blocks/
  README.md
  input/
    A.md
```

Expected output may be assertions in test code rather than golden JSON if that is clearer.

Do not create a huge all-features vault fixture that is hard to debug.

The test suite should make source offsets visible for syntax where exact provenance matters.

---

# Required test scenarios

Cover at least these categories.

## A. Frontmatter fixes KG2's known CommonMark ambiguity

Input:

```md
---
aliases:
  - Alternate
---
# Real heading
```

Expected:

- only `Real heading` becomes document structure;
- `Alternate` is extracted as document alias;
- frontmatter does not become a Setext section.

Also keep KG2's pure CommonMark test unchanged to prove the dialect distinction.

## B. Plain wikilink

```md
See [[Target]].
```

Extract one link reference with exact span and file target.

## C. File extension / folder path

```md
[[Target.md]]
[[folder/Target]]
```

Preserve syntax accurately for KG4.

## D. Display text

```md
[[Target|custom]]
[[Target#Heading|section]]
```

Target and display text must be separate.

## E. Same-file heading

```md
[[#Heading]]
```

No file target should be invented.

## F. Cross-file heading

```md
[[Target#Heading]]
```

## G. Nested heading path

```md
[[Target#Parent#Child]]
```

Preserve ordered heading components.

## H. Block target

```md
[[Target#^block-id]]
[[#^block-id]]
```

## I. Embed

```md
![[Target]]
![[image.png|663]]
![[Target#Heading]]
```

Reference kind is embed; target parsing remains correct.

## J. Standard Markdown link

```md
[Target](Target.md)
[Section](Target.md#Heading)
```

Extract source reference without resolving.

## K. Markdown image

```md
![Alt](image.png)
```

Represent deliberately according to chosen embed/reference contract.

## L. External Markdown URL

```md
[Web](https://example.com)
```

Verify the explicitly documented external-link behavior.

## M. Code shielding

```md
`[[Not a link]]`

```text
[[Not a link]]
```
```

No wikilink reference.

## N. Obsidian comment shielding

```md
%%
[[Not a link]]
%%
[[Real]]
```

Only `Real`.

## O. Callout / quote reference

```md
> [!info]
> See [[Target]]
```

The reference is extracted even though the text is nested under a block quote.

## P. Heading-contained reference

```md
## Compare [[A]] and [[B]]
```

Both references are extracted and KG2 structure title behavior remains sensible.

## Q. Duplicate references

Identical syntax in two different source spans yields two distinct parsed reference occurrences.

Do not deduplicate source occurrences.

## R. Block markers

At least:

```md
Paragraph. ^abc-123
```

and standalone/separate-line marker syntax.

Always preserve marker span.

Only report full block span when implementation can justify it.

## S. Invalid block ID

Test disallowed characters according to current official Obsidian rules.

## T. Duplicate block ID in one document

Do not silently choose one.

Emit diagnostic or otherwise preserve ambiguity explicitly.

## U. Malformed wikilink

Test at least one unterminated/broken form and document whether it is:

- ignored as text;
- emitted as diagnostic.

Do not fake a valid reference.

## V. CRLF + Unicode

Source spans remain correct under original UTF-16 string indexing.

## W. JSON round trip

Adapter output remains plain serializable data.

---

# What KG3 should NOT resolve

Do not answer any of these yet:

```text
Which Target.md does [[Target]] mean if several files have that name?
Does alias "Liking" resolve to Associated Value.md?
Should [[Target]] prefer a path-nearby note?
Does [[#Heading]] match one of two duplicate headings?
How should heading matching normalize whitespace/punctuation?
What canonical ID should a section receive?
What does a missing note become?
Should an image embed create a canonical graph node?
```

Those are KG4/KG5 questions.

KG3 should give KG4 enough parsed evidence to answer them later.

---

# Do not prematurely modify canonical schema

KG1's canonical `Reference` currently uses:

```text
id
kind
sourceEntityId
rawTarget
sourceSpan
resolution
```

Do not add Obsidian alias/fragment fields directly to this canonical type merely because KG3 parses them.

KG4 can transform parsed target components into canonical raw target + resolved entity result.

Only change core if implementation uncovers a real inability to preserve required source truth after resolution. If so, stop and explain the architectural mismatch rather than casually changing schema version 1.

---

# Performance

KG3 should still be a pure single-document transformation.

Expected complexity should be roughly linear in source/AST size.

Avoid:

- one full-source regex pass per reference;
- repeated line/column rescans from offset 0;
- building Graphology indexes;
- file system access;
- workspace-wide indexes;
- workers;
- incremental parse caches;
- Rust/WASM.

KG10/KG12 own orchestration/performance hardening.

Correct source spans and syntax behavior are more important than micro-optimizing small documents.

---

# Skills

No new repository-local agent skill is required for KG3.

Do not install:

- Vercel deployment tooling;
- React Flow skills;
- Sigma/Graphology skills;
- Tauri skills;
- database/backend skills.

The existing React/web-design skills may remain installed but are not relevant to this source-adapter implementation.

---

# Scope

## In scope

- inspect KG2 merged state;
- create `adapter-obsidian` package;
- preserve generic `parser-markdown` CommonMark behavior;
- establish a narrow KG2 mdast/extension integration seam without duplicating structure derivation;
- YAML/frontmatter syntax handling;
- extract document aliases;
- Obsidian wikilink parsing;
- wikilink display text;
- file/heading/block target decomposition;
- nested heading target components;
- embed recognition;
- standard Markdown link/image extraction as internal-source candidates;
- explicit block-anchor marker extraction;
- Obsidian comment shielding;
- exact source spans;
- adapter diagnostics;
- synthetic fixtures/tests;
- package/lint boundary rules;
- docs/roadmap reconciliation;
- standard branch/PR/merge/cleanup workflow.

## Out of scope

Do not implement:

- workspace scanning;
- file reading;
- workspace-wide alias index;
- file target resolution;
- heading matching/resolution;
- block-target resolution;
- canonical ID assignment;
- canonical snapshot assembly;
- backlinks;
- Graphology;
- search index;
- view projections;
- React Flow;
- Sigma;
- Tauri;
- persistence;
- file watching;
- source writes;
- web/cloud/backend;
- Icarus-specific theory schema;
- AI semantic links.

Do not begin KG4 automatically.

---

# Suggested implementation sequence

## 1. Inspect

Read repository-owned guidance and actual parser code.

Verify package/dependency versions and current lint boundary patterns.

## 2. Decide parser integration seam

Solve KG2 → KG3 extension reuse with the smallest documented API change.

Prove CommonMark `parseMarkdownDocument()` behavior remains unchanged.

## 3. Add frontmatter-aware mdast parsing

Use maintained syntax-tree frontmatter extensions.

Add the known Setext/frontmatter regression test first.

## 4. Define adapter IR

Keep it source-specific but canonical-ID-free.

Write types before large scanner implementation.

## 5. Implement reference extraction

Use AST structure to shield code/frontmatter and source-aware tokenization for wikilinks.

Keep source spans exact.

## 6. Add Markdown-link extraction

Reuse mdast link/image nodes where practical.

Do not resolve URLs/files.

## 7. Add block anchors + comments

Implement conservative source behavior and diagnostics.

Do not overclaim uncertain block ownership.

## 8. Test synthetic vault cases

Prioritize exact source spans and edge cases.

## 9. Documentation consistency pass

After implementation, re-read:

- parser README;
- architecture;
- roadmap;
- relevant ADRs;
- fixture maps.

Update older wording if later KG3 decisions make it inaccurate.

## 10. Validate, PR, merge, cleanup

Follow `AGENTS.md`.

---

# Documentation to update

Likely files:

```text
packages/adapter-obsidian/README.md
packages/parser-markdown/README.md       # only integration seam changes
docs/ARCHITECTURE.md
docs/ROADMAP.md
tests/fixtures/workspaces/README.md
README.md                                # status only if current pattern uses it
eslint.config.*                          # dependency boundary if needed
```

Do not edit unrelated docs.

### Adapter README should state

- package responsibility;
- public entry point;
- dependency direction;
- supported Obsidian syntax;
- output contract;
- exact unsupported/deferred behaviors;
- diagnostics;
- KG4 handoff.

Do not say “Obsidian-compatible parser” without qualifying the supported subset.

Prefer:

> Obsidian syntax adapter for the tested link/frontmatter/block subset required by the explorer.

---

# Dependencies

Likely new dependencies are frontmatter/YAML-related.

Verify before use.

If you add a custom wikilink scanner rather than an external wiki-link package, explain that choice in the final report.

If you choose an external wiki-link package:

- verify it supports Obsidian's `|` display syntax;
- heading targets;
- block targets;
- embeds;
- current ESM/micromark version;
- exact source positions;
- active maintenance/license.

If it does not, do not use it merely to reduce code volume.

No dependency should be added for future graph/UI work.

---

# Validation

Run focused package checks plus the repository-wide gate.

At minimum, equivalents of:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/adapter-obsidian typecheck
pnpm exec vitest run packages/adapter-obsidian

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check

git diff --check
```

Also run focused regression coverage proving generic KG2 CommonMark behavior is unchanged.

If parser-markdown's API is changed for the integration seam, run its focused tests separately.

PR and post-merge CI must pass before KG3 is reported complete.

---

# Exit gate

KG3 is complete when:

1. `adapter-obsidian` is a real separate package/boundary.
2. Generic KG2 CommonMark parsing remains independently functional.
3. Obsidian frontmatter no longer creates false Setext sections.
4. Document aliases are parsed from YAML frontmatter.
5. Wikilinks are extracted with exact source spans.
6. Wikilink target, heading/block fragment, and display text are separated.
7. Same-file heading/block links do not invent filenames.
8. Multi-heading target syntax is preserved.
9. Embeds are distinguishable from ordinary links.
10. Standard Markdown link/image references are handled deliberately.
11. Code and Obsidian comments do not generate false wikilinks.
12. Links inside quotes/callouts/lists/headings can still be extracted.
13. Explicit block anchor markers are preserved with exact spans.
14. Uncertain block-content ownership is not silently guessed.
15. Adapter-level malformed/unsupported syntax is diagnosable.
16. Output is plain serializable data with no canonical IDs.
17. No workspace resolution is performed.
18. No canonical schema change is made without explicit architectural evidence.
19. Synthetic fixtures cover the current Icarus-relevant syntax subset.
20. All repository validation and CI pass.
21. KG3 is merged and branch cleanup is complete.

Do not begin KG4.

---

# Final report

Report:

## 1. Summary

Public adapter entry point and what it adds beyond KG2.

## 2. Adapter IR

Explain:

- structure;
- metadata/aliases;
- references;
- target decomposition;
- block anchors;
- diagnostics.

## 3. KG2 integration seam

Explain exactly how the Obsidian parser reuses the KG2 structure algorithm without making CommonMark Obsidian-specific.

## 4. Syntax behavior

Document implemented support for:

- frontmatter;
- aliases;
- wikilinks;
- display text;
- headings;
- block targets;
- embeds;
- Markdown links/images;
- comments;
- block markers.

Explicitly list unsupported Obsidian syntax.

## 5. Dependencies

List exact versions/licenses added.

Explain why the chosen wikilink strategy was preferred over available external packages.

## 6. Source-span behavior

Confirm original UTF-16 offsets/CRLF semantics and how sub-token spans are calculated.

## 7. Fixtures/tests

List key synthetic cases and test counts.

## 8. Files changed

Important files/packages only.

## 9. Validation

Every command actually run, PR CI, post-merge CI, branch cleanup.

## 10. Documentation reconciliation

What older architecture/parser wording changed after KG3.

## 11. Deviations / warnings

Especially:

- block-anchor edge cases;
- malformed YAML policy;
- unsupported Obsidian syntax;
- any source syntax that KG4 must treat conservatively.

## 12. KG4 handoff

State precisely what KG4 can now index/resolve:

- normalized document path;
- KG2 section tree/spans;
- document aliases;
- unresolved parsed reference targets;
- block anchors;
- diagnostics.

List what remains intentionally unresolved:

- file matching;
- alias matching;
- heading matching;
- block target matching;
- canonical entity IDs;
- source ownership mapping;
- canonical reference resolutions;
- snapshot assembly.

Do not implement KG4 automatically.
