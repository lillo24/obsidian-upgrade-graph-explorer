# UX2 — User-Facing Inspector Cleanup

## Goal

Turn the Inspector from a diagnostic dump into something useful while actually exploring ideas.

The normal Inspector should answer three simple questions:

```text
Node selected:
What is this?
Where is it?
What links to/from it?

Connection selected:
What does this line represent?
Which actual links caused it?

Broken/uncertain target selected:
What is wrong with this link?
Where might it have been intended to go?
```

Everything else should either disappear from normal view or move under collapsed **Technical details**.

---

# Product rule

A user should not need to understand:

- canonical entities;
- projection roles;
- reference IDs;
- source spans;
- rolled-up endpoints;
- provenance terminology;
- resolver states as implementation concepts.

Those concepts may remain available for debugging, but they are **not the product vocabulary**.

Do not remove underlying diagnostic information from the system. Change its presentation.

---

# 1. Simplify the Node Inspector

Current node view contains:

```text
kind
name
breadcrumb
source provenance

Projection Role
Focus Distance
Canonical Descendants
Structurally Hidden

relationship counts

Outgoing References
Backlinks
Ambiguous Candidate Mentions
Internal Relationships Hidden by Current Collapse
Internal Occurrences
```

Normal node Inspector should instead look approximately like:

```text
Associated Value

Language.md › Associated Value › Feeling

12 outgoing links
7 backlinks

Outgoing
────────────────
Fear
Emotions.md › Fear

Goal Planning
Planning.md › Goals


Backlinks
────────────────
Reward
Emotions.md › Reward

Planning
Goals.md › Planning


▸ Technical details
```

Exact visual design is flexible.

## Header

Show:

- human-readable node name;
- simple type if useful: File / Section / Block;
- breadcrumb/path.

Do not display implementation vocabulary such as:

```text
canonical
projection
entity
```

unless Technical details is expanded.

Breadcrumb navigation should continue to work.

---

# 2. Make outgoing links readable

Current occurrence cards expose:

- resolution badge;
- link/embed kind;
- raw target;
- exact source;
- source provenance;
- Reference ID;
- resolved target;
- reason;
- ambiguity metadata.

That is too much for every single link.

For a normal **resolved outgoing link**, show only useful information.

Example:

```text
→ Fear
  Emotions.md › Fear
```

Potentially show `embed` subtly if it genuinely matters.

The user should be able to click the destination and navigate there.

Do not show by default:

- Reference ID;
- exact source offsets;
- canonical terminology;
- resolution implementation details;
- repetitive “resolved” labels when nothing is wrong.

A correctly resolved normal link should look normal.

---

# 3. Make Backlinks equally simple

Backlinks should answer:

> Where is this thing referenced from?

Example:

```text
Backlinks 7

Reward
Emotions.md › Reward

Planning
Goals.md › Planning
```

The major value over ordinary file-level backlinks is that Graph Explorer knows the **specific section** where the link originates.

Expose that clearly.

If:

```text
Emotions.md
  # Reward
    ## Prediction
```

contains the link, ideally show something like:

```text
Prediction
Emotions.md › Reward › Prediction
```

Clicking it should navigate there.

Do not expose `Reference ID` or resolver internals simply to prove that the backlink exists.

---

# 4. Redesign Connection / Edge Inspector

When a reference edge is selected, title it something intuitive such as:

**Connection**

Then show:

```text
Associated Value → Emotions

This visible connection represents 3 links:

Feeling
Associated Value.md › Feeling
→
Fear
Emotions.md › Fear

Goal Planning
Associated Value.md › Goal Planning
→
Reward
Emotions.md › Reward

Engineering
Associated Value.md › Engineering
→
Emotions.md
```

The core question is:

> **Why does this line exist?**

The current labels:

```text
Visible projected relationship
canonical occurrence
Aggregated Provenance
Displayed through visible source/target ancestor
```

should not be primary UI vocabulary.

If sections are collapsed and several exact links become one visible graph edge, explain that simply:

```text
3 links are grouped into this connection because some sections are currently collapsed.
```

Only show that sentence when aggregation is actually happening.

---

# 5. Simplify hierarchy edges

A hierarchy edge is not a “reference.”

For:

```text
File
↓
Section
```

or:

```text
Section
↓
Subsection
```

show something like:

```text
Structure

Associated Value
contains
Feeling
```

Potentially include breadcrumb/path navigation.

Do not say:

```text
Canonical structural containment.
No Reference ID is fabricated.
```

That belongs in Technical details, if anywhere.

---

# 6. Broken / uncertain links

These are different: here status information is actually useful.

## Unresolved

Show:

```text
Broken link

Target: Some Missing Note

No matching destination was found.
```

Then where it originated:

```text
From:
Planning.md › Goals
```

## Ambiguous

Show:

```text
Uncertain link

Target: Reward

More than one possible destination exists:
• Reward — Emotions.md
• Reward — Motivation.md
```

Keep the existing rule:

**Do not silently select one candidate.**

Candidates should be clickable so the user can inspect them.

## Invalid

Use similarly plain language:

```text
Invalid link

This link could not be interpreted as a valid destination.
```

If the underlying reason is understandable and useful, show it.

Avoid exposing parser/resolver vocabulary unless Technical details is expanded.

---

# 7. Introduce collapsed “Technical details”

Add one `<details>` section near the bottom:

**Technical details**

Collapsed by default.

This is where developer/debugging information can live.

Possible contents:

```text
Entity ID
Reference ID
Projection role
Focus distance
Exact source provenance/span
Resolution state/reason
Rolled-up source/target state
Canonical descendant count
Structurally hidden descendant count
Raw target
Internal occurrence metadata
```

Not every selected thing needs every field.

Do not invent a generic giant dump. Show only fields relevant to the selected object.

Technical details must not become another permanently expanded panel.

---

# 8. Internal relationships

The current Inspector prominently shows:

**Internal Relationships Hidden by Current Collapse**

and then an entire **Internal Occurrences** section.

Move it to Technical details by default.

There is one user-facing exception:

If hidden internal links materially explain something the user is seeing, a compact hint can appear:

```text
4 additional links are inside collapsed sections.
```

But don't render another huge list unless requested/expanded.

---

# 9. Ambiguous candidate mentions on ordinary nodes

The existing node Inspector has a full section:

**Ambiguous Candidate Mentions**

This means links that do not resolve to this node, but list it as one possible destination.

Move this under Technical details, perhaps labeled:

```text
Possible matches from uncertain links
```

Do **not** mix these with real backlinks.

Resolved backlink:

```text
This definitely links here.
```

Ambiguous candidate:

```text
This link might mean here, but Graph Explorer doesn't know.
```

That distinction must remain correct.

---

# 10. Relationship summary

Current:

```text
12 outgoing
7 backlinks
2 candidate mentions
4 internal
```

Normal view should probably become:

```text
12 outgoing · 7 backlinks
```

Candidate/internal counts can move into Technical details.

---

# 11. Pagination / large lists

Keep bounded rendering.

The existing `PAGE_SIZE = 20` and Show More behavior is reasonable.

Do not render hundreds of backlink cards at once just because the cards become simpler.

You can improve wording:

```text
Show 20 more
```

No architecture change required.

---

# 12. Inspector empty state

When Inspector is open and nothing is selected, keep this very small.

Something like:

```text
Select a file, section, or connection.
```

No explanatory paragraphs.

---

# 13. Responsive behavior

UX1 turns Inspector into an overlay/drawer at narrow widths.

Requirements:

- paths wrap sensibly;
- IDs inside Technical details don't blow out layout;
- long raw targets wrap;
- buttons remain reachable;
- no horizontal overflow;
- connection explanation remains readable vertically.

Test around `390px`.

---

# Implementation boundaries

Prefer changing:

```text
apps/web/src/components/ProvenanceInspector.tsx
apps/web/src/App.css
Inspector-focused tests
```

Small web-only presentation helpers are fine.

Ideally **do not modify `explorer-inspection` at all**, because it already exposes the information needed for this redesign.

Only touch `packages/explorer-inspection` if an essential human-facing datum genuinely cannot be produced from the existing inspection output.

If that happens:

- add the smallest source-neutral derived field/helper possible;
- do not weaken provenance correctness;
- explain why in the PR.

---

# Do not change

No changes to:

```text
canonical model
resolver behavior
reference resolution
ambiguity semantics
projection behavior
stable identity
view persistence
search
Focus
graph filtering
report generation
```

---

# Parallel KG10 constraint

UX2 can run alongside KG10.

Keep the diff primarily in the web Inspector.

Before merging:

```text
rebase latest main
resolve conflicts deliberately
pnpm check
```

Do not take ownership of KG10 source/incremental APIs.

---

# Explicitly out of scope

Do not implement UX3 here:

```text
Hover → temporary fade
Click → select without persistent fade
Focus → isolation
```

Do not add the heading-depth filter here.

Also out:

- performance optimization;
- Dagre changes;
- workers;
- Tauri;
- vault watching;
- source preview;
- open in Obsidian;
- editing Markdown;
- new graph analytics.

---

# Tests

Add focused tests covering at least:

### Node

- selected entity shows name and breadcrumb;
- outgoing links displayed;
- backlinks displayed;
- resolved links do not show Reference IDs in normal view;
- technical details collapsed by default;
- IDs available only after Technical details expansion;
- ambiguous candidate mentions do not appear as normal backlinks.

### Reference edge

- source and target displayed;
- underlying occurrences displayed;
- aggregated edge explains multiple actual links;
- technical “Aggregated Provenance” terminology isn't the normal section label.

### Hierarchy edge

- rendered as structural containment;
- no normal text mentioning fabricated Reference IDs/canonical containment.

### Diagnostics

- unresolved target gets understandable broken-link message;
- ambiguous target shows possible destinations;
- invalid target gets understandable error;
- ambiguous candidates remain unchosen.

### Accessibility

- Technical details is keyboard-expandable;
- relationship navigation buttons retain accessible labels;
- statuses aren't conveyed by color alone.

---

# Browser QA

Use synthetic report and, if available, the private Icarus report.

Test:

```text
open Inspector
→ select file
→ select # section
→ inspect backlinks
→ navigate backlink
→ inspect outgoing link
→ select aggregated edge
→ understand why edge exists
→ select hierarchy edge
→ select broken target
→ select ambiguous target
→ expand Technical details
→ close Inspector
```

Also test inside maximized graph mode.

At 390px verify:

- cards fit;
- paths wrap;
- no horizontal overflow;
- Technical details remains usable.

---

# Validation

```bash
pnpm check
git diff --check
```

No new dependency expected.

---

# Exit gate

UX2 is complete only when:

- [ ] node Inspector primarily shows human-readable name/location;
- [ ] outgoing links are understandable without technical vocabulary;
- [ ] backlinks clearly identify the exact source section;
- [ ] normal resolved links do not expose Reference IDs;
- [ ] edge Inspector answers “why does this connection exist?”;
- [ ] aggregated edges show their actual underlying links;
- [ ] hierarchy edges use simple containment language;
- [ ] unresolved links use plain broken-link language;
- [ ] ambiguous links show possible destinations without guessing;
- [ ] invalid links have understandable error presentation;
- [ ] technical metadata exists only under collapsed Technical details;
- [ ] Technical details defaults closed;
- [ ] candidate mentions aren't mixed with real backlinks;
- [ ] internal collapsed relationships aren't a dominant normal section;
- [ ] existing navigation still works;
- [ ] Show More/bounded lists still work;
- [ ] no resolution/provenance correctness lost;
- [ ] no schema change unless absolutely necessary;
- [ ] maximized Inspector works;
- [ ] 390px Inspector works;
- [ ] `pnpm check` passes;
- [ ] `git diff --check` passes;
- [ ] latest `main` reconciled before merge.

## Final report

Return:

1. Summary
2. PR + merge commit
3. Files changed
4. Node Inspector
5. Backlinks/outgoing presentation
6. Connection Inspector
7. Broken/ambiguous/invalid presentation
8. Technical details
9. Responsive behavior
10. Tests
11. Browser QA
12. Dependencies
13. Any inspection-model changes
14. Parallel KG conflict/rebase notes
15. Deviations
16. UX3 handoff

**Do not begin UX3 automatically.**
