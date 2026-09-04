import { describe, expect, it } from 'vitest';
import { graphFixture } from '../../focus-schematic/src/test-fixture';

import { validateFocusSchematicLayoutInput } from './input';
import {
  FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
} from './settings';
import { layoutInput } from './test-helpers';
import { computeFocusSchematicLayoutAttempt } from './two-stage';

describe('two-stage Dagre', () => {
  it('lays out two-sided nested modules with containment, clearance, and cold determinism', () => {
    const fixture = graphFixture({
      root: 'Root',
      documents: ['A', 'Root', 'B'],
      references: [
        { source: 'A', target: 'Root' },
        { source: 'Root', target: 'B' },
      ],
      withStructure: true,
    });
    const input = layoutInput(fixture);
    const first = computeFocusSchematicLayoutAttempt(input);
    const second = computeFocusSchematicLayoutAttempt(input);
    expect(first.status).toBe('success');
    expect(second.status).toBe('success');
    if (first.status !== 'success' || second.status !== 'success') return;
    expect(first.candidate).toEqual(second.candidate);
    expect(first.candidate.routes).toEqual([]);
    expect(first.routeCoverage).toBe(1);
    expect(first.quality).toMatchObject({
      moduleOverlapPairs: [],
      nodeOverlapPairs: [],
      nodeOutsideModuleIds: [],
      missingModuleIds: [],
      missingVisibleNodeIds: [],
      nonFiniteGeometryCount: 0,
      leftSideViolationModuleIds: [],
      rightSideViolationModuleIds: [],
      rankOrderViolationModuleIds: [],
    });
    const root = first.candidate.modules.find(
      ({ moduleId }) => moduleId === 'Root',
    );
    expect(root === undefined ? NaN : root.x + root.width / 2).toBeCloseTo(0);
    expect(root === undefined ? NaN : root.y + root.height / 2).toBeCloseTo(0);
    expect(FOCUS_SCHEMATIC_LAYOUT_CLEARANCE).toBeGreaterThan(0);
  });

  it('retains filtered path intermediaries under both explicit policies', () => {
    const fixture = graphFixture({
      root: 'Root',
      documents: ['Root', 'Hidden', 'Visible'],
      references: [
        { source: 'Root', target: 'Hidden' },
        { source: 'Hidden', target: 'Visible' },
      ],
      direction: 'outgoing',
      filters: { text: 'Visible' },
    });
    const compact = computeFocusSchematicLayoutAttempt(layoutInput(fixture));
    const context = computeFocusSchematicLayoutAttempt(
      layoutInput(fixture, {
        ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
        filteredModulePolicy: 'context-card',
      }),
    );
    expect(compact.status).toBe('success');
    expect(context.status).toBe('success');
    if (compact.status !== 'success' || context.status !== 'success') return;
    expect(
      compact.candidate.modules.find(({ moduleId }) => moduleId === 'Hidden'),
    ).toMatchObject({ width: 72, height: 40 });
    expect(
      context.candidate.modules.find(({ moduleId }) => moduleId === 'Hidden'),
    ).toMatchObject({ width: 200, height: 80 });
  });

  it('rejects missing, duplicate, unknown, nonpositive, and unordered dimensions', () => {
    const fixture = graphFixture({
      root: 'Root',
      documents: ['Root', 'A'],
      references: [{ source: 'Root', target: 'A' }],
    });
    const input = layoutInput(fixture);
    const bad = {
      ...input,
      nodeDimensions: [
        ...input.nodeDimensions.slice(1),
        { projectionNodeId: 'unknown', width: 0, height: 80 },
      ],
    };
    expect(validateFocusSchematicLayoutInput(bad)).toMatchObject({
      valid: false,
    });
  });
});
