import type { FocusSchematicComputedLayout } from './types';
import { focusSchematicSoftRadialSpreadScale } from './soft-cluster-spacing';

interface Translation {
  readonly x: number;
  readonly y: number;
}

const center = (rectangle: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}) => ({
  x: rectangle.x + rectangle.width / 2,
  y: rectangle.y + rectangle.height / 2,
});

/**
 * Applies the Sandbox spacing value after structural Soft layout. Complete
 * non-root modules translate uniformly, so internal geometry and every solver
 * decision remain byte-identical to the cached base result.
 */
export function applyFocusSchematicSoftRadialSpread(
  computed: FocusSchematicComputedLayout,
  spacing: unknown,
  rootDocumentProjectionNodeId?: string | null,
): FocusSchematicComputedLayout {
  const scale = focusSchematicSoftRadialSpreadScale(spacing);
  if (scale === 1) return computed;
  const root = computed.candidate.modules.find(
    ({ moduleId }) => moduleId === computed.candidate.rootModuleId,
  );
  if (root === undefined)
    throw new Error('Soft radial spread requires the root module geometry.');
  const rootFile = computed.candidate.nodes.find(
    ({ projectionNodeId }) => projectionNodeId === rootDocumentProjectionNodeId,
  );
  const rootCenter = center(rootFile ?? root);
  const translations = new Map<string, Translation>();
  for (const module of computed.candidate.modules) {
    if (module.moduleId === computed.candidate.rootModuleId) {
      translations.set(module.moduleId, { x: 0, y: 0 });
      continue;
    }
    const moduleCenter = center(module);
    translations.set(module.moduleId, {
      x: (moduleCenter.x - rootCenter.x) * (scale - 1),
      y: (moduleCenter.y - rootCenter.y) * (scale - 1),
    });
  }
  const translate = <Rectangle extends { readonly moduleId: string }>(
    rectangle: Rectangle,
  ): Rectangle => {
    const delta = translations.get(rectangle.moduleId);
    if (delta === undefined)
      throw new Error(
        `Soft radial spread cannot resolve module "${rectangle.moduleId}".`,
      );
    return {
      ...rectangle,
      x: (rectangle as Rectangle & { readonly x: number }).x + delta.x,
      y: (rectangle as Rectangle & { readonly y: number }).y + delta.y,
    };
  };
  return {
    ...computed,
    candidate: {
      ...computed.candidate,
      modules: computed.candidate.modules.map(translate),
      nodes: computed.candidate.nodes.map(translate),
    },
    attachments: computed.attachments.map((attachment) => {
      const delta = translations.get(attachment.moduleId);
      if (delta === undefined)
        throw new Error(
          `Soft radial spread cannot resolve attachment module "${attachment.moduleId}".`,
        );
      return {
        ...attachment,
        x: attachment.x + delta.x,
        y: attachment.y + delta.y,
      };
    }),
  };
}
