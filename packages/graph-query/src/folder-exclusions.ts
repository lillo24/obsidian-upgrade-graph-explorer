import {
  isNormalizedWorkspaceFolderKey,
  workspaceFolderKeyContainsFolder,
  type WorkspaceFolderKey,
} from '@icarus-graph-explorer/core';

import {
  canonicalMutationResult,
  isIssueList,
  parseCurrentQuery,
  rebuildAnd,
  topLevelAndTerms,
} from './managed-exclusions';
import type {
  FolderExclusionListResult,
  FolderExclusionMutationResult,
  GraphQueryExpression,
  GraphQueryIssue,
} from './types';

function invalidFolderIssue(folderKey: string): GraphQueryIssue {
  return {
    code: 'invalid-predicate-value',
    position: 0,
    length: folderKey.length,
    message:
      'A folder exclusion requires a normalized workspace folder key using forward slashes, or "." for the workspace root.',
  };
}

function managedFolder(
  expression: GraphQueryExpression,
): WorkspaceFolderKey | undefined {
  return expression.kind === 'not' &&
    expression.expression.kind === 'folder-predicate'
    ? expression.expression.value
    : undefined;
}

/** Adds one global `NOT folder="..."` subtree term to a canonical query. */
export function addFolderExclusion(
  query: string | undefined,
  folderKey: string,
): FolderExclusionMutationResult {
  if (!isNormalizedWorkspaceFolderKey(folderKey)) {
    return { ok: false, issues: [invalidFolderIssue(folderKey)] };
  }
  const parsed = parseCurrentQuery(query);
  if (isIssueList(parsed)) return { ok: false, issues: parsed };
  if (
    parsed !== undefined &&
    topLevelAndTerms(parsed).some((term) => {
      const managed = managedFolder(term);
      return (
        managed !== undefined &&
        workspaceFolderKeyContainsFolder(managed, folderKey)
      );
    })
  ) {
    return canonicalMutationResult(parsed);
  }
  const exclusion: GraphQueryExpression = {
    kind: 'not',
    expression: { kind: 'folder-predicate', value: folderKey },
  };
  return canonicalMutationResult(
    parsed === undefined
      ? exclusion
      : { kind: 'and', left: parsed, right: exclusion },
  );
}

/** Lists unique global folder exclusions in visible query-term order. */
export function listFolderExclusions(
  query: string | undefined,
): FolderExclusionListResult {
  const parsed = parseCurrentQuery(query);
  if (isIssueList(parsed)) return { ok: false, issues: parsed };
  if (parsed === undefined) return { ok: true, folderKeys: [] };
  const seen = new Set<WorkspaceFolderKey>();
  for (const term of topLevelAndTerms(parsed)) {
    const folderKey = managedFolder(term);
    if (folderKey !== undefined) seen.add(folderKey);
  }
  return { ok: true, folderKeys: [...seen] };
}

/** Removes all matching global folder exclusion terms from a query. */
export function removeFolderExclusion(
  query: string | undefined,
  folderKey: string,
): FolderExclusionMutationResult {
  if (!isNormalizedWorkspaceFolderKey(folderKey)) {
    return { ok: false, issues: [invalidFolderIssue(folderKey)] };
  }
  const parsed = parseCurrentQuery(query);
  if (isIssueList(parsed)) return { ok: false, issues: parsed };
  if (parsed === undefined) return { ok: true, query: undefined };
  return canonicalMutationResult(
    rebuildAnd(
      topLevelAndTerms(parsed).filter(
        (term) => managedFolder(term) !== folderKey,
      ),
    ),
  );
}
