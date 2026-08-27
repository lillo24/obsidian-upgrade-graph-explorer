import {
  createDiagnosticLookups,
  validateObsidianDiagnosticReport,
} from '@icarus-graph-explorer/diagnostics-obsidian';
import { describe, expect, it } from 'vitest';

import {
  buildReferenceViews,
  filterReferenceViews,
  matchingHierarchyDocumentIds,
} from './report-view';
import sampleReportJson from './sample-report.json';

const validation = validateObsidianDiagnosticReport(sampleReportJson);
if (!validation.valid) throw new Error(JSON.stringify(validation.issues));
const report = validation.value;
const lookups = createDiagnosticLookups(report.snapshot);
const views = buildReferenceViews(report, lookups);

describe('diagnostic report view transformations', () => {
  it('filters every explicit resolution state without changing report data', () => {
    expect(filterReferenceViews(views, 'resolved', '')).toHaveLength(23);
    expect(filterReferenceViews(views, 'ambiguous', '')).toHaveLength(1);
    expect(filterReferenceViews(views, 'unresolved', '')).toHaveLength(6);
    expect(filterReferenceViews(views, 'invalid', '')).toHaveLength(1);
    expect(report.snapshot.references).toHaveLength(31);
  });

  it('searches source paths, owner labels, targets, and candidate labels', () => {
    expect(filterReferenceViews(views, 'all', 'missing.pdf')).toHaveLength(1);
    expect(filterReferenceViews(views, 'all', 'folder-a/note')).toHaveLength(1);
    expect(
      filterReferenceViews(views, 'all', 'overview / nested'),
    ).toHaveLength(1);
  });

  it('filters hierarchy documents by path or descendant section title', () => {
    expect(
      matchingHierarchyDocumentIds(report, lookups, 'nested'),
    ).toHaveLength(1);
    expect(
      matchingHierarchyDocumentIds(report, lookups, 'folder-a'),
    ).toHaveLength(1);
    expect(
      matchingHierarchyDocumentIds(report, lookups, 'not present'),
    ).toEqual([]);
  });
});
