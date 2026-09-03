import { describe, expect, it } from 'vitest';

import {
  compareFocusSchematicLayouts,
  evaluateFocusSchematicLayout,
  validateFocusSchematicLayoutCandidate,
} from './layout';
import type {
  FocusSchematicLayoutCandidate,
  FocusSchematicModel,
} from './types';
import { graphFixture } from './test-fixture';

function candidate(
  model: FocusSchematicModel,
  positions: Readonly<Record<string, readonly [number, number]>>,
): FocusSchematicLayoutCandidate {
  const modules = model.modules.map((module) => {
    const [x, y] = positions[module.id] ?? [0, 0];
    return { moduleId: module.id, x, y, width: 100, height: 100 };
  });
  return {
    modelSchemaVersion: 1,
    rootModuleId: model.rootModuleId,
    modules,
    nodes: model.modules.flatMap((module) =>
      module.visibleEntityNodeIds.map((projectionNodeId, index) => {
        const owner = modules.find(({ moduleId }) => moduleId === module.id)!;
        return {
          projectionNodeId,
          moduleId: module.id,
          x: owner.x + 10,
          y: owner.y + 10 + index * 20,
          width: 20,
          height: 10,
        };
      }),
    ),
    routes: [],
  };
}

describe('Focus Schematic layout quality', () => {
  const fixture = graphFixture({
    root: 'Root',
    documents: ['A', 'Root', 'B'],
    references: [
      { source: 'A', target: 'Root' },
      { source: 'Root', target: 'B' },
    ],
  });

  it('accepts a complete perfect two-sided candidate and reports absent routing', () => {
    const layout = candidate(fixture.model, {
      A: [-200, 0],
      Root: [0, 0],
      B: [200, 0],
    });
    expect(
      validateFocusSchematicLayoutCandidate(fixture.model, layout).valid,
    ).toBe(true);
    expect(evaluateFocusSchematicLayout(fixture.model, layout)).toMatchObject({
      moduleOverlapPairs: [],
      nodeOverlapPairs: [],
      nodeOutsideModuleIds: [],
      leftSideViolationModuleIds: [],
      rightSideViolationModuleIds: [],
      routingAvailable: false,
      focusPathCrossingCount: null,
    });
    expect(
      validateFocusSchematicLayoutCandidate(fixture.model, {
        ...layout,
        modules: [
          { ...layout.modules[0], extra: true },
          ...layout.modules.slice(1),
        ],
      }).valid,
    ).toBe(false);
    expect(() =>
      validateFocusSchematicLayoutCandidate(fixture.model, {
        ...layout,
        modules: [null],
      }),
    ).not.toThrow();
  });

  it('detects side, overlap, outside-node, nonfinite, and candidate coverage failures', () => {
    const layout = candidate(fixture.model, {
      A: [0, 0],
      Root: [0, 0],
      B: [200, 0],
    });
    const broken = {
      ...layout,
      modules: layout.modules.filter(({ moduleId }) => moduleId !== 'B'),
      nodes: layout.nodes.map((node, index) =>
        index === 0 ? { ...node, x: 999 } : node,
      ),
    };
    const quality = evaluateFocusSchematicLayout(fixture.model, broken);
    expect(quality.leftSideViolationModuleIds).toEqual(['A']);
    expect(quality.moduleOverlapPairs.length).toBeGreaterThan(0);
    expect(quality.nodeOutsideModuleIds.length).toBeGreaterThan(0);
    expect(quality.missingModuleIds).toHaveLength(1);
    expect(
      validateFocusSchematicLayoutCandidate(fixture.model, broken).valid,
    ).toBe(false);
  });

  it('detects rank order violations', () => {
    const multi = graphFixture({
      root: 'Root',
      documents: ['Root', 'Near', 'Far'],
      references: [
        { source: 'Root', target: 'Near' },
        { source: 'Near', target: 'Far' },
      ],
      direction: 'outgoing',
    });
    const quality = evaluateFocusSchematicLayout(
      multi.model,
      candidate(multi.model, { Root: [0, 0], Near: [300, 0], Far: [200, 0] }),
    );
    expect(quality.rankOrderViolationModuleIds).toContain('Far');
  });

  it('scores grouped folders more coherently', () => {
    const folders = graphFixture({
      root: 'Root',
      documents: ['Root', 'one/A', 'one/B', 'two/C'],
      references: [
        { source: 'Root', target: 'one/A' },
        { source: 'Root', target: 'one/B' },
        { source: 'Root', target: 'two/C' },
      ],
    });
    const grouped = evaluateFocusSchematicLayout(
      folders.model,
      candidate(folders.model, {
        Root: [0, 0],
        'one/A': [200, 0],
        'one/B': [400, 20],
        'two/C': [600, 500],
      }),
    );
    const scattered = evaluateFocusSchematicLayout(
      folders.model,
      candidate(folders.model, {
        Root: [0, 0],
        'one/A': [200, 0],
        'two/C': [400, 20],
        'one/B': [600, 500],
      }),
    );
    expect(grouped.meanSameFolderVerticalDistance!).toBeLessThan(
      scattered.meanSameFolderVerticalDistance!,
    );
    expect(grouped.sameFolderAdjacencyRatio!).toBeGreaterThan(
      scattered.sameFolderAdjacencyRatio!,
    );
  });

  it('keeps route-aware crossings separate from center-line approximation', () => {
    const base = candidate(fixture.model, {
      A: [-200, -100],
      Root: [0, 0],
      B: [200, -100],
    });
    const routes = fixture.model.relationships.map((relationship, index) => ({
      relationshipId: relationship.id,
      points:
        index === 0
          ? [
              { x: -100, y: -100 },
              { x: 200, y: 100 },
            ]
          : [
              { x: -100, y: 100 },
              { x: 200, y: -100 },
            ],
    }));
    const quality = evaluateFocusSchematicLayout(fixture.model, {
      ...base,
      routes,
    });
    expect(quality.routingAvailable).toBe(true);
    expect(quality.focusPathCrossingCount).toBe(1);
    expect(quality.approximateCrossingCount).toBeNull();
  });

  it('reports the Heading alignment proxy', () => {
    const structured = graphFixture({
      root: 'Root',
      documents: ['Root', 'A'],
      withStructure: true,
      references: [
        {
          source: 'Root',
          sourceEntityId: 'Root-section',
          target: 'A',
          targetEntityId: 'A-section',
        },
      ],
    });
    const layout = candidate(structured.model, { Root: [0, 0], A: [200, 0] });
    expect(
      evaluateFocusSchematicLayout(structured.model, layout),
    ).toMatchObject({
      attachmentSampleCount: 1,
      meanAttachmentAlignmentError: 0,
    });
  });

  it('compares raw and root-relative stability deterministically', () => {
    const before = candidate(fixture.model, {
      A: [-200, 0],
      Root: [0, 0],
      B: [200, 0],
    });
    const translated = candidate(fixture.model, {
      A: [-190, 10],
      Root: [10, 10],
      B: [210, 10],
    });
    expect(
      compareFocusSchematicLayouts({
        beforeModel: fixture.model,
        beforeLayout: before,
        afterModel: fixture.model,
        afterLayout: translated,
      }),
    ).toMatchObject({
      rootCenterDisplacement: Math.sqrt(200),
      medianSharedModuleDisplacement: Math.sqrt(200),
      rootRelativeMedianSharedModuleDisplacement: 0,
      sharedModuleCount: 3,
    });
  });
});
