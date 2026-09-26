# Shared workspace overlay

This folder owns only the application-level modal boundary shared by Arguments
and AI Review. It keeps both feature panels mounted, delegates canonical and
To store draft decisions to the active feature, and owns focus containment, Escape routing,
native modal inertness, and launcher focus restoration. `App` owns and opens
the Argument session before passing it into this presentation boundary. It may
also place an app-owned, non-blocking notice above the active Arguments panel;
the workspace does not own the native operation behind that notice.

- `WorkspaceOverlay.tsx` composes the independent feature panels and routes
  top-level area changes through the Arguments leave guard. Embedded Arguments
  supplies compact Library / To store navigation without duplicating the
  workspace title or Close control. The shell does not create the Argument
  session or the Review compiler provider.
- `workspace.css` owns the restrained 94vw × 93dvh chrome and responsive shell.
  It inherits the application semantic tokens and owns no independent
  Light/Dark selector.

Argument authoring and review capture/history remain in their feature folders;
the graph only supplies launchers and an overlay-open signal.
