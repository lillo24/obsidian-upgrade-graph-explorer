import {
  evaluateFocusSchematicLayout,
  type FocusSchematicLayoutCandidate,
} from '@icarus-graph-explorer/focus-schematic';

import { computeFocusSchematicComputedLayoutAttempt } from './endpoint-facing';
import { FOCUS_SCHEMATIC_LAYOUT_CLEARANCE } from './settings';
import type {
  FocusSchematicEndpointLayoutPhaseTimings,
  FocusSchematicLayoutAttempt,
  FocusSchematicLayoutInput,
  FocusSchematicLayoutPhaseTimings,
} from './types';

function legacyTimings(
  timings: FocusSchematicEndpointLayoutPhaseTimings,
): FocusSchematicLayoutPhaseTimings {
  return {
    inputMs: timings.inputMs,
    planningMs:
      timings.modulePlanningMs +
      timings.endpointConnectionMs +
      timings.demandCollectionMs +
      timings.subtreePropagationMs +
      timings.laneAssignmentMs,
    internalMs:
      timings.centerLayoutMs +
      timings.leftLayoutMs +
      timings.rightLayoutMs +
      timings.compositionMs,
    macroMs: timings.macroMs,
    postMs:
      timings.crossingMinimizationMs +
      timings.folderInventoryMs +
      timings.folderInitialOrderMs +
      timings.folderOrderRefinementMs +
      timings.folderRankOrderingMs +
      timings.folderBandPackingMs +
      timings.folderModuleAssignmentMs +
      timings.folderExceptionAnalysisMs +
      timings.attachmentMs +
      timings.folderQualityMs,
    validateMs: timings.validationMs,
    qualityMs: timings.qualityMs,
    serializeMs: timings.serializationMs,
    totalMs: timings.totalMs,
  };
}

/**
 * Selected non-production layout attempt. The legacy attempt shape stays
 * available while A1's richer future-worker payload remains explicit through
 * computeFocusSchematicComputedLayoutAttempt.
 */
export function computeFocusSchematicLayoutAttempt(
  input: FocusSchematicLayoutInput,
): FocusSchematicLayoutAttempt {
  const attempt = computeFocusSchematicComputedLayoutAttempt(input);
  if (attempt.status !== 'success')
    return {
      status: attempt.status,
      strategyId: attempt.strategyId,
      configId: attempt.configId,
      reason: attempt.reason,
      timings: legacyTimings(attempt.timings),
    };

  const { candidate, modulePlan } = attempt.result;
  const selectedRelationshipCount = new Set(
    modulePlan.modules.flatMap(({ parentRelationshipId }) =>
      parentRelationshipId === null ? [] : [parentRelationshipId],
    ),
  ).size;
  const routedRelationshipCount = new Set(
    attempt.nativeRoutes.map(({ relationshipId }) => relationshipId),
  ).size;
  return {
    status: 'success',
    strategyId: attempt.strategyId,
    configId: attempt.configId,
    plan: modulePlan,
    candidate,
    quality: evaluateFocusSchematicLayout(input.model, candidate, {
      clearance: FOCUS_SCHEMATIC_LAYOUT_CLEARANCE,
      rankTolerance: 1,
    }),
    nativeRoutes: attempt.nativeRoutes,
    routeCoverage:
      selectedRelationshipCount === 0
        ? 1
        : routedRelationshipCount / selectedRelationshipCount,
    warnings: attempt.warnings,
    timings: legacyTimings(attempt.timings),
  };
}

/** Returns only the selected A1 candidate for HIER2 API compatibility. */
export function computeFocusSchematicLayout(
  input: FocusSchematicLayoutInput,
): FocusSchematicLayoutCandidate {
  const attempt = computeFocusSchematicLayoutAttempt(input);
  if (attempt.status !== 'success')
    throw new Error(`Focus Schematic layout failed: ${attempt.reason}`);
  return attempt.candidate;
}
