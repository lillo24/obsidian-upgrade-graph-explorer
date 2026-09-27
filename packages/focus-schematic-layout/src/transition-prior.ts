import type {
  FocusSchematicComputedLayout,
  FocusSchematicLayoutInput,
} from './types';
import type { FocusSchematicProductLayoutPolicies } from './policies';
import {
  focusSchematicLayoutMatchesProductPolicies,
  isFocusSchematicEndpointOrderPolicy,
  isFocusSchematicProductInternalLayoutVariant,
  isFocusSchematicProductMacroLayout,
  isFocusSchematicSoftFolderScopeMode,
  normalizeFocusSchematicSoftAncestorDecayBase,
  normalizeFocusSchematicSoftFolderDisplayIntent,
  normalizeFocusSchematicSoftFolderStrength,
} from './policies';
import { validateFocusSchematicLayoutInput } from './input';
import { validateFocusSchematicComputedLayout } from './endpoint-facing';

export interface FocusSchematicLayoutTransitionPrior {
  readonly schemaVersion: 1;
  readonly input: FocusSchematicLayoutInput;
  readonly policies: FocusSchematicProductLayoutPolicies;
  readonly policiesFingerprint: string;
  readonly result: FocusSchematicComputedLayout;
}

export interface FocusSchematicTransitionClassification {
  readonly classification: 'cold-required' | 'local-internal-change';
  readonly eligible: boolean;
  readonly reason: string;
  readonly affectedModuleIds: readonly string[];
}

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function canonical(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (
      item !== null &&
      typeof item === 'object' &&
      Object.getPrototypeOf(item) === Object.prototype
    )
      return Object.fromEntries(
        Object.entries(item)
          .sort(([left], [right]) => compareText(left, right))
          .map(([key, child]) => [key, normalize(child)]),
      );
    return item;
  };
  return JSON.stringify(normalize(value));
}

export function focusSchematicTransitionPoliciesFingerprint(
  policies: FocusSchematicProductLayoutPolicies,
): string {
  return canonical({
    ...policies,
    softFolderStrength: normalizeFocusSchematicSoftFolderStrength(
      policies.softFolderStrength,
    ),
    softAncestorDecayBase: normalizeFocusSchematicSoftAncestorDecayBase(
      policies.softAncestorDecayBase,
    ),
    softFolderDisplayIntent: normalizeFocusSchematicSoftFolderDisplayIntent(
      policies.softFolderDisplayIntent,
    ),
  });
}

export function createFocusSchematicLayoutTransitionPrior(
  input: FocusSchematicLayoutInput,
  policies: FocusSchematicProductLayoutPolicies,
  result: FocusSchematicComputedLayout,
): FocusSchematicLayoutTransitionPrior {
  const validation = validateFocusSchematicComputedLayout(input, result);
  if (!validation.valid)
    throw new Error('Cannot create a transition prior from an invalid layout.');
  if (!focusSchematicLayoutMatchesProductPolicies(result, policies))
    throw new Error(
      'Cannot create a transition prior with mismatched policies.',
    );
  return {
    schemaVersion: 1,
    input,
    policies,
    policiesFingerprint: focusSchematicTransitionPoliciesFingerprint(policies),
    result,
  };
}

function plainRecord(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
    ? (value as Record<string, unknown>)
    : null;
}

function validatePolicies(value: unknown): FocusSchematicProductLayoutPolicies {
  const policies = plainRecord(value);
  if (
    policies === null ||
    Object.keys(policies).sort().join('|') !==
      [
        'endpointOrderPolicy',
        'internalLayoutVariant',
        'macroLayout',
        'softAncestorDecayBase',
        'softFolderDisplayIntent',
        'softFolderScopeMode',
        'softFolderStrength',
      ]
        .sort()
        .join('|') ||
    !isFocusSchematicProductMacroLayout(policies.macroLayout) ||
    !isFocusSchematicProductInternalLayoutVariant(
      policies.internalLayoutVariant,
    ) ||
    !isFocusSchematicEndpointOrderPolicy(policies.endpointOrderPolicy) ||
    !isFocusSchematicSoftFolderScopeMode(policies.softFolderScopeMode) ||
    !Number.isFinite(policies.softFolderStrength) ||
    (policies.softAncestorDecayBase !== 3 &&
      policies.softAncestorDecayBase !== 4)
  )
    throw new Error('Transition prior policies are malformed.');
  return {
    macroLayout: policies.macroLayout,
    softFolderStrength: normalizeFocusSchematicSoftFolderStrength(
      policies.softFolderStrength,
    ),
    softFolderScopeMode: policies.softFolderScopeMode,
    softAncestorDecayBase: normalizeFocusSchematicSoftAncestorDecayBase(
      policies.softAncestorDecayBase,
    ),
    softFolderDisplayIntent: normalizeFocusSchematicSoftFolderDisplayIntent(
      policies.softFolderDisplayIntent,
    ),
    endpointOrderPolicy: policies.endpointOrderPolicy,
    internalLayoutVariant: policies.internalLayoutVariant,
  };
}

export function validateFocusSchematicLayoutTransitionPrior(
  value: unknown,
): FocusSchematicLayoutTransitionPrior {
  const candidate = plainRecord(value);
  if (
    candidate === null ||
    Object.keys(candidate).sort().join('|') !==
      ['input', 'policies', 'policiesFingerprint', 'result', 'schemaVersion']
        .sort()
        .join('|') ||
    candidate.schemaVersion !== 1 ||
    typeof candidate.policiesFingerprint !== 'string'
  )
    throw new Error('Transition prior has an unsupported shape.');
  const input = validateFocusSchematicLayoutInput(candidate.input);
  if (!input.valid) throw new Error('Transition prior input is invalid.');
  const policies = validatePolicies(candidate.policies);
  if (
    candidate.policiesFingerprint !==
    focusSchematicTransitionPoliciesFingerprint(policies)
  )
    throw new Error('Transition prior policy fingerprint is invalid.');
  const result = validateFocusSchematicComputedLayout(
    input.value,
    candidate.result,
  );
  if (!result.valid)
    throw new Error('Transition prior computed layout is invalid.');
  if (!focusSchematicLayoutMatchesProductPolicies(result.value, policies))
    throw new Error('Transition prior policies do not match its layout.');
  return {
    schemaVersion: 1,
    input: input.value,
    policies,
    policiesFingerprint: candidate.policiesFingerprint,
    result: result.value,
  };
}

function stableModuleSignature(
  input: FocusSchematicLayoutInput,
  moduleId: string,
): string {
  const module = input.model.modules.find(({ id }) => id === moduleId);
  if (module === undefined) return '';
  return canonical({
    id: module.id,
    documentEntityId: module.documentEntityId,
    sourcePath: module.sourcePath,
    folderKey: module.folderKey,
    presentation: module.presentation,
    documentProjectionNodeId: module.documentProjectionNodeId,
    focusDistance: module.focusDistance,
    incomingDistance: module.incomingDistance,
    outgoingDistance: module.outgoingDistance,
    placement: module.placement,
  });
}

function primaryTopology(input: FocusSchematicLayoutInput): string {
  return canonical(
    input.model.relationships
      .filter(({ secondary }) => !secondary)
      .map((relationship) => ({
        id: relationship.id,
        sourceModuleId: relationship.sourceModuleId,
        targetModuleId: relationship.targetModuleId,
        referenceIds: relationship.referenceIds,
        incomingPathForModuleIds: relationship.incomingPathForModuleIds,
        outgoingPathForModuleIds: relationship.outgoingPathForModuleIds,
        selectedBackboneForModuleIds: relationship.selectedBackboneForModuleIds,
      }))
      .sort((left, right) => compareText(left.id, right.id)),
  );
}

function secondaryTopology(input: FocusSchematicLayoutInput): string {
  return canonical(
    input.model.relationships
      .filter(({ secondary }) => secondary)
      .sort((left, right) => compareText(left.id, right.id)),
  );
}

function moduleInternalSignature(
  input: FocusSchematicLayoutInput,
  moduleId: string,
): string {
  const module = input.model.modules.find(({ id }) => id === moduleId);
  if (module === undefined) return '';
  const nodeIds = new Set(module.visibleEntityNodeIds);
  const edgeIds = new Set(module.hierarchyEdgeIds);
  return canonical({
    visibleEntityNodeIds: [...module.visibleEntityNodeIds].sort(compareText),
    hierarchyEdgeIds: [...module.hierarchyEdgeIds].sort(compareText),
    internalReferenceIds: [...module.internalReferenceIds].sort(compareText),
    diagnosticIds: [...module.diagnosticIds].sort(compareText),
    nodes: input.projection.nodes
      .filter(({ id }) => nodeIds.has(id))
      .sort((left, right) => compareText(left.id, right.id)),
    edges: input.projection.edges
      .filter(({ id }) => edgeIds.has(id))
      .sort((left, right) => compareText(left.id, right.id)),
    dimensions: input.nodeDimensions
      .filter(({ projectionNodeId }) => nodeIds.has(projectionNodeId))
      .sort((left, right) =>
        compareText(left.projectionNodeId, right.projectionNodeId),
      ),
    endpointGroups: input.model.relationships
      .filter(({ secondary }) => !secondary)
      .flatMap((relationship) =>
        relationship.visibleEndpointGroups
          .filter(
            (group) =>
              nodeIds.has(group.sourceProjectionNodeId) ||
              nodeIds.has(group.targetProjectionNodeId),
          )
          .map((group) => ({ relationshipId: relationship.id, ...group })),
      ),
  });
}

function cold(reason: string): FocusSchematicTransitionClassification {
  return {
    classification: 'cold-required',
    eligible: false,
    reason,
    affectedModuleIds: [],
  };
}

export function classifyFocusSchematicLayoutTransition(
  current: FocusSchematicLayoutInput,
  policies: FocusSchematicProductLayoutPolicies,
  prior: FocusSchematicLayoutTransitionPrior,
): FocusSchematicTransitionClassification {
  if (current.model.rootModuleId !== prior.input.model.rootModuleId)
    return cold('focus-root-changed');
  if (
    focusSchematicTransitionPoliciesFingerprint(policies) !==
    prior.policiesFingerprint
  )
    return cold('layout-policy-changed');
  if (policies.macroLayout !== 'soft-folder-clusters')
    return cold('macro-family-not-supported-incrementally');
  if (canonical(current.settings) !== canonical(prior.input.settings))
    return cold('structural-layout-settings-changed');
  const currentIds = current.model.modules
    .map(({ id }) => id)
    .sort(compareText);
  const priorIds = prior.input.model.modules
    .map(({ id }) => id)
    .sort(compareText);
  if (canonical(currentIds) !== canonical(priorIds))
    return cold('file-module-set-changed');
  if (
    currentIds.some(
      (id) =>
        stableModuleSignature(current, id) !==
        stableModuleSignature(prior.input, id),
    )
  )
    return cold('file-module-structure-changed');
  if (canonical(current.model.folders) !== canonical(prior.input.model.folders))
    return cold('folder-hierarchy-changed');
  if (primaryTopology(current) !== primaryTopology(prior.input))
    return cold('primary-file-topology-changed');
  const affectedModuleIds = currentIds.filter(
    (id) =>
      moduleInternalSignature(current, id) !==
      moduleInternalSignature(prior.input, id),
  );
  if (affectedModuleIds.length === 0) {
    if (secondaryTopology(current) !== secondaryTopology(prior.input))
      return {
        classification: 'local-internal-change',
        eligible: true,
        reason: 'secondary-reference-change',
        affectedModuleIds,
      };
    return cold('no-local-internal-change');
  }
  return {
    classification: 'local-internal-change',
    eligible: true,
    reason: 'local-internal-change',
    affectedModuleIds,
  };
}
