# PERFQ1A — Query Projection Fast Path + DISC1 Direct Eligibility

**Task type:** projection performance / algorithmic refactor / benchmark instrumentation / QUERY1 + DISC1 optimization

## Goal

Make repeated QUERY1/filter changes feel immediate by removing unnecessary graph reconstruction from the projection path, while preserving exact KG6/DISC1/STRUCT1/Focus/reference semantics.

The target architecture for this milestone is:

```text
ProjectionWorkspace / canonical indexes
        ↓
build normal structural base ONCE per projectView call
        ↓
prepare entity-filter predicate ONCE
        ↓
linear filter/retain of the already-built projection
        ↓
DISC1 actionable counts from canonical candidate eligibility
WITHOUT a second hypothetical graph build for query/path/kind filters
        ↓
validation
```

This is **not** a QUERY1 grammar/evaluator rewrite. Existing evidence says the query evaluator itself is cheap; the expensive path is the derived graph work around it.

---

# Split decision

Deliberately split the optimization effort.

```text
PERFQ1A — THIS PLAN
→ measure projectView sub-phases
→ remove DISC1's second full candidate projection for entity-only filters
→ refactor applyFilters to preserve existing sorted topology instead of rebuilding/resorting it
→ add safe no-op paths
→ optimize validation only if profiling proves it material
→ remeasure

PERFQ1B — CONDITIONAL, DO NOT START AUTOMATICALLY
→ snapshot/disclosure-scoped prepared structural-base cache
→ only if PERFQ1A evidence shows repeated unchanged-disclosure queries are still too slow because the first base projection dominates
```

Do **not** implement a structural projection cache in PERFQ1A.

Do **not** move W2 projection to a worker in PERFQ1A.

The reason for the split is architectural: current performance policy explicitly rejected a broader `projectView` cache when there was no measured need. QUERY1 created new evidence, but first remove obvious duplicate work and measure the remaining cost before introducing cache invalidation/state.

---

# Current repository grounding

Repository:

`lillo24/icarus-graph-explorer`

Current `main` at prompt-writing time:

```text
43ed84943c42be95aef70bd01fbe7c46f9a08638
```

This is after:

```text
QUERY1 complete
KG13 complete
GROUP1 complete
PR #40 Global activation / stable Structure Focus-depth fix
```

Before editing, fetch actual latest `main` and inspect all commits after this SHA.

If current `main` has advanced, adapt rather than restoring stale code.

---

# Historical trigger — re-baseline before changing code

QUERY1 completion evidence previously exposed roughly:

```text
medium synthetic workspace
8,500 canonical entities
16,000 references
Structure depth 3
query:
(documents OR (sections AND level<=3)) AND NOT path:"archive"

projectView ≈ 650.9 ms
renderer mapping ≈ 64.7 ms
```

Treat `650.9 ms` as the **historical trigger**, not as a guaranteed current-main measurement.

PR #40 changed disclosure policy plumbing, so the first task is to rerun the current benchmark on current `main` and record the actual baseline.

Current Class B derived-view reference remains:

```text
median 100 ms
p95    250 ms
```

These are investigative product budgets, not machine-portable CI wall-clock gates.

---

# Current code path — important evidence

Current `projectViewWithDisclosurePolicy()` does:

```text
buildBaseProjection(...)
→ applyFocus(...)
→ parse active QUERY1 once
→ applyFilters(...)
→ if no Focus and actionable descendants exist:
     if entity-visibility filters exist:
       expand EVERY candidate owner hypothetically
       buildBaseProjection(...) AGAIN
       applyFilters(...) AGAIN
       collect retained candidate EntityIds
     derive revealableDescendantCount
→ validateViewProjection(...)
```

This second base projection is the first high-confidence optimization target.

Current `buildBaseProjection()`:

- calculates disclosure;
- scans every canonical reference;
- reroutes hidden reference endpoints to visible ancestors;
- aggregates internal references;
- aggregates reference edges;
- creates diagnostic targets;
- creates projected entity nodes;
- rebuilds hierarchy edges;
- sorts nodes/edges/provenance arrays.

Current `applyFilters()`:

- builds entity/node maps;
- normalizes path/kind/text/query filters;
- evaluates content entities;
- scans reference edges;
- handles raw-target projected-text support;
- walks canonical ancestors for retained context;
- rebuilds hierarchy edges from canonical parents;
- copies filtered nodes;
- sorts nodes/edges/issues again.

The QUERY1 evaluator itself parses once and performs bounded short-circuit AST evaluation.

GROUP1A evidence is a useful sanity check: several QUERY1-backed rules across 3,000 entities took about 1 ms, so do not spend this milestone micro-optimizing Boolean AST evaluation unless new sub-phase evidence contradicts that.

---

# Critical current-main compatibility: PR #40 disclosure policy

Current `project.ts` now has:

```text
projectViewWithDisclosurePolicy(...)
DisclosureCalculationOptions
```

and disclosure supports:

```text
defaultDepthByDocumentId
```

for projection-only Focus-depth behavior.

PERFQ1A must preserve this exactly.

Do not regress:

- stable Structure Focus depth;
- per-document projection-only depth overrides;
- Local projection behavior;
- Global activation behavior;
- persisted structural depth semantics.

Any new DISC1 direct calculation must consume the already-calculated `DisclosureResult` and therefore naturally honor the active disclosure policy.

---

# Scope

## In scope

1. current-main baseline and sub-phase instrumentation;
2. reusable preparation of canonical entity visibility filters;
3. DISC1 direct candidate-retention fast path for filters that do not depend on projected raw-target text;
4. exact slow fallback for projected-text semantics;
5. `applyFilters()` stable-order / linear materialization refactor;
6. remove redundant hierarchy reconstruction inside filtering when ancestor closure guarantees existing hierarchy validity;
7. remove redundant node/edge sorts where input order is already canonical;
8. safe no-op return paths;
9. validation optimization only if measured material;
10. performance benchmarks and operation-count oracles;
11. correctness/oracle/property-style regressions;
12. docs/performance-policy update based on actual evidence;
13. browser + desktop regression QA.

## Explicitly out of scope

Do not implement:

- new QUERY1 grammar;
- query autocomplete;
- fuzzy/semantic search;
- query inverted indexes;
- bitsets;
- lowercased whole-workspace query-fact caches unless profiling unexpectedly proves evaluator cost material;
- `projectView` result cache;
- structural base-projection cache;
- workerizing W2 projection;
- W3 changes;
- renderer replacement;
- GROUP1 changes;
- KG14 product work;
- canonical/parser/resolver changes;
- new external dependencies.

---

# Part 1 — Establish exact current baseline first

Before changing algorithmic behavior, rerun current-main benchmarks.

At minimum:

```bash
pnpm benchmark:performance -- --profile small
pnpm benchmark:performance -- --profile medium
```

Use current repository syntax if flags differ.

Record for the existing `depth-three-advanced-query` scenario:

```text
canonical entity/reference counts
projected node/edge counts
projectView median / p95 / max
renderer mapping median / p95
operation counts
```

Also record:

```text
three-structural-levels without advanced query
path-entity-filter
fully-expanded projectView
```

The comparison matters more than a single number.

---

# Part 2 — Add projection sub-phase evidence

The existing benchmark times `projectView()` as one phase. That is insufficient for deciding the next architecture.

Add narrow opt-in instrumentation that can separately measure:

```text
1. disclosure/base projection construction
2. Focus slicing
3. filter preparation/query parse
4. primary applyFilters
5. DISC1 candidate-eligibility preparation
6. DISC1 legacy candidate base projection, if used
7. DISC1 legacy candidate filtering, if used
8. actionable-count finalization
9. final validation
```

Also collect aggregate operation counts such as:

```text
baseProjectionBuilds
candidateBaseProjectionBuilds
filterPreparations
filterApplications
candidateDirectPlans
candidateLegacyFallbacks
canonicalReferencesScanned
entityFilterEvaluations
ancestorWalkSteps
hierarchyEdgesRebuilt
nodeSorts
edgeSorts
validationRuns
```

Exact naming may differ.

### Instrumentation architecture

Do not add a `view-projection → @icarus-graph-explorer/performance` dependency solely for timing.

Prefer one of:

- a tiny source-neutral optional projection instrumentation callback/type owned by `view-projection`;
- benchmark-only composition around newly factored pure internal functions;
- another repository-consistent mechanism with zero normal-product overhead when disabled.

Requirements:

```text
normal product use
→ no persistent recorder
→ no private data retained
→ no path/query text emitted in benchmark output
```

Synthetic benchmark output remains aggregate-only.

---

# Part 3 — Prepare canonical entity filters once

Refactor the canonical part of filter preparation into one reusable internal plan.

Conceptually:

```ts
interface PreparedEntityVisibilityFilter {
  readonly validPathPrefixes: ReadonlySet<string> | undefined;
  readonly entityKinds: ReadonlySet<EntityKind> | undefined;
  readonly preparedQuery: GraphQueryParseResult | undefined;
  readonly normalizedProjectedText: string;
  readonly issues: readonly ProjectionIssue[];
}
```

Exact type may differ.

The important separation is:

```text
CANONICAL ENTITY FILTERS
pathPrefixes
entityKinds
QUERY1 query

PROJECTED-TEXT EXTRA
filters.text
including unresolved rawTarget behavior
```

Create one shared pure predicate for the canonical entity portion, e.g. conceptually:

```ts
matchesCanonicalEntityFilters(entity, preparedFilters)
```

It must preserve current semantics exactly:

- path-prefix matching remains exact/folder-prefix behavior;
- entity-kind behavior unchanged;
- QUERY1 uses the existing `matchesGraphQuery()` evaluator;
- invalid QUERY1 fails closed;
- invalid path prefixes behave exactly as current `applyFilters()` behavior;
- reference-status handling remains separate;
- `filters.text` remains projected-text behavior and is not silently redefined as QUERY1 `text:`.

Do not duplicate QUERY1 predicate logic.

---

# Part 4 — DISC1 fast path: no second graph for entity-only filters

This is the main PERFQ1A optimization.

Current behavior computes actionable disclosure counts under filters by building a second hypothetical projection with every candidate owner expanded.

For filters whose entity retention does **not** depend on projected raw-target text, that whole graph build is unnecessary.

### Fast-path applicability

Use the direct path when:

```text
state.focus === undefined
AND
base.disclosure has candidate owners
AND
at least one entity-visibility filter is active
AND
filters.text is absent or trims to empty
```

The active entity filters may include:

```text
pathPrefixes
entityKinds
QUERY1 query
referenceStatuses in parallel
```

Reference statuses do not affect entity retention when projected text is absent; they affect edges/diagnostics, not whether a canonical candidate entity is retained as content/context.

### Preserve fallback

If non-empty `filters.text` is active, retain the current safe hypothetical candidate-projection path in PERFQ1A.

Reason:

```text
projected text
may match unresolved diagnostic rawTarget
→ may retain an otherwise text-nonmatching source entity as supporting context
→ depends on projected reference/diagnostic routing
```

Do not approximate this in PERFQ1A.

---

# Part 5 — Direct candidate-visible entity set

For the fast path, derive the hypothetical candidate-visible canonical set without `buildBaseProjection()`.

The intended set is:

```text
base.disclosure.visibleEntityIds
UNION
all EntityIds appearing in base.disclosure.revealableDescendantIdsByEntityId values
```

Before relying on this property, add an oracle test proving that for supported disclosure states this set equals the entity IDs visible after the current `expandAllCandidateOwners()` hypothetical disclosure state.

Cover:

- depth 0–3;
- jump heading levels;
- manual expansion;
- manual collapse;
- Blocks enabled/disabled;
- Heading limit;
- existing nested expanded descendants;
- PR #40 `defaultDepthByDocumentId` disclosure options.

If the union property does not hold in any supported case, do not force it. Derive candidate visibility directly from disclosure/tree state without constructing reference topology.

The fast path may run disclosure/tree logic; it must not scan/reroute all references or create projected edges/diagnostics.

---

# Part 6 — Direct candidate filter retention

Given the hypothetical candidate-visible entity set:

1. evaluate the shared canonical entity filter predicate against candidate-visible canonical entities;
2. these matching entities are hypothetical **content**;
3. add required canonical ancestors as context, but only where those ancestors are in the candidate-visible set;
4. produce one retained EntityId set;
5. `withActionableDisclosureCounts()` intersects each owner's candidate list against that retained set.

This must reproduce the old candidate-projection semantics exactly for the fast-path filter class.

Important overlap case:

```text
candidate section A does not itself match
but deeper candidate section B matches
A is required as visible context
→ A counts as revealable because the filtered hypothetical graph displays it
```

Do not count only direct predicate matches.

Ancestor closure is mandatory.

---

# Part 7 — Invalid-query behavior in direct DISC1 path

Current externally-invalid active projection state fails closed and emits `invalid-query` through the primary filter pass.

The direct candidate path must therefore produce:

```text
retained candidate entities = empty
revealableDescendantCount = 0
```

for invalid QUERY1.

Do not throw a second error.

Do not duplicate the issue.

The primary `applyFilters()` result remains the source of the projection issue.

---

# Part 8 — DISC1 exactness oracle against legacy implementation

Before deleting the slow candidate path for entity-only filters, create an oracle test helper that computes both:

```text
DIRECT candidate retained EntityIds

vs

LEGACY:
expand all candidate owners
→ buildBaseProjection
→ applyFilters
→ collect entity IDs
```

For deterministic synthetic fixtures, require exact set equality.

Matrix should include combinations of:

```text
Structure depth 0 / 1 / 2 / 3
Heading limit none / # / ###
Blocks off / on
manual expanded/collapsed state
path filter
entity kind filter
QUERY1 path
QUERY1 title
QUERY1 kind
QUERY1 level
AND / OR / NOT
query matching all
query matching none
invalid query
referenceStatuses alone and combined
```

Non-empty projected `filters.text` is explicitly expected to use the legacy fallback, not the direct oracle path.

Keep at least one regression proving raw-target text still behaves exactly as before.

---

# Part 9 — Refactor applyFilters into planning + linear materialization

Current filtering rebuilds hierarchy from canonical parents and sorts the final graph again.

This is unnecessary if filtering guarantees ancestor closure.

Refactor conceptually into:

```text
prepare filters
        ↓
plan retained content/context/reference/diagnostic IDs
        ↓
materialize by scanning the already-sorted projection once
```

Exact file organization is up to the implementation.

A useful internal split may be:

```text
filter-plan.ts
slicing.ts
```

but do not create abstractions without value.

---

# Part 10 — Preserve hierarchy by filtering existing edges

Current `applyFilters()` calls `hierarchyFor()` to rebuild hierarchy edges after filtering.

Prove and then use this invariant:

```text
for every retained entity node,
all available visible ancestors required by filtering are also retained
```

Therefore every hierarchy edge in the input projection whose child is retained should have its required projected parent retained.

Instead of:

```text
retained entities
→ canonical parent walks
→ new hierarchy edges
→ sort
```

prefer:

```text
existing sorted hierarchy edges
→ keep edge when both endpoints are retained
```

Add exact projection-equality tests before/after refactor across:

- ordinary Structure;
- Focus projection;
- context ancestors;
- Focus `ancestors-and-children` context;
- raw-target supporting source behavior;
- repeated/jump-level headings.

If any existing semantic case requires hierarchy compression after filtering, retain the minimal reconstruction only for that case and document why.

Do not change hierarchy semantics merely for speed.

---

# Part 11 — Preserve existing sorted order

Input `ViewProjection.nodes` and `.edges` are already deterministically sorted.

Filtering them in input order preserves sorting.

Avoid calling the generic `sortedProjection()` on the normal successful filter path.

Preferred materialization:

```text
for node of projection.nodes:
  keep/transform if retained

for edge of projection.edges:
  keep if retained by plan
```

This preserves canonical sorted order without:

```text
copy
→ sort nodes
→ sort edges
```

Issues may still need sorting when new invalid-path/query issues are appended.

Keep issue ordering deterministic.

---

# Part 12 — Avoid unnecessary object copies

When a retained node's output metadata is unchanged, reuse the input node object.

Only clone when current semantics require changing:

```text
role
focusDistance
internalReferenceIds
revealableDescendantCount
```

Do not mutate input projections.

This is an allocation optimization, not a semantic one.

Likewise preserve edge objects when unchanged.

---

# Part 13 — Safe no-op filter paths

Add explicit no-op detection where exact equality is provable.

At minimum:

```text
filters === undefined
→ return projection
```

already exists.

Also consider/prove:

```text
no entity filter
AND no effective reference-status restriction
→ return projection
```

For non-Focus Structure projections where every content entity survives the canonical filter and references/statuses are unchanged:

```text
applyFilters may return the input projection
```

Do not add fragile no-op heuristics.

Do not use `JSON.stringify(projection)` for equality.

No-op detection should emerge from counts/sets already computed by the filter plan.

---

# Part 14 — Reference-status behavior remains separate

Do not rewrite reference-status semantics while optimizing entity filters.

Preserve exactly:

- resolved/unresolved/ambiguous/invalid status selection;
- internal resolved-reference handling;
- diagnostic retention;
- aggregated reference edge provenance;
- status-specific filtering with no entity filter;
- status combined with QUERY1/path/kind/text.

The DISC1 direct candidate fast path may ignore reference status **only for candidate entity retention when projected text is absent**, because the existing semantics do not let reference status alone remove canonical entity content/context.

Add a test proving this assumption against the legacy candidate oracle.

---

# Part 15 — Projected text remains the conservative fallback

Current `filters.text` is not just canonical entity text.

It can match:

```text
sourcePath
title
unresolved rawTarget
```

and raw-target matches can retain supporting source nodes.

Do not silently reinterpret it.

For PERFQ1A:

```text
non-empty filters.text
→ candidate DISC1 uses legacy hypothetical projection/filter fallback
```

Primary `applyFilters()` still receives the stable-order/materialization optimizations where safe.

Record fallback operation counts so later work can see whether this rare path matters.

---

# Part 16 — Query evaluator micro-optimization: evidence gate only

Do not proactively add query indexes or caches.

Instrument enough to determine actual query-evaluation share.

Only optimize `graph-query/src/evaluate.ts` in PERFQ1A if BOTH are true on the medium query scenario:

```text
query evaluation > 10% of projectView time
AND
query evaluation > 10 ms median
```

If that surprising condition occurs, allowable low-risk changes include:

- lowercasing string literal needles once in a prepared/compiled expression;
- avoiding repeated lowercase conversion of the same entity facts within one projection;
- preserving exact parser/formatter public semantics.

Do not add a whole-workspace inverted index in this milestone.

Expected result is that no evaluator change is needed.

---

# Part 17 — Validation optimization: evidence gate only

`validateViewProjection()` remains mandatory.

Do not disable it in production.

Do not make validation dev-only.

Instrument its phase first.

Only optimize validation if it is material, suggested gate:

```text
validation >= 15% of medium query projectView time
OR
validation >= 15 ms median
```

If triggered, optimize implementation rather than semantics.

Examples of safe changes to investigate:

```text
current sortedness check:
map IDs → clone/sort → JSON.stringify compare

preferred:
single adjacent monotonic-order pass
```

and:

```text
array equality:
JSON.stringify
→ direct length + element comparison
```

Reuse maps/sets within a validation run where possible.

Do not weaken:

- canonical entity/reference checks;
- provenance uniqueness;
- endpoint validation;
- role/focus invariants;
- sortedness requirements;
- diagnostic consistency.

Add old-vs-new validation oracle tests if implementation is materially refactored.

---

# Part 18 — Do not add the structural cache yet

Even after the fast path, every normal `projectView()` call still builds the primary structural base once.

That may be enough to return the advanced-query scenario to Class B.

PERFQ1A must measure before adding cache complexity.

Do not add:

```text
ProjectionEngine cache
ProjectionWorkspace mutable base cache
GraphExplorer structural-base memo
projectView LRU
```

in this milestone.

The final PERFQ1A report must expose how much time the **remaining first base projection** costs after duplicate candidate work is removed.

---

# Part 19 — Focus path must remain unchanged semantically

Current Focus behavior intentionally suppresses speculative Expand controls because reference endpoint roll-up makes local prediction non-local.

Preserve:

```text
Focus
→ no speculative DISC1 direct Expand count path
```

Do not attempt to optimize Focus disclosure counts by re-enabling speculation.

`applyFilters()` refactor must still support Focus projections exactly.

PR #40 per-document Structure Focus depth must remain stable.

---

# Part 20 — Local projection regression

KG13 Local uses bounded projection logic and current disclosure policy seams.

Even if PERFQ1A is motivated by Structure QUERY1 performance, run Local projection tests because shared `applyFilters`, disclosure, or project helpers may affect it.

Do not change:

- Local document root;
- Local bounded neighborhood semantics;
- Free/Structured shared projection;
- Local presentation switching;
- transition anchors;
- Local viewport persistence.

---

# Part 21 — Navigation / QUERY1 / Saved Filters behavior unchanged

Optimization must not alter product behavior:

```text
Apply Advanced Query
Clear Advanced Query
Apply Saved Filter
```

still create exactly one NAV1 history checkpoint only when canonical query state changes.

Draft typing remains local and does not project.

Search/Inspector navigation still:

- preserves a query that includes the destination;
- clears an excluding/invalid query when necessary to reveal a target;
- announces that behavior;
- allows Back to restore previous query state.

No persistence schema changes.

---

# Part 22 — DISC1 correctness matrix

Preserve the established user meaning:

```text
› N
= expanding now reveals exactly N descendant entity nodes under the current filters

⌄ N
= collapsing now hides exactly N currently visible descendant entity nodes
```

Regression cases must include:

### Blocks

```text
Blocks off
→ block-only candidate contributes 0

Blocks on
→ exact block candidate count
```

### Heading limit

Hard ceiling still excludes disallowed sections from candidate counts.

### Structural depth

Depth 0/1/2/3 exact next-action counts remain.

### Path/query

Query-excluded candidates contribute 0 unless retained as required context for another matching candidate.

### Preserved nested expansion

Existing descendant expansion state remains respected.

### Focus

Speculative Expand remains suppressed.

### NAV1

Back/Forward restores disclosure/query state and derived counts recompute without becoming history themselves.

---

# Part 23 — Exact projection oracle tests for applyFilters refactor

Before/after output should be byte-for-byte/deep-equal for supported inputs except object identity reuse.

Build an oracle helper around the pre-refactor semantics if practical.

Test combinations:

```text
no filters
reference status only
path only
kind only
projected text only
QUERY1 only
path + kind + query
query + reference status
text + query
invalid path prefix
invalid query
Focus
Focus ancestors-and-children
unresolved diagnostic targets
ambiguous targets
invalid targets
internal resolved references
aggregated reference edges
```

Assert exact:

```text
nodes
edges
issues
roles
focusDistance
internalReferenceIds
referenceIds
candidateEntityIds
reasons
ordering
```

---

# Part 24 — Operation-count tests

Add deterministic operation oracles.

For medium/synthetic advanced QUERY1 without projected text after PERFQ1A:

```text
baseProjectionBuilds = 1
candidateBaseProjectionBuilds = 0
primaryFilterApplications = 1
legacyCandidateFilterApplications = 0
candidateDirectPlans = 1
validationRuns = 1
```

For projected-text fallback:

```text
baseProjectionBuilds = 1
candidateBaseProjectionBuilds = 1 when actionable candidates exist
candidateLegacyFallbacks = 1
```

For no visibility filter:

```text
candidateBaseProjectionBuilds = 0
candidateDirectPlans = 0
```

Do not turn timing into CI gates; operation paths can be gated deterministically.

---

# Part 25 — Focused query benchmark

Add a dedicated query-projection benchmark if the existing general benchmark cannot expose enough detail cleanly.

Suggested command:

```text
pnpm benchmark:query-projection
```

Exact script name may differ.

It should use deterministic synthetic content and report aggregate-only data.

Scenarios:

```text
small depth-3 no filter
small depth-3 query
medium depth-3 no filter
medium depth-3 query matching most
medium depth-3 selective query
medium path+kind
medium projected-text fallback
medium invalid query fail-closed
```

For each, report:

```text
canonical counts
projected counts
phase median/p95/max
operation counts
```

No private paths/query text need to be emitted. Scenario IDs are enough.

---

# Part 26 — Repeated query-change benchmark

The user-facing requirement is not only cold projection; changing filters repeatedly should feel fast.

Add a deterministic sequence with unchanged snapshot/disclosure:

```text
Query A
→ Query B
→ Query C
→ Clear
→ Query A
```

PERFQ1A does not cache the base, so this benchmark establishes the remaining repeated cost.

Report:

```text
per-transition projectView time
base-projection share
filter share
DISC1 share
validation share
```

This evidence determines whether PERFQ1B is justified.

---

# Part 27 — Performance targets

Primary success target for PERFQ1A:

```text
medium / Structure depth 3 / nontrivial Advanced Query
projectView median <= 100 ms
p95 <= 250 ms
```

These remain investigative, machine-local product references.

Stronger repeated-use target:

```text
unchanged snapshot + unchanged disclosure
subsequent query changes
median <= 50 ms
```

Do not fail CI solely because wall-clock numbers vary by machine.

Use these as the PERFQ1B decision gate.

---

# Part 28 — PERFQ1B decision gate

At the end of PERFQ1A, choose one of two outcomes.

## Outcome A — stop

Do **not** create PERFQ1B if current-machine evidence shows:

```text
medium depth-3 advanced query within Class B
AND
repeated query changes around/below 50 ms median
AND
base projection is no longer the dominant user-visible obstacle
```

Document that no cache is justified.

## Outcome B — recommend PERFQ1B

Recommend a separate follow-up only if:

```text
repeated unchanged-disclosure query median remains >50 ms
OR
Class B median/p95 remains missed
```

and profiling shows the remaining first `buildBaseProjection()` is a major share, suggested:

```text
>= 40–50% of repeated query projectView time
```

Then PERFQ1B should be planned against the new merged code, not implemented automatically here.

Likely PERFQ1B topic:

```text
Prepared Structural Projection Cache
```

keyed by snapshot + structural disclosure + projection-only disclosure policy, not by query.

Do not write the detailed PERFQ1B implementation before PERFQ1A evidence unless requested separately.

---

# Part 29 — Worker decision gate

Do not move W2 projection to a worker in PERFQ1A.

If, **after** algorithmic fast paths and a justified structural-base cache, projection still materially blocks the UI above Class B, a later worker decision can be revisited with new evidence.

Workerizing inefficient duplicate work is not the first solution.

---

# Part 30 — Performance policy update

Update `tools/vault-diagnostics/src/performance-policy.ts` based on final evidence.

The old W2 statement says bounded filter projections remain below layout cost and W2 stays main-thread.

After PERFQ1A, document the QUERY1 regression and the new evidence.

If PERFQ1A restores W2 to Class B:

```text
W2 decision = main-thread retained
reason = duplicate candidate projection/filter work removed; exact DISC1 direct eligibility proven
```

For cache policy:

- do not claim a structural cache exists;
- retain `projectView result cache = do-not-add` unless evidence requires revising language;
- if PERFQ1B is recommended, add a clearly **pending evidence-backed candidate**, not a completed cache.

---

# Part 31 — Documentation

Update as appropriate:

```text
docs/PERFORMANCE.md
packages/view-projection/README.md
tools/vault-diagnostics README/docs
history implementation archive
```

Document the distinction:

```text
QUERY1 evaluator
= cheap bounded entity predicate

query-driven projection
= structural/filter/DISC1 derived graph work
```

Do not describe this as a query parser performance fix.

---

# Part 32 — Browser QA

Use production browser build and synthetic/sample data.

Exercise:

1. Structure depth 3;
2. apply nontrivial Advanced Query;
3. change query several times;
4. clear query;
5. apply Saved Filter;
6. Back/Forward;
7. expand/collapse under active query;
8. Blocks toggle;
9. Heading limit;
10. path/entity filters;
11. projected-text filter fallback;
12. enter/exit Focus;
13. Search navigation that clears excluding query;
14. Inspector navigation;
15. switch Global/Local/Structure and back.

Verify:

- no stale graph;
- no incorrect disclosure count;
- no query history regression;
- no console error;
- last valid UI does not show success-shaped failure;
- filter Apply no longer causes the historical long main-thread stall on the tested medium synthetic workload.

Use current performance instrumentation where possible to record aggregate interaction evidence.

---

# Part 33 — Desktop/live QA

On a disposable synthetic vault:

1. open workspace;
2. Structure depth 3;
3. apply query;
4. edit Markdown while query active;
5. verify transactional live adoption;
6. expand/collapse with query;
7. Back/Forward;
8. clear/reapply Saved Filter;
9. switch presentation modes;
10. rescan/reopen as current checklist requires.

No vault writes from PERFQ1A.

No private path/query/source content committed.

Release/native QA should follow current repository policy.

---

# Part 34 — Dependencies and schemas

Expected:

```text
new external dependencies: 0
canonical schema changes: 0
view-state schema changes: 0
Saved Filter schema changes: 0
Visual Group schema changes: 0
worker protocol changes: 0
renderer contract changes: ideally 0
```

If optional projection instrumentation adds a source-neutral type, it must remain runtime-only and non-serialized.

---

# Likely files

Use actual latest main; this is guidance.

Likely core changes:

```text
packages/view-projection/src/project.ts
packages/view-projection/src/slicing.ts
packages/view-projection/src/disclosure.ts              // only if helper exposure/refactor is needed
packages/view-projection/src/validation.ts              // conditional on measured cost
packages/view-projection/src/*.test.ts
packages/view-projection/README.md
```

Possible new internal module:

```text
packages/view-projection/src/filter-plan.ts
```

Benchmark/policy:

```text
tools/vault-diagnostics/src/performance-benchmark.ts
tools/vault-diagnostics/src/query-projection-benchmark.ts   // if useful
tools/vault-diagnostics/src/performance-policy.ts
package.json / tool package scripts only as needed
docs/PERFORMANCE.md
```

Avoid broad `GraphExplorer.tsx` edits unless runtime instrumentation needs a narrow interaction hook.

No renderer changes should be required for the core optimization.

---

# Suggested implementation sequence

1. Create dedicated PERFQ1A branch/worktree from actual latest main.
2. Run current small/medium baselines before editing.
3. Add sub-phase/operation instrumentation.
4. Rerun baseline and identify actual dominant phases.
5. Refactor canonical filter preparation into one shared internal plan.
6. Add legacy-vs-direct DISC1 oracle tests first.
7. Implement candidate-visible entity derivation.
8. Implement direct candidate canonical filtering + ancestor closure.
9. Route query/path/kind candidate counts through direct fast path.
10. Keep projected-text fallback.
11. Add deterministic operation-count assertions.
12. Refactor `applyFilters()` to plan + stable-order materialization.
13. Replace hierarchy reconstruction with existing-edge filtering where proven exact.
14. Remove redundant node/edge sorts on normal filter paths.
15. Add safe no-op returns.
16. Rerun all projection correctness tests.
17. Measure validation; optimize only if evidence gate triggers.
18. Measure query evaluator; optimize only if evidence gate triggers.
19. Run focused small/medium query benchmark.
20. Run repeated query-change benchmark.
21. Run general performance suite and worker regressions.
22. Browser semantic/performance QA.
23. Desktop/live QA.
24. Update performance policy/docs with actual before/after numbers.
25. Make PERFQ1B recommendation/no-recommendation from evidence.
26. Archive this prompt under `history-implementations/`.
27. PR → CI → merge → post-merge CI → branch/worktree cleanup.
28. Do not start PERFQ1B automatically.
29. Do not start KG14 automatically.

---

# Validation commands

Use current repository-equivalent commands.

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/view-projection typecheck
pnpm exec vitest run packages/view-projection

pnpm --filter @icarus-graph-explorer/graph-query typecheck
pnpm exec vitest run packages/graph-query

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:performance -- --profile small
pnpm benchmark:performance -- --profile medium
# plus new focused query benchmark if added

pnpm benchmark:dagre-worker -- --profile small
pnpm benchmark:dagre-worker -- --profile medium
pnpm benchmark:workspace-worker -- --profile medium

pnpm --filter @icarus-graph-explorer/web build
pnpm desktop:check

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
git diff --check
```

Run optimized desktop build/release QA if required by current repository checklist.

PR CI and post-merge `main` CI must pass.

---

# Exit gate

PERFQ1A is complete only when:

1. Implementation starts from actual latest main.
2. Current-main pre-change benchmark is recorded.
3. Historical 650.9 ms is not falsely presented as current if current measurement differs.
4. `projectView` sub-phases are measurable with aggregate-only instrumentation.
5. Normal product mode has no always-on recorder.
6. No private source/path/query data is retained by diagnostics.
7. Query parses once per projection.
8. Canonical path/kind/query filter preparation is shared.
9. QUERY1 predicate semantics are not duplicated.
10. Invalid query still fails closed.
11. Invalid query still produces `invalid-query` issue.
12. Invalid path-prefix semantics are unchanged.
13. Projected `filters.text` semantics are unchanged.
14. Raw-target text support remains unchanged.
15. Reference-status semantics remain unchanged.
16. Fast DISC1 candidate path exists for non-text entity visibility filters.
17. Fast path performs zero candidate `buildBaseProjection()` calls.
18. Fast path performs zero legacy candidate `applyFilters()` calls.
19. Candidate-visible entity derivation is oracle-tested.
20. Fast candidate retained set is exactly equal to legacy retained set across deterministic fixtures.
21. Direct candidate path includes context ancestors of matching descendants.
22. Direct candidate path handles path filters exactly.
23. Direct candidate path handles entity-kind filters exactly.
24. Direct candidate path handles QUERY1 Boolean expressions exactly.
25. Direct candidate path handles QUERY1 level predicates exactly.
26. Direct candidate path handles query matching all.
27. Direct candidate path handles query matching none.
28. Direct candidate path handles invalid query with zero counts.
29. Direct candidate path behaves correctly with referenceStatuses.
30. Direct candidate path respects Structure depth 0–3.
31. Direct candidate path respects Heading limit.
32. Direct candidate path respects Blocks opt-in.
33. Direct candidate path respects manual expansion.
34. Direct candidate path respects manual collapse.
35. Direct candidate path respects preserved nested expansion.
36. Direct candidate path respects PR #40 projection-only depth options.
37. Focus does not use speculative direct Expand counts.
38. Non-empty projected-text candidate calculation still uses safe fallback.
39. Projected-text fallback operation count is explicit.
40. DISC1 `› N` remains exact.
41. DISC1 `⌄ N` remains exact.
42. DISC1 zero-count controls remain suppressed.
43. `applyFilters()` output semantics remain exact.
44. Filtered nodes remain deterministically sorted.
45. Filtered edges remain deterministically sorted.
46. Projection issues remain deterministically sorted.
47. Filtering does not unnecessarily reconstruct hierarchy edges when endpoint filtering is sufficient.
48. Hierarchy output is oracle-equal to old behavior.
49. Focus hierarchy output is oracle-equal to old behavior.
50. Context ancestor behavior is unchanged.
51. `ancestors-and-children` Focus behavior is unchanged.
52. Diagnostic retention is unchanged.
53. Aggregated reference provenance is unchanged.
54. Internal resolved references are unchanged.
55. Ambiguous/invalid/unresolved targets are unchanged.
56. Normal filter materialization avoids redundant node sort.
57. Normal filter materialization avoids redundant edge sort.
58. No-op paths are exact, not heuristic.
59. Input projections are never mutated.
60. Object reuse does not change semantics.
61. Validation still runs on final projection.
62. Validation semantics are not weakened.
63. Validation is only refactored if profiling gate is met.
64. Query evaluator is only modified if profiling gate is met.
65. No inverted query index is added.
66. No structural projection cache is added.
67. No projectView LRU/result cache is added.
68. No W2 worker is added.
69. No new external dependency is added.
70. No canonical schema changes.
71. No view-state schema changes.
72. No Saved Filter schema changes.
73. No Visual Group schema changes.
74. No worker protocol changes.
75. PR #40 stable Structure Focus depth remains correct.
76. Global activation regression remains fixed.
77. Local projection semantics remain correct.
78. Local Free/Structured switching remains correct.
79. QUERY1 Apply/Clear history behavior is unchanged.
80. Saved Filter Apply history behavior is unchanged.
81. Query draft typing remains projection-free.
82. Search navigation query-clearing behavior is unchanged.
83. Inspector navigation query-clearing behavior is unchanged.
84. NAV1 Back restores previous query state.
85. Same-workspace live updates remain transactional.
86. Query active during Markdown update remains correct.
87. Advanced-query benchmark has phase breakdown.
88. Advanced-query benchmark has deterministic operation counts.
89. Fast-path advanced query records `candidateBaseProjectionBuilds = 0`.
90. Text fallback records legacy candidate build when required.
91. Small benchmark is reported.
92. Medium benchmark is reported.
93. Repeated query-change benchmark is reported.
94. Before/after numbers are documented.
95. Medium depth-3 query is compared to Class B target.
96. Remaining base-projection share is reported.
97. Remaining filter share is reported.
98. Remaining DISC1 share is reported.
99. Remaining validation share is reported.
100. Query evaluator share is reported.
101. Performance policy is updated from evidence.
102. W2 main-thread decision is explicitly re-evaluated.
103. PERFQ1B decision is explicit: recommend or stop.
104. PERFQ1B is recommended only if decision gate is met.
105. PERFQ1B is not implemented automatically.
106. Browser query/filter QA passes.
107. Browser disclosure QA passes.
108. Browser Search/Inspector/NAV1 QA passes.
109. Browser mode-switch QA passes.
110. Browser console remains clean.
111. Desktop/live synthetic QA passes.
112. No vault writes are introduced.
113. View-projection tests pass.
114. Graph-query tests pass.
115. Web tests pass.
116. Current worker benchmarks/regressions pass.
117. Full `pnpm check` passes.
118. Production web build passes.
119. `pnpm desktop:check` passes.
120. Optimized desktop/release QA passes if current policy requires it.
121. `git diff --check` passes.
122. PR CI passes.
123. Post-merge main CI passes.
124. Prompt is archived exactly under repository convention.
125. PERFQ1A worktree/branch is cleaned after merge.
126. Concurrent unrelated worktrees/files remain untouched.
127. KG14 is not started automatically.

---

# Final completion report

Report:

## 1. Summary

PR, implementation commit, merge commit, post-merge CI.

## 2. Starting / final main

Starting SHA, final rebase/merge SHA, concurrent changes accommodated.

## 3. Baseline

Current-main pre-change small/medium numbers, explicitly distinguishing them from the historical ~650.9 ms trigger.

## 4. Sub-phase profile

For the medium depth-3 Advanced Query, report median/p95 for:

```text
base projection
Focus slice
filter preparation
primary filter
DISC1 direct plan or legacy candidate base/filter
count finalization
validation
```

## 5. Root cause confirmed

State what actually dominated after measurement; do not merely repeat the prompt's hypothesis.

## 6. DISC1 fast path

Explain direct candidate-visible set, canonical filter matching, ancestor closure, and text fallback.

## 7. Exactness evidence

Legacy-vs-direct candidate oracle matrix and any edge cases found.

## 8. applyFilters refactor

Planning/materialization architecture, hierarchy-edge reuse, stable order, object reuse/no-op paths.

## 9. Projected text / reference status

Confirm unchanged semantics and fallback path.

## 10. Validation

Measured share; whether it was optimized; exact changes if any.

## 11. Query evaluator

Measured share; whether it was left unchanged as expected.

## 12. PR #40 / Focus compatibility

Confirm projection-only depth policy and Global/Local regressions remain fixed.

## 13. QUERY1 / NAV1 / persistence

Apply/Clear/Saved Filter/navigation/history behavior.

## 14. Performance after

Report small/medium:

```text
projectView median/p95
phase medians/p95
mapping
operation counts
```

and before/after ratios.

## 15. Repeated query sequence

Report A→B→C→Clear→A transition timings and remaining first-base share.

## 16. Class B result

Did medium query return to:

```text
median <=100 ms
p95 <=250 ms
```

on the recorded environment?

## 17. PERFQ1B decision

Explicitly one:

```text
NOT JUSTIFIED — stop here
```

or

```text
JUSTIFIED — prepare separate structural-base-cache plan
```

with measured reason.

## 18. Worker decision

Confirm no W2 worker was added; state whether main-thread projection remains evidence-backed.

## 19. Dependencies / schemas

Expected zero external dependency/schema/protocol changes.

## 20. Tests / QA

Test counts, benchmark commands, browser/desktop/release QA, CI.

## 21. Files changed

Key projection/filter/benchmark/docs files.

## 22. Deviations / warnings

Anything that differed from the hypothesis, machine-specific timing, existing Vite warning, etc.

## 23. Handoff

Do not start PERFQ1B or KG14 automatically.
