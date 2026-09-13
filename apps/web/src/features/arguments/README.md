# Arguments feature map

This folder owns the application-level Arguments workspace. It is independent
of graph projection and rendering; the graph shell only hosts its launcher and
requests open/close transitions.

- `ArgumentsWorkspace.tsx` owns onboarding, modal UI, drafts, navigation,
  search, source binding/previews, import previews, and confirmed-snapshot
  exports. Its owner remains mounted above report-keyed graph remounts.
- `ArgumentRecordView.tsx` presents Topic, Axiom, Counter-Argument, source
  status, and metadata reading views. The injected source section remains an
  application concern.
- `TheorySourceReferences.tsx` presents registered locators, safe plain-text
  source previews, full-file version/freshness disclosure, and explicit source
  baseline controls.
- `ArgumentRecordEditor.tsx` owns schema-shaped authoring controls, including
  reusable memberships, response links, targets, and the advanced lossless
  source-reference JSON field.
- `retrieval-editor.ts` retains raw retrieval textarea text during editing and
  normalizes it into the existing arrays only at Save.
- `session.ts` owns the single repository/authoring session, serialized reload
  and mutations, immutable reader replacement, atomic multi-operation Save,
  and the expected-snapshot source-baseline transaction.
- `platform-store.ts` selects the browser profile store or desktop app-local
  store once on first access. It never falls back across platforms.
- `argument-overlay.ts` owns modal scroll lock, nested Escape order, focus
  containment, and visible focus restoration.
- `context-export.ts` formats complete core reader bundles; it does not recreate
  closure logic and always discloses that linked theory text was not read.
- `source-capture.ts` is the narrow app-owned authorization boundary over a
  committed desktop inventory. It exposes safe source metadata, explicit
  binding, and immutable captures for selected registered Markdown locators;
  it never exposes the absolute vault root or desktop runtime.
- `source-preview.ts` owns retained source-preview identity and keys.
- `source-packet.ts` wraps an unmodified core bundle/receipt with source-capture
  provenance, deduplicated exact passages, per-reference receipts, failures,
  completeness, and a verifiable outer fingerprint. The fingerprint covers
  every envelope field except `packetFingerprint` itself.
- `markdown-directory-export.ts` preserves the core export's safe relative
  directory layout beneath a directory explicitly selected by the user.
- `arguments.css` owns the responsive 94vw by 93dvh two-pane surface.

Imports are explicitly selected at runtime and limited to 5 MiB before parsing.
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
