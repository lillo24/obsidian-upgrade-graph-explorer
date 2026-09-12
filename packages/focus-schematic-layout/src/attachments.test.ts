import { describe, expect, it } from 'vitest';
import type { FocusSchematicLayoutCandidate } from '@icarus-graph-explorer/focus-schematic';

import {
  createFocusSchematicEndpointAttachments,
  focusSchematicSpatialCardinalSide,
  measureFocusSchematicAttachmentCrossings,
  measureFocusSchematicCandidateAttachmentCrossings,
} from './attachments';
import type {
  FocusSchematicConnectionEndpoint,
  FocusSchematicEndpointPlan,
} from './types';

const documentEndpoint = (
  moduleId: string,
  attachmentSide: 'left' | 'right' | 'auto' = 'right',
): FocusSchematicConnectionEndpoint => ({
  kind: 'visible-entity',
  projectionNodeId: `node-${moduleId}`,
  entityId: `entity-${moduleId}`,
  entityKind: 'document',
  moduleId,
  attachmentSide,
});

function plan(
  targets: readonly string[],
  source: FocusSchematicConnectionEndpoint = documentEndpoint('root'),
): FocusSchematicEndpointPlan {
  return {
    schemaVersion: 1,
    rootModuleId: 'root',
    connections: targets.map((target) => ({
      id: `connection-${target}`,
      kind: 'precise',
      relationshipId: `relationship-${target}`,
      projectedEdgeId: `edge-${target}`,
      referenceIds: [`reference-${target}`],
      sourceModuleId: source.moduleId,
      targetModuleId: target,
      source,
      target: documentEndpoint(target, 'left'),
      role: 'focus-path',
    })),
    nodeDemands: [],
    summary: {
      preciseConnectionCount: targets.length,
      fallbackConnectionCount: 0,
      preciseReferenceIdCount: targets.length,
      fallbackReferenceIdCount: 0,
      totalReferenceIdCount: targets.length,
    },
  };
}

function candidate(
  positions: Readonly<Record<string, readonly [number, number]>>,
): FocusSchematicLayoutCandidate {
  const modules = Object.entries(positions).map(([moduleId, [x, y]]) => ({
    moduleId,
    x,
    y,
    width: 100,
    height: 100,
  }));
  return {
    modelSchemaVersion: 1,
    rootModuleId: 'root',
    modules,
    nodes: modules.map((module) => ({
      projectionNodeId: `node-${module.moduleId}`,
      moduleId: module.moduleId,
      x: module.x + 20,
      y: module.y + 20,
      width: 60,
      height: 60,
    })),
    routes: [],
  };
}

describe('Soft cardinal File attachments', () => {
  it('uses left, right, top, and bottom simultaneously and mirrors targets', () => {
    const endpointPlan = plan(['left', 'right', 'top', 'bottom']);
    const geometry = candidate({
      root: [0, 0],
      left: [-300, 0],
      right: [300, 0],
      top: [0, -300],
      bottom: [0, 300],
    });
    const attachments = createFocusSchematicEndpointAttachments(
      endpointPlan,
      geometry,
      'soft-cardinal-files',
    );
    const sourceSides = new Map(
      attachments
        .filter(({ endpoint }) => endpoint === 'source')
        .map(({ connectionId, side }) => [connectionId, side]),
    );
    expect(sourceSides).toEqual(
      new Map([
        ['connection-bottom', 'bottom'],
        ['connection-left', 'left'],
        ['connection-right', 'right'],
        ['connection-top', 'top'],
      ]),
    );
    expect(
      attachments.find(
        ({ connectionId, endpoint }) =>
          connectionId === 'connection-bottom' && endpoint === 'target',
      )?.side,
    ).toBe('top');
  });

  it('uses horizontal for a 45-degree tie and right for coincident centers', () => {
    expect(
      focusSchematicSpatialCardinalSide(
        { x: 0, y: 0, width: 20, height: 20 },
        { x: 100, y: 100, width: 20, height: 20 },
      ),
    ).toBe('right');
    expect(
      focusSchematicSpatialCardinalSide(
        { x: 0, y: 0, width: 20, height: 20 },
        { x: 0, y: 0, width: 20, height: 20 },
      ),
    ).toBe('right');
  });

  it('recomputes a File side after geometry correction', () => {
    const endpointPlan = plan(['target']);
    const right = createFocusSchematicEndpointAttachments(
      endpointPlan,
      candidate({ root: [0, 0], target: [300, 10] }),
      'soft-cardinal-files',
    );
    const below = createFocusSchematicEndpointAttachments(
      endpointPlan,
      candidate({ root: [0, 0], target: [20, 300] }),
      'soft-cardinal-files',
    );
    expect(right.find(({ endpoint }) => endpoint === 'source')?.side).toBe(
      'right',
    );
    expect(below.find(({ endpoint }) => endpoint === 'source')?.side).toBe(
      'bottom',
    );
  });

  it('keeps precise Heading attachment semantics while cardinalizing a File', () => {
    const heading: FocusSchematicConnectionEndpoint = {
      kind: 'visible-entity',
      entityId: 'document-root',
      moduleId: 'root',
      projectionNodeId: 'node-root',
      entityKind: 'section',
      attachmentSide: 'left',
    };
    const attachments = createFocusSchematicEndpointAttachments(
      plan(['target'], heading),
      candidate({ root: [0, 0], target: [0, 300] }),
      'soft-cardinal-files',
    );
    expect(
      attachments.find(({ endpoint }) => endpoint === 'source')?.side,
    ).toBe('left');
    expect(
      attachments.find(({ endpoint }) => endpoint === 'target')?.side,
    ).toBe('top');
  });

  it('preserves Directional attachments byte-for-byte under the default policy', () => {
    const endpointPlan = plan(['target']);
    const geometry = candidate({ root: [0, 0], target: [0, 300] });
    expect(
      createFocusSchematicEndpointAttachments(endpointPlan, geometry),
    ).toEqual(
      createFocusSchematicEndpointAttachments(
        endpointPlan,
        geometry,
        'directional',
      ),
    );
    expect(
      createFocusSchematicEndpointAttachments(endpointPlan, geometry).map(
        ({ side }) => side,
      ),
    ).toEqual(['right', 'left']);
  });

  it('measures crossings from the selected attachment geometry', () => {
    const endpointPlan = plan(['a', 'b']);
    expect(
      measureFocusSchematicAttachmentCrossings(endpointPlan, [
        {
          connectionId: 'connection-a',
          endpoint: 'source',
          kind: 'visible-node',
          projectionNodeId: 'source-a',
          moduleId: 'root',
          side: 'right',
          x: 0,
          y: 0,
        },
        {
          connectionId: 'connection-a',
          endpoint: 'target',
          kind: 'visible-node',
          projectionNodeId: 'target-a',
          moduleId: 'a',
          side: 'left',
          x: 100,
          y: 100,
        },
        {
          connectionId: 'connection-b',
          endpoint: 'source',
          kind: 'visible-node',
          projectionNodeId: 'source-b',
          moduleId: 'root',
          side: 'right',
          x: 0,
          y: 100,
        },
        {
          connectionId: 'connection-b',
          endpoint: 'target',
          kind: 'visible-node',
          projectionNodeId: 'target-b',
          moduleId: 'b',
          side: 'left',
          x: 100,
          y: 0,
        },
      ]),
    ).toBe(1);
  });

  it('gives bounded candidate scoring the actual cardinal crossing objective', () => {
    const crossingPlan: FocusSchematicEndpointPlan = {
      ...plan(['right-bottom']),
      connections: [
        {
          ...plan(['right-bottom']).connections[0]!,
          id: 'connection-down',
          sourceModuleId: 'left-top',
          targetModuleId: 'right-bottom',
          source: documentEndpoint('left-top'),
          target: documentEndpoint('right-bottom'),
        },
        {
          ...plan(['right-top']).connections[0]!,
          id: 'connection-up',
          sourceModuleId: 'left-bottom',
          targetModuleId: 'right-top',
          source: documentEndpoint('left-bottom'),
          target: documentEndpoint('right-top'),
        },
      ],
      summary: {
        preciseConnectionCount: 2,
        fallbackConnectionCount: 0,
        preciseReferenceIdCount: 2,
        fallbackReferenceIdCount: 0,
        totalReferenceIdCount: 2,
      },
    };
    const crossed = candidate({
      root: [-600, 0],
      'left-top': [-300, -100],
      'left-bottom': [-300, 100],
      'right-top': [300, -100],
      'right-bottom': [300, 100],
    });
    const clean = candidate({
      root: [-600, 0],
      'left-top': [-300, -100],
      'left-bottom': [-300, 100],
      'right-top': [300, 100],
      'right-bottom': [300, -100],
    });
    expect(
      measureFocusSchematicCandidateAttachmentCrossings(
        crossingPlan,
        crossed,
        'soft-cardinal-files',
      ),
    ).toBe(1);
    expect(
      measureFocusSchematicCandidateAttachmentCrossings(
        crossingPlan,
        clean,
        'soft-cardinal-files',
      ),
    ).toBe(0);
  });
});
