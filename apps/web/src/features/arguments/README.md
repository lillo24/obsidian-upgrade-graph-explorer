# Arguments feature map

This folder owns the application-level Arguments workspace. It is independent
of graph projection and rendering; the graph shell only hosts its launcher and
requests open/close transitions.

- `ArgumentsWorkspace.tsx` owns onboarding, drafts, navigation, search, import
  previews, and confirmed-snapshot exports. It exposes a narrow leave guard to
  the shared workspace modal while keeping a standalone wrapper for tests.
- `ArgumentRecordView.tsx` presents Topic, Axiom, Counter-Argument, source
  locator, status, and metadata reading views without resolving sources.
- `ArgumentRecordEditor.tsx` owns schema-shaped authoring controls, including
  reusable memberships, response links, targets, retrieval metadata, and the
  advanced lossless source-reference JSON field.
- `session.ts` owns the single repository/authoring session, serialized reload
  and mutations, immutable reader replacement, and atomic multi-operation Save.
- `platform-store.ts` selects the browser profile store or desktop app-local
  store once on first access. It never falls back across platforms.
- `argument-overlay.ts` remains the focus/escape implementation used by the
  shared workspace host and the standalone Arguments test wrapper.
- `context-export.ts` formats complete core reader bundles; it does not recreate
  closure logic and always discloses that linked theory text was not read.
- `markdown-directory-export.ts` preserves the core export's safe relative
  directory layout beneath a directory explicitly selected by the user.
- `arguments.css` owns the responsive 94vw by 93dvh two-pane surface.

Imports are explicitly selected at runtime and limited to 5 MiB before parsing.
No seed, source body, graph state, draft, or search state is production content.
