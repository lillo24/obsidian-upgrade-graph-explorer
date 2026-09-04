Create a focused implementation task to fix the All Network camera “progressive zoom-out” bug.

This is NOT CONVERGENCE1C yet.

Current evidence strongly suggests a camera-policy bug:

- Global Sigma uses:
  minCameraRatio = 0.02
  maxCameraRatio = 6
- authoritative position adoption calls `measureDensity(positions)`
- when `cameraOwnership === "auto"`, `applyPositions(...)` can then do roughly:

  camera.setState({
    x: 0.5,
    y: 0.5,
    angle: 0,
    ratio: effectiveDensityRatio(),
  })

- repeated Re-layout can therefore:
  geometry adoption
  → density remeasurement
  → new automatic camera ratio
  → recenter/rezoom
  → repeat
  → eventually appear to reach a hard maximum zoom-out

The fact that repeated Re-layout eventually reaches an apparent zoom-out ceiling is especially consistent with the Sigma `maxCameraRatio = 6` clamp.

Do NOT merge this with CONVERGENCE1C.
Do NOT change Global ForceAtlas2 convergence in this task unless a narrow regression proves it is required for the camera fix.

==================================================
GOAL
==================================================

After the graph has initially been presented:

Re-layout
Reference Pull
Folder Separation
Folder Clustering Strength
Dynamic Pull Apply/Remove
Fixed Placement Apply/Remove
ordinary authoritative position adoption

must NOT implicitly change the camera framing.

These operations may move nodes.
They are not camera commands.

The intended product semantics are:

initial graph presentation
→ automatic density framing may choose a useful camera

then:

geometry / physics change
→ preserve current viewport framing

explicit Fit
→ recompute framing intentionally

Network Density control
→ may intentionally alter automatic framing

user pan/zoom
→ obviously changes framing

Search/navigation/Focus transitions
→ keep their existing explicit camera behavior

==================================================
FIRST: PROVE THE BUG
==================================================

Before changing code, add a browser/session regression around repeated Re-layout.

On a fresh All Network session, record for each authoritative layout adoption:

- `cameraOwnership`
- camera x/y/ratio
- `effectiveDensityRatio()`
- raw density decision ratio
- graph bounds
- raw graph point under viewport center
- raw graph-units-per-100px
- whether `measureDensity()` ran
- whether camera `setState()` / `animate()` ran
- whether Fit/center/navigation request ran
- requested camera ratio before Sigma clamping
- resulting camera ratio after clamp

Then:

Re-layout #1
Re-layout #2
Re-layout #3
...

Prove whether:
- camera ratio is progressively increasing;
- it eventually reaches/clamps at 6;
- graph geometry itself is moving little or a lot.

Also run the same diagnostics for:

- Reference Pull
- Folder Separation
- Folder Clustering Strength

This task must distinguish:

A. geometry changed
B. density measurement changed
C. camera framing changed

Do not infer from screenshots.

==================================================
ROOT DESIGN PROBLEM
==================================================

The current architecture appears to conflate:

1. measuring graph density
2. deciding what automatic framing WOULD be
3. actually applying that framing to the camera

Those must be separated.

`measureDensity(positions)` may legitimately run after geometry changes because diagnostics / future Fit need current density.

But:

measuring a new density
≠
permission to move the camera

Refactor toward something conceptually like:

measureDensity(...)
→ update density decision only

applyAutomaticDensityFraming(...)
→ changes camera
→ only called by explicit camera-owning events

Do not necessarily use those exact names.

==================================================
CAMERA OWNERSHIP / TRANSACTION POLICY
==================================================

The existing `"auto" | "user"` cameraOwnership flag is probably too coarse.

A camera may have originated from Auto framing while still needing to remain stable during later geometry mutations.

Do NOT fix this by simply pretending every untouched camera is `"user"` unless that is proven to be the cleanest model.

Prefer an explicit transaction/intent distinction such as:

camera-neutral geometry transaction
initial automatic framing
explicit Fit
explicit density-framing adjustment
semantic navigation
user camera interaction

The important invariant is:

position adoption alone
→ never grants permission to reframe camera

==================================================
REQUIRED CAMERA-NEUTRAL OPERATIONS
==================================================

After initial presentation, these should preserve the raw viewport:

- explicit Re-layout
- accepted automatic Global worker result
- Reference Pull physics result
- Folder Separation physics result
- Folder Clustering Strength physics result
- SPATIAL2 Dynamic Pull authoritative result
- SPATIAL2 Fixed Placement authoritative result
- Remove spatial rule
- Reset spatial rules
- dynamic cache-hit adoption
- fixed recomposition

For all of them:

preserve:
- raw graph point under viewport center
- raw visual scale
- camera angle

Do not:
- Fit
- center
- recalculate camera ratio from density
- reset x/y to 0.5
unless an explicit camera-owning operation asked for it.

FLICKER1's atomic graph-mutation/camera preservation must remain the underlying mechanism.

Do not create a second competing camera framework.

==================================================
OPERATIONS THAT MAY CHANGE CAMERA
==================================================

Preserve current intended behavior for:

1. Initial All Network mount
   - automatic density framing may choose the initial ratio.

2. Explicit Fit
   - intentionally recompute useful framing.

3. Network Density framing control
   - this is explicitly a camera/framing control.
   - changing it may update camera ratio according to its defined policy.

4. Search / center requests / semantic navigation
   - preserve existing behavior.

5. All ↔ Focus transitions and viewport history
   - preserve existing behavior.

6. user pan / zoom / touchpad
   - preserve existing behavior.

Do not make Re-layout equivalent to Fit.

==================================================
IMPORTANT DENSITY DETAIL
==================================================

Keep current density measurement up to date after geometry changes.

For example:

Re-layout
→ positions change
→ measureDensity(new positions)
→ store the new density decision
→ CAMERA STAYS WHERE IT IS

Later:

user clicks Fit
→ use the latest already-measured density decision
→ apply framing intentionally

Likewise:

user changes Network Density strength
→ use current density decision
→ change framing intentionally

So the fix is not “stop measuring density.”
It is “stop automatically applying density framing during unrelated position adoption.”

==================================================
INITIAL PRESENTATION BOUNDARY
==================================================

Define clearly when initial automatic framing ends.

Potentially:

mount
→ initial accepted positions known
→ measure density
→ apply initial automatic camera once
→ mark initial framing complete

After that:
→ ordinary position mutations are camera-neutral

If topology/source changes create an entirely new scene with no meaningful prior camera anchor, preserve existing FLICKER1 / semantic viewport policy.

Do not generalize this task into redesigning every topology transition.

==================================================
THE USER’S SPECIFIC REPRODUCTION
==================================================

Add a regression for:

fresh graph
→ Re-layout
→ Re-layout
→ Re-layout

Required:
- no progressive camera ratio increase;
- no progressive recenter;
- camera must not approach `maxCameraRatio = 6` solely from repeated Re-layout.

Then:

fresh graph
→ Reference Pull change
→ Reference Pull change / Re-layout

and:

fresh graph
→ Folder Strength change
→ Reference Pull change

The current strange observation was:
after touching Folder Clustering Strength, Reference Pull / Folder Separation sometimes stopped producing the same huge apparent zoom-out.

After the fix, the order of physics controls must not determine whether the camera is implicitly reframed.

Node geometry can still differ because physics changed.
Camera ownership cannot.

==================================================
TESTS
==================================================

Required regressions:

1. Fresh All Network initial mount still applies automatic density framing.

2. Re-layout after mount:
   - density can be remeasured;
   - camera ratio unchanged;
   - raw viewport center unchanged;
   - raw graph scale unchanged;
   - no x/y reset.

3. Re-layout 5×:
   - no progressive camera zoom-out;
   - ratio never marches toward maxCameraRatio from these transactions.

4. Reference Pull:
   - node geometry may change;
   - camera framing unchanged.

5. Folder Separation:
   - same invariant.

6. Folder Clustering Strength:
   - same invariant.

7. Dynamic Pull Apply:
   - same invariant.

8. Dynamic Pull Remove:
   - same invariant.

9. Fixed Placement Apply/Remove:
   - same invariant.

10. Reset all spatial rules:
    - same invariant.

11. Exact cache-hit position adoption:
    - same invariant.

12. Explicit Fit:
    - DOES change framing normally.

13. Network Density strength:
    - DOES change framing according to policy.

14. Search / center request:
    - still centers normally.

15. user pan/zoom:
    - still sets/maintains user ownership semantics.

16. initial restored semantic viewport:
    - remains authoritative over automatic framing.

17. no extra ForceAtlas2 request is introduced.

18. no KG6 projection work is introduced.

19. no duplicate Sigma process/render transaction is introduced.

20. FLICKER1 anchored-mutation tests remain green.

==================================================
DIAGNOSTIC ASSERTION
==================================================

Add at least one regression that proves the original failure would have happened:

before fix:
position adoption + auto camera
→ density ratio changes
→ camera ratio changes

after fix:
position adoption
→ density ratio may change internally
→ camera ratio stays unchanged

This should test the real session policy, not only a mocked pure function.

==================================================
DO NOT FIX CONVERGENCE HERE
==================================================

There is still a separate CONVERGENCE1C question:

same physics
→ repeated Re-layout may still move actual node coordinates because Global uses finite jobs

That remains a future task.

For this task, report geometry displacement separately.

If repeated Re-layout still visibly moves nodes after camera framing is fixed:
- quantify it;
- identify it as CONVERGENCE1C evidence;
- do not add convergence architecture here.

The success criterion here is:

camera does not move unless camera movement was explicitly requested.

==================================================
FOCUS / SHARED NETWORK SETTINGS
==================================================

PR #72 has now merged shared Network controls.

Do not reintroduce separate user-facing settings.

Focus has its own camera/density implementation and already uses Local convergence.

Inspect whether the same accidental “density remeasurement → camera write” bug exists in Focus.

If it does:
- fix through the same shared camera-intent principle where appropriate.

If it does not:
- do not modify Focus merely for symmetry.

Reference Pull remains one shared preference.

==================================================
PERFORMANCE
==================================================

The fix should be cheaper than current behavior.

Geometry adoption may still:
- update positions
- process Sigma
- measure density

But should not perform unnecessary camera writes / extra redraw sequences.

Record:
- position adoption count
- density measurement count
- camera mutation count
- Sigma process/render count

For a Re-layout:
expected camera mutation count after initial presentation = 0

==================================================
VALIDATION
==================================================

Run:

- focused Global renderer/session tests
- FLICKER1 camera tests
- density session tests
- spatial Apply/Remove tests
- shared Network settings tests
- `pnpm check`
- `pnpm desktop:check`
- `pnpm desktop:build`
- Global renderer benchmark
- production-browser QA

Browser QA must explicitly show:
- repeated Re-layout no longer zooms out;
- Reference Pull does not alter camera;
- Folder Separation does not alter camera;
- Folder Strength does not alter camera;
- Fit still works;
- Network Density still deliberately reframes.

Then build the optimized `.exe` and provide the exact path.

Native QA checklist:

1. open All Network;
2. wait for initial framing;
3. press Re-layout repeatedly;
4. verify no progressive zoom-out;
5. manually pan/zoom and repeat;
6. Reference Pull change;
7. Folder Separation change;
8. Folder Clustering Strength change;
9. Dynamic Pull Apply/Remove;
10. Fixed Place Apply/Remove;
11. explicit Fit;
12. Network Density;
13. physical touchpad pan/pinch;
14. no stuck camera / CSP / console / worker errors.

Do not merge until native QA is accepted if this branch uses a manual release gate.

==================================================
DOCUMENTATION
==================================================

Add/update a concise camera ownership rule:

“Density measurement and camera framing are separate operations. Network geometry changes may update density evidence but do not implicitly reframe an already presented graph. Initial presentation, explicit Fit, explicit Density framing, navigation, and user camera actions own camera changes.”

Update architecture/performance docs if needed.

Do NOT mark CONVERGENCE1C complete.

Archive this implementation prompt.

==================================================
FINAL REPORT
==================================================

Report:

1. exact root cause;
2. whether repeated Re-layout was hitting / approaching `maxCameraRatio = 6`;
3. before/after camera ratio evidence;
4. graph-geometry movement measured separately;
5. density measurement behavior;
6. new camera transaction/ownership rule;
7. Re-layout behavior;
8. physics-slider behavior;
9. Fit and Network Density behavior;
10. Focus impact, if any;
11. tests/browser/native QA;
12. optimized exe path;
13. dependencies;
14. files changed;
15. docs/ADR if any;
16. remaining CONVERGENCE1C evidence.

Do not start CONVERGENCE1C automatically.
