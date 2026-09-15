import type { NetworkPhysicsAttractor, NetworkPhysicsEdge } from './protocol';

export interface NetworkPhysicsDynamicCoupling {
  readonly activeNodeKeys: readonly string[];
  readonly stabilizedNodeKeys: readonly string[];
}

/**
 * Indexes undirected reference components once per retained simulation. Pull
 * memberships may couple whole components during a gesture; M2 folder
 * membership deliberately does not enter this runtime topology.
 */
export class NetworkPhysicsDynamicCouplingIndex {
  private readonly nodeKeys: readonly string[];
  private readonly componentByNodeKey: ReadonlyMap<string, number>;
  private readonly nodeKeysByComponent: readonly (readonly string[])[];

  constructor(
    nodeKeys: readonly string[],
    edges: readonly Pick<NetworkPhysicsEdge, 'source' | 'target'>[],
  ) {
    this.nodeKeys = [...nodeKeys].sort((left, right) =>
      left.localeCompare(right),
    );
    if (new Set(this.nodeKeys).size !== this.nodeKeys.length) {
      throw new Error('Network physics dynamic coupling duplicates a node.');
    }
    const neighbors = new Map(
      this.nodeKeys.map((key) => [key, new Set<string>()] as const),
    );
    for (const edge of edges) {
      const source = neighbors.get(edge.source);
      const target = neighbors.get(edge.target);
      if (source === undefined || target === undefined) {
        throw new Error(
          `Network physics dynamic coupling edge has a missing endpoint: ${edge.source} -> ${edge.target}.`,
        );
      }
      source.add(edge.target);
      target.add(edge.source);
    }
    const componentByNodeKey = new Map<string, number>();
    const nodeKeysByComponent: string[][] = [];
    for (const root of this.nodeKeys) {
      if (componentByNodeKey.has(root)) continue;
      const component = nodeKeysByComponent.length;
      const pending = [root];
      const members: string[] = [];
      componentByNodeKey.set(root, component);
      while (pending.length > 0) {
        const key = pending.pop()!;
        members.push(key);
        for (const neighbor of [...neighbors.get(key)!].sort((left, right) =>
          right.localeCompare(left),
        )) {
          if (componentByNodeKey.has(neighbor)) continue;
          componentByNodeKey.set(neighbor, component);
          pending.push(neighbor);
        }
      }
      nodeKeysByComponent.push(
        members.sort((left, right) => left.localeCompare(right)),
      );
    }
    this.componentByNodeKey = componentByNodeKey;
    this.nodeKeysByComponent = nodeKeysByComponent;
  }

  /**
   * Stable undirected components for the lifetime of one retained simulation.
   * The returned membership is seed-derived and never re-captured from a
   * gesture's released coordinates.
   */
  components(): readonly (readonly string[])[] {
    return this.nodeKeysByComponent;
  }

  resolve(
    constraintNodeKey: string,
    attractors: readonly NetworkPhysicsAttractor[],
  ): NetworkPhysicsDynamicCoupling {
    const constraintComponent = this.componentByNodeKey.get(constraintNodeKey);
    if (constraintComponent === undefined) {
      throw new Error(
        `Network physics dynamic coupling omitted constrained node ${constraintNodeKey}.`,
      );
    }
    const activeComponents = new Set([constraintComponent]);
    const pullComponents = attractors
      .filter(({ strength }) => strength > 0)
      .map((attractor) => {
        const components = new Set<number>();
        for (const key of attractor.memberNodeKeys) {
          const component = this.componentByNodeKey.get(key);
          if (component === undefined) {
            throw new Error(
              `Network physics Pull membership omitted node ${key}.`,
            );
          }
          components.add(component);
        }
        return [...components].sort((left, right) => left - right);
      });
    let changed = true;
    while (changed) {
      changed = false;
      for (const components of pullComponents) {
        if (!components.some((component) => activeComponents.has(component))) {
          continue;
        }
        for (const component of components) {
          if (activeComponents.has(component)) continue;
          activeComponents.add(component);
          changed = true;
        }
      }
    }
    const activeNodeKeys = this.nodeKeysByComponent
      .filter((_members, component) => activeComponents.has(component))
      .flat();
    const active = new Set(activeNodeKeys);
    return {
      activeNodeKeys,
      stabilizedNodeKeys: this.nodeKeys.filter((key) => !active.has(key)),
    };
  }
}
