# VISUAL1B QA correction — simplify per-file Size UI only

Native QA found that the current Size editor has the wrong product model.

Do **not** investigate or change the Network relayout/flicker behavior in this correction yet. That will be analyzed separately.

Keep PR #51 draft/unmerged.

## Problem

The current UI exposes:

```text
Network size

Size
Auto | Custom

Size multiplier
0.50× ─────●───── 2.50×

Relative to automatic Network size...
```

This is conceptually misleading.

The File is already automatically sized by the global Network rules:

```text
base size
+
link-count influence
=
automatic size
```

The per-file control is only a multiplier/boost applied on top of that automatic result.

Therefore `Auto` versus `Custom` is unnecessary and confusing.

A custom value of `1.0×` is not a different sizing mode from “Auto”; it means:

```text
automatic size × 1.0
```

Likewise:

```text
1.3×
=
whatever automatic size this File currently has
× 1.3
```

If the File later gains more links and its automatic size changes, the per-file multiplier should continue to apply to that new automatic size.

## Desired UI

Replace the current Auto/Custom selection and explanatory copy with one simple control:

```text
Size

0.50× ─────────●──────── 2.50×
               1.30×

Reset
```

or the closest styling consistent with the existing Network Explorer action menu.

### Semantics

- No stored override:
  - slider displays `1.00×`.
- Moving the slider:
  - immediately stores that multiplier.
- `1.00×` is a valid visual value but does not need to be described as “Auto”.
- `Reset`:
  - removes the stored override;
  - returns the control to `1.00×`.
- Do not expose `Auto`, `Custom`, or a mode selector.
- Do not tell the user they are switching between automatic/custom sizing.
- Keep the concept of the automatic base sizing internal.

The concise accessible explanation, if one is useful, can be:

```text
Adjust this File relative to its calculated Network size.
```

Do not show a long permanent explanation unless needed for accessibility.

## Accessibility

The range should expose something like:

```text
aria-label="File size"
aria-valuetext="1.30 times calculated Network size"
```

`Reset size` must be keyboard accessible.

Keep current Escape/focus restoration behavior in the node-actions editor.

## Existing architecture to preserve

Do not change:

- `packages/presentation-overrides`;
- EntityId/workspace persistence;
- multiplier range unless UI testing reveals a clear issue;
- All + Network vs Focus + Network eligibility;
- QUERY1 Hide behavior;
- Network Explorer virtualization;
- Visual Groups;
- view-state schema;
- renderer sizing formula;
- layout inputs/fingerprints;
- ForceAtlas2;
- worker requests;
- cache behavior.

Again: **the graph movement/flicker during slider changes is explicitly out of scope for this correction.**

We will diagnose that separately.

## Tests

Update focused UI tests to prove:

1. Auto/Custom `<select>` is gone.
2. Slider is always present.
3. No override displays `1.00×`.
4. Moving from `1.00×` to another value calls `onChange(value)`.
5. Reset calls `onChange(undefined)`.
6. After Reset, slider returns to `1.00×`.
7. Existing persisted override appears at its stored multiplier.
8. keyboard range input still works.
9. Escape/focus behavior remains correct.
10. unsupported node kinds still do not expose Size.

Run the focused UI tests and normal formatting/typecheck required for the touched files.

Do not merge PR #51 after this correction. Native QA is still blocked by the separate Network-layout flicker issue.
