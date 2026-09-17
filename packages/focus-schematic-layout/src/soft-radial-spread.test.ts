import { describe, expect, it } from 'vitest';

import { buildEndpointFixture } from './endpoint-fixtures';
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
    result: attempt.result,
    rootDocumentProjectionNodeId: rootModule.documentProjectionNodeId,
  };
}

describe('Soft radial post-layout spread', () => {
  it.each([0, 25, 50, 71, 72, 73, 75, 100] as const)(
    'translates complete modules at spacing %i without changing structural decisions',
    (spacing) => {
      const { result, rootDocumentProjectionNodeId } = baseLayout();
      const spread = applyFocusSchematicSoftRadialSpread(
        result,
        spacing,
        rootDocumentProjectionNodeId,
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
      expect(spread.quality).toBe(result.quality);
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
        for (const beforeAttachment of result.attachments.filter(
          ({ moduleId }) => moduleId === beforeModule.moduleId,
        )) {
          const afterAttachment = spread.attachments.find(
            ({ connectionId, endpoint }) =>
              connectionId === beforeAttachment.connectionId &&
              endpoint === beforeAttachment.endpoint,
          )!;
          expect(afterAttachment.x - beforeAttachment.x).toBeCloseTo(
            afterModule.x - beforeModule.x,
            10,
          );
          expect(afterAttachment.y - beforeAttachment.y).toBeCloseTo(
            afterModule.y - beforeModule.y,
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
    const { result, rootDocumentProjectionNodeId } = baseLayout();
    const values = [71, 72, 73].map((spacing) =>
      applyFocusSchematicSoftRadialSpread(
        result,
        spacing,
        rootDocumentProjectionNodeId,
      ),
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
