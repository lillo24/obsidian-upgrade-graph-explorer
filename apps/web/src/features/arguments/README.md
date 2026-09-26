# Arguments feature map

This folder owns the application-level Arguments workspace. It is independent
of graph projection and rendering; the graph shell only hosts its launcher and
requests open/close transitions.

- `ArgumentsWorkspace.tsx` owns onboarding, drafts, navigation, search, source
  binding/previews, separate additive Insert JSON and full-library Import JSON
  dialogs, human Proposal resolution, and confirmed-snapshot
  exports. It exposes a
  narrow leave guard and embedded panel to the shared workspace modal while
  retaining a standalone wrapper for tests.
- `ProposalMailbox.tsx` owns the human-readable pending/history review surface:
  intent and target previews, compact local Argument context, typed dependency
  cards, structured reasoning, and source observations kept separate from
  inference premises.
- `proposal-mailbox.ts` owns shared target-staleness derivation used by the
  Mailbox and human resolution panel.
- `ArgumentRecordView.tsx` presents Topic, Context/Axiom Group, Axiom, Argument, Counter-Argument,
  Current/source status, direct versus inherited premise staleness with compact
  cause paths, separate relation staleness, and metadata reading views. The
  injected source section remains an application concern.
- `TheorySourceReferences.tsx` presents registered locators, safe plain-text
  source previews, full-file version/freshness disclosure, and explicit source
  baseline controls.
- `ArgumentRecordEditor.tsx` owns schema-shaped authoring controls, including
  scoped stable-ID Examples, ordered stable-ID premises and Example provenance,
  prior-premise reuse, attack/support relations, Boundary/Invariance,
  ordered Context Axiom membership, single-parent Context inheritance,
  Argument background attachment, reusable memberships, part-level response targets, and the advanced lossless
  source-reference JSON field.
- `retrieval-editor.ts` retains raw retrieval textarea text during editing and
  normalizes it into the existing arrays only at Save.
- `session.ts` owns the single repository/authoring session, serialized reload
  and mutations, immutable reader replacement, atomic multi-operation Save and
  Insert JSON commits, atomic Proposal resolutions, and the expected-snapshot
  source-baseline transaction.
- `platform-store.ts` selects the browser profile store or desktop app-local
  store once on first access. It never falls back across platforms.
- `argument-overlay.ts` remains the focus/escape implementation used by the
  shared workspace host and the standalone Arguments test wrapper.
- `context-export.ts` formats complete core reader bundles; it does not recreate
  closure logic and always discloses that linked theory text was not read.
- `source-capture.ts` is the narrow app-owned authorization boundary over a
  committed desktop inventory. It exposes safe source metadata, explicit
  binding, and immutable captures for selected registered Markdown locators;
  it never exposes the absolute vault root or desktop runtime. Each capture
  also reports whether capture limits retained the entire selected set, so a
  strict Review session can disable source reads instead of exposing a subset.
- `source-preview.ts` owns retained source-preview identity and keys.
- `source-packet.ts` wraps an unmodified core bundle/receipt with source-capture
  provenance, deduplicated exact passages, per-reference receipts, failures,
  completeness, and a verifiable outer fingerprint. The fingerprint covers
  every envelope field except `packetFingerprint` itself.
- `markdown-directory-export.ts` preserves the core export's safe relative
  directory layout beneath a directory explicitly selected by the user.
- `arguments.css` owns the responsive 94vw by 93dvh two-pane surface. Its
  surface, control, focus, and status colors inherit the application semantic
  tokens; it owns no separate OS or root-theme override.

Full-library imports are explicitly selected at runtime and limited to 5 MiB
before parsing. Insert JSON uses the same size ceiling but a distinct,
strictly validated additive format; users may select a local `.json` file or
paste and edit the document manually before its non-mutating preview.
Confirmation persists the prepared candidate once against the previewed snapshot. Dirty
editor drafts retain the existing Save/Discard/Stay guard. The format and
neutral example are documented in
[`docs/ARGUMENT_WORKSPACE_INSERT_JSON.md`](../../../../../docs/ARGUMENT_WORKSPACE_INSERT_JSON.md).
Schema-v1/v2/v3/v4/v5 imports surface a migration notice and use the core deterministic
migration; no Argument, Example/provenance, relation, or Current pointer is
inferred. V3 migration adds empty Context storage and empty Argument Context
bindings only; v4 migration adds only an empty Proposal Mailbox. Context
background remains visibly separate from inference premises and never
participates in premise staleness.

The Mailbox header count and pending/history tabs expose non-canonical AI
Proposals separately from the canonical record browser. Details lead with Topic,
intent, human-readable target/part, staleness, and a compact local Argument
context; typed premises and expandable dependencies are distinct from drafting
source observations and compact commit provenance. Accept carries only typed
premises into the ordinary Argument editor. `attack` and `support` intent may
seed the corresponding canonical relation, while refinement, extension, and
boundary intent seed no attack; supersession and Current promotion remain
separate human choices. Reject requires a human response plus resolved outcome.
Save performs one expected-snapshot transaction, while Cancel and dirty-draft
guards preserve the pending Proposal. Opening the Mailbox reloads first so local
MCP submissions become visible.

Canonical pending-review Arguments and Counter-Arguments remain available
through the Proposals-only filter; they are distinct from the Mailbox. Current
promotion and premise/relation reassessment require explicit confirmation and
remain expected-snapshot commits. Inherited premise staleness disables local
reassessment until upstream inference dependencies have been reassessed; reads
never advance pinned revisions.
Source capture is limited to 24 registered references, 16 Markdown files, one
million UTF-16 characters per file, four million captured characters total,
and four concurrent reads. Packets request at most 64,000 characters per
passage and 256,000 passage characters total. Blocks remain explicitly
unsupported because the parser proves only marker spans, not complete block
extents. Browser report/sample mode has no source bodies and reports source
content unavailable.

Document versions use
`icarus-full-document-sha256-canonical-json-v1:<digest>`, derived from the exact
complete source string with the core canonical fingerprint algorithm. This is
a full-file content identity, not a Git SHA. Core read payloads separately keep
their `returned-excerpt` fingerprint. Captures remain immutable for their
lifetime; a new committed runtime revision creates a new capture generation,
while a new source session also invalidates the explicit binding.

Reads, refreshes, previews, and exports do not write the Argument Library or
theory. Only the confirmed “Record this source version” action stores
`sourceSpaceHint` (when absent) plus the full-file `sourceVersion`; it preserves
review state and outcome and follows normal conservative record-revision and
response-staleness rules. No seed, source body, graph state, draft, or search
state is production content.
