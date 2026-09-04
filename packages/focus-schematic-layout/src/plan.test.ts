import { describe, expect, it } from 'vitest';
import { graphFixture } from '../../focus-schematic/src/test-fixture';

import {
  createFocusSchematicLayoutPlan,
  validateFocusSchematicLayoutPlan,
} from './plan';

describe('Focus Schematic shared layout plan', () => {
  it('keeps HIER1 non-mutual ranks and builds one monotonic parent per module', () => {
    const { model } = graphFixture({
      root: 'Root',
      documents: ['A', 'B', 'Root', 'C', 'D'],
      references: [
        { source: 'A', target: 'B' },
        { source: 'B', target: 'Root' },
        { source: 'Root', target: 'C' },
        { source: 'C', target: 'D' },
      ],
    });
    const plan = createFocusSchematicLayoutPlan(model);
    expect(
      Object.fromEntries(
        plan.modules.map(({ moduleId, signedRank }) => [moduleId, signedRank]),
      ),
    ).toEqual({
      A: -2,
      B: -1,
      Root: 0,
      C: 1,
      D: 2,
    });
    expect(
      plan.modules
        .filter(({ moduleId }) => moduleId !== 'Root')
        .every(({ parentModuleId }) => parentModuleId !== null),
    ).toBe(true);
    expect(
      validateFocusSchematicLayoutPlan(model, JSON.parse(JSON.stringify(plan)))
        .valid,
    ).toBe(true);
  });

  it('resolves equal mutual ties deterministically and balances equal rank load', () => {
    const fixture = graphFixture({
      root: 'Root',
      documents: ['Root', 'A', 'B'],
      references: [
        { source: 'Root', target: 'A' },
        { source: 'A', target: 'Root' },
        { source: 'Root', target: 'B' },
        { source: 'B', target: 'Root' },
      ],
    });
    const plan = createFocusSchematicLayoutPlan(fixture.model);
    expect(plan.modules.find(({ moduleId }) => moduleId === 'A')?.side).toBe(
      'left',
    );
    expect(plan.modules.find(({ moduleId }) => moduleId === 'B')?.side).toBe(
      'right',
    );
    expect(plan.arbitraryTieBreakCount).toBe(1);
    expect(JSON.stringify(createFocusSchematicLayoutPlan(fixture.model))).toBe(
      JSON.stringify(plan),
    );
  });

  it('prefers the stronger semantic parent candidate before load balancing', () => {
    const fixture = graphFixture({
      root: 'Root',
      documents: ['Root', 'A'],
      withStructure: true,
      references: [
        { source: 'Root', target: 'A' },
        {
          source: 'A',
          sourceEntityId: 'A-section',
          target: 'Root',
          targetEntityId: 'Root-section',
        },
      ],
    });
    expect(
      createFocusSchematicLayoutPlan(fixture.model).modules.find(
        ({ moduleId }) => moduleId === 'A',
      )?.side,
    ).toBe('left');
  });
});
