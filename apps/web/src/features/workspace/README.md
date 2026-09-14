# Shared workspace overlay

This folder owns only the application-level modal boundary shared by Arguments
and AI Review. It keeps both feature panels mounted, delegates unsaved-change
decisions to the active feature, and owns focus containment, Escape routing,
native modal inertness, and launcher focus restoration. `App` owns and opens
the Argument session before passing it into this presentation boundary.

- `WorkspaceOverlay.tsx` composes the independent feature panels and routes
  top-level area changes through the Arguments leave guard. It does not create
  the Argument session or the Review compiler provider.
- `workspace.css` owns the restrained 94vw × 93dvh chrome and responsive shell.

Argument authoring and review capture/history remain in their feature folders;
the graph only supplies launchers and an overlay-open signal.
