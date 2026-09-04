# NETWORKSETTINGS1 — Shared Reference Pull + Shared Network Visual Controls

**Task type:** settings architecture cleanup + cross-renderer behavior alignment

## Goal

Start from current `main`:

```text
71216f79b1f14d687961698649532bdc26466a6f
```

Make controls that conceptually belong to **Network** work consistently in both:

```text
All + Network
Focus + Network
```

Specifically:

```text
Reference Pull
Base node size
Link thickness
Label threshold
```

Keep genuinely All-specific spatial controls All-only:

```text
Folder clustering
Folder clustering strength
Spacing
Folder separation
```

Do not change Hierarchy renderers.

---

## Current architecture to respect

Both All and Focus use ForceAtlas2, but the existing Reference Pull implementations are not literally the same parameter:

### All Network

Current Global layout uses:

```ts
edgeWeightInfluence: settings.linkForce
```

### Focus Network

Current Local layout has:

```ts
hierarchyWeight: 6
referenceWeight: 1
edgeWeightInfluence: 1
```

and multiplies reference-edge weights by `referenceWeight`.

So implement **one user-facing Reference Pull concept**, but do not naively assume the internal numeric parameters are mathematically identical.

Default behavior at the current default value must remain unchanged.

---

# 1. Shared Reference Pull

The Settings UI should expose one:

```text
Network

Reference Pull
Weak ───────────── Strong
```

It must affect:

```text
All + Network
Focus + Network
```

### All

Continue controlling the existing Global reference-force behavior.

### Focus

Plumb the same user-facing setting into Local ForceAtlas2 reference attraction.

It must affect **reference edges only**, not change the established Local hierarchy pull.

Changing Reference Pull while:

```text
All + Network
→ Global relayout

Focus + Network
→ Local relayout
```

Changing it in either Hierarchy mode should not affect that renderer.

Preserve the atomic/no-flicker relayout behavior already merged from FLICKER1.

---

# 2. Do not duplicate settings state

Do not create:

```text
allReferencePull
focusReferencePull
```

unless evidence shows separate values are actually necessary.

The desired product model is:

```text
Reference Pull
= Network-level preference
```

Prefer extracting/adapting a shared Network settings subset while maintaining backward compatibility with the existing persisted `GlobalLayoutSettings`.

Avoid a persistence migration if the existing stored `linkForce` can safely remain the canonical persisted value.

Important: once Reference Pull becomes shared, changing:

```text
Compact
Normal
Spacious
```

must **not silently overwrite the user's Reference Pull value**.

Audit `withGlobalSpacingPreset()` accordingly.

---

# 3. Shared visual controls

Move these conceptually under Network and make them affect both Sigma renderers:

```text
Base node size
Link thickness
Label threshold
```

They must remain **render-only**.

Changing them must produce:

```text
0 Global layout requests
0 Local layout requests
0 ForceAtlas2 work
0 Pull requests
0 layout fingerprint changes
0 cache invalidations
```

## Base node size in Focus

Do not mutate Local canonical/layout node sizes just to make the UI work.

Focus currently has intentional relative sizes such as:

```text
root
document
section
block
diagnostic
```

Preserve those proportions.

Apply the shared Base node size as a **display-time scale** relative to the existing Focus defaults.

It must compose correctly with:

```text
per-file Size overrides
Focus-root emphasis
Visual Groups
```

The current default setting must produce the exact current Focus appearance.

## Link thickness in Focus

Apply it at render/style reduction only.

Do not alter:

```text
reference weight
hierarchy weight
layout edge weight
ForceAtlas2
```

Preserve Focus LOD thinning behavior; the shared thickness should compose with it.

## Label threshold in Focus

Focus currently has both:

```text
semantic LOD label visibility
Sigma labelRenderedSizeThreshold
```

The shared Label Threshold should control the appropriate Sigma/display threshold without breaking the semantic LOD rules.

It may suppress labels that are otherwise eligible.

It must **not reveal labels that Focus LOD intentionally hides**.

---

# 4. Settings organization

Reorganize Sandbox approximately as:

```text
Sandbox

Focus
└─ Focus Root appearance

Network
├─ Reference Pull
├─ Base node size
├─ Link thickness
└─ Label threshold

Network Density
├─ All Network Density
└─ Focus Network Density

All Network
├─ Folder clustering
├─ Folder clustering strength
├─ Spacing
├─ Folder separation
└─ other genuinely All-only controls

Experimental
└─ ...
```

Keep scope visually obvious.

`Link influence on node size` can remain All-only in this task; do not broaden it automatically.

---

# 5. Preserve defaults

This change is primarily about **scope and ownership of controls**, not retuning defaults.

At default settings:

```text
All Network appearance/layout
= unchanged

Focus Network appearance/layout
= unchanged
```

Reference Pull default must reproduce the current:

```text
Global linkForce = 1
Local referenceWeight = 1
```

behavior.

Shared visual defaults must reproduce current All and Focus visuals exactly.

---

# 6. Validation

Add tests proving:

### Reference Pull

```text
weak/default/strong
→ changes Global reference attraction

weak/default/strong
→ changes Focus reference attraction

Focus hierarchy attraction remains unchanged
```

Use deterministic fixtures containing both hierarchy and reference edges.

### Shared visuals

For All and Focus:

```text
Base node size changes visible node radius
Link thickness changes visible edge width
Label threshold changes eligible labels
```

with zero layout requests.

### Persistence

Reload/restart preserves the shared settings correctly.

Existing persisted settings migrate/read without data loss.

### Spacing presets

Changing:

```text
Compact
Normal
Spacious
```

must preserve:

```text
Reference Pull
Base node size
Link thickness
Label threshold
```

once they are treated as independent/shared Network choices.

### Scope

Verify:

```text
Folder clustering
Folder strength
Folder separation
All-only spacing physics
```

still do not affect Focus.

### Regression

Preserve:

```text
SPACING1B density framing
FLICKER1 atomic relayout
VISUAL1B per-file Size overrides
GLOBALVIS1 render-only guarantees
Visual Groups
camera ownership/history/Fit
```

---

# Validation commands

Run at minimum:

```bash
pnpm check
pnpm desktop:check
pnpm desktop:build

pnpm benchmark:local-renderer
pnpm benchmark:global-renderer -- --profile small
```

Run any relevant Global/Local layout and visual regression suites directly as well.

Perform production-browser graphical QA in both All and Focus.

Build a fresh release executable for native QA.

---

# Git / workflow

Create a new task branch from current `main`.

Use one focused PR.

Do not reopen or reuse old PR #60 branches.

Archive this prompt under:

```text
history-implementations/NETWORKSETTINGS1_shared_reference_pull_network_visual_controls_codex_prompt.md
```

Do not modify ROADMAP unless current repository workflow explicitly requires it.

---

# Final report

Report:

1. shared Reference Pull architecture;
2. how the shared value maps into Global vs Local ForceAtlas2;
3. confirmation Local hierarchy weight is unaffected;
4. shared visual-settings architecture;
5. how Focus Base node size composes with existing per-file Size overrides;
6. confirmation visual controls are render-only in both renderers;
7. persistence/backward-compatibility approach;
8. Settings before/after;
9. files changed;
10. tests/benchmarks/builds;
11. native executable path + SHA-256;
12. any deviations or remaining concerns.
