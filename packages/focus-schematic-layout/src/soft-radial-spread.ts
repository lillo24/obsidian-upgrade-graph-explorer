import { createFocusSchematicEndpointAttachments } from './attachments';
import { evaluateFocusSchematicEndpointLayoutQuality } from './endpoint-facing';
import { evaluateFocusSchematicFolderBandQuality } from './folder-bands';
import type {
  FocusSchematicComputedLayout,
  FocusSchematicEndpointLayoutQuality,
  FocusSchematicLayoutInput,
} from './types';
import { focusSchematicSoftRadialSpreadScale } from './soft-cluster-spacing';
import {
  buildFocusSchematicSoftFolderDisplayTree,
  projectFocusSchematicSoftFolderGroupingTree,
} from './soft-folder-display';
import { createFocusSchematicSoftCompoundBodies } from './soft-group-packing';
import { measureFocusSchematicSoftNestedHierarchy } from './soft-nested-hierarchy-packing';

interface Translation {
  readonly x: number;
  readonly y: number;
}

export interface FocusSchematicSoftRadialSpreadOptions {
  /** Renderer-only grouping of Files stored directly at workspace root. */
  readonly includeWorkspaceRootGroup?: boolean;
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
 * Applies the Sandbox spacing value after structural Soft layout. Every
 * Direct folder body or Nested top-level subtree translates rigidly; structural
 * packing already proves that this affine transform is safe over the full
 * supported scale interval.
 */
export function applyFocusSchematicSoftRadialSpread(
  input: FocusSchematicLayoutInput,
  computed: FocusSchematicComputedLayout,
  spacing: unknown,
  options: FocusSchematicSoftRadialSpreadOptions = {},
): FocusSchematicComputedLayout {
  const scale = focusSchematicSoftRadialSpreadScale(spacing);
  if (scale === 1) return computed;
  const root = computed.candidate.modules.find(
    ({ moduleId }) => moduleId === computed.candidate.rootModuleId,
  );
  if (root === undefined)
    throw new Error('Soft radial spread requires the root module geometry.');
  const rootFile = computed.candidate.nodes.find(
    ({ projectionNodeId }) =>
      projectionNodeId ===
      input.model.modules.find(({ id }) => id === input.model.rootModuleId)
        ?.documentProjectionNodeId,
  );
  const rootCenter = center(rootFile ?? root);
  const policy = computed.internalLayoutEvidence.softClusterPolicyEvidence;
  if (policy?.layoutFamily !== 'soft-folder-clusters')
    throw new Error(
      'Soft radial spread requires Soft Folder Cluster policy evidence.',
    );
  const semanticTree = buildFocusSchematicSoftFolderDisplayTree({
    visibleFiles: input.model.modules
      .filter(({ presentation }) => presentation !== 'filtered')
      .map(({ id, folderKey }) => ({ fileId: id, exactFolderKey: folderKey })),
    intent: policy.displayIntent,
  });
  const tree = projectFocusSchematicSoftFolderGroupingTree(semanticTree, {
    excludedFileIds: [input.model.rootModuleId],
  });
  const translations = new Map<string, Translation>();
  for (const body of createFocusSchematicSoftCompoundBodies(
    input,
    computed.candidate,
    tree,
    { ...options, folderScopeMode: policy.folderScopeMode },
  )) {
    const delta = body.anchored
      ? { x: 0, y: 0 }
      : {
          x: (body.center.x - rootCenter.x) * (scale - 1),
          y: (body.center.y - rootCenter.y) * (scale - 1),
        };
    for (const moduleId of body.memberModuleIds)
      translations.set(moduleId, delta);
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
  const candidate = {
    ...computed.candidate,
    modules: computed.candidate.modules.map(translate),
    nodes: computed.candidate.nodes.map(translate),
  };
  if (policy.folderScopeMode === 'nested') {
    const nested = measureFocusSchematicSoftNestedHierarchy(candidate, tree);
    if (
      nested.nestedParentContainmentViolationCount > 0 ||
      nested.nestedFolderSplitViolationCount > 0 ||
      nested.nestedGuideBlockerViolationCount > 0
    )
      throw new Error(
        `Soft radial spread violated Nested hierarchy: containment=${nested.nestedParentContainmentViolationCount}, splits=${nested.nestedFolderSplitViolationCount}, blockers=${nested.nestedGuideBlockerViolationCount}.`,
      );
  }
  const attachments = createFocusSchematicEndpointAttachments(
    computed.endpointPlan,
    candidate,
    'soft-cardinal-files',
  );
  const quality = evaluateFocusSchematicEndpointLayoutQuality(
    input,
    computed.modulePlan,
    computed.endpointPlan,
    computed.internalLanePlan,
    candidate,
    attachments,
    'soft-cardinal-files',
  );
  const baselineQuality: FocusSchematicEndpointLayoutQuality = {
    ...quality,
    exactEndpointCrossingCount:
      computed.folderBandQuality.baselineExactEndpointCrossingCount,
    adjacentRankOrderInversionCount:
      computed.folderBandQuality.baselineAdjacentRankOrderInversionCount,
    meanPreciseEndpointVerticalError:
      computed.folderBandQuality.baselineMeanEndpointVerticalError,
    p95PreciseEndpointVerticalError:
      computed.folderBandQuality.baselineP95EndpointVerticalError,
  };
  return {
    ...computed,
    candidate,
    attachments,
    quality,
    folderBandQuality: evaluateFocusSchematicFolderBandQuality(
      input,
      computed.modulePlan,
      computed.folderBandPlan,
      candidate,
      baselineQuality,
      quality,
    ),
  };
}
