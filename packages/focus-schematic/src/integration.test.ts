import { readFileSync } from 'node:fs';

import { parseObsidianDocument } from '@icarus-graph-explorer/adapter-obsidian';
import { resolveObsidianWorkspace } from '@icarus-graph-explorer/resolver-obsidian';
import {
  createProjectionWorkspace,
  projectLocalView,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';
import { describe, expect, it } from 'vitest';

import { createFocusSchematicModel } from './model';

describe('Markdown-to-Focus-Schematic integration', () => {
  it('preserves incoming, outgoing, two-hop, Heading, folder, and diagnostic semantics', () => {
    const paths = [
      'Root.md',
      'incoming/Source.md',
      'outgoing/Target.md',
      'outgoing/Deep.md',
    ] as const;
    const documents = paths.map((path) =>
      parseObsidianDocument({
        path,
        source: readFileSync(
          new URL(
            `../../../tests/fixtures/workspaces/focus-schematic/input/${path}`,
            import.meta.url,
          ),
          'utf8',
        ),
      }),
    );
    const resolved = resolveObsidianWorkspace({
      workspaceId: 'focus-schematic-integration',
      documents,
    });
    if (!resolved.ok) throw new Error(JSON.stringify(resolved.diagnostics));
    const workspace = createProjectionWorkspace(resolved.snapshot);
    const root = workspace
      .entities()
      .find(
        (entity) =>
          entity.kind === 'document' && entity.source.path === 'Root.md',
      );
    if (root === undefined) throw new Error('Missing synthetic root document.');
    const state: ViewProjectionState = {
      disclosure: {
        defaultDepth: 2,
        expandedEntityIds: [],
        collapsedEntityIds: [],
        includeBlocks: false,
      },
      focus: {
        rootEntityId: root.id,
        hops: 2,
        direction: 'both',
        hierarchyContext: 'ancestors-and-children',
      },
    };
    const projection = projectLocalView(workspace, state);
    const model = createFocusSchematicModel({ workspace, state, projection });

    expect(model.modules).toHaveLength(4);
    expect(model.relationships).toHaveLength(3);
    expect(model.diagnostics.map(({ status }) => status)).toEqual([
      'unresolved',
    ]);
    expect(model.folders.map(({ key }) => key)).toEqual([
      '.',
      'incoming',
      'outgoing',
    ]);
    expect(
      model.relationships.some(({ visibleEndpointGroups }) =>
        visibleEndpointGroups.some(
          ({ targetPrecision }) => targetPrecision === 'section',
        ),
      ),
    ).toBe(true);
  });
});
