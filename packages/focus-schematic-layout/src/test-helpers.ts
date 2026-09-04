import type { FocusSchematicLayoutInput } from './types';
import { FOCUS_SCHEMATIC_LAYOUT_SETTINGS } from './settings';
import type { graphFixture } from '../../focus-schematic/src/test-fixture';

type Fixture = ReturnType<typeof graphFixture>;

export function layoutInput(
  fixture: Fixture,
  settings: FocusSchematicLayoutInput['settings'] = FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
): FocusSchematicLayoutInput {
  const visible = new Set(
    fixture.model.modules.flatMap(
      ({ visibleEntityNodeIds }) => visibleEntityNodeIds,
    ),
  );
  return {
    model: fixture.model,
    projection: fixture.projection,
    nodeDimensions: fixture.projection.nodes
      .filter(
        (node): node is Extract<typeof node, { kind: 'entity' }> =>
          node.kind === 'entity' && visible.has(node.id),
      )
      .map((node) => ({
        projectionNodeId: node.id,
        ...(node.entityKind === 'document'
          ? { width: 200, height: 80 }
          : node.entityKind === 'section'
            ? { width: 184, height: 72 }
            : { width: 152, height: 64 }),
      }))
      .sort((left, right) =>
        left.projectionNodeId < right.projectionNodeId
          ? -1
          : left.projectionNodeId > right.projectionNodeId
            ? 1
            : 0,
      ),
    settings,
  };
}
