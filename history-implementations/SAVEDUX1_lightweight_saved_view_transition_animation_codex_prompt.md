# SAVEDUX1 — Lightweight Saved View load transition

**Task type:** UI polish / motion design / performance-sensitive presentation

## Goal

Add a very short, distinctive, **extremely lightweight** visual transition when a Named Saved View becomes the active working context.

The desired feeling is approximately:

```text
Language Focused
View loaded

→ dark/glass/ink/venom-like jagged pieces retract toward a point near center
→ text has a tiny cartoony anticipation
→ then the title smoothly accelerates away to the right
```

The effect should feel custom rather than like a generic fade, but it is **decorative only**. If a distinctive version cannot remain cheap and stable, prefer a simpler text/fade/slide version. Performance and graph correctness outrank the animation.

## Repository and current state

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Relevant completed milestones:

```text
SAVED1A       Named semantic Saved Views
SAVED1B       profile snapshots + quick switch
POST-SAVED1B1 fixed the pre-existing Network generation race,
              hardened render-time Saved View matching,
              and moved the sole switcher immediately left of Search
```

POST-SAVED1B1 is merged and accepted.

Before editing:

1. inspect `AGENTS.md`;
2. start from latest `main`;
3. inspect current open PRs/worktrees;
4. use a dedicated branch/worktree;
5. do not touch unrelated worktrees, `.pnpm-store/`, AI Review, Argument Workspace, or unrelated local state.

Current repository evidence at prompt-writing time:

- Saved View Apply finishes its product transaction in `GraphExplorer.tsx`, then emits an accessibility announcement such as `Applied Saved View "Language Focused" as Focus Network.`
- Current Saved View identity is **derived**, not persisted.
- POST-SAVED1B1 intentionally made render-time matching nonfatal.
- The single Saved View switcher is now in the top-left search-control region immediately before Search.

Re-inspect current code because newer `main` wins over this prompt.

---

# Core product behavior

Show the transition in two cases.

## A. Explicit Saved View switch/apply

Examples:

```text
quick switch:
Current View → Language Focused

Manage Saved Views:
Apply "Architecture Overview"
```

After the Saved View Apply transaction succeeds, show:

```text
Language Focused
View loaded
```

Do **not** animate on failed Apply. Do not animate while Apply is still known to have failed persistence/validation.

## B. App startup / vault reopen when Current View exactly matches a Named Saved View

Current product behavior remains:

```text
startup
→ restore Current View
→ restore current preferences/spatial registry
→ derive exact matching Named Saved View
→ do NOT reapply that Saved View
```

If startup/reopen derives an exact Named Saved View match, show the same small transition once:

```text
Language Focused
View loaded
```

This must not cause an Apply, layout, write, or viewport request.

If startup resolves only to:

```text
Current View
```

show nothing.

---

# Important: no persisted active Saved View

Do not introduce:

```text
activeSavedViewId
lastAnimatedSavedView
startupSavedView
```

into persistence.

Use existing derived matching truth. Animation/session bookkeeping must be memory-only.

---

# Motion concept

The desired direction is not a full-screen cinematic transition.

Think:

```text
brief overlay over the graph
~250–400 ms total
small amount of geometry
static jagged fragments
GPU-friendly transforms
```

Visual idea:

```text
      \  \      |      /  /
       \   irregular  /
        \   shards   /
          →   •   ←

       Language Focused
          View loaded

     tiny anticipation → title exits right
```

The fragments can feel like:

- retracting black/dark glass;
- ink/venom pulling back toward a central point;
- a broken-surface pattern collapsing inward;
- organic but crisp enough to fit the graph UI.

Do **not** try to simulate liquid physics. Do **not** generate particles. Do **not** animate a real fracture mesh. The illusion should come from a few static shapes moving with transforms.

---

# Performance budget

This requirement is hard.

The effect must be negligible compared with graph rendering.

Preferred implementation:

```text
plain React/DOM
+ CSS
+ transforms
+ opacity
```

Strongly prefer:

```text
6–10 static pieces maximum
```

Each piece can be:

- a simple absolutely positioned element with `clip-path: polygon(...)`, or
- a small inline SVG polygon if that is measurably cleaner.

Animate only compositor-friendly properties where possible:

```text
transform
opacity
```

Avoid:

```text
Canvas animation
WebGL animation
shader effects
particle systems
requestAnimationFrame loops
SVG path morphing
large filter chains
backdrop-filter
blur
box-shadow animation
layout-property animation
hundreds of DOM nodes
continuous timers
```

No dependency should be added. Do not use Framer Motion or another animation library.

---

# Hard fallback rule

If the distinctive shard/ink effect:

- causes visible graph frame drops;
- introduces layout work;
- causes WebView/native instability;
- complicates Saved View apply timing;
- requires JS frame loops;
- is visually poor at normal app scale;

then remove the shards and ship only:

```text
Saved View name
View loaded
small anticipation
quick rightward exit
```

The feature is successful even with the simpler fallback if it feels polished and costs essentially nothing.

---

# Suggested timing

Exact values can be tuned during browser/native QA.

Target total:

```text
280–420 ms
```

Possible phases:

```text
0–70 ms
  title appears / tiny anticipation left or slight compression

0–220 ms
  jagged pieces retract toward center / disappear

150–340 ms
  title tilts very slightly upward on the right,
  then accelerates smoothly off to the right

~340 ms
  overlay unmounts
```

Keep it fast enough that repeated Saved View switching never feels blocked. Do not force the user to wait for the animation before interacting.

---

# Text motion direction

The user described a cartoony anticipation similar to a character/car preparing to accelerate:

```text
small movement left
→ slight right-side-up tilt
→ fast smooth exit to right
```

Interpret this subtly. Do not create a literal Looney Tunes imitation or exaggerated bounce.

Suggested motion:

```text
translateX(0)
→ translateX(-6px), rotate(-1deg)
→ translateX(10px), rotate(2deg)
→ translateX(80–140px), opacity 0
```

Tune based on real dimensions. The visual should feel playful, not childish.

---

# Overlay behavior

The overlay must:

```text
pointer-events: none
```

It must never steal:

- click;
- keyboard focus;
- hover;
- wheel;
- pan;
- zoom;
- drag;
- Saved View dropdown focus.

It should be purely visual and accessibility-neutral.

Use a reasonable z-index above graph content but below product-level emergency/error surfaces if such layering exists. Do not cover native menus. Do not change graph layout dimensions.

Prefer a fixed/absolute overlay that occupies the graph workspace without affecting layout.

---

# Accessibility

Respect:

```css
@media (prefers-reduced-motion: reduce)
```

Reduced motion behavior:

```text
name + "View loaded"
brief opacity-only appearance
or no visual transition
```

No shards flying/retracting.

Do not duplicate the existing Saved View accessibility announcement with a second noisy live region. The current Apply path already announces success.

The visual overlay should normally be:

```text
aria-hidden="true"
```

unless current accessibility architecture strongly suggests otherwise.

---

# What should trigger it?

Create a narrow event/seam such as:

```ts
SavedViewVisualTransition {
  name: string
  token: number
  origin: 'apply' | 'startup-match'
}
```

Names/types may differ.

The event must be emitted only when there is a truthful successful transition.

## Explicit Apply

Use the existing successful Apply boundary.

Do not trigger before:

- validation;
- settings/spatial persistence transaction;
- semantic state adoption.

Do not trigger on failed Apply.

## Startup exact match

Trigger after the app has:

- hydrated the workspace Current View;
- loaded current graph preferences/spatial registry;
- loaded Saved Views;
- derived the final exact matching Saved View name for the initial workspace state.

Do not trigger from every render where `matchingNamedView` is truthy.

Use a session-only guard keyed appropriately to the current source/workspace session.

---

# "Loaded" timing vs graph geometry

Do not build a complicated new renderer synchronization architecture just for this animation.

First inspect the current final-generation viewport/readiness seams.

Preferred policy:

### If there is already a clean final-ready signal

Use it so the transition text appears when the relevant final graph generation/viewport is accepted.

### If there is no clean narrow signal

Trigger on the **successful Saved View product transaction**, and let the ~300 ms overlay naturally cover the beginning of layout adoption.

Do not:

- add a new worker protocol;
- block Apply waiting for animation;
- block interaction;
- poll renderer state;
- create a requestAnimationFrame readiness detector;
- add arbitrary multi-second delays.

Document which seam was chosen and why.

---

# Startup transition guard

The startup animation must happen at most once for one workspace/source session.

Example:

```text
open vault
→ Current View exactly matches "Language Focused"
→ animate once
```

Then ordinary state updates that continue matching:

```text
viewport observation
preference hydration completion
live source update
React rerender
```

must **not** replay the animation.

If the user later explicitly applies another Saved View:

```text
→ animate normally
```

If they explicitly apply the same Saved View again:

- if Apply is accepted as a real user action, one transition is acceptable;
- do not suppress it merely because the state was already identical.

---

# Rapid switching / interruption

Test:

```text
A → B → C quickly
```

The animation must not queue three long overlays.

Use latest-wins presentation behavior.

Acceptable:

```text
A starts
→ B replaces it
→ C replaces B
→ C completes
```

Do not create an animation queue.

Avoid stale timeouts unmounting a newer animation. Use an incrementing token/key or equivalent safe lifecycle.

---

# Component boundary

Prefer a dedicated small component, for example:

```text
SavedViewTransitionOverlay.tsx
```

or equivalent.

It should own:

- visual DOM;
- animation classes;
- auto-unmount lifecycle;
- reduced-motion presentation.

`GraphExplorer` or the relevant product owner should own:

- when the transition is triggered;
- the Saved View name;
- latest-wins token.

Do not put Saved View persistence or matching logic inside the animation component.

---

# CSS architecture

Keep animation definitions in existing app styles unless repository conventions suggest a colocated file.

Use clear scoped names, e.g.:

```text
.saved-view-transition
.saved-view-transition__shard
.saved-view-transition__title
.saved-view-transition__subtitle
```

Avoid global element selectors. Avoid CSS that changes Sigma/React Flow transforms. No wildcard transitions.

---

# Visual constraints

The overlay should work in:

```text
All + Network
Focus + Network
All + Hierarchy
Focus + Hierarchy
normal mode
maximized mode
320px width
large desktop window
```

Do not assume graph center is screen center if the workspace has side drawers. Use the actual graph workspace surface as the positioning context.

The visual can still originate near the center of that surface.

At very narrow widths, reduce the number/extent of shards if necessary.

---

# Relationship with the top-left Saved View switcher

POST-SAVED1B1 established:

```text
[ Saved View ][ Manage ][ Search ]
```

Do not move or redesign that again.

The animation must not shift that row. The quick switch should remain immediately left of Search.

No overlay should obscure the control long enough to impair fast consecutive switching.

---

# Preserve the POST-SAVED1B1 renderer fix

Do not touch the Network generation/physics guard unless strictly necessary.

The recent white-screen root cause was:

```text
adjacent layout generations
→ mismatched automatic/dynamic node-key sets
→ spatial composition invariant throw
```

POST-SAVED1B1 fixed this by blocking physics initialization during the authoritative layout handoff.

SAVEDUX1 must not:

- introduce renderer generation coupling;
- add camera/layout requests;
- retrigger physics;
- cause stale geometry adoption;
- alter filter behavior.

This task is presentation-only.

---

# No graph work from animation

Hard operation contract:

```text
show animation
→ 0 projection
→ 0 layout
→ 0 spatial worker request
→ 0 camera command
→ 0 Saved View persistence write
→ 0 Current View write caused solely by animation
```

Animation state changes may cause normal React rendering of the overlay component only.

Add instrumentation/regression where practical.

---

# No animation on unrelated changes

Do not trigger for:

```text
changing query manually
changing filters manually
changing Scope manually
changing Layout manually
changing settings manually
editing Arrange Folders
pan/zoom
Search navigation
Back/Forward
Current View hydration that does not exactly match a Named Saved View
Saved View Save
Saved View Update
Saved View Rename
Saved View Delete
```

Only:

```text
successful Named Saved View Apply
startup/reopen exact Named Saved View match
```

---

# Testing

Add focused component and integration tests.

## Visual component

Test:

1. renders name/subtitle;
2. is pointer-events none structurally/style-wise where testable;
3. unmounts after completion;
4. latest token replaces prior animation;
5. stale timeout cannot close a newer transition;
6. reduced-motion variant does not rely on shard movement.

Do not test exact millisecond browser animation frames in unit tests.

## Apply integration

Test:

```text
successful quick-switch Apply
→ transition event with correct name
```

and:

```text
failed Apply
→ no transition
```

Also:

```text
Manage → Apply
→ same transition path
```

Do not fork behavior between quick switch and manager Apply.

## Startup

Test:

```text
Current View exactly equals Named View A
→ transition A once
→ no Saved View Apply
→ no profile write
→ no layout caused by transition
```

and:

```text
Current View does not match
→ no animation
```

and rerender/hydration stabilization:

```text
same startup match remains true
→ still only one animation
```

## Rapid switch

```text
A → B → C
→ latest visible transition is C
→ stale A/B lifecycle cannot remove C
```

---

# Browser QA

Use production/minified build.

Test at least:

```text
normal desktop
maximized
320 × 640
large desktop
prefers-reduced-motion
```

Use at least two Saved Views with short names and one long name.

Evaluate:

1. switch A → B;
2. switch B → A;
3. rapid A → B → A;
4. manager Apply;
5. exact startup/reload match;
6. Current View startup with no match;
7. graph remains interactive during animation;
8. pan/zoom immediately after switching;
9. Search/Saved View controls do not move;
10. no console warnings/errors.

---

# Native QA

Build a fresh optimized Windows executable.

User checklist should be concise:

```text
1. Open vault with a Saved View that matches Current View.
   → one quick load animation.

2. Switch Saved View A → B.
   → fast animation, no lag.

3. Switch B → A quickly.
   → latest animation wins, no stacking.

4. Pan/zoom immediately during/after animation.
   → interaction remains smooth.

5. Toggle Unresolved/Ambiguous once.
   → no animation and no white screen.

6. Confirm Saved View control is still immediately left of Search.
```

If native computer control is unavailable, leave the PR draft for user acceptance.

---

# Performance QA

The feature should be cheap enough that formal timing gates are probably unnecessary.

Still inspect:

- Performance panel/devtools if available;
- compositor behavior;
- layout/paint events;
- graph operation counters.

Hard expectations:

```text
no JS frame loop
no graph operations
no animation queue
no persistent mounted overlay
```

Prefer the browser compositor.

If `clip-path` animation itself proves expensive on the target WebView, keep polygon shape static and animate only transform/opacity.

If even that is poor, use the fallback text-only transition.

---

# Implementation workflow

Use one prompt/one PR for SAVEDUX1.

This is small enough to stay together because it is one trigger contract, one presentation component, one CSS effect, one startup guard, and one QA surface.

At completion:

1. archive this exact prompt under `history-implementations/`;
2. add `SAVEDUX1_implementation_status.md`;
3. update roadmap/docs briefly;
4. open a dedicated PR;
5. run CI;
6. keep native acceptance truthful;
7. merge only after required native acceptance;
8. verify post-merge CI;
9. clean only this task's branch/worktree.

---

# Likely files/areas

Inspect first; exact edits are up to repository evidence.

Likely:

```text
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/SavedViewsPopover.tsx
apps/web/src/components/EntitySearch.tsx
apps/web/src/components/README.md

apps/web/src/App.css

apps/web/src/saved-view.ts
apps/web/src/components/saved-views-integration.test.tsx

possibly a new:
apps/web/src/components/SavedViewTransitionOverlay.tsx
apps/web/src/components/SavedViewTransitionOverlay.test.tsx

docs/ROADMAP.md
docs/PRODUCT_QUALITY_AUDIT.md
history-implementations/
```

Do not force changes in all listed files. Do not alter the Saved Views registry schema.

---

# Validation

Follow current `AGENTS.md`.

Expected commands, adapted to current repository reality:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run apps/web

pnpm check
pnpm desktop:check
pnpm desktop:build

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile small

git diff --check
```

A renderer package test run is required only if renderer code is unexpectedly touched. Ideally SAVEDUX1 does not touch renderer packages.

---

# Exit gate

SAVEDUX1 is complete only when:

1. successful Saved View Apply triggers the visual transition;
2. failed Apply does not;
3. quick-switch and manager Apply use the same trigger path;
4. exact startup Named View match triggers once;
5. unmatched Current View startup triggers nothing;
6. startup does not reapply the Saved View;
7. no active Saved View identity is persisted;
8. animation bookkeeping is session-only;
9. transition is latest-wins under rapid switching;
10. stale timers cannot remove a newer transition;
11. overlay is pointer-events none;
12. overlay does not take focus;
13. accessibility announcement behavior is not duplicated noisily;
14. reduced-motion is respected;
15. no dependency is added;
16. no Canvas is used;
17. no WebGL animation is used;
18. no requestAnimationFrame animation loop is used;
19. no particle system is used;
20. no blur/backdrop-filter animation is used;
21. shard count remains small;
22. transforms/opacity are the primary animated properties;
23. graph layout dimensions never change;
24. Saved View/Search control row never moves;
25. quick switch remains immediately left of Search;
26. animation works in normal mode;
27. animation works in maximized mode;
28. animation works at 320px;
29. All Network works;
30. Focus Network works;
31. All Hierarchy works where available;
32. Focus Hierarchy works;
33. animation causes zero projection work;
34. animation causes zero layout work;
35. animation causes zero spatial worker work;
36. animation causes zero camera commands;
37. animation causes zero persistence writes by itself;
38. existing SAVED1A/B behavior is unchanged;
39. POST-SAVED1B1 filter regression remains fixed;
40. production-browser QA passes;
41. optimized desktop build passes;
42. native QA passes or remains explicitly gated;
43. prompt/status are archived;
44. PR CI passes;
45. post-merge CI passes after acceptance;
46. task branch/worktree cleanup completes.

---

# Final report

## Visual design

Describe the actual effect implemented and total duration.

## Trigger semantics

Explain explicit Apply and startup exact-match behavior.

## Readiness seam

State whether it triggers on successful product transaction or an existing final-ready signal, and why.

## Reduced motion

Describe behavior.

## Performance

Report:

```text
DOM node count
animation properties
graph operation counts
whether any JS animation loop exists
```

Expected: no JS loop.

## Rapid switching

Explain latest-wins lifecycle.

## Browser/native QA

Report normal/maximized/narrow/startup/rapid-switch results.

## Files changed

## Dependencies

Expected: none.

## Fallback decision

State whether the jagged retract effect was retained or simplified because of performance/visual quality.

## Remaining work

Keep separate:

```text
automatic last-vault reopen
PIN1
AUTO1
```

Do not start them automatically.
