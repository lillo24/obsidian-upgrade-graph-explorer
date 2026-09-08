import type {
  FocusSchematicLayoutInput,
  FocusSchematicLayoutInputValidationIssue,
  FocusSchematicLayoutInputValidationResult,
} from './types';

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function plainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function exactKeys(value: unknown, keys: readonly string[]): boolean {
  return (
    plainObject(value) &&
    Object.keys(value).sort(compareText).join('|') ===
      [...keys].sort(compareText).join('|')
  );
}

export function validateFocusSchematicLayoutInput(
  value: unknown,
): FocusSchematicLayoutInputValidationResult {
  const issues: FocusSchematicLayoutInputValidationIssue[] = [];
  if (
    !exactKeys(value, ['model', 'projection', 'nodeDimensions', 'settings'])
  ) {
    return {
      valid: false,
      issues: [{ path: '$', message: 'Layout input has unsupported fields.' }],
    };
  }
  const input = value as unknown as FocusSchematicLayoutInput;
  if (
    !plainObject(input.model) ||
    input.model.schemaVersion !== 1 ||
    typeof input.model.rootModuleId !== 'string' ||
    !Array.isArray(input.model.modules) ||
    !Array.isArray(input.model.folders) ||
    !Array.isArray(input.model.relationships) ||
    !Array.isArray(input.model.parentCandidates)
  )
    issues.push({
      path: '$.model',
      message: 'Model header or collections are invalid.',
    });
  if (
    !plainObject(input.projection) ||
    !Array.isArray(input.projection.nodes) ||
    !Array.isArray(input.projection.edges) ||
    !Array.isArray(input.projection.issues)
  )
    issues.push({ path: '$.projection', message: 'Projection is invalid.' });
  if (!Array.isArray(input.nodeDimensions))
    issues.push({
      path: '$.nodeDimensions',
      message: 'Dimensions must be an array.',
    });
  if (!plainObject(input.settings))
    issues.push({
      path: '$.settings',
      message: 'Settings must be a plain object.',
    });
  if (issues.length > 0) return { valid: false, issues };

  const expectedNodeOwner = new Map(
    input.model.modules.flatMap((module) =>
      module.visibleEntityNodeIds.map((nodeId) => [nodeId, module.id] as const),
    ),
  );
  const projectionEntityIds = new Set(
    input.projection.nodes
      .filter(({ kind }) => kind === 'entity')
      .map(({ id }) => id),
  );
  const seen = new Set<string>();
  let previous = '';
  input.nodeDimensions.forEach((dimension, index) => {
    if (
      !exactKeys(dimension, ['projectionNodeId', 'width', 'height']) ||
      typeof dimension.projectionNodeId !== 'string' ||
      !Number.isFinite(dimension.width) ||
      !Number.isFinite(dimension.height) ||
      dimension.width <= 0 ||
      dimension.height <= 0
    )
      issues.push({
        path: `$.nodeDimensions[${index}]`,
        message:
          'Dimension record must have a known ID and positive finite size.',
      });
    if (seen.has(dimension.projectionNodeId))
      issues.push({
        path: '$.nodeDimensions',
        message: `Duplicate dimension for "${dimension.projectionNodeId}".`,
      });
    if (!expectedNodeOwner.has(dimension.projectionNodeId))
      issues.push({
        path: '$.nodeDimensions',
        message: `Unknown visible node "${dimension.projectionNodeId}".`,
      });
    if (!projectionEntityIds.has(dimension.projectionNodeId))
      issues.push({
        path: '$.projection',
        message: `Dimension node "${dimension.projectionNodeId}" is not a projected entity.`,
      });
    if (index > 0 && compareText(previous, dimension.projectionNodeId) >= 0)
      issues.push({
        path: '$.nodeDimensions',
        message: 'Dimensions must be strictly ordered by projectionNodeId.',
      });
    previous = dimension.projectionNodeId;
    seen.add(dimension.projectionNodeId);
  });
  for (const nodeId of expectedNodeOwner.keys())
    if (!seen.has(nodeId))
      issues.push({
        path: '$.nodeDimensions',
        message: `Missing dimension for "${nodeId}".`,
      });

  const settingsKeys = [
    'diagnosticReserveHeight',
    'filteredModulePolicy',
    'directionalFolderBandsEnabled',
    'internalNodeSeparation',
    'internalRankSeparation',
    'macroNodeSeparation',
    'macroRankSeparation',
    'modulePaddingX',
    'modulePaddingY',
    'ranker',
  ];
  if (!exactKeys(input.settings, settingsKeys))
    issues.push({ path: '$.settings', message: 'Settings shape is invalid.' });
  const numericSettings = [
    input.settings.modulePaddingX,
    input.settings.modulePaddingY,
    input.settings.diagnosticReserveHeight,
    input.settings.internalNodeSeparation,
    input.settings.internalRankSeparation,
    input.settings.macroNodeSeparation,
    input.settings.macroRankSeparation,
  ];
  if (numericSettings.some((item) => !Number.isFinite(item) || item < 0))
    issues.push({
      path: '$.settings',
      message: 'Spacing must be finite and nonnegative.',
    });
  if (typeof input.settings.directionalFolderBandsEnabled !== 'boolean')
    issues.push({
      path: '$.settings.directionalFolderBandsEnabled',
      message: 'Directional Folder Bands must be enabled or disabled.',
    });
  if (
    !['compact-bridge', 'context-card'].includes(
      input.settings.filteredModulePolicy,
    )
  )
    issues.push({
      path: '$.settings.filteredModulePolicy',
      message: 'Unknown filtered policy.',
    });
  if (
    !['network-simplex', 'tight-tree', 'longest-path'].includes(
      input.settings.ranker,
    )
  )
    issues.push({
      path: '$.settings.ranker',
      message: 'Unknown Dagre ranker.',
    });

  return issues.length > 0
    ? { valid: false, issues }
    : { valid: true, value: input, issues: [] };
}

export function assertFocusSchematicLayoutInput(
  value: unknown,
): asserts value is FocusSchematicLayoutInput {
  const result = validateFocusSchematicLayoutInput(value);
  if (!result.valid)
    throw new Error(
      `Invalid Focus Schematic layout input: ${result.issues
        .map(({ path, message }) => `${path}: ${message}`)
        .join('; ')}`,
    );
}
