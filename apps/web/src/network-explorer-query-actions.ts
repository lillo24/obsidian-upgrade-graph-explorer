import {
  addExactPathExclusion,
  parseGraphQuery,
  removeExactPathExclusion,
} from '@icarus-graph-explorer/graph-query';

export type ExactPathQueryMutationPlan =
  | {
      readonly ok: true;
      readonly query: string | undefined;
      readonly draft: string;
    }
  | { readonly ok: false; readonly issue: string };

/** Validate both representations before committing either; never concatenate QUERY1. */
export function planExactPathQueryMutation(args: {
  readonly activeQuery: string | undefined;
  readonly queryDraft: string;
  readonly path: string;
  readonly operation: 'add' | 'remove';
}): ExactPathQueryMutationPlan {
  const dirty = args.queryDraft !== (args.activeQuery ?? '');
  const draft =
    args.queryDraft.trim().length === 0 ? undefined : args.queryDraft;
  if (dirty && draft !== undefined && !parseGraphQuery(draft).valid) {
    return {
      ok: false,
      issue:
        'Fix or reset the current query draft before hiding/restoring files.',
    };
  }
  const mutate =
    args.operation === 'add' ? addExactPathExclusion : removeExactPathExclusion;
  const activeResult = mutate(args.activeQuery, args.path);
  const draftResult = dirty ? mutate(draft, args.path) : activeResult;
  if (!activeResult.ok || !draftResult.ok) {
    const failed = !activeResult.ok ? activeResult : draftResult;
    return {
      ok: false,
      issue: `Could not ${args.operation === 'add' ? 'hide' : 'restore'} this file: ${!failed.ok ? (failed.issues[0]?.message ?? 'QUERY1 validation failed.') : 'QUERY1 validation failed.'} No query was changed.`,
    };
  }
  return {
    ok: true,
    query: activeResult.query,
    draft: draftResult.query ?? '',
  };
}

/** Duplicate basenames retain full parent context; stale paths need no filesystem lookup. */
export function hiddenFileLabels(
  paths: readonly string[],
): readonly { path: string; label: string }[] {
  const counts = new Map<string, number>();
  for (const path of paths) {
    const name = path.split('/').at(-1) ?? path;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return paths.map((path) => {
    const name = path.split('/').at(-1) ?? path;
    return { path, label: counts.get(name) === 1 ? name : path };
  });
}

export interface GraphQueryDraftState {
  readonly activeQuery: string;
  readonly draft: string;
  readonly issue: string | undefined;
}

/** Clean editors follow history; dirty editors survive external semantic changes. */
export function reconcileGraphQueryDraft(
  state: GraphQueryDraftState,
  activeQuery: string,
): GraphQueryDraftState {
  if (state.activeQuery === activeQuery) return state;
  return {
    activeQuery,
    draft: state.draft === state.activeQuery ? activeQuery : state.draft,
    issue: state.draft === state.activeQuery ? undefined : state.issue,
  };
}
