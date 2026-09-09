import { describe, expect, it } from 'vitest';

import { createGlobalConvergencePolicy } from '../global-convergence';
import { createGlobalFolderMacroPolicy } from '../global-folder-macro';
import { createLocalConvergencePolicy } from '../local-convergence';
import { resolveGlobalPhysicsSettings } from '../settings';
import {
  createAllNetworkPhysicsSeed,
  createFocusNetworkPhysicsSeed,
} from './seed';

describe('network physics seeds', () => {
  it('uses accepted Focus coordinates and marks only documents eligible', () => {
    const request = {
      schemaVersion: 2 as const,
      rootKey: 'document',
      policy: createLocalConvergencePolicy(2),
      settings: {
        hierarchyWeight: 6,
        referenceWeight: 0.8,
        scalingRatio: 1.35,
      },
      nodes: [
        { key: 'document', kind: 'document' as const, x: 0, y: 0, size: 4 },
        { key: 'heading', kind: 'section' as const, x: 1, y: 1, size: 3 },
      ],
      edges: [
        {
          key: 'edge',
          source: 'document',
          target: 'heading',
          kind: 'hierarchy' as const,
          weight: 2,
        },
      ],
    };
    const seed = createFocusNetworkPhysicsSeed({
      request,
      positions: [
        { key: 'document', x: 20, y: -5 },
        { key: 'heading', x: 9, y: 3 },
      ],
      sessionGeneration: 'session',
      simulationGeneration: 'simulation',
    });
    expect(seed.nodes).toEqual([
      {
        key: 'document',
        x: 20,
        y: -5,
        size: 4,
        constraintEligible: true,
      },
      {
        key: 'heading',
        x: 9,
        y: 3,
        size: 3,
        constraintEligible: false,
      },
    ]);
    expect(seed.edges[0]?.weight).toBe(12);
  });

  it('uses All dynamic pre-Place positions and preserves resolved Pull data', () => {
    const settings = resolveGlobalPhysicsSettings({
      folderClustering: false,
      spacingPreset: 'normal',
    });
    const nodes = [
      { key: 'file', x: 100, y: 100, folderKey: 'docs' },
      {
        key: 'diagnostic',
        x: 110,
        y: 100,
        folderKey: 'docs',
      },
    ];
    const request = {
      schemaVersion: 3 as const,
      algorithm: 'reference-only' as const,
      policy: createGlobalConvergencePolicy(nodes.length),
      macro: createGlobalFolderMacroPolicy(nodes, settings),
      settings,
      nodes,
      edges: [
        {
          key: 'edge',
          source: 'file',
          target: 'diagnostic',
          weight: 1,
        },
      ],
    };
    const attractors = [
      {
        ruleFolderKey: 'docs',
        memberNodeKeys: ['file'],
        targetX: -30,
        targetY: 8,
        strength: 75,
      },
    ];
    const before = JSON.stringify({ request, attractors });
    const seed = createAllNetworkPhysicsSeed({
      request,
      dynamicPositions: [
        { key: 'file', x: 4, y: 5 },
        { key: 'diagnostic', x: 8, y: 9 },
      ],
      attractors,
      constraintEligibleNodeKeys: new Set(['file']),
      sessionGeneration: 'session',
      simulationGeneration: 'simulation',
    });
    expect(seed.nodes).toEqual([
      { key: 'file', x: 4, y: 5, size: 1, constraintEligible: true },
      {
        key: 'diagnostic',
        x: 8,
        y: 9,
        size: 1,
        constraintEligible: false,
      },
    ]);
    expect(seed.attractors).toEqual(attractors);
    expect(seed.automaticFolderFieldPolicy).toBe('none');
    expect(JSON.stringify({ request, attractors })).toBe(before);
  });

  it('marks an M2-shaped All snapshot for intentional temporary relaxation without changing activation coordinates', () => {
    const settings = resolveGlobalPhysicsSettings({
      folderClustering: true,
      spacingPreset: 'normal',
    });
    const nodes = [
      { key: 'a', x: -5, y: 0, folderKey: 'docs' },
      { key: 'b', x: 5, y: 0, folderKey: 'docs' },
    ];
    const shapedSnapshot = [
      { key: 'a', x: 41, y: -7 },
      { key: 'b', x: 44, y: -7 },
    ];
    const seed = createAllNetworkPhysicsSeed({
      request: {
        schemaVersion: 3,
        algorithm: 'fixed-total-field',
        policy: createGlobalConvergencePolicy(nodes.length),
        macro: createGlobalFolderMacroPolicy(nodes, settings),
        settings,
        nodes,
        edges: [{ key: 'ab', source: 'a', target: 'b', weight: 1 }],
      },
      dynamicPositions: shapedSnapshot,
      attractors: [],
      constraintEligibleNodeKeys: new Set(['a', 'b']),
      sessionGeneration: 'session',
      simulationGeneration: 'simulation',
    });

    expect(seed.automaticFolderFieldPolicy).toBe('seeded-output-relaxation');
    expect(seed.nodes.map(({ key, x, y }) => ({ key, x, y }))).toEqual(
      shapedSnapshot,
    );
  });
});
