# KG0 — Repository & Architecture Foundation

**Task type:** repository bootstrap / architecture foundation / developer-experience setup

## Goal

Turn the currently almost-empty `lillo24/icarus-graph-explorer` repository into a clean, reproducible foundation for the Markdown Structure Graph Explorer.

This task is **not** to build the parser or the graph UI yet. Its job is to establish the engineering contracts that later implementation plans can safely build on without accidentally coupling the product to Obsidian, React Flow, Tauri, Graphology, or Icarus-specific theory content.

The repository should finish this task in a state where a future Codex run can clone it, read a small amount of repository-owned documentation, install dependencies, run the standard checks, and immediately understand:

- what the product is;
- what the core architectural boundaries are;
- what technology is intentionally chosen now;
- what technology is intentionally deferred;
- what commands define a healthy repository;
- where future parser/model/renderer code belongs;
- which decisions require evidence before they are changed.

## Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

At the time this prompt was prepared, the repository contains only a small `README.md`:

```md
# icarus-graph-explorer
Custom Graphical Interaface to explore more intuitively the Icarus Project
```

Treat the repository as essentially greenfield. Inspect the actual repository before changing anything in case it has changed since this prompt was generated.

The separate Icarus repository is the first intended real data source, but **do not couple this repository to the Icarus repo and do not require access to the Icarus vault for KG0**.

## External context

There is a longer Google Doc named:

**“Markdown Structure Graph Explorer — Reviewed Architecture & Roadmap”**

Codex should **not depend on being able to access that Google Doc**. The engineering constraints that matter for this task are included below.

One purpose of KG0 is to move the durable engineering guidance into this repository so future implementation work is self-contained.

If the Google Doc is somehow available, it may be used as supporting context, but it should not override this task without reporting the discrepancy.

---

# Product context

The product is a **hierarchical knowledge-graph explorer for Markdown workspaces**.

The first real use case is an Obsidian vault, but the application should eventually be useful independently from Obsidian.

Its distinctive capability is that a Markdown document is not necessarily an atomic graph node:

- files can be viewed as nodes;
- a file can be expanded into its heading hierarchy;
- links can be attributed to the exact heading/section they originate from;
- heading-targeted links can resolve to the exact target section;
- a later section-level graph can behave conceptually as if headings were separate files without physically fragmenting the Markdown source.

Example:

```text
Associated Value.md
  ├─ Feeling Value
  │    └─ references → Symbols.md / Symbolising Process
  └─ Abstract Value
       └─ references → Goal Planning.md
```

A collapsed file-level view may aggregate those relationships:

```text
Associated Value.md → Symbols.md
Associated Value.md → Goal Planning.md
```

The canonical data must retain the precise section-level information even when a renderer displays an aggregated file-level projection.

---

# Foundational architecture to preserve

These are the important constraints for KG0 and subsequent work.

## 1. Obsidian is an adapter, not the core model

The core product should understand generic concepts such as:

- document;
- section;
- optional addressable block;
- reference;
- source location/span;
- resolution state;
- workspace/source provider;
- knowledge snapshot/delta;
- visualization/view state.

Obsidian-specific concepts belong in an adapter layer later:

- `[[wikilinks]]`;
- heading links;
- aliases;
- embeds;
- Obsidian block references;
- Obsidian-specific frontmatter interpretation;
- Obsidian resolution behavior.

Do **not** create core types named things like `ObsidianFileNode` or `ObsidianWikilinkEdge`.

## 2. Hierarchical documents are the deliberate stable abstraction

Do not over-generalize the project into a universal arbitrary-data knowledge platform.

The intended general abstraction is:

```text
Document
  └─ Section
      └─ Section
          └─ optional addressable Block
```

with references between addressable entities.

This is general enough to support plain Markdown and future source adapters while still being shaped around the actual problem.

## 3. Source truth and view state are different domains

Source-derived knowledge will eventually include things like:

- documents;
- section hierarchy;
- source-backed metadata;
- references;
- source spans;
- resolution results.

Application-owned visualization state will eventually include things like:

- hidden;
- collapsed / expanded;
- pinned;
- manually positioned;
- selected;
- filters;
- viewport;
- saved views;
- renderer preferences.

Hiding or pinning something must never mutate the source knowledge model.

Early versions are read-only with respect to Markdown.

## 4. The canonical model is renderer-independent

React Flow must never own canonical truth.

Sigma.js must never own canonical truth.

Graphology must never own canonical truth.

A renderer receives a projection of plain, serializable domain data plus view state.

Graphology is likely to become a useful derived runtime index/algorithm backend later, especially if Sigma is used, but the persisted/canonical domain schema should stay library-independent.

## 5. Fail explicitly rather than guessing

Later parser/resolver work must be able to represent at least:

- resolved;
- unresolved;
- ambiguous;
- invalid.

The explorer is intended to inspect knowledge structure accurately, so silently selecting an arbitrary target is worse than admitting uncertainty.

## 6. Local-first and read-only by default

The selected Markdown workspace may contain private material.

The initial product architecture must require:

- no backend;
- no account;
- no cloud upload;
- no remote processing of the vault;
- no write-back into the vault.

Application-owned caches and view state may be stored locally.

Remote/cloud capabilities are future opt-in features, not KG0 assumptions.

## 7. Performance should come from boundaries and projections first

Do not prematurely optimize for millions of nodes or move code into Rust/WASM.

Important long-term strategies are:

- incremental parsing at file granularity;
- serializable snapshots/deltas;
- workers when measured work becomes expensive on the UI thread;
- renderer-specific view projections instead of rendering the entire canonical model literally;
- narrow React subscriptions;
- benchmark-driven renderer decisions.

KG0 should preserve the ability to implement these later. It does not need to implement them.

---

# Technology decisions for the foundation

Use these unless inspection reveals a concrete incompatibility. If a decision must change, document why rather than silently substituting another stack.

## Application language/framework

- TypeScript
- React
- Vite
- SPA architecture initially

Do **not** use Flutter for this repository.

Do **not** introduce Next.js or another server framework. The first product is local-first and graph-heavy; server rendering is not currently solving a required problem.

## Package/workspace management

Use `pnpm` workspaces.

Pin the package-manager version through the root `package.json` `packageManager` field and commit the lockfile.

Prefer Corepack when appropriate rather than requiring a global package manager installation.

Do not introduce Nx/Turborepo or another monorepo orchestrator in KG0.

## Testing

Use Vitest for unit/contract tests.

Playwright is expected later for end-to-end UI flows, but there is no need to add a full E2E suite in KG0 unless a minimal smoke test materially improves the foundation.

## Code quality

Set up a coherent TypeScript/lint/format workflow.

Choose a conventional, low-friction setup after inspecting current stable tooling. ESLint + formatting is acceptable; another well-supported equivalent is acceptable if it reduces complexity.

The repository must expose simple standard commands from the root, ideally along the lines of:

```bash
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm check
```

`pnpm check` should become the normal one-command local validation entry point.

Avoid scripts that merely duplicate each other without value.

## CI

Add a small GitHub Actions CI workflow that installs reproducibly and runs the important non-interactive checks.

Prefer official actions and least-privilege permissions.

If current immutable action SHAs can be resolved reliably, pin actions to immutable commits with a comment indicating the release version. If this would require guessing, use a current official stable action reference and report it instead of inventing a SHA.

No deployment workflow is required.

---

# Skills for Codex / coding agents

This repository is intended to be worked on heavily with Codex, so KG0 should establish repository-local agent guidance.

## Install now

If the environment supports the Agent Skills CLI, install these **repository-local/project-scoped** skills and commit the resulting project skill configuration/files if that is how the current CLI represents project skills:

### 1. Vercel React Best Practices

Source:

`vercel-labs/agent-skills`

Skill:

`vercel-react-best-practices`

Current public install form at prompt-writing time:

```bash
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
```

Why:

- React performance and architecture will matter in later graph views;
- the product will potentially render many interactive nodes;
- it gives Codex a consistent performance-review baseline.

This does **not** mean the app should use Next.js or be deployed on Vercel. Apply only rules relevant to a Vite/React client application.

### 2. Web Design Guidelines

Source:

`vercel-labs/agent-skills`

Skill:

`web-design-guidelines`

Current public install form at prompt-writing time:

```bash
npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines
```

Why:

- later graph controls, keyboard navigation, focus, hit-targets, error states and accessibility need consistent UI discipline;
- installing it now gives the repo a stable shared UI-review skill before visual work begins.

Before invoking these commands, inspect the current Skills CLI help and make sure the installation is project/repository scoped rather than unintentionally modifying only the agent user's global configuration.

If the CLI has changed, use its current supported project-scoped mechanism.

If network access or the Skills CLI is unavailable:

- do not block the rest of KG0;
- do not hand-copy partial skill content from memory;
- document exactly what prevented installation;
- leave a short `docs/AGENT_SKILLS.md` entry with the intended skills and current source repository so they can be installed later.

Skills are third-party/external development instructions. Inspect what the installer adds before committing it. Do not run arbitrary scripts beyond what the documented skill installation requires.

## Explicitly defer

Do **not** install these merely because they might be useful later:

- a Vercel deployment skill or Vercel project integration;
- Tauri skills;
- React Flow-specific skills;
- Sigma/Graphology skills;
- Playwright/browser-automation skills;
- backend/database/cloud skills.

Add them only when the implementation phase actually needs them.

In particular, a deployment-oriented Vercel integration is unnecessary now: the product is local-first and KG0 has no deployment requirement.

---

# Repository-owned Codex guidance

Create a short root `AGENTS.md`.

Do **not** turn it into a giant manual.

Treat it as a map into the repository's source-of-truth documentation.

It should communicate at least:

1. read `docs/ARCHITECTURE.md` before structural changes;
2. read `docs/ROADMAP.md` to understand what is deliberately deferred;
3. keep generic/core packages free of React, React Flow, Tauri and Obsidian-specific APIs;
4. preserve local-first/read-only assumptions unless a later task explicitly changes them;
5. do not add future technologies merely because they are mentioned in the roadmap;
6. use installed relevant skills when applicable;
7. run the repository validation commands before reporting completion;
8. when real/private Icarus vault content exposes a bug later, reduce it to a synthetic committed regression fixture rather than copying private content into public/generic fixtures.

If installed skills require additional local documentation, link to them rather than duplicating large skill manuals into `AGENTS.md`.

---

# Repository documentation to create

## `docs/ARCHITECTURE.md`

Create a concise but substantive architecture document that becomes the engineering source of truth.

It should capture the reviewed decisions above, including:

- product purpose;
- the file → section → optional block hierarchy;
- Obsidian as an adapter;
- canonical model independent from renderers/libraries;
- source truth vs view state;
- local-first/read-only default;
- explicit ambiguity/error handling;
- intended runtime dependency direction;
- deferred React Flow / Graphology / Tauri / Sigma roles;
- performance principles;
- privacy boundary;
- testing philosophy.

Include a simple dependency-direction diagram, for example conceptually:

```text
SourceProvider
  → workspace/parser/adapter/resolver
  → canonical snapshot / deltas
  → derived indexes
  → view projection
  → renderer
  → UI

ViewStateStore
  → view projection / UI
```

The exact names may evolve in KG1+, so state the dependency direction more strongly than speculative class names.

Keep the document useful to an engineer. Avoid turning it into marketing prose.

## `docs/ROADMAP.md`

Record the implementation-plan map so future tasks can see the sequencing:

- KG0 — Repository + architecture foundation
- KG1 — Canonical domain model + fixture infrastructure
- KG2 — Base Markdown structural parser
- KG3 — Obsidian syntax adapter
- KG4 — Workspace resolver + canonical snapshot
- KG5 — Diagnostic explorer + real-vault validation
- KG6 — View-projection architecture
- KG7 — Structural graph MVP
- KG8 — Inspector, backlinks, search + navigation
- KG9 — Persistence + stable identity
- KG10 — Incremental workspace engine
- KG11 — Tauri local-vault workflow
- KG12 — Performance + worker hardening
- KG13 — Global graph decision / renderer, benchmark-gated
- KG14 — Product-quality exploration

For each, a short outcome and dependency/gate is enough.

Clearly mark KG13 as conditional: Sigma should be introduced only if real benchmarks justify a separate high-density renderer.

## ADRs / decisions

Create lightweight architecture decision records under something like:

`docs/decisions/`

Only document expensive foundational choices, not every package selection.

At minimum capture:

- TypeScript/React/Vite + pnpm workspace rather than Flutter/Next.js;
- hierarchical-document domain independent from Obsidian/renderers;
- local-first, read-only, no backend as the initial trust boundary;
- React Flow first / Sigma benchmark-gated / Graphology derived rather than canonical;
- Tauri planned for a later local-vault milestone but prohibited from leaking into generic core packages.

You may combine closely related decisions if that produces clearer ADRs.

Use a simple status/context/decision/consequences format.

---

# Suggested initial repository shape

Do **not** create every future package from the long-term architecture as an empty placeholder.

A good KG0 shape is approximately:

```text
/
├─ AGENTS.md
├─ README.md
├─ package.json
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
├─ tsconfig...                 # as needed
├─ eslint/format config        # as chosen
├─ .editorconfig
├─ .gitignore
├─ .github/
│  └─ workflows/
│     └─ ci.yml
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ ROADMAP.md
│  ├─ AGENT_SKILLS.md          # if useful
│  └─ decisions/
│     └─ ...
├─ apps/
│  └─ web/
│     └─ ... minimal React/Vite app
├─ packages/
│  └─ core/
│     └─ ... framework-independent foundation only
└─ tests/
   └─ fixtures/
      └─ ... minimal fixture conventions/readme if useful
```

This is guidance, not a rigid requirement.

The important point is to create only boundaries that have a real purpose now.

`packages/core` may contain a minimal framework-independent shell/contracts area, but **do not implement the detailed KG1 canonical domain model in this task**. KG1 exists to design and test that model carefully.

The web app can import from `packages/core`; `packages/core` must not import from the web app.

---

# Dependency-boundary enforcement

Do not rely only on documentation.

Implement at least one lightweight mechanical safeguard against obvious forbidden imports in framework-independent core code.

For example, use lint configuration or another simple existing tool so code under `packages/core` cannot import:

- `react`;
- `react-dom`;
- `@xyflow/*` / React Flow;
- `@tauri-apps/*`;
- Sigma;
- Obsidian-specific application packages.

Do not add a large architecture-lint dependency merely for this if ESLint/config can express it cleanly.

The goal is to catch accidental boundary violations early.

---

# Minimal web application

Create a deliberately small Vite/React application proving the workspace is wired correctly.

It does not need a graph.

A simple page can show:

- product name;
- a short line such as “Hierarchical Markdown graph explorer”;
- a visible “Foundation ready” development status.

Keep it visually clean but do not spend significant time on branding.

The page should not imply that vault importing or graph exploration already works.

If the web-design skill is installed, use it only to prevent obvious accessibility/UI mistakes; do not turn KG0 into a visual-design exercise.

---

# README

Replace the current placeholder/typo with a useful repository README.

It should briefly state:

- what the project intends to become;
- that it is currently early-stage;
- that it is local-first/read-only with respect to Markdown;
- how to install;
- how to run;
- how to validate;
- where architecture and roadmap documentation live.

Do not claim features that KG0 does not implement.

---

# Scope

## In scope

- inspect the current greenfield repository;
- initialize pnpm workspace;
- scaffold React + TypeScript + Vite web app;
- create a minimal framework-independent core package/boundary;
- set up TypeScript;
- set up lint/format conventions;
- set up Vitest foundation;
- set up root scripts;
- set up basic CI;
- create architecture/roadmap/ADR documentation;
- create concise `AGENTS.md`;
- install the two approved repository-local agent skills when supported;
- add a lightweight dependency-boundary safeguard;
- improve README;
- ensure reproducible dependency installation;
- ensure all initial checks pass.

## Explicitly out of scope

Do not implement:

- Markdown parsing;
- mdast/unified parser integration;
- Obsidian wikilink extraction;
- link resolution;
- canonical KG1 domain model in detail;
- Graphology;
- React Flow;
- Sigma.js;
- GSAP;
- Tauri;
- browser folder picking;
- filesystem watching;
- IndexedDB/database persistence;
- stable heading reconciliation;
- Icarus-vault integration;
- source-file writes;
- cloud sync;
- accounts/backend;
- Vercel deployment;
- AI/semantic relationship extraction;
- elaborate UI/branding.

Do not add dependencies for these future phases unless a current KG0 requirement actually needs them.

Do not create placeholder packages for all future modules.

Do not add a license without an explicit product/licensing decision.

---

# Implementation approach

Use this sequence as guidance, but inspect the repository and adapt when a simpler/better implementation satisfies the same contracts.

1. **Inspect**
   - verify current repo contents and branch state;
   - check available Node/Corepack/pnpm tooling;
   - check for any existing agent instructions or repository policies;
   - inspect the current Agent Skills CLI before installing project skills.

2. **Bootstrap workspace**
   - create root package/workspace configuration;
   - scaffold `apps/web` using React + TypeScript + Vite;
   - add a minimal framework-independent core workspace package;
   - ensure workspace imports resolve through normal package boundaries rather than fragile path hacks.

3. **Establish quality tooling**
   - strict TypeScript settings suitable for a new codebase;
   - lint/format;
   - Vitest;
   - root validation scripts;
   - minimal boundary enforcement.

4. **Install approved agent skills**
   - project-scoped only;
   - inspect resulting files;
   - record them in agent documentation;
   - if unavailable, document the blocker and continue.

5. **Create repository knowledge base**
   - `AGENTS.md` as map;
   - architecture;
   - roadmap;
   - ADRs;
   - skill note if useful.

6. **Add minimal CI**
   - reproducible install;
   - run checks;
   - build.

7. **Polish README**
   - accurate current-state instructions.

8. **Validate clean clone behavior as far as the environment permits**
   - install from lockfile;
   - typecheck;
   - lint;
   - tests;
   - build;
   - inspect repository status.

---

# Quality constraints

## TypeScript

Prefer strict typing from the start.

Avoid:

- broad `any`;
- unsafe casts used only to silence the compiler;
- circular workspace dependencies;
- configuration duplicated independently in every package without reason.

Use shared configuration where it genuinely reduces drift.

## React

Keep application components simple in KG0.

Do not introduce a state library merely because Zustand is planned later. KG0 has no complex application state.

Do not introduce React Flow.

Do not create abstractions for hypothetical graph components.

## Packages

Every dependency added should have a current KG0 reason.

Prefer fewer dependencies.

Do not add a package because it appears in the long-term architecture.

## Documentation

Repository docs should distinguish:

- **current implemented state**;
- **architectural decision**;
- **planned future direction**.

Never describe future roadmap items as though they already exist.

## Privacy

No telemetry or analytics should be added.

Do not create example fixtures using private Icarus theory content.

If a Markdown fixture is useful for the test harness foundation, use tiny synthetic material.

---

# Validation

Run the appropriate commands from a clean repository state.

At minimum, the final implementation should demonstrate successful equivalents of:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check
```

If some commands are intentionally combined or named differently, explain the mapping.

Verify:

1. the web app builds;
2. the minimal tests pass;
3. core package code does not import React or deferred platform/renderer dependencies;
4. the web package can consume the core package through the workspace;
5. architecture docs and AGENTS.md do not contradict each other;
6. README setup instructions match the actual commands;
7. CI runs the same meaningful checks developers run locally;
8. no server/backend/deployment assumption was introduced;
9. the approved skills are project-local if installed;
10. no private Icarus content was committed.

If dependency installation or network access prevents a validation step, report the exact limitation. Do not report a check as passed if it was not run.

---

# Exit gate

KG0 is complete when all of the following are true:

- the repository is no longer an ad-hoc empty repo;
- `pnpm install` is reproducible from a committed lockfile;
- a minimal Vite/React app runs/builds;
- a framework-independent core workspace boundary exists;
- root typecheck/lint/test/build/check commands work;
- CI exists;
- architectural constraints are repository-owned and easy for Codex to find;
- dependency direction is documented and lightly enforced;
- future technologies are explicitly deferred rather than preinstalled;
- the two approved agent skills are installed project-locally, or their installation blocker is documented without blocking the foundation;
- nothing in KG0 pretends that parsing, Obsidian integration, or graph rendering already exists.

Do not begin KG1 implementation in the same task.

---

# Final report

At completion, report:

1. **Summary**
   - what foundational structure was created.

2. **Repository structure**
   - important new directories/files and why they exist.

3. **Technology/tooling**
   - exact main package versions selected;
   - Node/pnpm assumptions;
   - lint/format/test stack.

4. **Agent skills**
   - which skills were installed;
   - where the project-scoped skill files/configuration live;
   - if installation was skipped/blocked, exactly why.

5. **Architecture safeguards**
   - how core independence is documented and mechanically enforced.

6. **Validation**
   - every command run;
   - pass/fail result;
   - anything not run.

7. **Deviations**
   - any place where you intentionally diverged from this prompt and why.

8. **Follow-up**
   - anything KG1 should know before defining the canonical domain model and fixture infrastructure.

Keep the final report factual. Do not start KG1 automatically.
