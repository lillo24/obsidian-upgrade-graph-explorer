# Shared workspace overlay

This folder owns only the application-level modal boundary shared by Arguments
and AI Review. It keeps both feature sessions mounted, delegates unsaved-change
decisions to the active feature, and owns focus containment, Escape routing,
native modal inertness, and launcher focus restoration.

- `WorkspaceOverlay.tsx` composes the independent feature panels and routes
  top-level area changes through the Arguments leave guard.
- `workspace.css` owns the restrained 94vw × 93dvh chrome and responsive shell.

Argument authoring and review capture/history remain in their feature folders;
the graph only supplies launchers and an overlay-open signal.
