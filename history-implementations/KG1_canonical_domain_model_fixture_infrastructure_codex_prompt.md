# KG1 — Canonical Domain Model + Fixture Infrastructure

**Task type:** domain-model design / architecture hardening / test infrastructure

## Goal

Implement the first real, framework-independent canonical data contracts for `icarus-graph-explorer`.

KG1 should replace the temporary KG0 `foundationIdentity` shell with a small, carefully tested model capable of representing:

- hierarchical Markdown documents;
- sections/headings;
- optional addressable blocks;
- references with exact source provenance;
- explicit reference-resolution outcomes;
- source locations/spans;
- a serializable workspace knowledge snapshot.

It should also establish fixture conventions that KG2–KG5 can reuse when the Markdown parser, Obsidian adapter, and resolver are implemented.

This task is **not** to parse Markdown or resolve Obsidian links. It is to make those later stages have a precise, stable target model.

---

# Critical current-state note

This prompt was prepared after KG0 reported successful local implementation, but **the GitHub remote still showed only the original initial commit when this prompt was generated** because KG0 explicitly reported that no commit was created.

Therefore:

- assume this task will run in the same local working tree where KG0 changes are present;
- inspect the actual working tree before editing anything;
- read `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, the relevant ADRs, root/package configuration, and existing `packages/core` tests first;
- treat the local repository as the source of truth when it differs from the KG0 summary below.

If the KG0 foundation is **not** present in the working tree—e.g. there is no pnpm workspace, no `packages/core`, no architecture docs, or no validation scripts—**stop and report that the required KG0 state is missing rather than recreating it from this prompt**.

No external file, Google Doc, Icarus vault, or other repository is required for KG1.

---

# KG0 state reported by the previous implementation

KG0 reported:

- pnpm workspace;
- React/Vite application under `apps/web`;
- framework-independent `packages/core`;
- strict TypeScript;
- ESLint + Prettier + Vitest;
- root validation commands including `pnpm check`;
- GitHub Actions CI;
- `docs/ARCHITECTURE.md`;
- `docs/ROADMAP.md`;
- five ADRs;
- root `AGENTS.md`;
- project-local agent skills:
  - `vercel-react-best-practices`;
  - `web-design-guidelines`;
- a mechanical lint boundary preventing `packages/core` from importing React, React Flow, Sigma, Graphology, Tauri, Obsidian packages, React-Sigma, or the web workspace;
- only a temporary `foundationIdentity`-style core shell;
- no parser, Obsidian integration, renderer, backend, Tauri, persistence, or vault access.

KG1 should preserve those boundaries.

---

# Product model context

The application is a **hierarchical knowledge-graph explorer for Markdown workspaces**.

A file is not necessarily an atomic graph node.

Conceptually:

```text
Document
  ├─ Section
  │   ├─ Section
  │   └─ optional addressable Block
  └─ Section
```

References can originate from a document or a more specific addressable entity and can target another addressable entity.

Later views may aggregate exact section-level data:

```text
A.md / Section A1  ─────→  B.md / Section B2
A.md / Section A3  ─────→  B.md / Section B4
```

into:

```text
A.md ─────→ B.md
```

but that aggregation is a **view projection**. The canonical model must preserve the exact underlying endpoints.

The first source adapter will later be Obsidian, but KG1 must remain generic Markdown/document-domain code.

---

# Architectural constraints

Preserve the repository architecture. In particular:

## Core must remain generic

`packages/core` must not import or model ownership around:

- React;
- React DOM;
- React Flow / xyflow;
- Sigma;
- Graphology;
- Tauri;
- Obsidian packages/APIs;
- Icarus theory concepts;
- browser filesystem APIs;
- Node filesystem APIs.

Do not introduce types named around source-specific syntax such as:

- `ObsidianFile`;
- `ObsidianWikilink`;
- `ReactFlowNode`.

The canonical vocabulary should stay closer to:

- workspace;
- document;
- section;
- block;
- reference;
- source location/span;
- resolution;
- snapshot.

## Plain serializable data is canonical

Canonical model instances must be representable as ordinary JSON-compatible data.

Do not make canonical state depend on:

- `Map`;
- `Set`;
- class instances with hidden mutable state;
- Graphology graphs;
- DOM objects;
- functions/callbacks;
- Dates as runtime objects;
- parser AST nodes;
- renderer node types.

It is acceptable to provide pure helper functions around the data.

## No parser/resolver implementation

KG1 defines the target contracts and invariants.

Do not:

- parse Markdown;
- add unified/remark/mdast yet;
- scan wikilinks;
- implement Obsidian target matching;
- implement a workspace scanner;
- infer references from strings.

Synthetic tests may construct model objects directly.

## Explicit uncertainty

The canonical reference model must be capable of distinguishing:

- `resolved`;
- `unresolved`;
- `ambiguous`;
- `invalid`.

Do not encode these as loosely related optional fields that permit contradictory states such as:

```ts
status: "unresolved"
resolvedTargetId: "some-id"
```

Prefer discriminated unions or an equally strong representation.

---

# Design guidance

The exact exported API is for you to decide after inspecting the existing repository, but the following issues should be handled deliberately.

## 1. Entity hierarchy

The initial canonical source-backed entity kinds should be minimal.

Likely initial addressable kinds:

- document;
- section;
- block.

Do **not** add speculative entity kinds merely because an old brainstorm mentioned tags or external nodes. Tags, external URLs, virtual groups, semantic relationships, etc. can be added when their real requirements are known.

A section needs enough structure to reconstruct heading hierarchy without turning containment into a generic graph edge.

A reasonable direction is:

- document has no structural parent;
- section has a parent that is either its document or another section;
- block has a structural parent appropriate to its source location, likely a document or section.

Use a single clear structural source of truth.

Do not simultaneously persist several redundant hierarchy representations unless there is a measured reason.

## 2. Document preamble

Markdown can contain content before the first heading.

The model must not require every reference to originate from a heading.

A reference found in document-level preamble should later be able to use the document itself as its source entity.

This is one reason `Reference.sourceEntityId` should not mean “section ID”.

## 3. Exact source ownership

The future parser should be able to attach a reference to the **most specific source entity it can establish**.

Do not hard-code a parser algorithm in KG1, but make the model compatible with:

- document as source for pre-heading content;
- exact nested section as source for content under that heading;
- addressable block as source if a future adapter deliberately chooses that precision.

Ancestor/file-level relationships can later be derived by projection/indexing.

## 4. Source positions

Define source-position semantics precisely enough that KG2 can map a Markdown AST into them without ambiguity.

A good compatibility target is the usual unist/mdast convention:

- line numbers: 1-based;
- columns: 1-based;
- character offsets: 0-based;
- end offset: exclusive.

Because JavaScript strings use UTF-16 code units for indexes, if offsets are exposed, document what unit they index.

Do not import unist/mdast types into core merely to reuse their shape.

Prefer a generic shape such as conceptually:

```ts
type SourcePoint = {
  line: number;
  column: number;
  offset?: number;
};

type SourceSpan = {
  start: SourcePoint;
  end: SourcePoint;
};
```

Adapt this if the current architecture docs already specify a better equivalent.

Test boundary semantics.

## 5. Source references / paths

A source-backed entity should retain enough provenance to identify its workspace and file.

Prefer workspace-relative normalized paths rather than absolute user-machine paths in canonical snapshots.

Establish and document path semantics now, likely:

- forward slash separator;
- relative to workspace root;
- no leading slash;
- no `..` traversal segments.

Do not store `C:\Users\...` or `/Users/...` paths in canonical committed fixtures.

The provider-specific absolute path belongs to a source-provider layer later, not generic core truth.

## 6. IDs

KG1 needs IDs in its contracts, but it does **not** need to solve KG9 stable rename reconciliation.

Use opaque string identities or another lightweight serializable representation.

Do not derive a permanent identity algorithm from:

```text
relative/path.md#Heading Text
```

and do not introduce UUID generation, filesystem identity tracking, fuzzy rename matching, or persistence logic in KG1.

The model should allow later identity infrastructure to supply stable IDs.

Avoid excessive type-branding machinery unless it clearly improves correctness without making fixture construction painful.

## 7. Reference model

A reference should preserve provenance separately from its resolution result.

It will likely need concepts equivalent to:

- reference ID;
- reference kind;
- source entity ID;
- raw target text;
- source span;
- optional display/alias information only if generic enough;
- resolution outcome.

Keep the initial reference kinds narrow. A likely minimum is:

- link;
- embed.

Do not add `tag-reference` unless repository architecture or a concrete KG1 test requires it.

Do not overfit to Obsidian syntax.

### Resolution

Prefer a discriminated union along the lines of:

```ts
type ReferenceResolution =
  | { status: "resolved"; targetEntityId: EntityId }
  | { status: "unresolved"; reason?: ... }
  | { status: "ambiguous"; candidateEntityIds: EntityId[]; reason?: ... }
  | { status: "invalid"; reason: ... };
```

This is conceptual, not mandatory naming.

Important invariants:

- resolved → exactly one valid target;
- ambiguous → candidate set exists and does not silently choose one target;
- unresolved → no resolved target;
- invalid → malformed/semantically invalid reference can be represented explicitly.

Do not prematurely invent a huge taxonomy of resolver error codes. A small typed reason model/string is enough if it remains evolvable.

## 8. Snapshot shape

Introduce a canonical serializable workspace snapshot.

It should have enough top-level structure to represent:

- schema/version information;
- workspace identity;
- entities;
- references.

Keep it deterministic and fixture-friendly.

Avoid adding volatile timestamps to the canonical snapshot unless they are required. A `generatedAt: new Date()` field would make golden fixtures noisy and does not currently encode source truth.

Prefer arrays or another JSON-stable representation over runtime indexes.

Derived indexes belong later.

## 9. JSON-safe metadata

If the model needs an extension metadata field, make its serialization contract explicit.

A generic `Record<string, unknown>` can accidentally admit functions, Dates, DOM values, etc.

If an extension field is genuinely useful now, define JSON-compatible value types.

However, do not add a generic metadata dumping ground solely for hypothetical future features.

Minimal, explicit fields are preferable.

---

# Invariants and validation

TypeScript types alone cannot protect deserialized fixtures or cross-worker data.

KG1 should establish a lightweight way to validate important model invariants.

Use the simplest approach that fits the existing codebase.

Possible directions:

- pure validation/assertion functions in core;
- a small schema library **only if** it clearly reduces complexity and is justified by current needs.

Do not add a large validation framework automatically.

At minimum, test invariants equivalent to:

### Identity

- entity IDs unique within a snapshot;
- reference IDs unique within a snapshot;
- IDs non-empty according to whatever ID contract is chosen.

### Hierarchy

- every non-document parent exists;
- allowed parent kinds are respected;
- no self-parent;
- no hierarchy cycles;
- source-backed descendants belong to coherent source/workspace structure.

### Sections

- heading depth/level, if modeled, is in the valid Markdown range;
- hierarchy is representable even with skipped heading levels such as `##` → `####`;
- duplicate heading text is allowed—title is not identity.

### Source spans

- line/column values follow documented bounds;
- start does not occur after end;
- offset semantics are coherent when offsets are present.

### References

- source entity exists;
- resolved target exists;
- ambiguous candidate IDs exist and are de-duplicated;
- resolution states cannot contain contradictory target fields;
- invalid/unresolved do not pretend to be resolved.

### Serialization

A valid synthetic snapshot should:

```text
model → JSON.stringify → JSON.parse → validate
```

without losing canonical information.

Do not require every object to be constructed through a class just to maintain these invariants.

---

# Fixture infrastructure

KG1 must establish fixture conventions that later parser/resolver work can reuse.

Inspect the KG0 `tests/fixtures/README.md` first and evolve it rather than replacing it blindly.

## Principles

Committed fixtures must be:

- synthetic;
- deterministic;
- small;
- understandable by inspection;
- free of private Icarus content;
- platform-independent.

When a future bug is discovered using the real Icarus vault, the regression test should reduce it to a minimal synthetic fixture.

## Model fixtures now

Add a small set of canonical-model fixtures sufficient to prove the contract.

For example, cover a workspace containing:

- two documents;
- nested sections;
- duplicate section titles in different locations;
- a document-preamble reference;
- a section-level resolved link;
- an unresolved link;
- an ambiguous link with multiple candidates;
- an invalid reference;
- an addressable block if blocks are included in the initial model.

Do not make one giant fixture test everything if smaller fixtures make failures easier to understand.

Store JSON fixtures only if the repository can load and validate them cleanly under the current Node/TypeScript setup.

If TypeScript fixture builders produce a clearer/testable structure, use them for construction tests while still including at least one JSON round-trip fixture to prove serialization.

## Future parser fixture convention

Prepare, but do not populate heavily, a convention for later workspace/parser fixtures.

A future fixture may need something conceptually like:

```text
tests/fixtures/workspaces/<case>/
  input/
    A.md
    B.md
  expected/
    ...
```

Do **not** lock KG2 into a brittle expected-output format before the parser exists.

Document the convention and create only the minimal directory/readme/examples that are useful now.

Do not create fake parser output just to fill directories.

---

# Public API guidance

Keep `packages/core` exports intentional.

Do not dump every internal helper into the package root.

A reasonable organization may become something like:

```text
packages/core/src/
  model/
    ids.ts
    source.ts
    entities.ts
    references.ts
    snapshot.ts
    validation.ts
  index.ts
```

This is guidance only. Follow the existing package conventions if they are cleaner.

The root public API should make the canonical contracts easy to consume in later packages without exposing test-only builders or implementation-only internals.

Remove the KG0 temporary `foundationIdentity` export once its only purpose has been replaced.

If the web app currently uses it solely as a foundation smoke test, update that smoke usage with the smallest sensible core contract or health/version export. Do not turn the web app into a model demo.

---

# Documentation updates

Update repository-owned docs only where KG1 makes a decision concrete.

Likely updates:

- `docs/ARCHITECTURE.md` — replace provisional model wording with the implemented canonical contract where appropriate;
- `docs/ROADMAP.md` — mark KG1 complete only after implementation/validation if the repository uses status markers;
- relevant ADR only if KG1 materially resolves an expensive architectural choice not already captured;
- fixture README/conventions.

Do not create ADRs for trivial naming decisions.

If implementation reveals a contradiction in existing architecture docs, do not silently choose one. Resolve the contradiction explicitly in code/docs and mention it in the final report.

---

# Skills

No new agent skill is required for KG1.

The existing React/web-design skills are allowed to remain installed but are not central to this core-model task.

Do not install:

- React Flow skills;
- Sigma/Graphology skills;
- Tauri skills;
- deployment/Vercel skills;
- database/backend skills;
- Markdown parser skills

as part of KG1.

If the repository's `AGENTS.md` contains broader skill instructions, follow them, but do not broaden scope.

---

# Scope

## In scope

- inspect KG0 implementation and repository guidance;
- replace temporary core foundation shell with canonical domain contracts;
- document precise source-span/path semantics;
- add explicit resolution union;
- add canonical serializable snapshot;
- add focused invariant validation;
- create model fixtures;
- establish reusable synthetic fixture conventions;
- add comprehensive unit tests for model invariants/serialization;
- update minimal web smoke dependency if KG0 foundation export is removed;
- update architecture/fixture docs where the implemented contract becomes more precise;
- keep all repository validation green.

## Out of scope

Do not implement:

- Markdown parsing;
- remark/unified/mdast;
- Obsidian syntax;
- wikilink parsing;
- heading-target resolution;
- filename/alias resolution;
- workspace scanning;
- browser directory access;
- Tauri;
- file watching;
- Graphology;
- React Flow;
- Sigma;
- view projections;
- graph aggregation;
- search indexes;
- backlinks index;
- persistence;
- stable rename reconciliation;
- generated UUID persistence;
- backend/cloud;
- Icarus-vault fixtures;
- source-file editing;
- UI beyond the smallest compile/smoke adjustment required by core API changes.

Do not start KG2 in the same task.

---

# Implementation approach

Use this as a direction, not as a rigid file-by-file command list.

## 1. Inspect and reconcile

Read:

- `AGENTS.md`;
- `docs/ARCHITECTURE.md`;
- `docs/ROADMAP.md`;
- model/local-first/rendering ADRs;
- `packages/core`;
- current core tests;
- `tests/fixtures/README.md`;
- root validation scripts.

Identify any conflict between this prompt and repository-owned decisions.

Repository-owned KG0 architecture should generally win unless it is clearly provisional or internally inconsistent. Report meaningful discrepancies.

## 2. Write the model contract before helpers

Define the smallest set of canonical types needed for:

```text
workspace
  → document hierarchy
  → section/block addressability
  → reference provenance
  → resolution state
  → serializable snapshot
```

Avoid convenience fields that can be derived cheaply and risk contradiction.

## 3. Encode invariants

Implement pure validation/assertion logic.

Prefer returning structured validation issues if that improves testing/debugging rather than throwing on the first problem, but keep the API small.

The validator should be usable on parsed JSON, not only strongly typed compile-time objects.

Do not turn KG1 into a general JSON-schema system.

## 4. Build fixtures and tests

Test valid and invalid cases.

Make failures local and explanatory.

Include serialization round-trip coverage.

Test duplicate titles and nested hierarchy explicitly so future code never treats names as identity.

## 5. Tighten the public API

Expose only the contracts KG2+ should rely upon.

Remove temporary KG0 core API if obsolete.

Update the minimal web package only as required to keep its dependency on core real and buildable.

## 6. Documentation consistency pass

After the model exists, re-read the architecture docs.

Check whether the concrete implementation invalidates older wording.

Update earlier sections if later implementation decisions require it rather than merely appending contradictory notes.

## 7. Validate

Run the repository's standard checks plus focused core tests.

---

# Validation scenarios

In addition to repository-wide validation, add focused tests proving behavior similar to these scenarios.

## A. Minimal hierarchy

```text
A.md
  # Top
    ## Child
```

Canonical model validates.

## B. Duplicate names are legal

```text
A.md / # Notes
B.md / # Notes
```

and/or two distinct `## Details` sections where allowed.

They must remain distinct entities because IDs, not titles, define identity.

## C. Preamble reference

A reference can originate from the document entity itself rather than requiring a section.

## D. Resolution states

Construct one reference for each:

```text
resolved
unresolved
ambiguous
invalid
```

and ensure only the fields legal for that state are representable/accepted by validation.

## E. Broken hierarchy

Reject or report:

- missing parent;
- self-parent;
- cycle.

## F. Bad target

A resolved reference to a non-existent entity is invalid at snapshot-validation time.

## G. Ambiguous candidates

Reject/report duplicate or non-existent candidate IDs.

Prefer at least two distinct candidates for a valid ambiguous result.

## H. Source-span boundaries

Test valid spans and obvious invalid ordering/bounds.

## I. JSON round trip

Load or create a representative canonical snapshot:

```ts
const json = JSON.stringify(snapshot);
const parsed = JSON.parse(json);
```

Validate the parsed value and prove canonical information survives.

## J. Framework boundary

Existing lint/mechanical checks for `packages/core` independence must continue to pass.

---

# Repository validation

Run the repository's actual commands from `AGENTS.md`/README.

Based on KG0's report, likely commands include:

```bash
pnpm format
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check
git diff --check
```

Also run focused core tests directly if the workspace provides an appropriate command.

Do not claim a command passed unless it was run.

Do not modify tooling versions merely to make unrelated upgrades during KG1.

---

# Exit gate

KG1 is complete when:

1. `packages/core` contains a deliberate canonical domain model rather than the KG0 placeholder.
2. The model represents documents, nested sections, optional addressable blocks, references, source provenance, and explicit resolution states.
3. Canonical state remains ordinary serializable data.
4. There is a documented, tested source path/span convention.
5. Snapshot invariants can be checked at runtime on JSON-derived values.
6. Duplicate names are supported without identity confusion.
7. A reference may originate from document preamble or a more specific entity.
8. Resolved/unresolved/ambiguous/invalid states are structurally non-contradictory.
9. Synthetic fixture conventions exist and are private-safe.
10. Representative model fixtures/tests cover valid and invalid snapshots.
11. No parser/Obsidian/renderer/platform/persistence dependency was introduced.
12. Existing core import-boundary enforcement still works.
13. Repository docs are consistent with the implemented model.
14. All relevant validation passes.

Do not proceed into Markdown parsing.

---

# Final report

Report:

## 1. Summary

What canonical contracts were added and what KG0 placeholder was removed/replaced.

## 2. Model

List the important exported concepts and their semantics.

Especially explain:

- hierarchy;
- source path/span convention;
- reference provenance;
- resolution union;
- snapshot shape.

## 3. Invariants

Explain what runtime validation checks and any important invariant intentionally deferred to later phases.

## 4. Fixtures/tests

Describe fixture structure and which synthetic cases are covered.

## 5. Files changed

List the important touched files/directories.

## 6. Dependencies

List any dependency added.

If a runtime/schema dependency was added, explain why it was preferable to small local validation helpers.

Confirm that no deferred graph/parser/platform dependency was introduced.

## 7. Validation

List exact commands run and results.

## 8. Documentation reconciliation

State whether any KG0 architecture wording had to change after implementing KG1 and why.

## 9. Deviations / uncertainty

Report any prompt decision you changed after inspecting the repository.

## 10. KG2 handoff

Explain what the future Markdown structural parser can now target directly and what questions remain deliberately unresolved.

Do not implement KG2 automatically.
