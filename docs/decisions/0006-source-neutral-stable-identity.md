# ADR 0006: Reconcile app-owned stable identity after canonical resolution

**Status:** Accepted

## Context

KG4 correctly assembles and resolves a complete canonical snapshot with
deterministic IDs derived from source locators. Those IDs are intentionally
transient: ordinary insertions change offsets and file renames change paths.
KG8 navigation and future KG9B view persistence need identity continuity, but
the low-level `SnapshotIdProvider` sees only path/offset locators and cannot
conservatively compare complete hierarchy or reference relationships.

Writing UUIDs into Markdown would make an application concern part of source
content, couple future adapters to one identity scheme, and violate the
local-read-only input boundary. Fuzzy matching would create plausible but
incorrect continuity when evidence is duplicated.

## Decision

Stable identity is app-owned private local state outside Markdown. KG4 keeps
producing a transient, correct schema-v1 `KnowledgeSnapshot`; a new
source-neutral package then reconciles the complete resolved snapshot against a
versioned observation catalog and emits the same canonical shape with remapped
opaque IDs.

Matching is staged, deterministic, one-to-one, and conservative. Exact source
evidence is preferred; unique graph-visible structural evidence may preserve
supported renames or moves. Ambiguous or weak evidence allocates new identity.
The foundation uses no fuzzy, semantic/AI, nearest-candidate, or input-order
matching.

The catalog is private and local because even its minimal observations can
contain paths, titles, fingerprints, and raw targets. It is runtime validated,
stored outside the selected vault, and never included in Markdown, diagnostic
reports, or renderer/view state. Its filesystem adapter and opaque workspace
UUID generation live outside the pure package.

## Consequences

KG4 resolution remains source-specific and independently testable, while the
identity layer can serve future source adapters. Stable remapping translates
entity parents and reference sources, targets, candidates, and IDs, then proves
that all non-identity canonical meaning is unchanged and reruns core validation.
Some rename/move cases intentionally receive new IDs when evidence is weak or
duplicated; false continuity is considered worse than lost continuity.

KG9B can persist renderer-independent view state against the resulting stable
workspace/entity IDs. KG10 can define deltas over the same identity boundary.
Neither consumer should depend on the textual stable-ID format. Historical
tombstones, view persistence, source write-back, fuzzy matching, and cloud sync
remain outside this decision.
