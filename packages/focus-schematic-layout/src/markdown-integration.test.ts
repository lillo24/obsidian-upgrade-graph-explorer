import { readFileSync } from 'node:fs';

import { parseObsidianDocument } from '@icarus-graph-explorer/adapter-obsidian';
import { createFocusSchematicModel } from '@icarus-graph-explorer/focus-schematic';
import { resolveObsidianWorkspace } from '@icarus-graph-explorer/resolver-obsidian';
import {
  createProjectionWorkspace,
  projectLocalView,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';
import { describe, expect, it } from 'vitest';

import { computeFocusSchematicComputedLayoutAttempt } from './endpoint-facing';
import { layoutInput } from './test-helpers';

describe('Markdown-to-HIER3A endpoint integration', () => {
  it('preserves document, Heading, alias, and Block target precision without source text', () => {
    const paths = [
      'Root.md',
      'File Target.md',
      'Heading Target.md',
      'Block Target.md',
    ] as const;
    const documents = paths.map((path) =>
      parseObsidianDocument({
        path,
        source: readFileSync(
          new URL(
            `../../../tests/fixtures/workspaces/focus-schematic-endpoints/input/${path}`,
            import.meta.url,
          ),
          'utf8',
        ),
      }),
    );
    const resolved = resolveObsidianWorkspace({
      workspaceId: 'focus-schematic-endpoint-integration',
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
    if (root === undefined) throw new Error('Missing endpoint fixture root.');
    const state: ViewProjectionState = {
      disclosure: {
        defaultDepth: 3,
        expandedEntityIds: workspace
          .entities()
          .filter(({ kind }) => kind === 'document' || kind === 'section')
          .map(({ id }) => id),
        collapsedEntityIds: [],
        includeBlocks: true,
      },
      focus: {
        rootEntityId: root.id,
        hops: 1,
        direction: 'outgoing',
        hierarchyContext: 'ancestors-and-children',
      },
    };
    const projection = projectLocalView(workspace, state);
    const model = createFocusSchematicModel({ workspace, state, projection });
    const attempt = computeFocusSchematicComputedLayoutAttempt(
      layoutInput({ workspace, state, projection, model }),
    );
    expect(attempt.status).toBe('success');
    if (attempt.status !== 'success') return;
    const endpointKinds = attempt.result.endpointPlan.connections
      .filter(({ kind }) => kind === 'precise')
      .map(({ source, target, referenceIds }) => ({
        source:
          source.kind === 'visible-entity' ? source.entityKind : source.kind,
        target:
          target.kind === 'visible-entity' ? target.entityKind : target.kind,
        referenceCount: referenceIds.length,
      }));
    expect(endpointKinds).toEqual(
      expect.arrayContaining([
        { source: 'document', target: 'document', referenceCount: 1 },
        { source: 'section', target: 'section', referenceCount: 2 },
        { source: 'section', target: 'block', referenceCount: 1 },
      ]),
    );
    expect(attempt.result.endpointPlan.summary).toMatchObject({
      preciseReferenceIdCount: 4,
      fallbackReferenceIdCount: 0,
      totalReferenceIdCount: 4,
    });
    const serialized = JSON.stringify(attempt.result.endpointPlan);
    expect(serialized).not.toContain('display');
    expect(serialized).not.toContain('Document-level target');
  });
});
