import { evaluateFocusSchematicLayout } from '@icarus-graph-explorer/focus-schematic';
import {
  computeFocusSchematicComputedLayoutAttempt,
  FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
} from '@icarus-graph-explorer/focus-schematic-layout';
import { describe, expect, it } from 'vitest';

import { createLayoutInput } from './dimensions';
import { buildFixture, generatedFixture, SEMANTIC_FIXTURES } from './fixtures';

describe('HIER3A compatibility with HIER2 evidence', () => {
  it('passes F1–F18 and seeded generated holdouts without changing macro hard gates', () => {
    const fixtures = [
      ...SEMANTIC_FIXTURES,
      ...Array.from({ length: 24 }, (_, index) => generatedFixture(index + 1)),
    ];
    for (const fixtureSpec of fixtures) {
      const fixture = buildFixture(fixtureSpec);
      const input = createLayoutInput(fixture);
      const attempt = computeFocusSchematicComputedLayoutAttempt(input);
      expect(attempt.status, fixtureSpec.id).toBe('success');
      if (attempt.status !== 'success') continue;
      const base = evaluateFocusSchematicLayout(
        input.model,
        attempt.result.candidate,
        { clearance: FOCUS_SCHEMATIC_LAYOUT_CLEARANCE, rankTolerance: 1 },
      );
      expect(base, fixtureSpec.id).toMatchObject({
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
      expect(attempt.result.quality, fixtureSpec.id).toMatchObject({
        leftDemandViolationNodeIds: [],
        rightDemandViolationNodeIds: [],
        invalidLaneTransitionEdgeIds: [],
      });
    }
  });
});
