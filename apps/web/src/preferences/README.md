# Graph preferences

This folder owns global, user-level graph appearance and interaction preferences. It is separate
from workspace view persistence because these settings apply to every vault and
must not be serialized into KG9 workspace state.

- `graph-preferences.ts` owns the defensive `localStorage` boundary for
  `icarus.graph-explorer.preferences.v1`.
- `graph-preferences.test.ts` verifies defaults, validation, exact serialization,
  and storage-failure behavior.
- `sandbox-settings.ts` owns the deliberately narrow Sandbox reset boundary;
  its test proves Trackpad Zoom and Local layout choice survive that reset.

The stable v1 payload contains `focusAppearance` (`outline`, `inverted`, or
`minimal`), `trackpadZoomMode` (`scroll-zoom` or `pinch-zoom`), and one
serializable `globalLayoutSettings` value. Global settings own the soft folder
toggle, Compact/Normal/Spacious preset, and optional bounded Custom values,
including the All Network `referenceDegreeSizeInfluence` percentage. They are
presentation preferences, not KG9 workspace state or persistent graph
coordinates. The defaults are `inverted`, `scroll-zoom`, and Normal with folder
clustering on; the link-influence default is `50`, which preserves the legacy
degree-size curve. Older payloads load missing Global settings from that
default. Legacy Custom objects that predate the influence field retain all
existing values and normalize only the missing field to `50`; an invalid field
falls back independently so valid sibling preferences survive.
The storage key and schema version stay at
`icarus.graph-explorer.preferences.v1`. If storage is unavailable, an in-memory
change still applies immediately for the current session and the Settings UI
reports that it will reset when the app closes.

HIER0 adds `showExperimentalAllHierarchy` to the unchanged
`icarus.graph-explorer.preferences.v1` record. Only boolean `true` enables it;
missing, false, and malformed values load as Off. It controls product exposure,
not graph/view truth. GraphExplorer patches one current complete record for all
controls, so another preference cannot drop the flag; storage failure keeps the
session value and reports the existing warning. Disclosure open/closed state is
not stored.

SPACING1B-QA keeps Focus Network density-framing strength outside this durable
record. It starts at 100% on every application launch and exists only to compare
legacy ratio 1 with the production density decision during the current page
lifetime. Reset Sandbox restores it to 100% together with Focus Root, All
Network layout, and Experimental defaults; Trackpad Zoom, source configuration,
workspace view/history, and Local layout choice are outside that reset.
