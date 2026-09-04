import { useCallback, useState } from 'react';

import type { WorkspaceFolderKey } from '@icarus-graph-explorer/core';
import { parseGraphQuery } from '@icarus-graph-explorer/graph-query';

import {
  planExactPathQueryMutation,
  planFolderQueryMutation,
  reconcileGraphQueryDraft,
  type GraphQueryDraftState,
} from '../network-explorer-query-actions';
import type { GraphQueryEditorState } from './GraphQueryEditor';

/** Lives above both editor placements; only onCommit changes semantic graph state. */
export function useGraphQueryDraft(
  activeQuery: string | undefined,
  onCommit: (query: string | undefined) => void,
): GraphQueryEditorState & {
  readonly adoptQuery: (query: string) => void;
  readonly mutateExactPath: (
    path: string,
    operation: 'add' | 'remove',
  ) => boolean;
  readonly mutateFolder: (
    folderKey: WorkspaceFolderKey,
    operation: 'add' | 'remove',
  ) => boolean;
} {
  const active = activeQuery ?? '';
  const [stored, setStored] = useState<GraphQueryDraftState>(() => ({
    activeQuery: active,
    draft: active,
    issue: undefined,
  }));
  const state = reconcileGraphQueryDraft(stored, active);
  if (state !== stored) setStored(state);
  const adoptQuery = useCallback(
    (query: string) => {
      setStored({ activeQuery: active, draft: query, issue: undefined });
    },
    [active],
  );
  const onApply = useCallback(() => {
    if (state.draft.trim().length === 0) {
      onCommit(undefined);
      adoptQuery('');
      return;
    }
    const parsed = parseGraphQuery(state.draft);
    if (!parsed.valid) {
      const first = parsed.issues[0];
      setStored({
        ...state,
        issue:
          first === undefined
            ? 'The graph query is invalid.'
            : `Character ${first.position + 1}: ${first.message}`,
      });
      return;
    }
    onCommit(parsed.canonical);
    adoptQuery(parsed.canonical);
  }, [adoptQuery, onCommit, state]);
  const onClear = useCallback(() => {
    onCommit(undefined);
    adoptQuery('');
  }, [adoptQuery, onCommit]);
  const onResetDraft = useCallback(
    () => adoptQuery(active),
    [active, adoptQuery],
  );
  const mutateExactPath = useCallback(
    (path: string, operation: 'add' | 'remove') => {
      const plan = planExactPathQueryMutation({
        activeQuery,
        queryDraft: state.draft,
        path,
        operation,
      });
      if (!plan.ok) {
        setStored({ ...state, issue: plan.issue });
        return false;
      }
      onCommit(plan.query);
      // Record the new base as well as the draft so external synchronization cannot
      // mistake the just-mutated dirty draft for the old clean applied formula.
      setStored({
        activeQuery: plan.query ?? '',
        draft: plan.draft,
        issue: undefined,
      });
      return true;
    },
    [activeQuery, onCommit, state],
  );
  const mutateFolder = useCallback(
    (folderKey: WorkspaceFolderKey, operation: 'add' | 'remove') => {
      const plan = planFolderQueryMutation({
        activeQuery,
        queryDraft: state.draft,
        folderKey,
        operation,
      });
      if (!plan.ok) {
        setStored({ ...state, issue: plan.issue });
        return false;
      }
      onCommit(plan.query);
      setStored({
        activeQuery: plan.query ?? '',
        draft: plan.draft,
        issue: undefined,
      });
      return true;
    },
    [activeQuery, onCommit, state],
  );
  return {
    activeQuery: active,
    queryDraft: state.draft,
    queryIssue: state.issue,
    onDraftChange: adoptQuery,
    onApply,
    onClear,
    onResetDraft,
    adoptQuery,
    mutateExactPath,
    mutateFolder,
  };
}
