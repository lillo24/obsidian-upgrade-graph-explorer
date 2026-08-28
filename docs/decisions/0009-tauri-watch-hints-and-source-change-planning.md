# ADR 0009: Treat Tauri watch events as hints for source change planning

**Status:** Accepted

## Context

KG11A acquires one explicitly selected vault and retains its complete source
inventory, but filesystem watchers expose noisy, platform-dependent event
sequences rather than canonical source changes. Editors may save through
temporary files, directory operations may collapse or expand into different
events, and a rename label alone does not prove source continuity.

## Decision

The Tauri provider uses recursive filesystem `watchImmediate` as its raw
acquisition mechanism and owns one deterministic quiet-window plus hard-limit
coalescing policy. Native events are hints only. After each bounded batch, the
provider re-observes the affected files or directory subtrees using the KG11A
discovery policy, compares that state with the previous inventory, and returns
a platform-neutral source change plan.

Absolute paths and Tauri event types remain inside the provider. Unsafe,
out-of-root, root-wide, overflow/rescan, or inconsistent observations request a
full resynchronization instead of producing a success-shaped plan. Routine
directory activity uses targeted subtree reconciliation rather than a full
vault scan. A Markdown move is emitted only when one removed and one added path
have exact source equality that is unique in both complete inventories;
otherwise the atomic plan retains delete plus upsert.

KG11B1 does not apply plans to KG10, persist the resulting catalog/report, or
update UI state. Those orchestration and full-resync responsibilities belong to
KG11B2.

## Consequences

Equivalent noisy event bursts and the same final filesystem state produce the
same plan. Some real renames intentionally reparse as delete plus upsert when
continuity evidence is ambiguous. A watcher can request recovery without
performing an expensive scan itself, and future live orchestration does not
need to understand native event shapes.

Tauri filesystem plugin 2.5.1 forwards represented Notify `rescan` flags but
does not forward Notify callback errors to JavaScript. KG11B2 must retain an
explicit full-resync recovery path rather than treating the subscription as an
infallible change log.
