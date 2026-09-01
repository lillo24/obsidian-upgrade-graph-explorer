# Visual Groups

Status: **STABLE — GROUP1A source-neutral classification backbone.**

This package turns ordered QUERY1 rules into renderer-safe node presentation.
It exists so Structure, Global, Local Free, and Local Structured can classify
the same canonical entity once by `EntityId` without putting visual concerns in
KG6 projection or reproducing query semantics in a renderer. GROUP1A supplies
the backbone and style seams only; GROUP1B user-facing configuration is pending.

## File map

- `src/types.ts` defines the serializable definition, fixed color tokens,
  renderer-safe presentation, validation issues, and `EntityId` map contract.
- `src/palette.ts` owns the deterministic eight-token palette and CSS-safe
  accent metadata. Durable data stores only the token.
- `src/compile.ts` validates/canonicalizes definitions, compiles QUERY1 once,
  applies ordered matching, and derives primary presentation maps.
- `src/index.ts` exposes the source-neutral public API.
- `src/index.test.ts` proves validation, bounds, priority, all-match behavior,
  QUERY1 reuse, palette safety, and canonical-ID assignment.

## Contract

```ts
interface VisualGroupDefinition {
  readonly name: string;
  readonly query: string;
  readonly color: VisualGroupColor;
  readonly enabled: boolean;
}
```

Names are trimmed to 1–64 characters, definitions are limited to 24, queries
are canonical QUERY1 strings after validation, colors are one of `teal`,
`blue`, `violet`, `magenta`, `red`, `orange`, `amber`, or `green`, and enabled
is an explicit boolean. Arbitrary CSS, parsed ASTs, membership lists, renderer
IDs, coordinates, Saved Filter references, and layout state are never durable.

Array order is priority: the first enabled matching group wins. The primary
API short-circuits on that match; the separate all-match API returns every
enabled match in the same order for a later Inspector. Disabled definitions are
validated and retained but excluded from the active evaluator path.

`compileVisualGroups()` parses every definition once. Per-entity matching calls
QUERY1's `matchesGraphQuery()` over canonical `AddressableEntity` values; it
does not reimplement path, title, kind, level, or Boolean behavior. A successful
match resolves to `{groupName, color, accent}`. Renderers receive only a
`ReadonlyMap<EntityId, VisualGroupNodePresentation>` and never receive queries,
ASTs, registries, or parsers.

Visual Groups are live derived presentation. They do not filter or project,
do not change topology, do not style edges, do not cluster layout, and do not
belong in canonical snapshots, KG6 state, graph-view persistence, NAV1 history,
semantic viewport state, or DISC1 counts. The web app owns strict schema-v1
workspace registry persistence and visible-entity map derivation. No membership
cache is stored.

## Validation

```bash
pnpm --filter @icarus-graph-explorer/visual-groups typecheck
pnpm exec vitest run packages/visual-groups
pnpm benchmark:visual-groups
```
