import { describe, expect, it } from 'vitest';
import type { FocusSchematicModule } from '@icarus-graph-explorer/focus-schematic';
import {
  buildEndpointFixture,
  computeFocusSchematicSoftClusterLayoutAttempt,
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  SOFT_CLUSTER_FIXTURES,
} from '@icarus-graph-explorer/focus-schematic-layout';

import type { GraphFlowNode } from '../types';
import {
  focusSchematicNodeDimensions,
  prepareFocusSchematicRendererGraph,
} from './index';
import { focusSchematicFolderClusterGuides } from './folder-cluster-guides';

function focusModule(
  id: string,
  folderKey: string,
  presentation: FocusSchematicModule['presentation'] = 'visible-content',
): FocusSchematicModule {
  return {
    id,
    documentEntityId: id,
    sourcePath: `${folderKey}/${id}.md`,
    folderKey,
    presentation,
    documentProjectionNodeId: presentation === 'filtered' ? null : id,
    visibleEntityNodeIds: presentation === 'filtered' ? [] : [id],
    hierarchyEdgeIds: [],
    internalReferenceIds: [],
    diagnosticIds: [],
    focusDistance: 1,
    incomingDistance: null,
    outgoingDistance: 1,
    placement: {
      allowedSides: ['right'],
      preferredSide: 'right',
      rankMagnitude: 1,
      preferredSignedRank: 1,
      reason: 'outgoing-only',
    },
  };
}

function moduleNode(
  moduleId: string,
  x: number,
  y: number,
  width = 120,
  height = 80,
): GraphFlowNode {
  return {
    id: `module-${moduleId}`,
    type: 'module',
    position: { x, y },
    width,
    height,
    measured: { width, height },
    data: { projectionNodeId: null, moduleId, root: moduleId === 'root' },
  } as GraphFlowNode;
}

describe('Soft Folder Cluster renderer guides', () => {
  it('renders singleton, capsule, and hull regions from exact visible membership', () => {
    const modules = [
      focusModule('root', '.'),
      focusModule('science-a', 'science'),
      focusModule('science-b', 'science'),
      focusModule('science-c', 'science'),
      focusModule('language-a', 'language'),
      focusModule('language-b', 'language'),
      focusModule('private', 'private', 'filtered'),
    ];
    const nodes = [
      moduleNode('root', 0, 0),
      moduleNode('science-a', 240, 0),
      moduleNode('science-b', 480, 0),
      moduleNode('science-c', 720, 0),
      moduleNode('language-a', 0, 260),
      moduleNode('language-b', 240, 260),
      moduleNode('private', 480, 260),
    ];

    const guides = focusSchematicFolderClusterGuides(modules, nodes, 'root');

    expect(guides.map(({ folderKey, shape }) => [folderKey, shape])).toEqual([
      ['.', 'singleton'],
      ['language', 'capsule'],
      ['science', 'hull'],
    ]);
    expect(guides.find(({ folderKey }) => folderKey === '.')?.root).toBe(true);
    expect(guides.find(({ folderKey }) => folderKey === '.')?.path).toBeNull();
    expect(
      guides.find(({ folderKey }) => folderKey === 'language')?.path,
    ).toContain('Q');
    expect(
      guides.find(({ folderKey }) => folderKey === 'science'),
    ).toMatchObject({
      memberModuleIds: ['science-a', 'science-b', 'science-c'],
      shape: 'hull',
    });
    expect(guides.some(({ folderKey }) => folderKey === 'private')).toBe(false);
  });

  it('splits clearly disconnected same-folder islands deterministically', () => {
    const modules = [
      focusModule('root', '.'),
      focusModule('split-a', 'science'),
      focusModule('split-b', 'science'),
      focusModule('between', 'language'),
    ];
    const nodes = [
      moduleNode('root', -300, 0),
      moduleNode('split-a', 0, 0),
      moduleNode('between', 150, 0, 120),
      moduleNode('split-b', 300, 0),
    ];
    const expected = focusSchematicFolderClusterGuides(modules, nodes, 'root');
    const reversed = focusSchematicFolderClusterGuides(
      [...modules].reverse(),
      [...nodes].reverse(),
      'root',
    );

    expect(
      expected.filter(({ folderKey }) => folderKey === 'science'),
    ).toHaveLength(2);
    expect(expected).toEqual(reversed);
  });

  it.each([0, 25, 50, 75, 100])(
    'derives current guides at strength %i without moving nodes or changing convergence',
    (strength) => {
      const fixture = buildEndpointFixture(
        SOFT_CLUSTER_FIXTURES.find(({ id }) => id === 'SC16')!,
      );
      const input = {
        model: fixture.model,
        projection: fixture.projection,
        nodeDimensions: focusSchematicNodeDimensions(
          fixture.projection,
          fixture.model,
        ),
        settings: {
          ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
          directionalFolderBandsEnabled: false,
        },
      };
      const attempt = computeFocusSchematicSoftClusterLayoutAttempt(input, {
        strength,
      });
      if (attempt.status !== 'success') throw new Error(attempt.reason);
      const graph = prepareFocusSchematicRendererGraph({
        projection: fixture.projection,
        model: fixture.model,
        layoutInput: input,
        computedLayout: attempt.result,
        rootEntityId: fixture.model.rootModuleId,
        secondaryRelationshipsVisible: false,
      });
      const before = graph.nodes.map(({ id, position }) => ({ id, position }));
      const guides = focusSchematicFolderClusterGuides(
        fixture.model.modules,
        graph.nodes,
        fixture.model.rootModuleId,
      );
      const repeated = computeFocusSchematicSoftClusterLayoutAttempt(input, {
        strength,
      });
      if (repeated.status !== 'success') throw new Error(repeated.reason);

      expect(guides.length).toBeGreaterThan(0);
      expect(new Set(guides.map(({ folderKey }) => folderKey))).toEqual(
        new Set(
          fixture.model.modules
            .filter(({ presentation }) => presentation !== 'filtered')
            .map(({ folderKey }) => folderKey),
        ),
      );
      expect(guides.every(({ path }) => path?.includes('NaN') !== true)).toBe(
        true,
      );
      expect(graph.nodes.map(({ id, position }) => ({ id, position }))).toEqual(
        before,
      );
      expect(repeated.result.candidate).toEqual(attempt.result.candidate);
    },
    20_000,
  );
});
