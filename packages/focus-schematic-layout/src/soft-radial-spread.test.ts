import { describe, expect, it } from 'vitest';

import { buildEndpointFixture } from './endpoint-fixtures';
import { validateFocusSchematicComputedLayout } from './endpoint-facing';
import { SOFT_CLUSTER_FIXTURES } from './soft-cluster-fixtures';
import { computeFocusSchematicSoftClusterLayoutAttempt } from './soft-clusters';
import { FOCUS_SCHEMATIC_LAYOUT_SETTINGS } from './settings';
import { layoutInput } from './test-helpers';
import { applyFocusSchematicSoftRadialSpread } from './soft-radial-spread';
import { focusSchematicSoftRadialSpreadScale } from './soft-cluster-spacing';

interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const center = (rectangle: Rectangle) => ({
  x: rectangle.x + rectangle.width / 2,
  y: rectangle.y + rectangle.height / 2,
});

const overlap = (left: Rectangle, right: Rectangle) =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;

function baseLayout() {
  const spec = SOFT_CLUSTER_FIXTURES.find(({ id }) => id === 'SC14')!;
  const input = layoutInput(buildEndpointFixture(spec), {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: false,
  });
  const attempt = computeFocusSchematicSoftClusterLayoutAttempt(input);
  if (attempt.status !== 'success') throw new Error(attempt.reason);
  const rootModule = input.model.modules.find(
    ({ id }) => id === input.model.rootModuleId,
  )!;
  return {
    input,
    result: attempt.result,
    rootDocumentProjectionNodeId: rootModule.documentProjectionNodeId,
  };
}

describe('Soft radial post-layout spread', () => {
  it.each([0, 25, 50, 71, 72, 73, 75, 100] as const)(
    'translates complete modules at spacing %i without changing structural decisions',
    (spacing) => {
      const { input, result, rootDocumentProjectionNodeId } = baseLayout();
      const spread = applyFocusSchematicSoftRadialSpread(
        input,
        result,
        spacing,
      );
      const scale = focusSchematicSoftRadialSpreadScale(spacing);
      const rootFile = result.candidate.nodes.find(
        ({ projectionNodeId }) =>
          projectionNodeId === rootDocumentProjectionNodeId,
      )!;
      const origin = center(rootFile);
      expect(
        spread.candidate.nodes.find(
          ({ projectionNodeId }) =>
            projectionNodeId === rootDocumentProjectionNodeId,
        ),
      ).toEqual(rootFile);
      expect(
        spread.candidate.modules.find(
          ({ moduleId }) => moduleId === result.candidate.rootModuleId,
        ),
      ).toEqual(
        result.candidate.modules.find(
          ({ moduleId }) => moduleId === result.candidate.rootModuleId,
        ),
      );
      expect(spread.internalLayoutEvidence).toBe(result.internalLayoutEvidence);
      expect(spread.endpointPlan).toBe(result.endpointPlan);
      expect(validateFocusSchematicComputedLayout(input, spread).valid).toBe(
        true,
      );
      for (const beforeModule of result.candidate.modules) {
        const afterModule = spread.candidate.modules.find(
          ({ moduleId }) => moduleId === beforeModule.moduleId,
        )!;
        expect(afterModule.width).toBe(beforeModule.width);
        expect(afterModule.height).toBe(beforeModule.height);
        const beforeCenter = center(beforeModule);
        const afterCenter = center(afterModule);
        if (beforeModule.moduleId !== result.candidate.rootModuleId) {
          expect(afterCenter.x - origin.x).toBeCloseTo(
            (beforeCenter.x - origin.x) * scale,
            8,
          );
          expect(afterCenter.y - origin.y).toBeCloseTo(
            (beforeCenter.y - origin.y) * scale,
            8,
          );
          expect(
            Math.atan2(afterCenter.y - origin.y, afterCenter.x - origin.x),
          ).toBeCloseTo(
            Math.atan2(beforeCenter.y - origin.y, beforeCenter.x - origin.x),
            10,
          );
        }
        for (const beforeNode of result.candidate.nodes.filter(
          ({ moduleId }) => moduleId === beforeModule.moduleId,
        )) {
          const afterNode = spread.candidate.nodes.find(
            ({ projectionNodeId }) =>
              projectionNodeId === beforeNode.projectionNodeId,
          )!;
          expect(afterNode.x - afterModule.x).toBeCloseTo(
            beforeNode.x - beforeModule.x,
            10,
          );
          expect(afterNode.y - afterModule.y).toBeCloseTo(
            beforeNode.y - beforeModule.y,
            10,
          );
        }
        for (const attachment of spread.attachments.filter(
          ({ moduleId }) => moduleId === beforeModule.moduleId,
        )) {
          const rectangle =
            attachment.projectionNodeId === null
              ? afterModule
              : spread.candidate.nodes.find(
                  ({ projectionNodeId }) =>
                    projectionNodeId === attachment.projectionNodeId,
                )!;
          if (attachment.side === 'left')
            expect(attachment.x).toBeCloseTo(rectangle.x, 10);
          if (attachment.side === 'right')
            expect(attachment.x).toBeCloseTo(rectangle.x + rectangle.width, 10);
          if (attachment.side === 'top')
            expect(attachment.y).toBeCloseTo(rectangle.y, 10);
          if (attachment.side === 'bottom')
            expect(attachment.y).toBeCloseTo(
              rectangle.y + rectangle.height,
              10,
            );
        }
      }
      for (let left = 0; left < spread.candidate.modules.length; left += 1)
        for (
          let right = left + 1;
          right < spread.candidate.modules.length;
          right += 1
        )
          expect(
            overlap(
              spread.candidate.modules[left]!,
              spread.candidate.modules[right]!,
            ),
          ).toBe(false);
    },
    30_000,
  );

  it('keeps 71/72/73 structurally identical and changes only radial scale', () => {
    const { input, result } = baseLayout();
    const values = [71, 72, 73].map((spacing) =>
      applyFocusSchematicSoftRadialSpread(input, result, spacing),
    );
    for (const value of values) {
      expect(
        value.candidate.modules.map(({ width, height }) => ({ width, height })),
      ).toEqual(
        result.candidate.modules.map(({ width, height }) => ({
          width,
          height,
        })),
      );
      expect(value.internalLayoutEvidence).toBe(result.internalLayoutEvidence);
      expect(value.endpointPlan).toBe(result.endpointPlan);
      expect(value.internalLanePlan).toBe(result.internalLanePlan);
    }
  });
});
