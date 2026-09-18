import { validateFocusSchematicComputedLayout } from './endpoint-facing';
import { validateFocusSchematicLayoutInput } from './input';
import {
  DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
  focusSchematicLayoutMatchesProductPolicies,
  isFocusSchematicEndpointOrderPolicy,
  isFocusSchematicProductMacroLayout,
  isFocusSchematicProductInternalLayoutVariant,
  isFocusSchematicSoftFolderScopeMode,
  normalizeFocusSchematicSoftAncestorDecayBase,
  normalizeFocusSchematicSoftFolderDisplayIntent,
  normalizeFocusSchematicSoftFolderStrength,
  type FocusSchematicProductLayoutPolicies,
} from './policies';
import type {
  FocusSchematicComputedLayout,
  FocusSchematicEndpointLayoutPhaseTimings,
  FocusSchematicLayoutInput,
  FocusSchematicSoftClusterEvidence,
} from './types';

export const FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION = 12 as const;

export interface FocusSchematicLayoutWorkerRequest {
  readonly protocolVersion: typeof FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION;
  readonly requestId: number;
  readonly kind: 'layout';
  readonly input: FocusSchematicLayoutInput;
  readonly policies: FocusSchematicProductLayoutPolicies;
}

export type FocusSchematicLayoutWorkerFailureCode =
  'invalid-request' | 'invalid-input' | 'computation-failed';

export type FocusSchematicLayoutWorkerResponse =
  | {
      readonly protocolVersion: typeof FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION;
      readonly requestId: number;
      readonly kind: 'success';
      readonly result: FocusSchematicComputedLayout;
      readonly softClusterEvidence: FocusSchematicSoftClusterEvidence | null;
      readonly timings: FocusSchematicEndpointLayoutPhaseTimings;
      readonly computeMs: number;
    }
  | {
      readonly protocolVersion: typeof FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION;
      readonly requestId: number;
      readonly kind: 'failure';
      readonly code: FocusSchematicLayoutWorkerFailureCode;
      readonly message: string;
      readonly computeMs: number;
    };

export class FocusSchematicLayoutProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FocusSchematicLayoutProtocolError';
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new FocusSchematicLayoutProtocolError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    throw new FocusSchematicLayoutProtocolError(
      `${label} has unexpected or missing fields.`,
    );
  }
}

function requestId(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new FocusSchematicLayoutProtocolError(
      'requestId must be a positive safe integer.',
    );
  }
  return Number(value);
}

function finiteNonNegative(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new FocusSchematicLayoutProtocolError(
      `${label} must be a finite non-negative number.`,
    );
  }
  return value;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new FocusSchematicLayoutProtocolError(
      `${label} must be a finite number.`,
    );
  return value;
}

function validateSoftClusterEvidence(
  value: unknown,
  policies: FocusSchematicProductLayoutPolicies,
): FocusSchematicSoftClusterEvidence | null {
  if (policies.macroLayout === 'directional-bands') {
    if (value !== null)
      throw new FocusSchematicLayoutProtocolError(
        'Directional layout responses cannot include Soft Cluster evidence.',
      );
    return null;
  }
  const evidence = record(value, 'Soft Cluster evidence');
  exactKeys(
    evidence,
    [
      'schemaVersion',
      'developmentOnly',
      'layoutFamily',
      'strength',
      'structuralSpacing',
      'endpointOrderPolicy',
      'fileParentOverrideCount',
      'flattenedFolderCount',
      'displayedFolderCount',
      'automaticallyCompressedFolderCount',
      'maximumDisplayedDepth',
      'folderScopeMode',
      'ancestorDecayBase',
      'hierarchyForcePolicy',
      'maximumPerFileFolderWeight',
      'fileAttachmentPolicy',
      'folderInfluenceEnabled',
      'topologyDirectionality',
      'secondaryGeometryInfluence',
      'fixedIterationSchedule',
      'compass',
      'cohesion',
      'groupPacking',
      'preCohesionMetrics',
      'postCohesionMetrics',
      'preGroupMetrics',
      'metrics',
      'runtime',
    ],
    'Soft Cluster evidence',
  );
  if (
    evidence.schemaVersion !== 7 ||
    evidence.developmentOnly !== true ||
    evidence.layoutFamily !== 'soft-folder-clusters' ||
    evidence.strength !==
      normalizeFocusSchematicSoftFolderStrength(policies.softFolderStrength) ||
    evidence.endpointOrderPolicy !== policies.endpointOrderPolicy ||
    !Number.isSafeInteger(evidence.fileParentOverrideCount) ||
    Number(evidence.fileParentOverrideCount) < 0 ||
    !Number.isSafeInteger(evidence.flattenedFolderCount) ||
    Number(evidence.flattenedFolderCount) < 0 ||
    !Number.isSafeInteger(evidence.displayedFolderCount) ||
    Number(evidence.displayedFolderCount) < 0 ||
    !Number.isSafeInteger(evidence.automaticallyCompressedFolderCount) ||
    Number(evidence.automaticallyCompressedFolderCount) < 0 ||
    !Number.isSafeInteger(evidence.maximumDisplayedDepth) ||
    Number(evidence.maximumDisplayedDepth) < 0 ||
    evidence.folderScopeMode !== policies.softFolderScopeMode ||
    evidence.ancestorDecayBase !==
      (policies.softFolderScopeMode === 'nearest-only'
        ? null
        : normalizeFocusSchematicSoftAncestorDecayBase(
            policies.softAncestorDecayBase,
          )) ||
    evidence.hierarchyForcePolicy !==
      (policies.softFolderScopeMode === 'nearest-only'
        ? 'nearest-only'
        : 'normalized-decay') ||
    finiteNonNegative(
      evidence.maximumPerFileFolderWeight,
      'maximumPerFileFolderWeight',
    ) > 1 ||
    evidence.fileAttachmentPolicy !== 'spatial-cardinal' ||
    evidence.folderInfluenceEnabled !== Number(evidence.strength) > 0 ||
    evidence.topologyDirectionality !== 'undirected-primary' ||
    evidence.secondaryGeometryInfluence !== 0 ||
    !Array.isArray(evidence.fixedIterationSchedule) ||
    evidence.fixedIterationSchedule.length !== 2 ||
    evidence.fixedIterationSchedule[0] !== 36 ||
    evidence.fixedIterationSchedule[1] !== 18
  )
    throw new FocusSchematicLayoutProtocolError(
      'Soft Cluster evidence does not match the requested policy.',
    );
  const compass = record(evidence.compass, 'Soft Compass evidence');
  exactKeys(
    compass,
    [
      'demandPolicy',
      'spatialDemandSummary',
      'topBranchCount',
      'bottomBranchCount',
      'leftBranchCount',
      'rightBranchCount',
      'modulesWithLateralBranches',
      'modulesWithOnlyVerticalBranches',
      'demandedBranchCount',
      'demandMatchedBranchCount',
      'demandOverriddenByCrossingCount',
      'demandOverriddenByInversionCount',
      'demandOverriddenByHierarchyCount',
      'pass2DemandMatchedBeforeCount',
      'pass2DemandMatchedAfterCount',
      'pass2ExactEndpointCrossingBeforeCount',
      'pass2ExactEndpointCrossingAfterCount',
      'pass2PrimaryManhattanSpanBefore',
      'pass2PrimaryManhattanSpanAfter',
      'pass1ToPass2BranchRegionChangeCount',
      'pass1ToPass2ModuleBoundsChangeCount',
    ],
    'Soft Compass evidence',
  );
  if (
    compass.demandPolicy !== 'spatial-cardinal' ||
    (compass.spatialDemandSummary !== 'dominant-cardinal' &&
      compass.spatialDemandSummary !== 'aggregate-vector')
  )
    throw new FocusSchematicLayoutProtocolError(
      'Soft Compass evidence does not match the production demand policy.',
    );
  for (const [key, metric] of Object.entries(compass))
    if (key !== 'demandPolicy' && key !== 'spatialDemandSummary')
      finiteNonNegative(metric, `Soft Compass evidence.${key}`);
  if (
    Number(compass.demandMatchedBranchCount) >
    Number(compass.demandedBranchCount)
  )
    throw new FocusSchematicLayoutProtocolError(
      'Soft Compass demand matches exceed demanded branches.',
    );
  const cohesion = record(evidence.cohesion, 'Soft folder cohesion evidence');
  exactKeys(
    cohesion,
    [
      'immediateFolderGroupCount',
      'immediateFolderSingletonCount',
      'immediateFolderCohesionMoveMean',
      'immediateFolderCohesionMoveP95',
      'immediateFolderCohesionMoveMax',
      'immediateFolderRmsRadiusMean',
      'immediateFolderRmsRadiusP95',
      'immediateFolderMaxPairDistanceMean',
      'immediateFolderMaxPairDistanceP95',
      'immediateFolderSplitViolationCount',
    ],
    'Soft folder cohesion evidence',
  );
  for (const [key, metric] of Object.entries(cohesion))
    if (metric !== null)
      finiteNonNegative(metric, `Soft folder cohesion evidence.${key}`);
  if (Number(cohesion.immediateFolderSplitViolationCount) !== 0)
    throw new FocusSchematicLayoutProtocolError(
      'Soft folder cohesion left a named immediate-folder split.',
    );
  const groupPacking = record(
    evidence.groupPacking,
    'Soft compound group packing evidence',
  );
  exactKeys(
    groupPacking,
    [
      'compoundGroupCount',
      'anchoredGroupCount',
      'groupPackingIterationCount',
      'groupPackingCollisionCheckCount',
      'groupPackingCorrectionCount',
      'groupPackingMs',
      'groupTranslationMean',
      'groupTranslationP95',
      'groupTranslationMax',
      'groupEnvelopeAreaMean',
      'groupEnvelopeAreaP95',
      'radialSpreadSafetyViolationCount',
    ],
    'Soft compound group packing evidence',
  );
  for (const [key, metric] of Object.entries(groupPacking))
    finiteNonNegative(metric, `Soft compound group packing evidence.${key}`);
  if (
    Number(groupPacking.anchoredGroupCount) !== 1 ||
    Number(groupPacking.radialSpreadSafetyViolationCount) !== 0
  )
    throw new FocusSchematicLayoutProtocolError(
      'Soft compound group packing evidence is invalid.',
    );
  const preCohesionMetrics = record(
    evidence.preCohesionMetrics,
    'Soft pre-cohesion metrics',
  );
  const postCohesionMetrics = record(
    evidence.postCohesionMetrics,
    'Soft post-cohesion metrics',
  );
  const preGroupMetrics = record(
    evidence.preGroupMetrics,
    'Soft pre-group metrics',
  );
  const finalMetrics = record(evidence.metrics, 'Soft final metrics');
  const metricKeys = [
    'repeatedFolderCount',
    'repeatedFolderModuleCount',
    'repeatedFolderRmsRadiusMean',
    'repeatedFolderRmsRadiusMedian',
    'repeatedFolderRmsRadiusP95',
    'childFolderCoherenceMean',
    'parentFolderCoherenceMean',
    'connectedPairCount',
    'connectedPairDistanceMean',
    'connectedPairDistanceP95',
    'exactPrimaryEndpointSpanMean',
    'exactPrimaryEndpointSpanP95',
    'exactEndpointCrossingCount',
    'hopMeanAbsoluteRadiusError',
    'hopRadiusCorrelation',
    'boundsWidth',
    'boundsHeight',
    'boundsArea',
    'overlapCount',
    'minimumModuleGap',
  ] as const;
  for (const [label, value] of [
    ['Soft pre-cohesion metrics', preCohesionMetrics],
    ['Soft post-cohesion metrics', postCohesionMetrics],
    ['Soft pre-group metrics', preGroupMetrics],
    ['Soft final metrics', finalMetrics],
  ] as const) {
    exactKeys(value, metricKeys, label);
    for (const key of metricKeys) {
      const metric = value[key];
      if (metric !== null) finiteNumber(metric, `${label}.${key}`);
    }
  }
  const resolvedSpacing = record(
    evidence.structuralSpacing,
    'Soft Cluster structural spacing',
  );
  exactKeys(
    resolvedSpacing,
    [
      'hopSpacing',
      'moduleGap',
      'topologyExtraDistance',
      'packingStep',
      'radialJitter',
      'internalNodeSeparation',
      'internalRankSeparation',
      'modulePaddingX',
      'modulePaddingY',
    ],
    'Soft Cluster structural spacing',
  );
  for (const [key, spacing] of Object.entries(resolvedSpacing)) {
    if (!Number.isSafeInteger(spacing) || Number(spacing) <= 0)
      throw new FocusSchematicLayoutProtocolError(
        `Soft Cluster structural spacing.${key} must be a positive integer.`,
      );
  }
  const metrics = record(evidence.metrics, 'Soft Cluster metrics');
  exactKeys(
    metrics,
    [
      'repeatedFolderCount',
      'repeatedFolderModuleCount',
      'repeatedFolderRmsRadiusMean',
      'repeatedFolderRmsRadiusMedian',
      'repeatedFolderRmsRadiusP95',
      'childFolderCoherenceMean',
      'parentFolderCoherenceMean',
      'connectedPairCount',
      'connectedPairDistanceMean',
      'connectedPairDistanceP95',
      'exactPrimaryEndpointSpanMean',
      'exactPrimaryEndpointSpanP95',
      'exactEndpointCrossingCount',
      'hopMeanAbsoluteRadiusError',
      'hopRadiusCorrelation',
      'boundsWidth',
      'boundsHeight',
      'boundsArea',
      'overlapCount',
      'minimumModuleGap',
    ],
    'Soft Cluster metrics',
  );
  for (const [key, metric] of Object.entries(metrics))
    if (metric !== null) finiteNumber(metric, `Soft Cluster metrics.${key}`);
  const runtime = record(evidence.runtime, 'Soft Cluster runtime');
  exactKeys(
    runtime,
    [
      'moduleCount',
      'primaryPairCount',
      'repeatedFolderCount',
      'iterationCount',
      'jointRoundCount',
      'compassAssignmentCount',
      'compassBranchRegionChurn',
      'collisionCheckCount',
      'collisionCorrectionCount',
      'layoutMs',
    ],
    'Soft Cluster runtime',
  );
  for (const [key, metric] of Object.entries(runtime))
    finiteNonNegative(metric, `Soft Cluster runtime.${key}`);
  if (
    metrics.overlapCount !== 0 ||
    runtime.iterationCount !== 54 ||
    runtime.jointRoundCount !== 2
  )
    throw new FocusSchematicLayoutProtocolError(
      'Soft Cluster bounded-runtime or collision evidence is invalid.',
    );
  return value as FocusSchematicSoftClusterEvidence;
}

export function validateFocusSchematicLayoutWorkerRequest(
  value: unknown,
): FocusSchematicLayoutWorkerRequest {
  const candidate = record(value, 'Focus Schematic worker request');
  exactKeys(
    candidate,
    ['protocolVersion', 'requestId', 'kind', 'input', 'policies'],
    'Focus Schematic worker request',
  );
  if (
    candidate.protocolVersion !== FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION
  ) {
    throw new FocusSchematicLayoutProtocolError(
      'Unsupported Focus Schematic worker protocol version.',
    );
  }
  if (candidate.kind !== 'layout') {
    throw new FocusSchematicLayoutProtocolError(
      'Focus Schematic worker request kind must be layout.',
    );
  }
  const id = requestId(candidate.requestId);
  const validation = validateFocusSchematicLayoutInput(candidate.input);
  if (!validation.valid) {
    throw new FocusSchematicLayoutProtocolError(
      `Invalid Focus Schematic layout input: ${validation.issues
        .map(({ path, message }) => `${path}: ${message}`)
        .join('; ')}`,
    );
  }
  const policies = record(candidate.policies, 'Focus Schematic policies');
  exactKeys(
    policies,
    [
      'macroLayout',
      'softFolderStrength',
      'softFolderScopeMode',
      'softAncestorDecayBase',
      'softFolderDisplayIntent',
      'endpointOrderPolicy',
      'internalLayoutVariant',
    ],
    'Focus Schematic policies',
  );
  if (!isFocusSchematicProductMacroLayout(policies.macroLayout))
    throw new FocusSchematicLayoutProtocolError(
      'Focus Schematic macro-layout policy is invalid.',
    );
  if (!isFocusSchematicEndpointOrderPolicy(policies.endpointOrderPolicy))
    throw new FocusSchematicLayoutProtocolError(
      'Focus Schematic endpoint order policy is invalid.',
    );
  if (
    !isFocusSchematicProductInternalLayoutVariant(
      policies.internalLayoutVariant,
    )
  )
    throw new FocusSchematicLayoutProtocolError(
      'Focus Schematic internal layout policy is invalid.',
    );
  const directional = policies.macroLayout === 'directional-bands';
  if (!isFocusSchematicSoftFolderScopeMode(policies.softFolderScopeMode))
    throw new FocusSchematicLayoutProtocolError(
      'Focus Schematic Soft folder scope mode is invalid.',
    );
  if (validation.value.settings.directionalFolderBandsEnabled !== directional)
    throw new FocusSchematicLayoutProtocolError(
      'Focus Schematic macro-layout policy does not match the layout input settings.',
    );
  let softFolderDisplayIntent;
  try {
    softFolderDisplayIntent = normalizeFocusSchematicSoftFolderDisplayIntent(
      policies.softFolderDisplayIntent,
    );
  } catch (error: unknown) {
    throw new FocusSchematicLayoutProtocolError(
      `Focus Schematic Soft folder display policy is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return {
    protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
    requestId: id,
    kind: 'layout',
    input: validation.value,
    policies: {
      macroLayout: policies.macroLayout,
      softFolderStrength: normalizeFocusSchematicSoftFolderStrength(
        policies.softFolderStrength,
      ),
      softFolderScopeMode: directional
        ? DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES.softFolderScopeMode
        : policies.softFolderScopeMode,
      softAncestorDecayBase:
        directional || policies.softFolderScopeMode === 'nearest-only'
          ? DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES.softAncestorDecayBase
          : normalizeFocusSchematicSoftAncestorDecayBase(
              policies.softAncestorDecayBase,
            ),
      softFolderDisplayIntent: directional
        ? { fileParentOverrides: [], flattenedFolderKeys: [] }
        : softFolderDisplayIntent,
      endpointOrderPolicy: policies.endpointOrderPolicy,
      internalLayoutVariant: policies.internalLayoutVariant,
    },
  };
}

export function validateFocusSchematicLayoutWorkerResponse(
  value: unknown,
  expectedRequestId: number,
  input: FocusSchematicLayoutInput,
  policies: FocusSchematicProductLayoutPolicies,
): FocusSchematicLayoutWorkerResponse {
  const candidate = record(value, 'Focus Schematic worker response');
  if (
    candidate.protocolVersion !== FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION
  ) {
    throw new FocusSchematicLayoutProtocolError(
      'Unsupported Focus Schematic worker response version.',
    );
  }
  if (requestId(candidate.requestId) !== expectedRequestId) {
    throw new FocusSchematicLayoutProtocolError(
      'Focus Schematic worker response requestId does not match.',
    );
  }
  if (candidate.kind === 'success') {
    exactKeys(
      candidate,
      [
        'protocolVersion',
        'requestId',
        'kind',
        'result',
        'softClusterEvidence',
        'timings',
        'computeMs',
      ],
      'Focus Schematic success response',
    );
    finiteNonNegative(candidate.computeMs, 'computeMs');
    const validation = validateFocusSchematicComputedLayout(
      input,
      candidate.result,
    );
    if (!validation.valid) {
      throw new FocusSchematicLayoutProtocolError(
        `Invalid computed layout: ${validation.issues
          .map(({ path, message }) => `${path}: ${message}`)
          .join('; ')}`,
      );
    }
    if (!focusSchematicLayoutMatchesProductPolicies(validation.value, policies))
      throw new FocusSchematicLayoutProtocolError(
        'Computed layout does not match the requested product policies.',
      );
    validateSoftClusterEvidence(candidate.softClusterEvidence, policies);
    // Phase timings are part of the attempt API. JSON cloning plus this exact
    // finite-number check prevents partial or embellished timing payloads.
    const timings = record(candidate.timings, 'Focus Schematic timings');
    const timingKeys = [
      'inputMs',
      'modulePlanningMs',
      'endpointConnectionMs',
      'demandCollectionMs',
      'subtreePropagationMs',
      'laneAssignmentMs',
      'centerLayoutMs',
      'leftLayoutMs',
      'rightLayoutMs',
      'compositionMs',
      'internalVariantMs',
      'macroMs',
      'crossingMinimizationMs',
      'folderInventoryMs',
      'folderInitialOrderMs',
      'folderOrderRefinementMs',
      'folderRankOrderingMs',
      'folderBandPackingMs',
      'folderModuleAssignmentMs',
      'folderExceptionAnalysisMs',
      'folderQualityMs',
      'attachmentMs',
      'qualityMs',
      'validationMs',
      'serializationMs',
      'totalMs',
      'dagreCallCount',
      'inputSerializedBytes',
      'outputSerializedBytes',
      'endpointLaneSerializedBytes',
      'folderBandSerializedBytes',
    ] as const;
    exactKeys(timings, timingKeys, 'Focus Schematic timings');
    for (const key of timingKeys) finiteNonNegative(timings[key], key);
    return candidate as unknown as FocusSchematicLayoutWorkerResponse;
  }
  if (candidate.kind === 'failure') {
    exactKeys(
      candidate,
      ['protocolVersion', 'requestId', 'kind', 'code', 'message', 'computeMs'],
      'Focus Schematic failure response',
    );
    if (
      candidate.code !== 'invalid-request' &&
      candidate.code !== 'invalid-input' &&
      candidate.code !== 'computation-failed'
    ) {
      throw new FocusSchematicLayoutProtocolError(
        'Focus Schematic failure response code is invalid.',
      );
    }
    if (
      typeof candidate.message !== 'string' ||
      candidate.message.length === 0
    ) {
      throw new FocusSchematicLayoutProtocolError(
        'Focus Schematic failure response message is required.',
      );
    }
    finiteNonNegative(candidate.computeMs, 'computeMs');
    return candidate as unknown as FocusSchematicLayoutWorkerResponse;
  }
  throw new FocusSchematicLayoutProtocolError(
    'Focus Schematic worker response kind is invalid.',
  );
}
