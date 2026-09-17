# SPATIAL2C — Live Soft Pull Preview for Arrange Folders

**Task type:** UI/renderer interaction feature + transient worker orchestration

## Goal / success outcome

Make **Arrange Folders → Pull** preview its spatial effect live while the rule is still a draft.

Current Pull authoring behaves like this:

```text
drag Pull target
→ target marker moves
→ target text changes
→ graph geometry stays still
→ release / Apply persists the rule
→ authoritative SPATIAL2A worker runs
→ graph finally moves
```

Target behavior:

```text
drag Pull target
→ target marker follows pointer immediately
→ graph begins reacting toward the draft target while dragging
→ connected nonmembers continue reacting through the existing soft ForceAtlas2 logic
→ newer pointer positions replace older preview intent
→ no persistence occurs yet

release / Apply
→ persist the complete rule through the existing transaction
→ run the existing full authoritative SPATIAL2A refinement
→ keep the transient preview visible until the confirmed result adopts
→ authoritative result replaces preview cleanly
```

This task is specifically about the **soft/Pull arrangement preview**.

`Place` already has a direct rigid preview and should remain unchanged except for compatibility fixes.

The preview must remain:

```text
transient
non-persistent
camera-neutral
outside automatic-layout caches
outside authoritative Pull cache
outside Saved Views/history
```

The visual goal is not “instant final equilibrium at 60 FPS.” A small physically meaningful lag is acceptable:

```text
marker = exact pointer intent
graph = soft live response following that intent
```

The user should be able to understand what a Pull rule will do **before committing it**.

---

# Current repository baseline

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Current `main` when this prompt was written:

```text
986f20aa5630a0a513fb6ca4de150d6dd368bd92
```

Re-check latest `main`, `AGENTS.md`, open PRs, and worktrees before editing.

Known concurrent/open work at prompt-writing time includes:

```text
#103 MOVE300A/B/C — draft; overlaps GlobalGraphCanvas/session/Network interaction
#106 HIER4B-SPACING — Soft Hierarchy spacing QA
#102 Vite dev worker boundary
#100 SAVEDUX1 — draft
```

Use an isolated branch/worktree.

Do not reset, modify, delete, or absorb unrelated branches/worktrees.

PR #103 is especially relevant because it touches Global Network session/input code. If it merges before this task finishes, integrate current `main` and rerun the relevant Arrange/Move arbitration tests. If this task merges first, clearly tell the MOVE branch that it must rebase and rerun its Global session QA.

This task concerns **All + Network Arrange Folders Pull**, not Focus Hierarchy's separate “Soft Folder Clusters” renderer.

---

# Current architecture / strongest evidence

Read current implementations before changing behavior, especially:

```text
packages/renderer-sigma/src/GlobalGraphCanvas.tsx
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/spatial-influence.ts
packages/renderer-sigma/src/spatial.ts
packages/renderer-sigma/src/arrangement.ts
packages/renderer-sigma/src/spatial-influence-cache.ts
packages/spatial-overrides/
apps/web/src/workers/global-spatial-influence.worker.ts
apps/web/src/workers/global-spatial-influence-worker-client.ts
packages/renderer-sigma/src/arrangement-canvas.test.tsx
packages/renderer-sigma/src/arrangement-session.test.ts
packages/renderer-sigma/src/spatial-rule-canvas.test.tsx
```

The existing position pipeline is:

```text
base automatic Global positions
→ separate soft Pull worker/cache
→ fixed Place composition
→ displayed Sigma positions
```

Keep that separation.

Current SPATIAL2B deliberately makes Pull draft target editing marker-only:

```text
Pull
→ positionFolderTargetAnchor(...)
→ no Graphology x/y preview

Place
→ previewFolderAnchor(...)
→ sparse rigid graph preview
```

The current soft worker is a finite deterministic request:

```text
base automatic positions
+ resolved Pull attractors
+ reference graph
→ interleaved ForceAtlas2 / centroid attraction
→ dynamic positions
```

Production uses 30/20 iterations by current scale policy; the implementation interleaves up to six chunks.

The current web client is a **latest-result-wins replacement-worker client**. Calling `layout()` again while a request is active supersedes and terminates the prior worker.

That replacement behavior is appropriate for authoritative commits, but raw pointer movement must **not** blindly spawn/terminate one worker per pointer event.

---

# Hard product invariants

## Draft ≠ confirmed rule

Preview must never become persistence.

A draft Pull edit must not write:

```text
spatial registry
Graph Preferences
Saved View profile
Current View/history
layout cache
authoritative spatial influence cache
source Markdown
identity/catalog data
```

Only the existing explicit commit transaction may persist the rule.

## Base / dynamic / fixed remain separate

Preview must not alter the meaning of:

```text
base automatic positions
confirmed dynamic Pull positions
fixed Place positions
```

Introduce a clearly transient preview layer/state rather than overwriting upstream ownership.

Conceptually:

```text
base automatic
→ draft Pull preview dynamic positions
→ confirmed/draft fixed Place composition
→ displayed preview

commit succeeds
→ ordinary confirmed dynamic pipeline becomes authoritative again
```

## Preview is path-independent

Do **not** repeatedly seed new preview calculations from the previously previewed result.

That would make the outcome depend on how the pointer travelled and how many preview computations happened.

Each preview request should derive from the same authoritative **base automatic positions** plus the current complete effective draft-rule set.

The same draft at the same base/layout/settings should produce the same preview geometry regardless of pointer history.

## M2 remains separate

Do not feed automatic Global M2 folder output back into the Pull worker differently from the existing confirmed path.

Do not create a new duration-accumulating folder prior.

## Camera is not preview state

Live Pull preview must perform zero:

```text
Fit
Density write
camera center write
camera zoom write
viewport persistence
```

The graph moves under the existing camera.

---

# Scope

## Required in this task

Live transient preview for geometry-affecting **Pull draft** changes:

1. target marker pointer drag;
2. target keyboard nudge;
3. Pull strength changes;
4. scope changes that change effective membership:
   - exact/subtree/custom;
   - root-file inclusion;
   - subtree inclusion/exclusion toggles.

The pointer-drag experience is the primary acceptance case.

If a draft changes from Place → Pull, the Pull preview should take ownership cleanly.

If Pull → Place, return to the existing rigid Place-preview path without leaving stale soft-preview geometry.

## Not required

- redesigning Place preview;
- persistent new folder coordinates;
- changing the final SPATIAL2A Pull algorithm;
- PHYSICS1 File Move;
- Focus Network;
- Focus Hierarchy Soft Folder Clusters;
- new folder clustering physics;
- new query language;
- Saved View schema changes;
- automatic camera fitting;
- a general-purpose animation framework.

---

# Implementation guidance

## 1. Add a separate transient Pull-preview owner

Do not make the confirmed `spatialRules` collection pretend the draft is already saved.

Prefer an explicit preview owner/controller holding something equivalent to:

```text
editor generation
draft revision
current effective draft rule set
latest desired preview input
active preview request
one pending newest preview input
last successfully displayed preview result
preview status/error
```

Exact names/types are up to the implementation.

The preview owner should be destroyed/reset when:

```text
Arrange exits
active folder changes
draft is cancelled
layout/source generation changes
rule persistence fails
editor becomes unavailable
renderer is disposed
```

Stale results from an older editor/layout generation must never adopt.

---

## 2. Use a separate preview worker service

Do not let draft preview supersede the authoritative SPATIAL2A worker.

Use the existing:

```text
global-spatial-influence.worker.ts
computeGlobalSpatialInfluence(...)
request/result validation
```

for semantic parity where possible, but instantiate a **separate preview service/client** or equivalent isolated ownership.

Avoid duplicating the actual Pull algorithm.

Authoritative confirmed work and transient preview work must be independently cancellable.

Do not put preview results into `GlobalSpatialInfluenceCache`.

Do not let preview failures poison the authoritative service.

If the cleanest API is a small service factory rather than passing two concrete services through many layers, use that after inspecting current ownership.

---

## 3. Do not request a worker for every raw pointer event

The target marker remains immediate.

Preview computation is bounded/coalesced.

Recommended scheduler:

```text
pointer / draft updates
→ update latest desired preview input
→ coalesce at animation-frame boundary

if no preview request active
→ start newest desired request

while one request is active
→ replace only one pending desired preview
→ do not create an unbounded queue

request completes
→ if generation is still valid:
     display that completed preview
→ if a newer pending preview exists:
     immediately start only the newest pending request
```

This intentionally permits:

```text
marker slightly ahead of graph
```

while maintaining continuous useful graph progress.

Do not require the graph result to correspond to the very latest pointer sample before rendering it; that can starve visible progress when the worker naturally lags.

Do require monotonic preview revision/generation safety so an older completed request can never overwrite a newer already-adopted preview.

---

## 4. Bake off a small preview iteration budget

The authoritative SPATIAL2A result remains unchanged.

For preview only, compare a small bounded set such as:

```text
6
12
18
30 iterations
```

using the **same** production `interleaved-centroid` algorithm.

Why these are useful:

```text
6
→ one FA2 iteration per existing six attractor chunks

12 / 18
→ intermediate quality/latency

30
→ current full small/medium authoritative quality
```

Evaluate at least:

```text
~100 nodes
~300 nodes
~1,000 nodes
```

and one larger existing safe fixture if practical.

Choose the smallest preview budget that reliably shows:

```text
correct direction of cluster motion
meaningful connected-neighbor reaction
reasonable relation to final authoritative result
```

without making pointer interaction feel delayed.

Do not change the final authoritative iteration policy based on this preview bakeoff.

If no finite replacement-worker preview is responsive enough at the user's ~300-node scale, **stop and report before inventing a persistent new solver or piggybacking on PHYSICS1**.

A new simulation architecture is not implicitly approved by this task.

---

## 5. Build preview requests from base automatic geometry

Each Pull preview request should use:

```text
current accepted base automatic positions
current Global physics settings
current topology/reference edges
effective spatial rule set where:
  confirmed same-root rule is replaced by current draft
```

Then resolve rules using the ordinary deepest-wins SPATIAL2 semantics.

This means:

```text
parent/child rule ownership stays correct
unrelated confirmed Pull rules remain active
confirmed Place rules remain downstream fixed composition
```

Do not use:

```text
current preview positions as next worker seed
current Sigma displayed positions
camera-normalized positions
fixed Place-composed positions
PHYSICS1 temporary File Move positions
```

as the preview worker's base seed.

---

## 6. Compose fixed Place after preview dynamic positions

A Pull preview changes the dynamic layer.

After the preview worker returns:

```text
base positions
+ preview dynamic positions
+ effective fixed Place rules
→ displayed preview
```

Use the same source-neutral spatial composition contract as confirmed rules.

Other saved Place rules should remain visible while previewing Pull.

If the same-root draft changed from a confirmed Place to Pull, replace that same-root rule in the effective draft set rather than applying both.

No fixed translation should feed back into the preview worker.

---

## 7. Preview strength and scope through the same seam

Once transient Pull preview exists, avoid a special anchor-only implementation.

A change to:

```text
strength
scope preset
root-file inclusion
custom inclusion/exclusion
```

changes the effective Pull geometry and should schedule one coalesced preview request.

However:

- ordinary hover/highlight pulses must not request preview physics;
- opening an editor on an unchanged confirmed rule should not recompute unnecessarily;
- an unruled folder may start from its default Pull/exact/70 draft, but do not visibly move geometry merely from opening the editor unless that draft actually differs from the displayed confirmed state and current UX clearly intends preview.

Preserve the existing dirty-draft semantics and accessibility announcements.

---

## 8. Pointer target remains immediate

The DOM/Sigma target marker owns pointer capture exactly as it does now.

During target dragging:

```text
pointer sample
→ marker position updates immediately
→ draft target text updates immediately
→ preview request is scheduled/coalesced separately
```

Do not make marker movement wait for worker completion.

Do not allow worker lag to steal pointer capture or stage pan ownership.

Wheel/trackpad behavior should remain the existing SPATIAL2B behavior.

---

## 9. Preview adoption should be camera-neutral and imperative

Apply preview positions through the renderer/session's existing spatial-position seam.

Do not route every node position through React state.

One completed preview result should produce at most one position adoption/renderer refresh transaction.

Do not trigger:

```text
KG6 projection
mapping
topology reconciliation
automatic Global layout
camera Fit
Density framing
Saved View matching writes
```

merely because the preview changes.

Instrumentation should make this provable.

---

## 10. Optional visual interpolation only if evidence requires it

First test direct application of coalesced preview-worker results.

If real/browser QA shows visible stepping between preview results, a short **display-only** interpolation between completed preview frames is acceptable.

If added:

```text
raw preview worker result = authoritative transient preview target
interpolated display = presentation only
```

Never feed interpolation coordinates back into the next preview worker.

Do not create a long easing queue. Newer target results should replace the current presentation target.

Camera remains untouched.

Do not add interpolation merely for aesthetic polish if the actual worker cadence already looks continuous.

---

# Commit / cancel handoff

## Cancel / Escape

When a Pull draft is cancelled:

```text
terminate/ignore active preview
clear pending preview input
restore exact confirmed dynamic + fixed composition
keep confirmed registry untouched
```

No preview coordinate survives as authoritative state.

## Persistence failure

If Apply/release persistence fails:

```text
draft remains/error is shown according to existing editor policy
preview must not become confirmed
restore or retain only behavior that is truthful to the existing write-before-adopt contract
```

Prefer returning to confirmed geometry rather than leaving a visually convincing unsaved rule presented as if it were saved.

## Successful Apply / target release

Preserve existing commit semantics.

When the complete rule is durably accepted:

```text
stop transient preview work
keep last valid preview displayed temporarily
→ ordinary confirmed SPATIAL2A pipeline runs full authoritative refinement
→ confirmed result + fixed composition adopts
→ transient preview ownership clears
```

Avoid:

```text
preview
→ snap back to old confirmed geometry
→ then move again to new confirmed geometry
```

The handoff should be preview → final authoritative result.

The final result still comes from the ordinary confirmed full worker/cache policy, not from the reduced preview result.

Only the final confirmed result may populate the authoritative spatial influence cache.

---

# Failure behavior

Preview is optional authoring assistance; confirmed graph correctness is not.

If a preview worker:

```text
fails
returns malformed output
times out according to existing worker boundary
is unavailable
```

then:

```text
keep the editor usable
keep marker/draft editing usable
show concise preview-unavailable status
restore/retain truthful confirmed geometry
do not persist anything automatically
```

A later draft change may retry if current service policy permits.

Do not report “Pull applied” when only the marker moved.

Do not convert preview failure into a Global layout failure.

---

# Interaction with PHYSICS1 / File Move

Arrange Folders already owns input while active.

Preserve:

```text
File Move cancelled/suspended while Arrange owns input
```

Do not run PHYSICS1 File Move and Pull preview simultaneously.

Do not reuse temporary File Move coordinates as preview seeds.

PR #103 currently overlaps Global session code; after rebasing, rerun:

```text
Arrange vs File Move arbitration
pointer ownership
Escape/cancel
worker laziness
```

No part of SPATIAL2C should change the All-300 / Focus-100 File Move limits.

---

# Performance / operation-count contract

Add instrumentation for preview-specific operations, for example:

```text
spatial-pull-preview-scheduled
spatial-pull-preview-request
spatial-pull-preview-worker
spatial-pull-preview-adopt
spatial-pull-preview-superseded/pending
```

Exact names are flexible.

Required properties:

```text
100 raw pointer samples
≠ 100 worker creations by default

visual marker updates
→ no automatic layout

preview adoption
→ no projection
→ no topology reconciliation
→ no automatic layout
→ no camera work
→ no authoritative cache write
```

Benchmark:

```text
request compute latency
end-to-end draft-change → preview adoption
request count vs pointer samples
main-thread adoption cost
final authoritative handoff
```

No CI timing gate.

Use p50/p95 local evidence where timing is meaningful.

---

# Tests

At minimum cover the following.

## Scheduling / supersession

```text
many target updates coalesce
only one preview request active
one newest pending request retained
no unbounded request queue
stale editor/layout generation cannot adopt
completed monotonic preview progress is not starved merely because pointer advanced
```

## Geometry ownership

```text
preview request starts from base automatic positions
same draft/path produces same preview request/result
preview does not seed from previous preview
fixed Place composes only after preview dynamic layer
same-root confirmed rule is replaced by draft, not doubled
deepest-wins membership stays correct
```

## Draft fields

```text
anchor drag previews
keyboard nudge previews
strength previews
scope preset previews
root-file toggle previews
custom inclusion/exclusion previews
hover/highlight-only changes do not run worker
```

## Commit / cancel

```text
Escape cancels and restores exact confirmed geometry
editor close restores confirmed geometry
write failure never leaves preview as confirmed
successful commit retains preview until authoritative adoption
authoritative result replaces preview once
authoritative cache receives final confirmed result only
preview never enters cache
```

## Place isolation

```text
Place keeps existing sparse rigid preview behavior
Pull ↔ Place switch leaves no stale preview geometry
Place-only edit still uses zero dynamic Pull workers where current contract says so
```

## Camera / UI

```text
preview causes zero Fit
zero density write
zero camera mutation
target marker stays exact during worker lag
stage pan/wheel rules remain current behavior
reduced-motion remains correct
```

## Concurrent systems

```text
Visual Groups unaffected
per-File Size unaffected
QUERY1/filter behavior unaffected
Saved View dirty-draft guard unaffected
File Move remains suspended/cancelled while Arrange owns input
```

---

# Browser / native QA

Build a fresh optimized desktop executable.

Use the real vault.

Required acceptance:

### Primary Pull target drag

```text
1. All + Network.
2. Arrange Folders.
3. Select a meaningful folder with several visible Files.
4. Behavior = Pull.
5. Drag target slowly:
   → marker follows pointer immediately;
   → cluster starts moving before release;
   → connected surrounding Files react softly.
6. Drag target quickly across a large distance:
   → graph can lag, but keeps making live progress;
   → it must not remain completely still until release.
7. Hold target still without releasing:
   → preview converges toward a stable draft presentation rather than continuously restarting.
8. Release:
   → no old-layout flash;
   → full authoritative refinement takes over;
   → final geometry is consistent with the preview direction.
```

### Strength

```text
change 0 → low → medium → high
```

The draft should visibly change before Apply. Strength 0 should preview the no-Pull/base behavior truthfully.

### Scope

Switch:

```text
This folder
Folder + subfolders
Custom
```

and toggle an exclusion. Effective members should change in the preview before Apply.

### Cancel

Move the Pull target substantially, then Escape/Cancel:

```text
exact confirmed graph returns
registry unchanged
```

### Place regression

Switch behavior to Place and verify its current direct rigid preview still works exactly as before.

### Camera / interaction

During Pull preview:

```text
no automatic Fit
no Density change
wheel/trackpad behavior remains correct
```

Use camera movement only if the current target-drag ownership permits it under existing product rules.

---

# Evidence gate

The first implementation should reuse the existing finite SPATIAL2A worker.

Do not introduce a persistent Pull-preview physics engine unless the measured replacement-worker preview fails at the user's ordinary vault scale.

If the current worker approach cannot provide useful live updates around ~300 visible documents after:

```text
coalescing
separate preview worker ownership
reduced preview iterations
```

then stop and report:

```text
preview request latency
worker creation/supersession cost
quality at tested iteration counts
recommended next architecture
```

Possible later architectures can then be considered explicitly.

Do not quietly make PHYSICS1 responsible for folder-rule authoring.

---

# Likely implementation areas

Inspect current code first; probable areas:

```text
packages/renderer-sigma/src/GlobalGraphCanvas.tsx
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/spatial-influence.ts
packages/renderer-sigma/src/types.ts
packages/renderer-sigma/src/spatial-rule-canvas.test.tsx
packages/renderer-sigma/src/arrangement-canvas.test.tsx
packages/renderer-sigma/src/arrangement-session.test.ts

apps/web/src/workers/global-spatial-influence-worker-client.ts
apps/web/src/workers/global-spatial-influence-worker-client.test.ts
worker/session factory ownership in the lazy renderer integration

docs/ARCHITECTURE.md
docs/PERFORMANCE.md
packages/renderer-sigma/README.md
apps/web/README.md

history-implementations/
```

A small new preview-controller module is preferable if it keeps high-frequency scheduling out of the already-large `GlobalGraphCanvas.tsx`.

Do not create a new package unless repository ownership clearly requires one.

---

# Validation

Follow current `AGENTS.md`.

Use current equivalents of:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/renderer-sigma
pnpm exec vitest run apps/web/src/workers
pnpm exec vitest run apps/web

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Add a focused Pull-preview analyzer/benchmark only if useful, e.g.:

```text
pnpm benchmark:spatial-pull-preview
```

No external dependency is expected.

No timing threshold in CI.

---

# Exit gate

SPATIAL2C is complete only when:

1. Pull target movement visibly changes graph geometry before commit.
2. Marker remains immediate even if graph preview lags.
3. Pull strength changes preview live.
4. Scope membership changes preview live.
5. Draft preview uses base automatic positions, not previous preview output.
6. Existing confirmed Pull rules outside the edited root remain represented.
7. Deepest-wins semantics remain correct.
8. Fixed Place composes after preview dynamic geometry.
9. Place's existing rigid preview is unchanged.
10. Raw pointer events are coalesced; no unbounded worker queue exists.
11. Preview has isolated worker/service ownership and cannot cancel authoritative Pull settlement.
12. Stale preview generations never adopt.
13. Preview results never enter authoritative Pull cache.
14. Preview results never persist.
15. Cancel restores exact confirmed geometry.
16. Persistence failure cannot leave unsaved preview masquerading as confirmed.
17. Successful commit transitions preview → authoritative result without an old-layout flash.
18. Final authoritative algorithm/iterations remain unchanged.
19. Automatic Global layout remains unchanged.
20. Camera/Density remain unchanged.
21. File Move remains mutually exclusive with Arrange.
22. Current Visual Groups, per-File Size, QUERY1, Saved Views and inspector behavior remain intact.
23. Small/medium automated tests pass.
24. `pnpm check` passes.
25. desktop check/build pass.
26. real-vault native Pull-preview QA passes.
27. concurrent PRs/worktrees remain untouched or are cleanly rebased if merged first.
28. exact prompt is archived.
29. task branch/worktree cleanup occurs only after accepted merge.
30. no separate PHYSICS1/persistent preview architecture is started automatically.

---

# Final report

Report:

## Result

```text
Pull preview behavior:
Preview iteration budget:
Scheduling/coalescing policy:
Preview worker ownership:
```

## Draft fields supported

```text
anchor
strength
scope
root-file/custom exclusions
```

State any deliberately deferred field.

## Geometry ownership

Explain:

```text
base
preview dynamic
fixed
displayed
confirmed authoritative
```

and prove preview does not contaminate upstream state/cache.

## Performance

Report:

```text
pointer/draft samples
preview requests
p50/p95 worker compute
end-to-end preview adoption
100 / ~300 / ~1,000 node evidence
```

Distinguish Node/worker timing from browser/native visual evidence.

## Commit / cancel

Describe rollback and preview → authoritative handoff.

## Tests / QA

State automated, browser, desktop build, and native checks separately.

## Files / dependencies

Expected external dependency additions: zero.

## Follow-up

If live Pull preview is successful, note whether a later task should extend preview polish to other folder-arrangement behaviors. Do not start that work automatically.
