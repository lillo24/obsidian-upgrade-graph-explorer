# Graph preferences

This folder owns global, user-level graph interaction preferences. It is separate
from workspace view persistence because these settings apply to every vault and
must not be serialized into KG9 workspace state.

- `graph-preferences.ts` owns the defensive `localStorage` boundary for
  `icarus.graph-explorer.preferences.v1`.
- `graph-preferences.test.ts` verifies defaults, validation, exact serialization,
  and storage-failure behavior.

The stable v1 payload is `{ "trackpadZoomMode": "scroll-zoom" | "pinch-zoom" }`.
The default is `scroll-zoom`. If storage is unavailable, an in-memory change still
applies immediately for the current session and the Settings UI reports that it
will reset when the app closes.
