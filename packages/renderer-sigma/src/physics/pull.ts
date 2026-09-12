import type { MultiDirectedGraph } from 'graphology';

import type { NetworkPhysicsAttractor } from './protocol';

type PullGraph = MultiDirectedGraph<
  { x: number; y: number; size: number; constraintEligible?: boolean },
  { weight: number }
>;

export const NETWORK_PHYSICS_PULL_REFERENCE_ITERATIONS = 4 as const;

function graphScale(graph: PullGraph): number {
  if (graph.order === 0) return 1e-6;
  let centerX = 0;
  let centerY = 0;
  graph.forEachNode((_key, node) => {
    centerX += node.x / graph.order;
    centerY += node.y / graph.order;
  });
  let squaredDistance = 0;
  graph.forEachNode((_key, node) => {
    squaredDistance += (node.x - centerX) ** 2 + (node.y - centerY) ** 2;
  });
  return Math.max(1e-6, Math.sqrt(squaredDistance / graph.order));
}

/**
 * Applies one physical-iteration share of the PHYSICS1 four-iteration Pull
 * reference quantum. Publish frequency therefore cannot change Pull strength;
 * numerical identity with the static five-iteration correction cadence is not
 * implied.
 */
export function applyNetworkPhysicsPullIteration(
  graph: PullGraph,
  attractors: readonly NetworkPhysicsAttractor[],
): void {
  const scale = graphScale(graph);
  for (const attractor of [...attractors].sort((left, right) =>
    left.ruleFolderKey.localeCompare(right.ruleFolderKey),
  )) {
    const strength = attractor.strength / 100;
    if (strength === 0) continue;
    let currentX = 0;
    let currentY = 0;
    for (const key of attractor.memberNodeKeys) {
      const node = graph.getNodeAttributes(key);
      currentX += node.x / attractor.memberNodeKeys.length;
      currentY += node.y / attractor.memberNodeKeys.length;
    }
    const dx = attractor.targetX - currentX;
    const dy = attractor.targetY - currentY;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) continue;
    const gain =
      1 -
      (1 - 0.55 * strength) ** (1 / NETWORK_PHYSICS_PULL_REFERENCE_ITERATIONS);
    const cap =
      (0.6 * scale * strength) / NETWORK_PHYSICS_PULL_REFERENCE_ITERATIONS;
    const multiplier = Math.min(gain, cap / distance);
    for (const key of attractor.memberNodeKeys) {
      const node = graph.getNodeAttributes(key);
      graph.mergeNodeAttributes(key, {
        x: node.x + dx * multiplier,
        y: node.y + dy * multiplier,
      });
    }
  }
}
