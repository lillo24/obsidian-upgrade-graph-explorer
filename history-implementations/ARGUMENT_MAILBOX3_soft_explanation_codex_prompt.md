# ARGUMENT-MAILBOX3 — Human-readable Soft Explanation for proposals

**Task type:** Proposal schema extension + Mailbox UX improvement + MCP contract + migration/tests

## Goal / success outcome

Add an optional **Soft Explanation** field to Argument Compiler Mailbox Proposals.

The formal Proposal structure remains the machine-/reasoning-useful layer:

- Topic
- intent / target
- examples
- typed premises/dependencies
- reasoning / reasoning steps
- conclusion
- boundary
- source observations
- consultation/provenance

But a human reviewer should also get one **free-form Markdown explanation** whose only purpose is:

> “Explain intuitively what this proposal means, why it exists, and what it is / is not claiming.”

This should be the fastest entry point for review.

The desired review experience is:

```text
Topic + local Argument context
↓
Proposal title / intent / target
↓
WHAT THIS MEANS
[rendered Soft Explanation Markdown]
↓
Formal argument
  Examples
  Premises / dependencies
  Reasoning
  Conclusion
  Boundary
↓
Source observations / provenance
↓
Technical metadata
```

A reviewer should be able to understand the proposal from the Soft Explanation alone, then inspect the formal structure only when needed.

## Current repository evidence

Inspect latest `main` before editing. At prompt creation time the relevant baseline is merge commit:

`1e3537522282fe5ab9ad34c4799a98fadc733d73`
(PR #129 — Proposal Mailbox schema redesign)

Read at minimum:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `packages/argument-workspace/README.md`
- `packages/argument-workspace/src/types.ts`
- `packages/argument-workspace/src/proposals.ts`
- `packages/argument-workspace/src/validation.ts`
- schema migration / serialization code in `packages/argument-workspace`
- `packages/argument-workspace/src/proposals.test.ts`
- `packages/argument-mcp-server/src/server.ts`
- `packages/argument-mcp-server/src/server.test.ts`
- `apps/web/src/features/arguments/ProposalMailbox.tsx`
- `apps/web/src/features/arguments/ArgumentsWorkspace.tsx`
- `apps/web/src/features/arguments/ArgumentsWorkspace.test.tsx`
- `apps/web/src/features/arguments/arguments.css`
- `apps/web/src/features/ai-review/MarkdownRenderer.tsx`
- `apps/web/src/features/ai-review/markdown-security.ts`
- relevant Markdown renderer tests/docs

Current important facts:

- Argument Library is now schema **v6**.
- Proposal v6 already distinguishes:
  - `intent`
  - typed `premises`
  - `reasoning`
  - structured `reasoningSteps`
  - `sourceObservations`
  - `conclusion`
  - `boundary`
  - consultation metadata
- `ProposalMailbox.tsx` now presents the formal structure much more clearly.
- There is already a safe Markdown renderer in the web app:
  - `apps/web/src/features/ai-review/MarkdownRenderer.tsx`
  - uses `react-markdown`, GFM, math/KaTeX;
  - skips raw HTML;
  - blocks unsafe URLs/images;
  - has rendering-error fallback.
- Do **not** duplicate Markdown security logic if a clean shared boundary can be extracted/reused.
- A Proposal remains non-canonical until explicit human resolution.

## Why this feature is needed

The formal Proposal can still be cognitively expensive even when structurally correct.

Example Proposal:

> **A shared Symbolic Matching layer does not establish how a plan is formed**

Its formal representation contains A2 dependencies, source observations, premises, reasoning, conclusion and boundary.

A reviewer understood it much faster when it was explained informally as:

```md
### What this is arguing

A2 says:

> Different underlying processes can end in the same Symbolic Matching layer.

For example:

Feeling Value retrieval → Symbolic Matching → Yes  
Current-state check → Symbolic Matching → Yes

The newer idea in `Associated Value.md` goes further:

> Maybe Goal-Planning itself is made from repeated Retrieval / Parsing / Symbolic Matching.

This proposal does **not** reject that possibility.

It only points out that evidence of Symbolic Matching when **retrieving or checking an already-made plan** does not tell us how the original plan was formed.

Example:

1. I decide which road to take using my goal and expected consequences.
2. Later, “Which road are you taking?” retrieves that plan.
3. “Are you taking Road A?” verifies it.

Seeing Symbolic Matching in steps 2–3 does not establish that Symbolic Matching produced step 1.

So the proposal is:

> Keep plan formation distinct from retrieval / verification until the mechanism generating the plan is explained separately.
```

This is the intended role of the new field.

## Core data-model requirement

Add an optional field with semantics equivalent to:

```ts
softExplanationMarkdown?: string
```

Exact name is flexible, but prefer something explicit and durable such as `softExplanationMarkdown`.

### Semantics

This field is:

- free-form Markdown;
- human-oriented;
- non-canonical;
- optional;
- part of the Proposal and preserved in Mailbox History;
- allowed to restate/translate the formal argument for readability;
- allowed to use headings, bullets, blockquotes, emphasis, inline code, fenced code, and simple tables if supported by the safe renderer.

This field is **not**:

- a formal premise;
- a reasoning dependency;
- a source observation;
- a conclusion;
- a canonical Argument field;
- a determinant of `attack`, `support`, `refine`, `supersede`, etc.;
- automatically parsed back into formal Proposal structure;
- automatically copied into a canonical Argument on acceptance.

The formal structure remains authoritative for machine-readable argumentative relationships.

The Soft Explanation is a **human-readable projection / explanation**, not hidden logic.

## Schema / migration

Because Proposal shape is persisted and v6 is already explicit, follow the repository's versioning convention.

Likely implementation: schema **v7**, with deterministic v6 → v7 migration.

Requirements:

- v1–v6 libraries must continue loading through existing migrations;
- existing v6 Proposals migrate with `softExplanationMarkdown` absent/undefined;
- no fake explanation should be generated during migration;
- pending legacy Proposals remain reviewable/resolvable;
- serialization/fingerprinting/idempotence remain deterministic;
- validation should enforce the existing Proposal text limits or a similarly bounded limit;
- whitespace-only Soft Explanations should either normalize to absent or fail consistently with existing optional-text conventions—choose the repo-consistent behavior;
- no automatic derivation from `reasoning`, `conclusion`, or `whyNovelOrUnresolved`.

If current repository conventions allow adding an optional persisted field without a schema bump, verify that carefully before choosing it. Do not silently violate the versioned-schema policy.

## MCP / Compiler submission contract

Extend `compiler_submit_proposal` so future AI reviews can submit the optional Soft Explanation directly.

The tool description should make its role clear:

> A concise/intuitive Markdown explanation for human review. It may summarize the proposal in ordinary language, but it is not a formal premise, reasoning dependency, or source record.

Update:

- MCP input schema;
- submission normalization;
- validation;
- tests;
- Compiler usage guide if appropriate.

### Guidance for future proposal generation

When a meaningful proposal survives the Argument Compiler cross-check, the AI should usually populate `softExplanationMarkdown` when the formal argument is not immediately obvious.

Good Soft Explanation content should answer, as applicable:

1. What did the current Argument/theory already say?
2. What newer claim or extension is being considered?
3. What problem/counterexample/distinction does this Proposal notice?
4. What exactly is the Proposal claiming?
5. What is it **not** claiming?

Do not force these as fixed headings. The field is intentionally soft.

Avoid:
- restating every metadata field;
- dumping IDs and revisions;
- reproducing the formal Premises verbatim;
- pretending uncertain claims are settled;
- adding reasoning that is absent from the formal Proposal.

If the Soft Explanation materially says something that the formal Proposal does not support, that is a proposal-authoring quality problem; the UI should not silently reconcile the two.

## Mailbox UI

In `ProposalMailbox`, render the Soft Explanation **prominently before the detailed formal argument**.

Suggested layout:

```text
[status / intent badges]
Topic
Proposal title
Target / relation summary
submission metadata

Local Argument context

┌─────────────────────────────────────┐
│ What this means                     │
│                                     │
│ [rendered Markdown explanation]     │
└─────────────────────────────────────┘

Formal argument
  Examples
  Premises / dependencies
  Reasoning
  Conclusion
  Boundary

Source observations / provenance

Why novel / unresolved

Consulted records and technical metadata
```

### Progressive disclosure

The user wants the Soft Explanation to be the fast reading path.

Consider:

- Soft Explanation open by default and visually prominent.
- Formal detail may remain visible as today, or be grouped under a clear `Formal argument` section/details container if that improves readability.
- Do not hide the Conclusion so deeply that review becomes harder.
- Technical metadata should remain secondary/collapsible as it currently is.

Do not redesign the whole Mailbox again; this is a focused readability improvement on top of PR #129.

## Markdown rendering

The user explicitly wants **rendered Markdown, not raw `.md` text**.

Requirements:

- no raw HTML execution;
- no unsafe scriptable links;
- no uncontrolled remote image rendering;
- preserve the safe external-link behavior already used by AI Review;
- rendering failure must degrade visibly/safely rather than crashing the Mailbox.

There is already `apps/web/src/features/ai-review/MarkdownRenderer.tsx`.

Do not make the Arguments feature import deeply from another feature merely because the component happens to live there if that violates feature ownership.

Prefer one of:

1. extract the existing safe Markdown renderer/security policy into a small shared web UI boundary and update AI Review + Proposal Mailbox to consume it; or
2. if repository architecture provides another cleaner shared location/pattern, use that.

Do not introduce a second independent Markdown security implementation unless there is a strong architectural reason.

Preserve existing AI Review rendering behavior while extracting/reusing it.

## Acceptance / rejection behavior

Soft Explanation must remain attached to the Proposal record/history.

On **Accept / Integrate**:

- do not turn it into a canonical premise;
- do not append it to canonical reasoning automatically;
- do not append it to source references;
- do not use it to choose canonical attack/support/supersession;
- keep the existing explicit human resolution workflow.

On **Reject / Record response**:

- keep it as Proposal history;
- do not silently use it as the canonical Counter-Argument observation/challenged claim unless the human explicitly copies/edits it.

No canonical mutation should occur merely because the Soft Explanation exists.

## Existing Proposal example to support

The following should render cleanly in the Mailbox:

```md
### What this is arguing

A2 says:

> Different underlying processes can end in the same Symbolic Matching layer.

For example:

```text
Feeling Value retrieval → Symbolic Matching → Yes
Current-state check     → Symbolic Matching → Yes
```

The newer idea in `Associated Value.md` goes further:

> Maybe Goal-Planning itself is made from repeated Retrieval / Parsing / Symbolic Matching.

This proposal does **not** reject that possibility.

It only points out that evidence of Symbolic Matching when **retrieving or checking an already-made plan** does not tell us how the original plan was formed.

Example:

1. I decide which road to take using my goal and expected consequences.
2. Later, “Which road are you taking?” retrieves that plan.
3. “Are you taking Road A?” verifies it.

Seeing Symbolic Matching in steps 2–3 does not establish that Symbolic Matching produced step 1.

So the proposal is:

> Keep plan formation distinct from retrieval / verification until the mechanism generating the plan is explained separately.
```

Ensure nested/fenced Markdown in fixtures is represented correctly in TypeScript strings.

## Existing pending proposals

Do not retroactively invent Soft Explanations for the current 5 pending Proposals as part of migration.

The feature should support:

```text
old Proposal
→ no Soft Explanation section

new Proposal with field
→ show “What this means”
```

If later we want to regenerate explanations for old proposals, that is a separate content operation, not a migration responsibility.

## Likely implementation areas

Probably:

- `packages/argument-workspace/src/types.ts`
- `packages/argument-workspace/src/proposals.ts`
- `packages/argument-workspace/src/validation.ts`
- schema migration / serialization tests
- `packages/argument-workspace/src/proposals.test.ts`
- `packages/argument-mcp-server/src/server.ts`
- `packages/argument-mcp-server/src/server.test.ts`
- `docs/ARGUMENT_COMPILER_AI_USAGE.md`
- `packages/argument-workspace/README.md`
- `docs/ARCHITECTURE.md`
- `apps/web/src/features/arguments/ProposalMailbox.tsx`
- `apps/web/src/features/arguments/ArgumentsWorkspace.test.tsx`
- `apps/web/src/features/arguments/arguments.css`
- existing safe Markdown renderer/security code and tests, if extracted to a shared boundary

These are starting points, not mandatory file placements. Inspect current ownership before editing.

## Scope / non-scope

### In scope

- optional persisted Soft Explanation Markdown field;
- schema migration/versioning needed for it;
- MCP submission support;
- safe rendered Markdown in the Proposal Mailbox;
- readability/layout around the new section;
- tests/docs;
- clean sharing/extraction of existing Markdown rendering infrastructure if needed.

### Out of scope

- rewriting current canonical Arguments;
- auto-generating Soft Explanations for old proposals;
- changing proposal intent semantics from PR #129;
- changing the Argument chain design;
- changing canonical Argument schema unless strictly required;
- parsing Markdown back into premises/reasoning;
- making Soft Explanation authoritative;
- adding AI generation inside the UI;
- broad redesign of AI Review.

## Validation

Follow `AGENTS.md` and inspect package scripts.

Add focused tests for at least:

1. Proposal submission with `softExplanationMarkdown`.
2. Submission without it.
3. exact retry/idempotence includes the field in proposal fingerprint/content identity.
4. changed Soft Explanation under same retry key is treated consistently as changed content.
5. schema migration from v6 preserves existing proposals with no fabricated explanation.
6. serialize → parse round trip.
7. Mailbox renders the Soft Explanation before formal details.
8. Markdown headings, emphasis, blockquote, list and fenced code render as formatted DOM rather than raw markers.
9. raw HTML remains inert/skipped.
10. unsafe URLs/images remain blocked under the shared Markdown security policy.
11. a Proposal without Soft Explanation does not show an empty section.
12. Accepting a Proposal does **not** copy Soft Explanation into canonical premises/reasoning/source references.
13. Rejecting a Proposal preserves it in Proposal history without implicitly converting the Soft Explanation into canonical Counter-Argument fields.
14. AI Review Markdown rendering remains unchanged if its renderer is refactored/shared.

Run the smallest complete relevant set, likely including:

- argument-workspace tests;
- argument-mcp-server tests;
- Argument Workspace UI tests;
- Markdown renderer/security tests if touched;
- typecheck;
- lint/format for changed areas;
- web build.

## Documentation

Update the nearest source of truth to state:

> `softExplanationMarkdown` is optional non-canonical human-review prose. It is rendered safely in the Mailbox and never automatically becomes a premise, reasoning dependency, source reference, relation, or canonical Argument content.

If schema changes to v7, document the v6 → v7 migration.

Update the Compiler AI usage guide so future cross-check submissions use this field appropriately.

## External context

No external file/context is required for this implementation beyond the repository.

The example above is included directly in this prompt. If Codex cannot find the expected PR #129/schema-v6 implementation on its branch, stop and report rather than rebuilding against an older architecture.

## Final report

After implementation, report:

1. how the Soft Explanation is represented;
2. schema version/migration decision;
3. MCP contract change;
4. where safe Markdown rendering now lives and whether it was shared/extracted;
5. exact Mailbox placement/behavior;
6. proof that acceptance/rejection does not make Soft Explanation canonical;
7. tests/checks run and results;
8. files changed;
9. branch, commit, PR URL, merge status and cleanup status per `AGENTS.md`;
10. any remaining design question or follow-up.
