# Safe Markdown

This folder owns the shared web presentation boundary for untrusted Markdown.

- `SafeMarkdown.tsx` renders GFM and bounded KaTeX, skips raw HTML, blocks
  images, makes unsafe links inert, and preserves a visible raw fallback after
  rendering failure.
- `security.ts` owns the external URL allowlist used by the renderer.
- `safe-markdown.css` owns renderer layout and safety-state presentation using
  application theme tokens.
- `SafeMarkdown.test.tsx` verifies formatting and security behavior shared by
  AI Review and the Argument Proposal Mailbox.

Feature code supplies Markdown only. It must not add a second URL or raw-HTML
policy around this component.
