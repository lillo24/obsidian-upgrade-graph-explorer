# ARGUMENT-MAILBOX2 — Proposal schema + Mailbox review redesign

**Task type:** schema evolution + UI/UX refactor + proposal-resolution behavior + tests/docs

## Goal / success outcome

Redesign the Argument Compiler Proposal Mailbox so a human reviewer can understand a proposal without remembering opaque IDs or mentally reconstructing the Argument graph.

The current Mailbox exposes low-level storage fields such as `premiseHints` and a coarse `target`, which makes proposals hard to review. It also conflates several different things:

- actual argumentative premises;
- references to existing Arguments/Axioms;
- source/repository observations used while forming the proposal;
- the proposal's relation to an existing Argument;
- the reasoning that combines those inputs.

The new design should make the argumentative structure explicit in both the persisted Proposal model and the Mailbox UI.

Success means that, for a proposal like:

> “A shared Symbolic Matching layer does not establish how a plan is formed”

the reviewer can immediately see:

1. **Topic**: `Symbolic Matching and Binary Answers`;
2. **relationship/intention**: e.g. `Add boundary to` / `Refine` A2, rather than an implicit or automatic `Attack`;
3. **target Argument**, by human-readable title, with the targeted part and an expandable preview of the Argument;
4. **Argument chain / local context** around the target, with Current clearly marked and clickable/expandable records;
5. **Premises** as typed items, not undifferentiated strings;
6. **Reasoning** that can reference premises/reasoning steps when useful;
7. **Source observations/provenance** separately from premises, including repository/file/commit information rendered compactly and navigably;
8. **Conclusion** and **Boundary**;
9. the existing human accept/reject flow still remains the only route to canonical mutation.

Do not make the AI Proposal canonical automatically.

## Current evidence from the repository

Inspect current `main` before editing and treat it as source of truth.

Read at minimum:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `packages/argument-workspace/README.md`
- `packages/argument-workspace/src/types.ts`
- `packages/argument-workspace/src/proposals.ts`
- `packages/argument-workspace/src/validation.ts`
- proposal/schema migration code in `packages/argument-workspace`
- `packages/argument-mcp-server/src/server.ts`
- `packages/argument-mcp-server/src/server.test.ts`
- `apps/web/src/features/arguments/ArgumentsWorkspace.tsx`
- `apps/web/src/features/arguments/ArgumentRecordView.tsx`
- `apps/web/src/features/arguments/ArgumentRecordEditor.tsx`
- `apps/web/src/features/arguments/ArgumentsWorkspace.test.tsx`
- `apps/web/src/features/arguments/arguments.css`

Relevant current behavior observed before writing this prompt:

- The durable Argument Library is currently schema v5.
- `ArgumentProposal` currently stores roughly:
  - `topicId?`
  - `target?`
  - `examples[]`
  - `premiseHints[]`
  - `suggestedAxiomIds[]`
  - `reasoning?`
  - `conclusion`
  - `boundary?`
  - `whyNovelOrUnresolved`
  - consultation/snapshot metadata.
- `ArgumentPremise` already has useful typed canonical forms:
  - free text;
  - Axiom reference;
  - Argument conclusion reference;
  - Argument premise reference.
- The Mailbox currently renders proposal fields more or less directly, including a `Premise hints` section.
- During acceptance, `proposal.premiseHints` are currently converted directly into canonical text premises.
- A proposal with an explicit target is currently initialized as an `attack` relation to that target; targeting the Current Argument can also make it a likely supersession/promotion case.
- This is too coarse for proposals whose intended relationship is **refinement / extension / adding a boundary**, rather than attacking or replacing the target.
- The Mailbox can already navigate records, detect stale targets, reuse canonical editors for final human resolution, and preserve pending/history provenance. Preserve those strengths.
- Existing tests verify that accepting/rejecting a Proposal does not mutate canon until the human resolution is saved.

The concrete confusing Proposal that motivated this change looked like:

```text
Topic: Symbolic Matching and Binary Answers

Proposal:
A shared Symbolic Matching layer does not establish how a plan is formed

Current canonical Argument involved:
ARG-BREAD-DRINKING-A2
“Symbolic Matching unifies the two Yes/No cases”

The Proposal was intended as:
A2 may remain valid, but its scope should not by itself establish
how the original plan/decision was generated.
```

The existing UI instead showed only the Topic as target and then buried references such as:

```text
ARG-BREAD-DRINKING-A2 revision 1 defines Symbolic Matching...
```

inside `Premise hints`, alongside a repository observation such as:

```text
The reviewed Associated Value.md at repository commit <sha> proposes...
```

Those two lines play different roles and should not be rendered as the same kind of premise.

## Core design requirement: distinguish argumentative roles

Do not merely restyle `premiseHints`.

Evolve the Proposal model so it can structurally distinguish at least these concepts.

### A. Proposal relationship / intent

A Proposal should be able to say how it relates to an existing Argument without immediately forcing a canonical `attack`.

Support a review-level proposal relation/intent along the lines of:

```text
new / independent
attack
support
refine
extend
add-boundary
supersede
```

Exact names are flexible after inspecting the domain model.

Important:

- This is a **Proposal/review semantic**, not automatically a new canonical `ArgumentRelationKind`.
- Do not expand canonical relation kinds unless repo evidence shows that is the cleaner architecture.
- `refine`, `extend`, and `add-boundary` should not silently become `attack`.
- On human acceptance, the reviewer must still choose/confirm the final canonical relationship(s), supersession, and Current promotion where applicable.
- A Proposal intent may seed sensible defaults in the resolution editor, but must not make canonical decisions automatically.

### B. Typed Proposal premises/dependencies

Replace or evolve the flat `premiseHints: string[]` bucket.

Proposal inputs should be able to represent at least:

1. **Text premise / claim**
2. **Existing Axiom reference**
3. **Existing Argument conclusion reference**
4. **Existing Argument premise reference**

Prefer reuse/alignment with the canonical `ArgumentPremise` concepts where appropriate, while keeping Proposals non-canonical and revision-pinned.

When a Proposal says:

> A2 defines Symbolic Matching as a final symbolic layer...

that should be representable as a linked dependency on A2 (or a specific premise/conclusion), not as anonymous prose if a canonical reference exists.

### C. Source observation / provenance

A repository/source observation is evidence/provenance used while drafting a Proposal, not automatically an inference premise.

Represent this separately.

It should support enough structured metadata to display something like:

```text
Source observation
Associated Value.md @ 36c927f
“Goal-Planning is currently proposed as ...”
```

Useful fields may include:

- short label;
- repository / URL;
- commit SHA or source version;
- file path;
- optional heading/span;
- observation text / extracted claim.

Do not overfit to GitHub if the existing source-reference abstractions can be reused cleanly. The key invariant is that **source provenance is not silently converted into a canonical premise**.

For Git commit provenance in the UI:

- display a short SHA;
- provide a clickable link when a safe URL is available;
- expose the full SHA via title/tooltip or equivalent;
- provide an easy copy affordance if consistent with existing UI patterns;
- do not display a 40-character SHA inline when a short label suffices.

### D. Structured reasoning, but do not over-engineer it

The reviewer asked for reasoning to be splittable by premise when useful.

Support a modest structure such as ordered reasoning steps that can reference:

- premise IDs;
- earlier reasoning-step IDs.

Example:

```text
P1  [Argument reference] A2 states ...
P2  [Claim] Producing a plan differs from retrieving an existing plan.

R1 uses P1 + P2:
A shared final symbolic operation does not establish that it generated
the representation being reported.

Conclusion:
A2 should remain valid, but its scope should not by itself include plan formation.
```

However:

- simple Proposals should still be allowed to use one ordinary reasoning paragraph;
- do not require every Proposal to become a formal proof DAG;
- prefer a small, readable representation that can grow later.

## Mailbox UI redesign

The Mailbox should read as an **argument review interface**, not a JSON/schema viewer.

### Proposal header

At the top of the selected Proposal show:

- status;
- Topic title;
- Proposal title;
- relationship/intention to target;
- target Argument title and targeted part, if any;
- staleness warnings;
- compact provenance/consultation information.

Do not make opaque IDs the primary labels.

IDs/revisions remain available as secondary metadata.

### Topic / local Argument chain

Show the Topic prominently above or beside the Proposal.

Provide a compact local scheme of the relevant canonical Argument chain/context, for example:

```text
A1 ──refined/superseded by──> A2 [CURRENT]
                               ↑
                               │
                         Proposal
                         ADD BOUNDARY
```

This does not need a graph library.

Prefer a lightweight accessible DOM representation using the existing Argument data:

- Argument cards/nodes;
- arrows/relationship labels;
- Current badge;
- Proposal marker;
- clickable/expandable Arguments.

At minimum include:

- the target Argument;
- Current Argument when different;
- directly relevant predecessor/supersession/attack/support neighbors where available.

Do not attempt to render the entire library graph inside the Mailbox.

### Expandable target/dependencies

When an Argument/Axiom is referenced:

- show human-readable title;
- show the relevant targeted part or referenced premise/conclusion;
- allow expansion to inspect enough of the canonical record to understand it;
- provide an `Open record` action using the existing navigation behavior.

The user should never need to remember what `ARG-BREAD-DRINKING-A2` means.

### Proposal body

Render sections by argumentative role:

```text
Examples
Premises / dependencies
Reasoning
Conclusion
Boundary
Source observations / provenance
Why novel / unresolved
Consulted records
```

Only show sections that contain data.

Within Premises, visually distinguish:

- claim/text;
- Axiom dependency;
- Argument conclusion dependency;
- Argument premise dependency.

Within Source observations, keep repo/file/commit provenance out of premise styling.

### Human resolution

Preserve the current explicit human resolution step.

When the user clicks Accept / Integrate:

- construct a draft from the richer Proposal structure;
- carry over actual typed premises as typed canonical premises where valid;
- do **not** convert source observations into premises;
- seed the final relationship choice from proposal intent, but let the human confirm/change:
  - attack/support where canonical;
  - supersession;
  - Current promotion;
- preserve stale revision checks.

If proposal intent cannot map cleanly to canonical relations, surface that clearly in the resolution UI rather than inventing an attack.

## Data migration / compatibility

Because Proposals are durable and current schema is v5, inspect the existing versioning/migration conventions before choosing the exact implementation.

Likely options:

- schema v6 with v5 → v6 migration; or
- a strictly backward-compatible optional extension if the repository's schema/version policy genuinely permits that.

Prefer the repository's established convention.

Requirements:

- existing v1–v5 libraries must still load through migration;
- existing pending v5 Proposals must remain reviewable;
- legacy `premiseHints` should migrate deterministically, most conservatively as text-premise candidates unless there is explicit structured information;
- do not infer Argument/Axiom references from arbitrary legacy prose;
- preserve proposal submission fingerprint/idempotence semantics;
- update canonical JSON/fingerprint behavior consistently;
- update Markdown/JSON export/import as needed;
- update any contract/schema version constants if the persisted shape changes.

## MCP submission contract

Update `packages/argument-mcp-server` and the proposal submission surface so an AI can submit the richer structure.

The tool should be able to submit:

- topic;
- proposal intent/relation;
- optional precise target;
- typed premise/dependency items;
- examples;
- simple reasoning and/or structured reasoning steps;
- conclusion;
- boundary;
- source observations/provenance;
- consultation records.

Keep the tool bounded and append-only.

It must still have **no canonical authoring or proposal-resolution authority**.

If backward compatibility for existing callers is useful, support the old `premiseHints` input only as a transitional/legacy path and normalize it immediately into the richer internal structure. Do not keep two permanent competing representations without a clear reason.

Update the Compiler usage guide/tool description where appropriate so future assistants know:

- use a target only when the proposal genuinely targets that Argument/part;
- choose `refine`/`add-boundary` etc. when appropriate rather than forcing `attack`;
- encode existing canonical dependencies structurally;
- keep source observations/provenance separate from premises.

## Likely implementation areas

Exact locations may change after inspection, but likely areas include:

- `packages/argument-workspace/src/types.ts`
- `packages/argument-workspace/src/proposals.ts`
- `packages/argument-workspace/src/validation.ts`
- argument-library migration / serialization / canonical fingerprint code
- `packages/argument-workspace/src/proposals.test.ts`
- other argument-workspace migration/validation tests
- `packages/argument-mcp-server/src/server.ts`
- `packages/argument-mcp-server/src/server.test.ts`
- `apps/web/src/features/arguments/ArgumentsWorkspace.tsx`
- possibly extract the Mailbox into smaller components if that improves ownership/readability
- `apps/web/src/features/arguments/ArgumentsWorkspace.test.tsx`
- `apps/web/src/features/arguments/arguments.css`
- `packages/argument-workspace/README.md`
- `docs/ARCHITECTURE.md`
- other closest docs/contracts that describe the Proposal Mailbox or schema

Follow repository ownership boundaries. Do not move domain logic into React merely to make the UI easier.

## Scope

In scope:

- Proposal schema/model evolution needed to represent the review semantics clearly.
- Mailbox UI redesign.
- Human-readable target/dependency previews.
- Compact local Argument-chain/context visualization.
- Structured source/commit provenance rendering.
- Correct acceptance mapping from Proposal data into human-reviewed canonical drafts.
- MCP submission contract changes.
- Migration, validation, tests, docs.

Out of scope unless required by the above:

- redesigning the normal canonical Argument editor;
- redesigning the main graph explorer;
- changing theory content;
- automatically accepting AI proposals;
- adding remote/network persistence;
- changing the canonical meaning of Current;
- adding a general-purpose graph-layout dependency just for the Mailbox;
- broad visual redesign outside the Argument Workspace.

## Important behavioral examples to test

### Example 1 — boundary/refinement proposal

Canonical:

```text
Topic: Symbolic Matching and Binary Answers

A1:
Different underlying processes can produce the same Yes/No form

A2 [CURRENT]:
Symbolic Matching unifies the two Yes/No cases
```

Proposal:

```text
Title:
A shared Symbolic Matching layer does not establish how a plan is formed

Intent:
Add boundary / refine A2

Target:
A2 reasoning or whole Argument

Premises:
P1 [Argument reference]:
A2 says Symbolic Matching is a final symbolic layer that can express
represented relations regardless of producer.

P2 [Text]:
Producing a plan, retrieving an already available plan, and
checking/reporting that plan are distinguishable tasks.

Source observation:
Associated Value.md @ commit 36c927f...
The current theory proposes Goal-Planning as repeated/double
Symbolic Matching or a stack of Retrieval/Parsing/Matching.

Reasoning:
A shared final symbolic layer in later reporting/checking tasks does
not establish that the same layer generated the original plan.

Conclusion:
A2 can remain valid while its scope is bounded away from a claim that
Symbolic Matching alone explains plan formation.
```

Expected UI:

- Topic visible at top.
- A2 visible by title and expandable.
- Local chain shows A1 → A2 [CURRENT] plus Proposal marker.
- `Add boundary / Refine` visible explicitly.
- P1 rendered as linked Argument dependency.
- P2 rendered as a text premise.
- source observation rendered separately with compact commit link.
- no `ARG-BREAD-DRINKING-A2` opaque reference without title/context.

Expected resolution:

- accepting does not automatically create an `attack`;
- the reviewer can choose the final canonical relation/supersession/current behavior.

### Example 2 — real attack

A Proposal explicitly attacks one premise of a canonical Argument.

Expected:

- target premise is rendered inline/expandable;
- default human-resolution relationship can sensibly start as Attack;
- stale target detection still works.

### Example 3 — legacy v5 Proposal

A pending Proposal containing only `premiseHints[]`.

Expected:

- library migrates cleanly;
- Mailbox shows those as legacy text premises/claims;
- no fake structured dependencies are inferred;
- acceptance remains possible.

### Example 4 — provenance only

A Proposal references a repository commit/file observation but that observation is not part of the logical premise chain.

Expected:

- it appears under Source observations / provenance;
- it is not converted into a canonical Argument premise on acceptance.

## UI/UX constraints

- Prefer progressive disclosure: compact by default, details expandable.
- Human-readable titles first; IDs/revisions secondary.
- Preserve keyboard accessibility and existing modal behavior.
- Reuse existing design tokens/classes where practical.
- No fixed colors outside the existing theme system.
- Keep long hashes/IDs from dominating layout.
- The Argument chain must remain understandable on narrow screens; a vertical fallback is acceptable.
- Do not require hover for critical information; hover/title may expose full SHA, but the short SHA and link/copy action must remain usable without hover.
- Avoid turning the Mailbox into another full graph explorer.

## Validation

Follow `AGENTS.md` and inspect package scripts before choosing commands.

At minimum, run the smallest complete set that covers every touched area, likely including:

- argument-workspace unit tests, especially proposal submission/resolution, validation, migration, fingerprint/idempotence;
- argument-mcp-server tests for the richer submission schema and legacy compatibility;
- Argument Workspace UI tests for Mailbox rendering and accept/reject flows;
- TypeScript/static analysis for touched packages;
- relevant web build/test checks;
- formatting/lint for changed files.

Add targeted tests for:

1. proposal intent does not automatically become Attack;
2. structured Argument/Axiom premise references survive submission → Mailbox → acceptance;
3. source observations do not become canonical premises;
4. legacy `premiseHints` migrate safely;
5. target title/part and local Argument context are visible;
6. expandable/open-record behavior works;
7. stale target/revision warnings still work;
8. short commit SHA + full/copy/link behavior;
9. human resolution remains the only canonical write;
10. proposal idempotence/submission fingerprint behavior remains deterministic.

If the persistent schema changes, test round-trip serialization and migrations from existing fixtures.

## Documentation

Update the closest sources of truth to explain:

- Proposal vs canonical Argument semantics;
- proposal intent/relation vs canonical attack/support/supersession;
- typed Proposal premises;
- source observations/provenance;
- human resolution mapping;
- any schema-version migration;
- updated MCP submission contract.

Do not duplicate large implementation detail across docs.

## Final report

After implementation:

1. summarize the new Proposal model and Mailbox UX;
2. list changed files/areas;
3. state the schema version/migration decision and backward compatibility;
4. state how Proposal intent maps into human resolution;
5. state how source observations are kept separate from premises;
6. list tests/checks actually run and their results;
7. identify anything skipped or still unresolved;
8. include branch, commit, PR URL, merge status, and cleanup status according to `AGENTS.md`.
