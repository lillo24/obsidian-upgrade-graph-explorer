# Graph preferences

This folder owns global, user-level graph appearance and interaction preferences. It is separate
from workspace view persistence because these settings apply to every vault and
must not be serialized into KG9 workspace state.

- `graph-preferences.ts` owns the defensive `localStorage` boundary for
  `icarus.graph-explorer.preferences.v1`.
- `graph-preferences.test.ts` verifies defaults, validation, exact serialization,
  and storage-failure behavior.

The stable v1 payload contains both `focusAppearance` (`outline`, `inverted`, or
`minimal`) and `trackpadZoomMode` (`scroll-zoom` or `pinch-zoom`). The defaults
are `inverted` and `scroll-zoom`. A pre-UX4C payload containing only the trackpad
field loads with `inverted`; an invalid field falls back independently so a
valid sibling preference is preserved. The storage key and schema version stay at
`icarus.graph-explorer.preferences.v1`. If storage is unavailable, an in-memory
change still applies immediately for the current session and the Settings UI
reports that it will reset when the app closes.
