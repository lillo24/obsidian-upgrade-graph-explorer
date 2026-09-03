import { describe, expect, it } from 'vitest';

import { composeGlobalSpatialOverrides } from './spatial';
import type { GlobalRendererInput } from './types';

const input: GlobalRendererInput = {
  nodes: [
    {
      key: 'a',
      attributes: {
        x: -2,
        y: 0,
        size: 4,
        color: '#000',
        label: 'A',
        nodeKind: 'document',
        entityId: 'a',
        sourcePath: 'alpha/A.md',
        status: null,
        folderKey: 'alpha',
        revealableDescendantCount: 0,
      },
    },
    {
      key: 'b',
      attributes: {
        x: 2,
        y: 0,
        size: 4,
        color: '#000',
        label: 'B',
        nodeKind: 'document',
        entityId: 'b',
        sourcePath: 'beta/B.md',
        status: null,
        folderKey: 'beta',
        revealableDescendantCount: 0,
      },
    },
  ],
  edges: [],
  projectionIssues: [],
};

describe('Sigma normalized-folder coordinate adapter', () => {
  it('places a positive X/Y anchor visually toward bottom-right', () => {
    const result = composeGlobalSpatialOverrides(
      input.nodes.map(({ key, attributes }) => ({
        key,
        x: attributes.x,
        y: attributes.y,
      })),
      input,
      new Map([['alpha', { x: 0.7, y: 0.7 }]]),
    );
    const summary = result.activeFolders[0]!;
    expect(summary.target.x).toBeGreaterThan(result.automaticFrame.centerX);
    expect(summary.target.y).toBeLessThan(result.automaticFrame.centerY);

    // Sigma 3.0.3 framedGraphToViewport uses (1 - graphY) * height / 2.
    // Therefore the lower graph Y produced by logical +Y has greater screen Y.
    const viewportY = (graphY: number) => (1 - graphY) * 100;
    expect(viewportY(summary.target.y)).toBeGreaterThan(
      viewportY(result.automaticFrame.centerY),
    );
  });

  it('excludes diagnostics from frame membership and translation', () => {
    const diagnostic = {
      ...input.nodes[0]!,
      key: 'diagnostic',
      attributes: {
        ...input.nodes[0]!.attributes,
        x: 1_000,
        y: -1_000,
        nodeKind: 'diagnostic' as const,
        entityId: null,
        sourcePath: null,
        status: 'unresolved' as const,
        folderKey: null,
      },
    };
    const withDiagnostic = { ...input, nodes: [...input.nodes, diagnostic] };
    const result = composeGlobalSpatialOverrides(
      withDiagnostic.nodes.map(({ key, attributes }) => ({
        key,
        x: attributes.x,
        y: attributes.y,
      })),
      withDiagnostic,
      new Map([['alpha', { x: 1, y: 1 }]]),
    );
    expect(result.automaticFrame.centerX).toBe(0);
    expect(
      result.displayedPositions.find(({ key }) => key === 'diagnostic'),
    ).toEqual({ key: 'diagnostic', x: 1_000, y: -1_000 });
  });
});
