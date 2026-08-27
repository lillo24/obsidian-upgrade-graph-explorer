import { describeEntity } from './descriptors';
import type {
  EntitySearchResult,
  SearchEntitiesOptions,
  SearchMatchKind,
} from './types';
import {
  compareEntitiesBySource,
  type InspectionWorkspace,
  type SearchRecord,
} from './workspace';

const DEFAULT_RESULT_LIMIT = 30;

const MATCH_RANK: Readonly<Record<SearchMatchKind, number>> = {
  'exact-name': 1,
  'name-prefix': 2,
  'exact-breadcrumb': 3,
  'name-substring': 4,
  'path-or-breadcrumb-substring': 5,
};

function matchRecord(
  record: SearchRecord,
  query: string,
): SearchMatchKind | undefined {
  if (record.normalizedName === query) return 'exact-name';
  if (record.normalizedName.startsWith(query)) return 'name-prefix';
  if (record.normalizedBreadcrumbParts.includes(query)) {
    return 'exact-breadcrumb';
  }
  if (record.normalizedName.includes(query)) return 'name-substring';
  if (
    record.normalizedPath.includes(query) ||
    record.normalizedBreadcrumb.includes(query)
  ) {
    return 'path-or-breadcrumb-substring';
  }
  return undefined;
}

export function searchEntities(
  workspace: InspectionWorkspace,
  query: string,
  options: SearchEntitiesOptions = {},
): readonly EntitySearchResult[] {
  const limit = options.limit ?? DEFAULT_RESULT_LIMIT;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(
      `Search result limit must be a positive integer; found ${limit}.`,
    );
  }
  const normalizedQuery = query.trim().toLocaleLowerCase('en-US');
  if (normalizedQuery.length === 0) return [];

  return workspace
    .searchRecords()
    .flatMap((record) => {
      const match = matchRecord(record, normalizedQuery);
      return match === undefined ? [] : [{ record, match }];
    })
    .sort(
      (left, right) =>
        MATCH_RANK[left.match] - MATCH_RANK[right.match] ||
        compareEntitiesBySource(left.record.entity, right.record.entity),
    )
    .slice(0, limit)
    .map(({ record, match }) => ({
      entity: describeEntity(workspace, record.entity.id),
      match,
    }));
}
