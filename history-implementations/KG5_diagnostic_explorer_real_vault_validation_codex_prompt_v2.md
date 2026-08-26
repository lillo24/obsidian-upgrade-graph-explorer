# KG5 — Diagnostic Explorer + Real-Vault Validation

**Task type:** diagnostic tooling / integration validation / first functional UI

## Goal / success outcome

Build the first end-to-end diagnostic workflow for `icarus-graph-explorer`.

KG5 should prove that the source pipeline works on a real Obsidian vault before graph projections and renderers harden assumptions.

The complete development workflow should become:

```text
local Markdown vault
        ↓
development-only local scanner
        ↓
parseObsidianDocument() per Markdown file
        ↓
resolveObsidianWorkspace()
        ↓
validated KnowledgeSnapshot
        +
adapter/resolver diagnostics
        +
non-canonical compatibility probes
        ↓
local diagnostic report JSON
        ↓
React diagnostic explorer
```

Success means an engineer can:

1. run the pipeline against a local vault without uploading or committing its contents;
2. inspect canonical documents, sections, marker-backed blocks, references, resolution states, candidates, and diagnostics in a usable browser UI;
3. run the workflow against the real Icarus vault;
4. identify compatibility gaps empirically;
5. reduce genuine bugs to synthetic committed regression fixtures;
6. finish KG5 with evidence that KG6 can safely design graph projections on top of the canonical model.

KG5 is **not** the graph UI. Do not add React Flow, Sigma, Graphology, Tauri, persistence, or live filesystem watching.

---

# External context — required for KG5 completion

This plan intentionally requires one external local dataset for the final validation gate:

```text
lillo24/Icarus-OR-The_APP-
```

The likely local clone, based on the current development environment, is a sibling repository around:

```text
C:/Users/leona/Documents/GitHub/Icarus-OR-The_APP-
```

Do **not** hard-code this path anywhere.

The local diagnostic command must accept a vault path explicitly.

If the Icarus repository is unavailable locally:

- implement and validate the generic/synthetic KG5 tooling;
- do not guess real-vault findings;
- do not claim KG5 complete;
- stop before final completion/merge and report exactly what external context is missing.

The Icarus repository is private project data. Do not commit its note contents, generated report, source excerpts, filenames/headings discovered only through private validation, or copied fixtures.

When a real-vault defect is found, reduce it to a small neutral synthetic reproduction before committing a regression test.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

KG4 is merged through PR #5 at:

`22839fd750c64037bd68d8f31a0d9307f9d4d9d6`

The implemented pipeline is now:

```text
adapter-obsidian
      ↓
resolver-obsidian
      ↓
KnowledgeSnapshot
```

More fully:

```text
parseObsidianDocument({ path, source })
      ↓
ParsedObsidianDocument[]
      ↓
resolveObsidianWorkspace({
  workspaceId,
  documents,
})
      ↓
WorkspaceResolutionResult
```

A successful KG4 result contains:

```ts
{
  ok: true,
  snapshot: KnowledgeSnapshot,
  diagnostics: WorkspaceResolutionDiagnostic[]
}
```

The resolver README establishes:

- deterministic but transient snapshot IDs;
- exact KG2 section hierarchy;
- marker-span-backed blocks;
- deepest-containing-section reference ownership;
- conservative case-sensitive file resolution;
- explicit ambiguity rather than undocumented tie-breaking;
- exact heading-chain matching;
- explicit block-anchor matching;
- aliases as metadata, not persisted destination keys;
- unsupported non-Markdown targets because there is currently no attachment inventory;
- fatal assembly failures returning no partial snapshot.

The roadmap now marks:

```text
KG4 — complete
KG5 — next: Diagnostic explorer + real-vault validation
KG6 — View-projection architecture
```

The current React application is still only the foundation screen and does not yet expose the canonical model.

---

# Current Icarus-vault evidence relevant to KG5

The external Icarus repository is genuinely an Obsidian vault and includes:

```text
.obsidian/
App_/
Integrating the ideas/
Y-General thoughts/
Z-Not in Graph/
ZZZ/
...
```

Its current `.obsidian/graph.json` uses a display filter approximately equivalent to:

```text
(path:"Integrating the ideas" OR path:"Y-General thoughts") -file:List
```

and currently has:

```json
"showAttachments": false
```

This is useful validation context, but **do not turn the current Obsidian graph filter into canonical ingestion policy**.

Canonical resolution needs the broader note workspace so links to notes outside the visible graph can still resolve.

Treat:

```text
graph display scope ≠ canonical workspace scope
```

The diagnostic UI may make path filtering easy, but KG5 should not implement Obsidian's graph-query language.

---

# Plugin-research decisions integrated into KG5

A separate review of existing Obsidian graph/navigation plugins produced several useful ideas. KG5 should incorporate only the parts that improve **validation architecture** now, while leaving graph interaction semantics to the milestones that own them.

The key principle is:

```text
plugin behavior can inform product requirements
but must not pull renderer-specific or plugin-specific architecture inward
```

## Integrate now in KG5

### 1. Start synthetic performance evidence before KG12

Add an **opt-in, non-gating synthetic performance harness** for the already-pure pipeline.

Measure at least:

```text
parse/adapt
workspace resolution
diagnostic report construction
```

against deterministic synthetic workspaces.

A practical initial family is approximately:

```text
small   ~100 documents
medium  ~500 documents / several thousand sections
large   ~2,000 documents / tens of thousands of sections
```

Exact generated structure should be deterministic and configurable.

Do not make the largest benchmark part of every normal `pnpm check`.

CI should validate that the benchmark generator/harness works through a small smoke case; actual performance runs remain opt-in until KG12 establishes explicit budgets.

The harness should record:

```text
document count
section count
block count
reference count
elapsed time by phase
```

Do not add worker logic or renderer benchmarks in KG5.

### 2. Collect real-vault timing evidence

The Icarus validation run should record coarse local timings for:

```text
file discovery/read
parse/adapt
resolution
diagnostic-report construction
report serialization
```

These timings are diagnostic evidence, not pass/fail budgets.

The final report should include aggregate timings and scale counts so KG6/KG7/KG12 can reason from an actual workload.

### 3. Validate the data needed for future collapsed-edge roll-up

Do not implement graph projections in KG5.

But during diagnostic validation, explicitly verify that the current source model preserves enough information for KG6 to derive:

```text
precise reference source entity
precise resolved target entity / candidate IDs
document-section ancestor hierarchy
```

so a future projection can map hidden endpoints to their nearest visible ancestors **without modifying canonical truth**.

If this information is missing for a real case, treat that as a KG5 architectural finding.

### 4. Treat unresolved / ambiguous / invalid as first-class diagnostic categories

The diagnostic UI already exposes resolution states.

Strengthen this requirement: these states must remain visibly separate and inspectable because KG7 will later need distinct graph-native visual representations.

KG5 should not create graph “ghost nodes” yet.

The diagnostic report/UI should simply preserve enough information for future projection-only synthetic visuals:

```text
unresolved → raw target + reason
ambiguous  → candidate entity IDs + readable candidate labels
invalid    → raw target + invalidity reason
```

These future visual nodes/markers must remain derived projection objects, not canonical entities.

## Explicitly defer to future milestones

Do **not** implement these in KG5:

```text
link roll-up / projected edge aggregation
fold/unfold graph hierarchy
focus / N-hop ego graph
hover graph highlighting
ghost graph nodes
graph layouts
saved views
pathfinding
centrality / communities
semantic similarity
typed semantic relationships
folder grouping
graph source previews
```

KG5 may collect evidence relevant to them, but must not harden their UI or data contracts prematurely.

## Licensing / inspiration rule

If future implementation work inspects plugin source code rather than only public behavior/documentation:

- treat plugin projects as behavioral/architectural references;
- respect their licenses;
- do not copy GPL/AGPL implementation into this repository without an explicit licensing decision.

---

# Architecture sanity check

Before implementation, preserve the existing dependency direction:

```text
source acquisition
   → parser / adapter / resolver
   → canonical snapshot
   → diagnostic/view read models
   → UI
```

Filesystem access needed only for real-vault validation must stay in an **outer development tool**.

Do not put Node filesystem APIs into:

- `core`;
- `parser-markdown`;
- `adapter-obsidian`;
- `resolver-obsidian`;
- generic browser UI code.

Tauri remains KG11.

Do not create a product filesystem abstraction merely because a development diagnostic CLI needs to walk a directory.

---

# Recommended KG5 shape

A good implementation will probably have three pieces.

## 1. Pure diagnostic-report/read-model package

Likely:

```text
packages/diagnostics-obsidian/
```

This package should convert successful KG4 output plus optional validation evidence into a deterministic, serializable report suitable for inspection.

It should remain:

- React-free;
- filesystem-free;
- renderer-free;
- platform-free.

It may depend on:

```text
core
resolver-obsidian
adapter-obsidian
```

if the implemented report/probes genuinely need those types.

Do not pretend the diagnostic layer is source-neutral if it is specifically interpreting Obsidian resolver compatibility. Honest package ownership is preferable to premature abstraction.

A likely report boundary is conceptually:

```ts
interface ObsidianDiagnosticReport {
  readonly schemaVersion: 1;
  readonly snapshot: KnowledgeSnapshot;
  readonly diagnostics: readonly DiagnosticRecord[];
  readonly probes: readonly CompatibilityProbe[];
  readonly sourceInventory: {
    readonly markdownFileCount: number;
    readonly nonMarkdownFileCount?: number;
  };
}
```

The exact shape is for Codex to refine.

Prefer deriving simple counts in the UI rather than duplicating large summary structures that can drift from the snapshot.

Do not include full source text or snippets in the report.

## 2. Development-only local vault runner

Likely:

```text
tools/vault-diagnostics/
```

or a similarly clear outer-layer location.

This tool is allowed to use Node filesystem APIs.

It should:

```text
walk local directory
  → select Markdown files
  → read text
  → normalize workspace-relative paths
  → parse each file
  → resolve complete workspace
  → build diagnostic report
  → print aggregate summary
  → optionally write local JSON report
```

The command should accept an explicit vault path, approximately:

```bash
pnpm diagnose:vault -- --vault "C:/path/to/vault"
```

and a report destination, approximately:

```bash
--out output/diagnostics/report.json
```

Names may differ.

Do not hard-code Icarus.

Do not make the web product read folders directly.

## 3. Browser diagnostic explorer

Replace the foundation-only screen with the first functional but deliberately non-graph diagnostic UI.

The web app should consume a diagnostic report, not directly scan a vault.

The main path should be:

```text
Select local report JSON
       ↓
validate report
       ↓
inspect locally in browser memory
```

Also provide a small bundled **synthetic** sample report so the UI can be developed/tested without private data.

Do not upload the selected report anywhere.

Do not add a backend.

---

# Diagnostic report privacy boundary

A generated report contains private structural information such as:

- filenames;
- heading titles;
- raw internal-link targets;
- source positions;
- graph relationships.

Therefore real-vault reports are private local artifacts.

Add a narrow gitignore rule such as:

```text
output/diagnostics/
```

or another repository-consistent ignored location.

Do not commit:

- real-vault report JSON;
- real-vault snapshots;
- source excerpts;
- screenshots containing private Icarus note structure;
- copied note text.

Console output should default to aggregate counts, not a dump of every path/target.

A `--verbose` mode may print detailed paths locally if useful, but it must not be required for normal validation.

---

# Local vault discovery

The development runner should recursively discover relevant files without external glob dependencies unless one is clearly justified.

Use Node APIs conservatively.

## Generic defaults

Ignore obvious infrastructure/generated directories such as:

```text
.git/
.obsidian/
node_modules/
```

Do not follow symlinks out of the selected root.

Do not silently ingest hidden plugin/runtime data.

Make additional excludes configurable.

## Icarus validation run

For the Icarus local validation, exclude repository/tooling areas that are clearly not vault note content, likely including:

```text
.github/
.obsidian/
.makemd/
.space/
App_/zz_CODE_APP/
```

Verify the actual local tree before using these.

Do **not** exclude genuine note areas merely because they are hidden from the current Obsidian graph.

In particular, directories such as:

```text
Z-Not in Graph/
ZZZ/
```

may still contain valid target notes and should normally remain available for canonical resolution unless evidence says otherwise.

The current Obsidian graph filter is a display choice, not a resolver inventory.

---

# Scanner failure behavior

Fail loudly for source-acquisition failures that make the workspace incomplete or untrustworthy.

Examples:

- selected root does not exist;
- cannot read a Markdown file;
- duplicate normalized path;
- path escapes selected root;
- fatal KG4 assembly failure.

Do not skip unreadable Markdown files and still report a “successful vault scan” unless the user explicitly chooses a best-effort mode.

A best-effort mode is not required in KG5.

Do not write report JSON when the resolver returns `ok: false`, unless the report format clearly marks the run as failed and cannot be confused with canonical success. Simpler is preferable: no success report on fatal assembly.

---

# Diagnostic report validation

The browser must not trust arbitrary JSON blindly.

Add runtime validation for the report boundary.

At minimum:

1. validate report schema/version;
2. validate the embedded `KnowledgeSnapshot` with `validateKnowledgeSnapshot()`;
3. validate diagnostics/probe records enough to avoid unsafe/contradictory UI assumptions;
4. fail with an actionable local error if the selected report is malformed.

Do not pull in a large schema dependency unless it materially simplifies this.

The report should round-trip through JSON deterministically.

---

# Diagnostic read model

The diagnostic explorer needs efficient human labels for opaque canonical IDs.

Build pure derived lookup helpers rather than changing canonical schema.

Useful derived indexes may include:

```text
entityById
documentByPath
childrenByParentId
referencesBySourceEntity
referencesByResolutionStatus
```

and presentation labels such as:

```text
Document: Integrating the ideas/...
Section: <document path> / Parent / Child
Block: <document path> / ^block-id or marker location
```

Because canonical `BlockEntity` currently does not store the textual block ID, do not invent one from the canonical entity alone.

If the diagnostic report needs adapter-level source facts to label a block more richly, keep that information in the non-canonical diagnostic/report layer.

Do not change schema v1 just to make the inspector prettier.

---

# First diagnostic UI

The UI is a debugging/validation surface, not the final graph design.

Keep it functional, accessible, and information-dense.

Use the repository's existing:

- `vercel-react-best-practices`;
- `web-design-guidelines`

skills when relevant.

Do not spend large amounts of time on branding.

## Required UI capabilities

### A. Report loading

Provide:

- “Load diagnostic report” file input;
- a synthetic sample/demo report option;
- clear invalid-report error state;
- clear local/privacy wording that the report is processed in the browser.

Do not request a vault folder.

### B. Summary

Show at least:

```text
documents
sections
blocks
references
resolved
unresolved
ambiguous
invalid
diagnostics by severity
compatibility probes
```

Counts should be derived from the loaded report.

### C. Resolution filtering

Allow filtering references by:

```text
resolved
unresolved
ambiguous
invalid
```

and ideally all.

### D. Search

Allow a simple local search over useful diagnostic strings such as:

- source path;
- raw target;
- entity/section title.

Do not add a search library unless needed.

### E. Reference inspection

For each reference show enough to understand:

```text
source path
source owner
source line/column
raw target
link/embed
resolution status
resolved target or ambiguous candidates
reason
```

Resolve opaque target/candidate IDs to readable canonical labels in the UI.

### F. Canonical hierarchy inspection

Provide a simple document/section tree or equivalent structured list.

The goal is to verify:

```text
file → nested headings → marker-backed blocks
```

Do not make this a force graph.

Collapsing a document/section in this diagnostic tree is fine as ordinary UI state, but do not treat it as KG6/KG9 graph view state architecture.

### G. Diagnostics

Show resolver/forwarded adapter diagnostics with:

```text
severity
code
path/span
message
```

Make fatal/non-fatal distinction visible if present.

### H. Compatibility probes

Show the KG5 compatibility-probe results separately from canonical resolver states.

The UI must make clear:

> Probe = possible compatibility clue, not canonical resolution truth.

---

# State management

Do not install Zustand solely for KG5 unless the UI genuinely becomes difficult to manage without it.

Local React state and pure derived selectors are probably enough for this diagnostic screen.

The long-term graph application may still adopt a state library later.

Do not harden a state architecture based on this temporary diagnostic workflow.

---

# No graph renderer yet

Explicitly do not install:

- React Flow;
- Sigma;
- Graphology;
- ELK;
- GSAP.

KG5 exists partly to prevent us from designing graph projection semantics on top of an unvalidated source model.

KG6 comes next.

---

# Compatibility probes

The canonical resolver should remain conservative unless real evidence proves a policy wrong.

KG5 should therefore add **non-canonical probes** that answer:

> “Would a slightly different compatibility rule have resolved this?”

These probes must never mutate `KnowledgeSnapshot` resolutions.

Keep the set small and directly tied to KG4's known uncertainties.

## 1. Case-only file match

For an unresolved file-like target, determine whether exactly one Markdown document would match under case-insensitive basename/path comparison.

Example probe:

```text
case-only-file-match
```

If present, this is evidence for later case-policy review.

Do not automatically resolve it.

## 2. Case-only heading match

For an unresolved heading target whose document candidates are otherwise known, determine whether exactly one section would match if title case were ignored.

Do not perform broad fuzzy matching.

## 3. Conservative heading-normalization clue

Only if useful after real-vault evidence, check a very small normalization such as exact Unicode/string equality after trim or equivalent.

Do not add arbitrary punctuation stripping/fuzzy search just to produce more probes.

## 4. Unsupported attachment inventory

The local runner can inventory non-Markdown files without creating canonical entities.

For a canonical/parsed unsupported non-Markdown reference, determine conservatively whether a matching attachment exists in the selected local vault.

Report separately:

```text
attachment-present-unmodeled
attachment-not-found
attachment-match-ambiguous
```

This does **not** change the canonical reference, because schema v1 still models Markdown documents only.

The purpose is to learn whether unsupported attachment references are mostly legitimate existing assets or actual broken links.

Use source-relative / explicit path evidence conservatively.

Do not build an attachment graph model in KG5.

## 5. Ambiguity visibility

For ambiguous canonical references, no special alternate resolution is required.

The report/UI should simply make candidate paths/sections readable enough to inspect whether KG4's ambiguity is sensible.

Do not invent “nearest file wins” as a probe unless real-vault evidence specifically makes it worth testing.

---

# Probe design

Keep probes plain and serializable.

Prefer referencing the canonical reference by `ReferenceId` rather than copying its source data repeatedly.

Conceptually:

```ts
interface CompatibilityProbe {
  readonly code: string;
  readonly referenceId: ReferenceId;
  readonly message: string;
  readonly candidateEntityIds?: readonly EntityId[];
  readonly candidatePaths?: readonly WorkspacePath[];
}
```

This is guidance only.

A probe must not masquerade as a resolver diagnostic.

---

# Real-vault validation procedure

After synthetic tests pass, run KG5 against the actual local Icarus vault.

## Phase 1 — broad canonical workspace

Ingest the user-note Markdown workspace with infrastructure/code exclusions.

Do not use `.obsidian/graph.json` as the resolver file filter.

Record aggregate local counts for:

```text
Markdown documents
sections
explicit block anchors
references
resolved
unresolved
ambiguous
invalid
adapter/resolver diagnostics
unsupported attachments
compatibility probes
```

Also record coarse local timings for:

```text
file discovery/read
parse/adapt
workspace resolution
diagnostic report construction
report serialization
```

These are evidence only, not KG5 pass/fail performance budgets.

Do not commit the report.

## Phase 2 — inspect current graph-interest paths

Because the current Obsidian graph focuses mainly on:

```text
Integrating the ideas/
Y-General thoughts/
```

use the diagnostic UI's path search/filter to inspect this subset specifically.

Do not implement Obsidian graph query syntax.

Verify that representative links in this core theory area:

- resolve to expected files;
- resolve to expected headings when targeted;
- preserve source ownership under the correct heading;
- expose ambiguous/broken cases instead of silently guessing.

## Phase 3 — inspect KG4 known uncertainties

Specifically inspect:

1. case-only file probes;
2. case-only heading probes;
3. ambiguous partial paths;
4. duplicate headings;
5. unsupported attachment references with inventory evidence;
6. unresolved block references;
7. adapter diagnostics indicating unsupported/malformed syntax.

The objective is to determine which are:

```text
A. expected/broken source links
B. unsupported but acceptable for now
C. genuine parser/resolver bugs
D. architecture/product decisions requiring discussion
```

---

# Handling real-vault findings

This is important.

## Minor, clear correctness bug

If real-vault validation proves a parser/resolver behavior is plainly wrong and the fix:

- fits existing architecture;
- does not create a major new product policy;
- can be reduced to a synthetic fixture;

then:

1. create the synthetic fixture;
2. fix the responsible package;
3. run its focused regression tests;
4. re-run the real-vault validation.

Examples:

- source span miscalculation;
- clearly wrong path parsing;
- a documented Obsidian syntax form we already claim to support but mishandle.

## Major policy/design choice

Stop and report before changing behavior if real-vault evidence raises a major choice such as:

- making canonical file matching case-insensitive globally;
- adding attachment entities to schema v1;
- fuzzy heading matching;
- reproducing undocumented Obsidian tie-breaking;
- expanding canonical block semantics beyond marker spans;
- changing identity strategy;
- changing alias semantics;
- changing what constitutes the canonical vault inventory.

Do not bury such a decision inside KG5.

This follows the repository rule that expensive architecture changes need evidence and explicit review.

---

# Real-vault validation artifact

The local report should be written to an ignored path, for example:

```text
output/diagnostics/icarus-report.json
```

Optionally allow a human-readable local summary file alongside it.

Neither should be committed.

The final Codex report may state aggregate counts and compatibility categories.

Avoid pasting private theory headings or file paths unless one specific path is required to explain a blocking bug.

If a specific private example is necessary for user review, report it in the final response, not in committed repository docs.

---

# Diagnostic runner CLI

Keep the CLI small.

Likely options:

```text
--vault <absolute/local root>        required
--out <report json>                  optional
--exclude <relative prefix>          repeatable
--workspace-id <id>                  optional deterministic default
--verbose                            optional
```

Do not build a general-purpose CLI framework unless needed.

Simple argument parsing is sufficient.

If you add a CLI parsing dependency, justify why hand parsing would be error-prone.

Prefer no new runtime dependency if the interface remains small.

### Workspace ID

Do not derive a private absolute path into the canonical workspace ID.

Use:

- explicit `--workspace-id`; or
- a neutral deterministic development value such as the root folder basename if acceptable.

Document that KG5 runner identity is development-only.

Do not pretend this solves account/workspace identity.

---

# File inventory

For diagnostic purposes the runner may collect:

```text
Markdown source paths
non-Markdown resource paths
```

Do not put non-Markdown resources into `KnowledgeSnapshot`.

The inventory belongs only to the local validation/report layer.

Avoid reading binary contents.

Only paths are needed for attachment existence probes.

---

# Browser report loading

Use the browser File API to read a user-selected JSON report.

This is not KG11 vault filesystem access.

It is acceptable because the user explicitly selects one diagnostic JSON file.

Do not:

- recursively read directories;
- persist a folder handle;
- watch files;
- request broad filesystem permissions.

Keep the distinction explicit in docs:

```text
KG5 = load one generated report
KG11 = product-grade live vault source access
```

---

# Sample report

Commit one small synthetic diagnostic report generated from existing or new synthetic fixtures.

Prefer deriving it through a script/test rather than hand-maintaining inconsistent JSON if practical.

The sample should contain at least:

- nested sections;
- one resolved reference;
- one unresolved reference;
- one ambiguous reference;
- one marker-backed block;
- one diagnostic;
- one compatibility probe.

It must contain no Icarus content.

Use it as:

- UI demo;
- browser QA input;
- regression source for report validation.

---

# UI implementation quality

Use semantic HTML and accessible labels.

Required considerations:

- keyboard-accessible report picker;
- clear focus states;
- table/list headings;
- no color-only status communication;
- empty states;
- invalid report state;
- long paths/targets must wrap or truncate without breaking layout;
- responsive enough for desktop widths and narrower windows;
- large diagnostic lists should not cause avoidable global React re-renders.

Use the existing React best-practices skill to review component subscriptions/derived data.

Do not implement virtualization unless real report measurements show it is necessary.

KG12 owns performance hardening.

---

# Browser QA / skills

No new **committed repository-local skill** is required for KG5.

The existing:

- `vercel-react-best-practices`;
- `web-design-guidelines`

skills are sufficient for the implementation.

If the Codex environment already has a current Playwright/browser-automation skill or CLI available, use it for local browser QA of:

- loading the synthetic report;
- filtering resolution states;
- searching;
- opening a diagnostic/reference detail;
- invalid JSON/report handling.

Do not add a Playwright dependency or new repo skill solely because it might be useful.

If browser automation is unavailable, perform/document a focused manual browser validation.

Re-evaluate committed E2E infrastructure when the structural graph interaction exists.

---

# Synthetic performance harness

KG5 should establish the first reproducible performance harness, but **not performance budgets**.

## Generator

Create a deterministic synthetic workspace generator in a pure/testable location.

It should be able to generate configurable:

```text
documents
sections per document
nested depth
references per section/document
resolved/unresolved/ambiguous mix
```

Do not attempt to model every Obsidian syntax feature.

The purpose is to measure the existing pipeline with representative structural scale.

## Benchmark command

Expose an opt-in command, approximately:

```bash
pnpm benchmark:pipeline
```

or a repository-consistent equivalent.

Support selecting a workload size/config if straightforward.

Output should be concise machine/human-readable phase timings.

Do not write huge benchmark artifacts into the repository.

## CI policy

Normal CI should:

- test the generator;
- run a small smoke benchmark or equivalent correctness case if cheap.

Normal CI should **not** fail because a timing threshold changed on shared runners.

KG12 will define performance budgets and worker boundaries after real workloads and renderer behavior exist.

## Benchmark architecture rule

Keep benchmarked modules pure/serializable enough that KG12 can later move expensive work to workers without rewriting domain logic.

Do not benchmark React rendering in KG5.

---

# Testing strategy

## Pure diagnostic/report tests

Test:

- report JSON round trip;
- embedded snapshot runtime validation;
- malformed report rejection;
- lookup label derivation;
- deterministic diagnostic/probe ordering;
- case-only probes;
- attachment inventory probes.

## Runner tests

Use temporary synthetic directories created during tests.

Do not make tests depend on the real Icarus repository.

Cover:

- recursive Markdown discovery;
- default ignored infrastructure directories;
- configurable excludes;
- no symlink escape;
- unreadable/missing vault failure where practical;
- report output;
- no source content embedded beyond canonical structural fields;
- fatal resolver failure does not look successful.

## Web tests

Do not introduce a large browser-test stack unless needed.

Extract data transformations/filtering into pure functions where useful and unit-test them.

At minimum test logic for:

- status counts;
- resolution filtering;
- search;
- entity labels;
- candidate labels.

Use browser/manual QA for actual file-input interaction and layout if no existing DOM-test stack is present.

---

# Scope

## In scope

- inspect current KG4 repository;
- add diagnostic report/read-model layer where justified;
- add development-only local vault scanning CLI;
- keep filesystem access out of product/domain packages;
- create ignored local diagnostic output;
- parse/resolve a complete local vault;
- add compatibility probes;
- add attachment path inventory for diagnostics only;
- replace foundation web screen with diagnostic explorer;
- load report JSON locally in browser;
- synthetic sample report;
- summary/reference/hierarchy/diagnostic/probe views;
- filters/search;
- real Icarus vault validation;
- reduce clear bugs to synthetic fixtures;
- deterministic synthetic pipeline-performance generator/harness;
- collect non-gating real-vault pipeline timings;
- reconcile architecture/roadmap/README, including future projection/interaction refinements from plugin research;
- full validation/PR/merge/cleanup.

## Explicitly out of scope

Do not implement:

- graph projection contracts;
- React Flow;
- Sigma;
- Graphology;
- force-directed layout;
- heading expansion inside a graph;
- graph hide/collapse semantics;
- persistent view state;
- stable IDs;
- IndexedDB;
- Tauri;
- live vault folder picker;
- file watching;
- incremental parsing;
- performance budgets or CI timing gates;
- worker implementation;
- renderer performance benchmarking;
- source editing;
- attachment canonical entities;
- external URL graph nodes;
- Obsidian graph-query parser;
- backend/cloud/accounts;
- AI semantics.

Do not begin KG6 automatically.

---

# Likely repository areas

Inspect before choosing exact layout.

Probable areas:

```text
packages/
  core/
  parser-markdown/
  adapter-obsidian/
  resolver-obsidian/
  diagnostics-obsidian/       # likely new, if shared report logic warrants it

tools/
  vault-diagnostics/          # likely new development-only workspace package

apps/web/
  src/
    ... diagnostic UI

tests/fixtures/workspaces/
docs/
```

If the current pnpm workspace only includes:

```yaml
apps/*
packages/*
```

and a real `tools/*` workspace package is created, update workspace configuration deliberately.

Do not move existing packages merely for symmetry.

---

# Future-roadmap refinements from plugin research

As part of KG5 documentation reconciliation, sharpen the future milestone descriptions without implementing them yet.

The following requirements should become durable roadmap guidance.

## KG6 — View projection architecture

Explicitly include:

```text
projection granularity:
  documents only
  documents + selected/top-level sections
  expanded selected hierarchy

collapse semantics:
  visible vs collapsed structural entities

reference endpoint roll-up:
  hidden source → nearest visible ancestor
  hidden target → nearest visible ancestor

projected edge aggregation:
  one visible edge may retain multiple underlying ReferenceIds

focus projection:
  selected root
  small N-hop reference neighborhood
  hierarchy inclusion policy

filter primitives:
  path
  title/search text
  entity kind
  resolution state
```

Do not promise tag/property filtering yet because schema/adapter support for general tags/properties does not currently exist.

All projection behavior must remain renderer-independent.

## KG7 — Structural graph MVP

Strengthen the milestone around scalability interactions rather than “render everything”:

```text
expand/collapse hierarchy
projected link roll-up
select
focus mode
hover neighborhood emphasis
structural layout
local/focus layout
distinct unresolved / ambiguous / invalid visual treatment
```

Any unresolved/ambiguous “ghost” representation is a **projection/UI synthetic node or marker**, never canonical source truth.

Keep the number of primary controls small.

## KG8 — Inspector, backlinks, search + navigation

Strengthen:

```text
exact source path + line/span provenance
section breadcrumbs
incoming/outgoing reference lists
edge provenance: why this edge exists
candidate inspection for ambiguity
search/filter UI
```

Do not promise full live source snippets/open-in-source solely from canonical snapshots.

A rich source preview/open-source workflow depends on an actual source provider; product-grade local source access is still planned for KG11.

Pathfinding can be considered after the core inspection workflow is stable rather than becoming a KG8 gate.

## KG9 — Persistence + stable identity

Persist application view state such as:

```text
fold state
pins/manual positions
selected view mode
filters
saved views
viewport
```

Do not persist renderer-specific objects as canonical truth.

## KG12 — Performance + worker hardening

Use the KG5 harness and later renderer measurements to establish:

```text
explicit workload profiles
performance budgets
worker split based on measurement
projection benchmarks
focus/collapse workload benchmarks
```

## KG13 — Global renderer decision

Keep the renderer decision benchmark-gated.

Plugin research is evidence that WebGL/Pixi/Sigma-style approaches are viable at high density, **not** evidence that React Flow should be replaced before Icarus workloads are measured.

## Post-MVP / derived analytics

Keep these outside canonical source truth:

```text
typed conceptual relations
pathfinding variants
centrality
betweenness
communities
connected components
co-citation
semantic similarity
timeline/recency overlays
```

If typed semantic relationships are introduced later, prefer a separate provenance-bearing derived/author-annotation relation layer rather than overloading canonical syntactic `Reference`.

---

# Documentation reconciliation

Update earlier sections if KG5 evidence changes them.

Likely documents:

```text
README.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
packages/resolver-obsidian/README.md     # only if compatibility bug/policy clarified
packages/diagnostics-obsidian/README.md  # if package exists
tools/vault-diagnostics/README.md        # if useful
apps/web README/map if repo pattern warrants it
```

Document clearly:

- KG5 diagnostic report workflow;
- development-only filesystem boundary;
- report privacy;
- report-file browser loading vs future Tauri vault access;
- compatibility probes are non-canonical;
- what the real-vault validation taught us at the level appropriate for a public repo.

Do **not** commit private Icarus findings into architecture docs.

The repository docs may say generically:

> Real-vault validation was completed and regressions were reduced to synthetic fixtures.

Detailed private findings belong in the task final report.

---

# Validation commands

Run repository standard checks plus focused KG5 checks.

Expected equivalents:

```bash
pnpm install --frozen-lockfile

# focused packages/tools
pnpm --filter <diagnostics-package> typecheck
pnpm --filter <vault-diagnostics-tool> typecheck
pnpm exec vitest run <KG5 areas>

# repository
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
git diff --check
```

Run the local vault diagnostic command against:

1. a synthetic temp/fixture vault;
2. the real local Icarus vault.

Run the opt-in synthetic pipeline benchmark at least once locally and record its workload configuration/results in the final report. Do not establish CI timing thresholds.

Start the web application and load:

1. the bundled synthetic report;
2. the ignored real Icarus report locally.

Verify:

- no network/backend dependency;
- no private report is tracked by git;
- `git status` stays clean except intended source changes before commit;
- real report remains ignored after generation.

If browser automation is available, validate the main diagnostic workflow with it.

Then follow the repository PR/merge/post-merge-CI/branch-cleanup workflow.

---

# Exit gate

KG5 is complete only when:

1. A local development command can scan a selected vault without product-layer filesystem coupling.
2. Markdown files are parsed with KG3 and resolved with KG4.
3. A valid canonical snapshot is produced or fatal failure is explicit.
4. Real reports are written only to ignored local paths.
5. The report contains no full source text.
6. The report boundary is runtime validated.
7. Compatibility probes remain separate from canonical resolution.
8. Case-only file/heading clues can be surfaced without changing resolver truth.
9. Non-Markdown attachment inventory can distinguish “present but unmodeled” from obvious missing/ambiguous cases without creating canonical attachment entities.
10. The React app can load a report JSON locally.
11. A synthetic report is available without private data.
12. The UI shows canonical hierarchy.
13. The UI shows references and readable source/target/candidate labels.
14. The UI filters explicit resolution states.
15. The UI shows adapter/resolver diagnostics.
16. The UI shows compatibility probes as non-canonical evidence.
17. The UI supports basic local search.
18. No graph renderer/state/persistence architecture has been introduced.
19. The actual Icarus vault has been run through the pipeline.
20. The current core theory areas can be inspected through the diagnostic UI.
21. KG4's known uncertainty categories have been reviewed against real data.
22. Clear parser/resolver bugs discovered in the real vault have synthetic regression tests.
23. Major policy questions, if discovered, were surfaced instead of silently changed.
24. No real Icarus content/report is committed.
25. A deterministic synthetic pipeline benchmark harness exists and has been run locally.
26. Real-vault scale counts and non-gating phase timings have been collected.
27. KG5 confirms the canonical model retains enough hierarchy/endpoints for KG6 endpoint roll-up without changing canonical truth.
28. Architecture/roadmap docs are reconciled, including the accepted future projection/interaction requirements from plugin research.
29. Repository tests/build/checks pass.
30. PR CI and post-merge main CI pass.
31. Branches are cleaned up and working tree is clean.

If real-vault access is unavailable, item 19 cannot pass and KG5 must not be reported complete.

---

# Final report

Report the following.

## 1. Summary

What KG5 added and how the local diagnostic workflow works.

## 2. Architecture

Explain:

```text
filesystem dev runner
→ KG3
→ KG4
→ diagnostic report
→ web explorer
```

and confirm filesystem APIs remain outside domain/product packages.

## 3. Diagnostic report

Explain:

- report schema;
- runtime validation;
- snapshot;
- diagnostics;
- probes;
- inventory metadata;
- privacy rules.

## 4. Development runner

Document:

- command;
- file discovery;
- default/configured excludes;
- report location;
- failure behavior.

## 5. Diagnostic UI

Describe:

- report loading;
- summary;
- hierarchy;
- references;
- filters/search;
- diagnostics;
- probes.

## 6. Real Icarus validation

Provide aggregate counts only unless a specific private example is necessary.

Report:

- Markdown documents processed;
- references by resolution state;
- diagnostic counts;
- compatibility-probe counts;
- attachment probe summary.

Do not paste note content.

## 7. Real-vault findings

Classify findings as:

```text
expected/broken source
unsupported but acceptable
fixed correctness bug
major policy question
```

For every correctness bug fixed, identify the synthetic regression fixture rather than copying the private source.

## 8. Resolver changes

If KG3/KG4 behavior changed because of real evidence, explain exactly why.

If nothing changed, state that.

## 9. Dependencies / skills

List dependencies added.

Confirm no graph/Tauri/persistence dependency was introduced.

Confirm whether any new committed skill was added. The expected answer is normally no.

## 10. Files changed

Important new/modified areas only.

## 11. Validation

List every command actually run, including:

- focused tests;
- repo `pnpm check`;
- synthetic diagnostic run;
- real Icarus diagnostic run;
- browser/manual QA;
- PR CI;
- post-merge CI.

## 12. Privacy check

Confirm:

- real report path is gitignored;
- no real source text/fixture was committed;
- repository search/diff inspection found no leaked Icarus content.

## 13. Performance evidence

Report:

- synthetic benchmark workload(s);
- parse/adapt timing;
- resolution timing;
- report construction timing;
- real-vault scale counts;
- real-vault coarse phase timings.

These are diagnostic measurements, not performance guarantees.

## 14. Documentation reconciliation

State what earlier architecture wording changed after real-vault evidence and confirm the accepted future roadmap refinements were recorded:

- KG6 roll-up / aggregation / focus / filter projection requirements;
- KG7 fold/focus/ghost-state interaction requirements;
- KG8 provenance-first inspector requirements;
- KG9 saved view-state direction;
- KG12 benchmark/worker discipline;
- KG13 benchmark-gated renderer decision.

## 15. Major unresolved questions

If real evidence exposed a design choice that should stop KG6, state it prominently.

If none exist, say KG6 can proceed.

## 16. KG6 handoff

State what KG6 can now safely assume about:

- canonical hierarchy;
- reference ownership;
- resolution states;
- candidate ambiguity;
- marker-backed blocks;
- representative real-vault scale;
- important compatibility limits.

Do not implement KG6 automatically.
