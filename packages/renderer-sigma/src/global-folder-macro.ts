import { stableHash32 } from './deterministic';
import { resolveGlobalPhysicsSettings } from './settings';
import type {
  GlobalFolderMacroPolicy,
  GlobalLayoutNode,
  GlobalLayoutPosition,
  GlobalLayoutSettings,
} from './types';

export const GLOBAL_FOLDER_NONE_VERSION = 'global-folder-none-v1' as const;
export const GLOBAL_FOLDER_FIXED_FIELD_VERSION =
  'global-folder-fixed-field-v1' as const;

function folderDirection(folderKey: string): { x: number; y: number } {
  const angle = (stableHash32(folderKey) / 0xffff_ffff) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function createGlobalFolderMacroPolicy(
  nodes: readonly Pick<GlobalLayoutNode, 'folderKey'>[],
  settings: GlobalLayoutSettings,
): GlobalFolderMacroPolicy {
  const resolved = resolveGlobalPhysicsSettings(settings);
  const active =
    resolved.folderClustering &&
    resolved.folderCohesion > 0 &&
    nodes.some(({ folderKey }) => folderKey !== undefined);
  return active
    ? {
        version: GLOBAL_FOLDER_FIXED_FIELD_VERSION,
        algorithm: 'fixed-total-field',
        priorApplications: 1,
        feedback: 'output-only',
      }
    : {
        version: GLOBAL_FOLDER_NONE_VERSION,
        algorithm: 'reference-only',
        priorApplications: 0,
        feedback: 'output-only',
      };
}

export function validateGlobalFolderMacroPolicy(input: {
  readonly policy: GlobalFolderMacroPolicy;
  readonly nodes: readonly Pick<GlobalLayoutNode, 'folderKey'>[];
  readonly settings: GlobalLayoutSettings;
}): void {
  const expected = createGlobalFolderMacroPolicy(input.nodes, input.settings);
  if (Object.keys(input.policy).length !== Object.keys(expected).length) {
    throw new Error(`Global folder macro does not match ${expected.version}.`);
  }
  for (const key of Object.keys(
    expected,
  ) as (keyof GlobalFolderMacroPolicy)[]) {
    if (input.policy[key] !== expected[key]) {
      throw new Error(
        `Global folder macro ${key} does not match ${expected.version}.`,
      );
    }
  }
}

/**
 * Applies one current-prior-equivalent transform to an output snapshot only.
 * The returned coordinates never feed the working FA2 graph, so additional
 * convergence steps cannot multiply cohesion or folder separation.
 */
export function deriveGlobalFolderMacroSnapshot(input: {
  readonly nodes: readonly Pick<GlobalLayoutNode, 'key' | 'folderKey'>[];
  readonly positions: readonly GlobalLayoutPosition[];
  readonly settings: GlobalLayoutSettings;
  readonly policy: GlobalFolderMacroPolicy;
}): readonly GlobalLayoutPosition[] {
  validateGlobalFolderMacroPolicy({
    policy: input.policy,
    nodes: input.nodes,
    settings: input.settings,
  });
  const output = new Map(
    input.positions.map((position) => [position.key, { ...position }] as const),
  );
  if (output.size !== input.nodes.length) {
    throw new Error('Global folder macro snapshot has the wrong node count.');
  }
  if (input.policy.algorithm === 'reference-only') {
    return [...output.values()].sort((left, right) =>
      left.key.localeCompare(right.key),
    );
  }
  const resolved = resolveGlobalPhysicsSettings(input.settings);
  const folders = new Map<
    string,
    { readonly keys: string[]; x: number; y: number }
  >();
  let centroidX = 0;
  let centroidY = 0;
  for (const node of input.nodes) {
    const position = output.get(node.key);
    if (position === undefined) {
      throw new Error(`Global folder macro snapshot omitted node ${node.key}.`);
    }
    centroidX += position.x;
    centroidY += position.y;
    if (node.folderKey === undefined) continue;
    const folder = folders.get(node.folderKey) ?? { keys: [], x: 0, y: 0 };
    folder.keys.push(node.key);
    folder.x += position.x;
    folder.y += position.y;
    folders.set(node.folderKey, folder);
  }
  centroidX /= input.nodes.length;
  centroidY /= input.nodes.length;
  const scale = Math.max(
    1,
    Math.sqrt(
      input.positions.reduce(
        (sum, position) =>
          sum + (position.x - centroidX) ** 2 + (position.y - centroidY) ** 2,
        0,
      ) / input.positions.length,
    ),
  );
  const radialFactor =
    1 - resolved.folderCohesion + (resolved.withinFolderSpacing - 1) * 0.012;
  const separation =
    resolved.folderCohesion * 0.16 * resolved.betweenFolderSpacing * scale;
  for (const [folderKey, folder] of [...folders].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const x = folder.x / folder.keys.length;
    const y = folder.y / folder.keys.length;
    const direction = folderDirection(folderKey);
    for (const key of folder.keys.sort((left, right) =>
      left.localeCompare(right),
    )) {
      const position = output.get(key)!;
      output.set(key, {
        key,
        x: x + (position.x - x) * radialFactor + direction.x * separation,
        y: y + (position.y - y) * radialFactor + direction.y * separation,
      });
    }
  }
  return [...output.values()].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}
