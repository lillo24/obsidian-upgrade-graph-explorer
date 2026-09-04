import type {
  EntityKind,
  WorkspaceFolderKey,
  WorkspacePath,
} from '@icarus-graph-explorer/core';

export const MAX_GRAPH_QUERY_LENGTH = 4_096;
export const MAX_GRAPH_QUERY_AST_NODES = 256;
export const MAX_GRAPH_QUERY_NESTING = 32;

export type GraphQueryStringField = 'path' | 'title' | 'text';
export type GraphQueryLevelOperator = 'eq' | 'lte' | 'gte';
export type GraphQuerySectionLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type GraphQueryPredicate =
  | {
      readonly kind: 'string-predicate';
      readonly field: GraphQueryStringField;
      readonly value: string;
    }
  | {
      readonly kind: 'kind-predicate';
      readonly value: EntityKind;
    }
  | {
      readonly kind: 'exact-path-predicate';
      readonly value: WorkspacePath;
    }
  | {
      readonly kind: 'folder-predicate';
      readonly value: WorkspaceFolderKey;
    }
  | {
      readonly kind: 'level-predicate';
      readonly operator: GraphQueryLevelOperator;
      readonly value: GraphQuerySectionLevel;
    };

export type GraphQueryExpression =
  | GraphQueryPredicate
  | {
      readonly kind: 'not';
      readonly expression: GraphQueryExpression;
    }
  | {
      readonly kind: 'and';
      readonly left: GraphQueryExpression;
      readonly right: GraphQueryExpression;
    }
  | {
      readonly kind: 'or';
      readonly left: GraphQueryExpression;
      readonly right: GraphQueryExpression;
    };

export type GraphQueryIssueCode =
  | 'empty-query'
  | 'query-too-long'
  | 'query-too-complex'
  | 'query-too-deep'
  | 'unexpected-token'
  | 'missing-operator'
  | 'unsupported-comma'
  | 'unknown-predicate'
  | 'invalid-predicate-value'
  | 'unterminated-string'
  | 'invalid-escape';

export interface GraphQueryIssue {
  readonly code: GraphQueryIssueCode;
  /** Zero-based UTF-16 offset into the submitted query. */
  readonly position: number;
  readonly length: number;
  readonly message: string;
}

export type GraphQueryParseResult =
  | {
      readonly valid: true;
      readonly expression: GraphQueryExpression;
      readonly canonical: string;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly GraphQueryIssue[];
    };

export type ExactPathExclusionMutationResult =
  | {
      readonly ok: true;
      readonly query: string | undefined;
    }
  | {
      readonly ok: false;
      readonly issues: readonly GraphQueryIssue[];
    };

export type ExactPathExclusionListResult =
  | {
      readonly ok: true;
      readonly paths: readonly WorkspacePath[];
    }
  | {
      readonly ok: false;
      readonly issues: readonly GraphQueryIssue[];
    };

export type FolderExclusionMutationResult =
  | {
      readonly ok: true;
      readonly query: string | undefined;
    }
  | {
      readonly ok: false;
      readonly issues: readonly GraphQueryIssue[];
    };

export type FolderExclusionListResult =
  | {
      readonly ok: true;
      readonly folderKeys: readonly WorkspaceFolderKey[];
    }
  | {
      readonly ok: false;
      readonly issues: readonly GraphQueryIssue[];
    };
