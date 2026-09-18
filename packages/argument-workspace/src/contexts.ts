import type { ArgumentContext, ArgumentLibrary } from './types';

export interface ResolvedArgumentContext {
  readonly context: ArgumentContext;
  /** Ancestors in root-to-parent order. */
  readonly parentContextIds: readonly string[];
  readonly inheritedAxiomIds: readonly string[];
  /** Parent axioms first, then direct axioms, with first occurrence winning. */
  readonly effectiveAxiomIds: readonly string[];
}

export interface ResolvedArgumentBackground {
  readonly contexts: readonly ResolvedArgumentContext[];
  readonly axioms: readonly {
    readonly axiomId: string;
    /** Attached Context IDs through which the Axiom is effective. */
    readonly viaContextIds: readonly string[];
  }[];
}

function appendUnique(target: string[], values: readonly string[]): void {
  const seen = new Set(target);
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    target.push(value);
  }
}

/**
 * Resolves Context inheritance independently from the inference dependency
 * graph. A valid library cannot contain missing parents or cycles; defensive
 * errors keep callers from receiving a plausible-looking partial result.
 */
export function createContextResolver(
  library: ArgumentLibrary,
): (contextId: string) => ResolvedArgumentContext {
  const contextsById = new Map(
    library.contexts.map((context) => [context.id, context]),
  );
  const memo = new Map<string, ResolvedArgumentContext>();
  const visiting = new Set<string>();

  const resolve = (contextId: string): ResolvedArgumentContext => {
    const cached = memo.get(contextId);
    if (cached !== undefined) return cached;
    const context = contextsById.get(contextId);
    if (context === undefined) {
      throw new Error(`Context "${contextId}" does not exist.`);
    }
    if (visiting.has(contextId)) {
      throw new Error(
        `Context inheritance cycle encountered at "${contextId}".`,
      );
    }
    visiting.add(contextId);
    const parent =
      context.parentContextId === undefined
        ? undefined
        : resolve(context.parentContextId);
    const inheritedAxiomIds = [...(parent?.effectiveAxiomIds ?? [])];
    const effectiveAxiomIds = [...inheritedAxiomIds];
    appendUnique(effectiveAxiomIds, context.axiomIds);
    const result: ResolvedArgumentContext = {
      context,
      parentContextIds:
        parent === undefined
          ? []
          : [...parent.parentContextIds, parent.context.id],
      inheritedAxiomIds,
      effectiveAxiomIds,
    };
    visiting.delete(contextId);
    memo.set(contextId, result);
    return result;
  };
  return resolve;
}

export function resolveArgumentBackground(
  library: ArgumentLibrary,
  contextIds: readonly string[],
): ResolvedArgumentBackground {
  const resolve = createContextResolver(library);
  const contexts = contextIds.map(resolve);
  const provenance = new Map<string, string[]>();
  for (const resolved of contexts) {
    for (const axiomId of resolved.effectiveAxiomIds) {
      const via = provenance.get(axiomId) ?? [];
      if (!via.includes(resolved.context.id)) via.push(resolved.context.id);
      provenance.set(axiomId, via);
    }
  }
  return {
    contexts,
    axioms: [...provenance].map(([axiomId, viaContextIds]) => ({
      axiomId,
      viaContextIds,
    })),
  };
}
