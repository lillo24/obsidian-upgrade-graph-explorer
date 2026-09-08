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
toggle, Compact/Normal/Spacious preset, and optional bounded Custom values.
NETWORKSETTINGS1 reuses its existing `linkForce`, `nodeSize`, `linkThickness`,
and `labelThreshold` fields as the canonical shared Network preference for both
All and Focus Network; no migration or duplicate Focus fields exist. Spacing
preset changes preserve those shared choices. The separate
`referenceDegreeSizeInfluence` percentage remains All-only. These values are
presentation preferences, not KG9 workspace state or persistent graph
coordinates. The defaults are `inverted`, `scroll-zoom`, and Normal with folder
clustering on; shared Network defaults resolve to Reference Pull `1`, Base node
size `4.5`, Link thickness `0.7`, and Label threshold `7`. Their Local adapters
reproduce the previous reference weight `1`, semantic-size scale `1`, width
scale `1`, and Sigma threshold `4`. The link-influence default is `50`, which
preserves the legacy Global degree-size curve. Older payloads load missing
Global settings from that default. Legacy Custom objects that predate the
influence field retain all existing values and normalize only the missing field
to `50`; an invalid field falls back independently so valid sibling preferences
survive.
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

HIER3B adds `focusHierarchyImplementation` to the same v1 record. The supported
values are `classic` and `modular-preview`; missing or malformed values resolve
to Classic. Reset Sandbox restores Classic while leaving Trackpad Zoom and the
Local Free/Structured choice intact. This is product exposure only: it does not
enter workspace state, history, projection, or persisted coordinates.

HIER4B-LIVE adds `modularFocusMacroLayout` and
`modularFocusSoftFolderStrength` to that same v1 record. Missing or malformed
macro values resolve to Directional Bands. Numeric strength clamps to 0–100;
invalid values resolve to 50. Strength is retained while Directional Bands is
active but has no Directional geometry or cache influence. Reset Sandbox
restores Directional Bands and 50 together with the existing Modular defaults.
The existing `modularFolderStripsVisible` boolean remains the persisted Folder
guides setting for compatibility. It defaults to On: Directional Bands renders
horizontal strips and Soft Folder Clusters renders spatial regions. The value is
consumed only after renderer adoption and never enters the model, worker, or
cache key.

SPACING1B-QA keeps separate All Network and Focus Network density-framing
strengths outside this durable record. Both start at 100% on every application
launch and exist only to compare legacy ratio 1 with each production density
decision during the current page lifetime. Changing either previews the camera
ratio immediately around that renderer's semantic anchor and does not request
layout or Pull work. Reset Sandbox restores both to 100% together with Focus
Root, All Network layout, and Experimental defaults; Trackpad Zoom, source
configuration, workspace view/history, spatial folder intent, and Local layout
choice are outside that reset.
