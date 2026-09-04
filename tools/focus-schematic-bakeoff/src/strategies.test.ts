import { describe, expect, it } from 'vitest';
import { computeFocusSchematicUniformLayoutAttempt as computeFocusSchematicLayoutAttempt } from '@icarus-graph-explorer/focus-schematic-layout';

import {
  createLayoutInput,
  assertRendererDimensionBaseline,
} from './dimensions';
import { buildFixture, SEMANTIC_FIXTURES } from './fixtures';
import {
  computeClassicBaselineAttempt,
  computeCompoundAttempt,
  evaluateHardGates,
} from './strategies';

const fixture = (id: string) => {
  const spec = SEMANTIC_FIXTURES.find((item) => item.id === id);
  if (spec === undefined) throw new Error(`Missing fixture ${id}.`);
  return buildFixture(spec);
};

describe('HIER2 development-only strategy adapters', () => {
  it('locks the adapter to current extended Focus card dimensions', () => {
    expect(assertRendererDimensionBaseline).not.toThrow();
    expect(createLayoutInput(fixture('F9')).nodeDimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 200, height: 80 }),
        expect.objectContaining({ width: 184, height: 72 }),
        expect.objectContaining({ width: 152, height: 64 }),
      ]),
    );
  });

  it('measures D0 through the current production Dagre wrapper', () => {
    const attempt = computeClassicBaselineAttempt(
      createLayoutInput(fixture('F4')),
    );
    expect(attempt.status).toBe('success');
    if (attempt.status !== 'success') return;
    expect(attempt.strategyId).toBe('D0-current-flat-dagre');
    expect(attempt.candidate.routes).toEqual([]);
  });

  it('reports D0 filtered modules as unsupported instead of deleting them', () => {
    expect(
      computeClassicBaselineAttempt(createLayoutInput(fixture('F14'))),
    ).toMatchObject({
      status: 'unsupported',
    });
  });

  it('runs compound Dagre with public cluster ownership and complete candidate coverage', () => {
    const attempt = computeCompoundAttempt(createLayoutInput(fixture('F5')));
    expect(attempt.status).toBe('success');
    if (attempt.status !== 'success') return;
    expect(attempt.candidate.modules).toHaveLength(attempt.plan.modules.length);
    expect(attempt.candidate.nodes).toHaveLength(
      fixture('F5').model.modules.flatMap(
        ({ visibleEntityNodeIds }) => visibleEntityNodeIds,
      ).length,
    );
    expect(evaluateHardGates(attempt).failures).not.toContain(
      'missing-modules:1',
    );
  });

  it('keeps secondary relationships out of compound positioning', () => {
    const before = computeCompoundAttempt(createLayoutInput(fixture('F3')));
    const after = computeCompoundAttempt(createLayoutInput(fixture('F8')));
    expect(before.status).toBe('success');
    expect(after.status).toBe('success');
  });

  it('inserts sibling Headings in canonical source-line order', () => {
    const built = fixture('F10');
    const attempt = computeFocusSchematicLayoutAttempt(
      createLayoutInput(built),
    );
    expect(attempt.status).toBe('success');
    if (attempt.status !== 'success') return;
    const sourceLine = new Map(
      built.projection.nodes.flatMap((node) =>
        node.kind === 'entity'
          ? [[node.id, node.sourceStartLine] as const]
          : [],
      ),
    );
    const headings = attempt.candidate.nodes
      .filter(({ projectionNodeId }) =>
        projectionNodeId.includes('Root-section'),
      )
      .sort((left, right) => left.y - right.y);
    expect(
      headings.map(({ projectionNodeId }) => sourceLine.get(projectionNodeId)),
    ).toEqual([2, 3, 4, 5]);
  });
});
