# AI Review application feature

This folder owns the visible local AI Review workflow and its single
application-level controller. It uses REVIEW2 for authorized Git capture,
REVIEW1 for deterministic prompts/orchestration/results, and the independent
review-history store for persistence. Its application adapter exposes the
current confirmed Argument Library snapshot through REVIEW1's read-only
compiler protocol. It does not own graph state, argument records, native paths,
or a live model adapter.

```text
controller.ts            Source lifecycle, setup, capture, prompt previews,
                         history/imports, and optional injected engine runs.
argument-compiler-adapter.ts
                         Retained Argument snapshot/source translation into
                         REVIEW1 CompilerProvider sessions.
ReviewWorkspace.tsx      Source picker, preparation/editor/history UI.
ReviewResults.tsx        Lazily mounted individual/integrated/compare readers.
MarkdownRenderer.tsx     Safe GFM + bounded KaTeX presentation boundary.
markdown-security.ts     Shared inert/external URL policy for Markdown.
platform-store.ts        Desktop app-local or explicit browser-session store.
synthetic-qa-fixture.ts  Explicit development-only scripted result fixture.
review.css               Responsive history, reading, and bounded overflow.
```

New setups default to 1 first-parent commit. Changing N invalidates the old
preparation; refresh opens a fresh bounded native session. Captures contain
committed pinned-HEAD content only, keep changed/context/deleted roles, and are
complete only for explicitly selected paths. Closing the modal leaves the
controller and valid capture alive. Changing source disposes the native session
while saved entries retain their original opaque workspace identity and source.

Prepared records are model-optional and export with the heading
`PREPARED AI REVIEW — NOT AI CONCLUSIONS`. The production Run button remains
disabled because no live model provider is connected. The default controller
receives the application-owned compiler provider, while placement still
defaults to none and a run cannot start without an Agent provider. Tests can
inject source, history/run repositories, clock/IDs, agent provider, and compiler
provider. No model provider, vault read, or rerun starts on mount/import.

Desktop history is private app-local data, separate from the vault, Arguments,
and graph preferences. Browser history is visibly session-only. Records are
limited to 5 MiB and 500 items, never pruned silently. Imports are previewed and
deeply validated; exact repeats are idempotent and differing ID collisions are
rejected. Nonterminal history is marked interrupted when a new controller opens
it, including queued records with no attempts.

Markdown runs through `react-markdown` with GFM, `remark-math`, and locally
bundled KaTeX (`trust: false`, strict errors, bounded expansion/size). Raw HTML
is skipped, images never load, unsafe/relative protocols are inert, and safe
web/mail links require a click and open outside the app. Exact raw output stays
available if formatting is blocked or fails.

## Explicit synthetic QA

In development only, open AI Review and choose **Load Synthetic QA Fixture**.
The action runs the local scripted REVIEW1 engine, labels every result
`SYNTHETIC REVIEW OUTPUT — NOT AN AI CONCLUSION`, and presents an import preview.
Accept it to exercise formatted results and history without reading a vault or
calling a model. It is excluded from the production UI and never prepopulated.
