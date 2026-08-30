import type {
  DagreLayoutEdge,
  DagreLayoutInput,
  DagreLayoutNode,
  DagreLayoutOutput,
} from './types';

export class DagreLayoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DagreLayoutValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function validNode(value: unknown): value is DagreLayoutNode {
  return (
    isRecord(value) &&
    nonEmptyString(value.id) &&
    finitePositive(value.width) &&
    finitePositive(value.height)
  );
}

function validEdge(value: unknown): value is DagreLayoutEdge {
  return (
    isRecord(value) &&
    nonEmptyString(value.id) &&
    nonEmptyString(value.source) &&
    nonEmptyString(value.target) &&
    (value.kind === 'hierarchy' || value.kind === 'reference')
  );
}

function assertUniqueIds(
  values: readonly { readonly id: string }[],
  label: string,
): void {
  const ids = new Set<string>();
  for (const value of values) {
    if (ids.has(value.id)) {
      throw new DagreLayoutValidationError(
        `Dagre layout ${label} IDs must be unique; duplicate ${value.id}.`,
      );
    }
    ids.add(value.id);
  }
}

export function validateDagreLayoutInput(value: unknown): DagreLayoutInput {
  if (
    !isRecord(value) ||
    (value.mode !== 'structure' && value.mode !== 'focus') ||
    !Array.isArray(value.nodes) ||
    !value.nodes.every(validNode) ||
    !Array.isArray(value.edges) ||
    !value.edges.every(validEdge)
  ) {
    throw new DagreLayoutValidationError(
      'Dagre layout input must contain a supported mode and plain nodes/edges.',
    );
  }
  assertUniqueIds(value.nodes, 'node');
  assertUniqueIds(value.edges, 'edge');
  const nodeIds = new Set(value.nodes.map(({ id }) => id));
  for (const edge of value.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      throw new DagreLayoutValidationError(
        `Dagre layout edge ${edge.id} must reference existing nodes.`,
      );
    }
  }
  return value as unknown as DagreLayoutInput;
}

export function validateDagreLayoutOutput(
  input: DagreLayoutInput,
  value: unknown,
): DagreLayoutOutput {
  if (!isRecord(value) || !Array.isArray(value.positions)) {
    throw new DagreLayoutValidationError(
      'Dagre layout output must contain a plain positions array.',
    );
  }
  const positions = value.positions;
  for (const position of positions) {
    if (
      !isRecord(position) ||
      !nonEmptyString(position.id) ||
      typeof position.x !== 'number' ||
      !Number.isFinite(position.x) ||
      typeof position.y !== 'number' ||
      !Number.isFinite(position.y)
    ) {
      throw new DagreLayoutValidationError(
        'Every Dagre layout position must have an ID and finite coordinates.',
      );
    }
  }
  assertUniqueIds(positions as { readonly id: string }[], 'position');
  const expected = input.nodes.map(({ id }) => id);
  const actual = positions.map(({ id }) => id);
  if (
    expected.length !== actual.length ||
    expected.some((id, index) => actual[index] !== id)
  ) {
    throw new DagreLayoutValidationError(
      'Dagre layout positions must cover every input node in input order.',
    );
  }
  return value as unknown as DagreLayoutOutput;
}
