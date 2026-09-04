import type { FocusSchematicLayoutInput } from '@icarus-graph-explorer/focus-schematic-layout';
import { FOCUS_SCHEMATIC_LAYOUT_SETTINGS } from '@icarus-graph-explorer/focus-schematic-layout';
// Tool-only adapter: the reusable package never imports the renderer.
import { ENTITY_NODE_DIMENSIONS } from '../../../packages/renderer-reactflow/src/mapping';

import type { buildFixture } from './fixtures';

type BuiltFixture = ReturnType<typeof buildFixture>;

export const HIER2_RECORDED_RENDERER_DIMENSIONS = {
  document: { width: 200, height: 80 },
  section: { width: 184, height: 72 },
  block: { width: 152, height: 64 },
} as const;

export function assertRendererDimensionBaseline(): void {
  if (
    JSON.stringify(ENTITY_NODE_DIMENSIONS) !==
    JSON.stringify(HIER2_RECORDED_RENDERER_DIMENSIONS)
  )
    throw new Error(
      'HIER2 evidence is stale: renderer extended Focus dimensions changed.',
    );
}

export function createLayoutInput(
  fixture: Pick<BuiltFixture, 'model' | 'projection'>,
  settings: FocusSchematicLayoutInput['settings'] = FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
): FocusSchematicLayoutInput {
  assertRendererDimensionBaseline();
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
        ...ENTITY_NODE_DIMENSIONS[node.entityKind],
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
