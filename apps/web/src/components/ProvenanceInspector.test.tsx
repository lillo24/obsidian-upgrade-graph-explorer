import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { validateObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import { createInspectionWorkspace } from '@icarus-graph-explorer/explorer-inspection';
import type { GraphSelection } from '@icarus-graph-explorer/renderer-reactflow';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  projectView,
  topLevelSectionProjectionState,
  type ViewProjection,
} from '@icarus-graph-explorer/view-projection';

import sampleReport from '../sample-report.json';
import { ProvenanceInspector } from './ProvenanceInspector';

const validation = validateObsidianDiagnosticReport(sampleReport);
if (!validation.valid) throw new Error('The web sample report must be valid.');

const snapshot = validation.value.snapshot;
const inspectionWorkspace = createInspectionWorkspace(snapshot);
const projectionWorkspace = createProjectionWorkspace(snapshot);
const documentProjection = projectView(
  projectionWorkspace,
  documentOnlyProjectionState(),
);
const sectionProjection = projectView(
  projectionWorkspace,
  topLevelSectionProjectionState(),
);

function renderInspector(
  projection: ViewProjection,
  selection: GraphSelection | null,
): string {
  return renderToStaticMarkup(
    <ProvenanceInspector
      onClear={() => undefined}
      onClose={() => undefined}
      onNavigate={() => undefined}
      projection={projection}
      selection={selection}
      workspace={inspectionWorkspace}
    />,
  );
}

function normalView(markup: string): string {
  return markup.split('<details class="technical-details">', 1)[0] ?? markup;
}

function entityNode(path: string) {
  const node = documentProjection.nodes.find(
    (candidate) => candidate.kind === 'entity' && candidate.sourcePath === path,
  );
  if (node === undefined) throw new Error(`Missing projected entity ${path}.`);
  return node;
}

function diagnosticNode(status: 'unresolved' | 'ambiguous' | 'invalid') {
  const node = documentProjection.nodes.find(
    (candidate) =>
      candidate.kind === 'reference-target' && candidate.status === status,
  );
  if (node === undefined) {
    throw new Error(`Missing projected ${status} diagnostic.`);
  }
  return node;
}

describe('user-facing provenance inspector', () => {
  it('keeps the empty state short', () => {
    const markup = renderInspector(documentProjection, null);

    expect(markup).toContain('aria-label="Inspector"');
    expect(markup).toContain('aria-label="Close Inspector"');
    expect(markup).not.toContain('>Close Inspector</button>');
    expect(markup).not.toContain('Clear selection');
    expect(markup).toContain('Select a file, section, or connection.');
    expect(markup).not.toContain('Technical details');
  });

  it('shows node identity and real relationships before technical metadata', () => {
    const source = entityNode('Source.md');
    const markup = renderInspector(documentProjection, {
      kind: 'node',
      id: source.id,
    });
    const normal = normalView(markup);

    expect(normal).toContain('>File<');
    expect(normal).toContain('<h4>Source</h4>');
    expect(normal).toContain('aria-label="Relationship summary"');
    expect(normal).toContain('Clear selection');
    expect(normal).toContain('class="selection-panel__collapse"');
    expect(normal).toContain('outgoing ·');
    expect(normal).toContain('backlinks');
    expect(normal).toContain('<h4>Outgoing</h4>');
    expect(normal).toContain('<h4>Backlinks</h4>');
    expect(normal.match(/relationship-card__main/gu)).toHaveLength(20);
    expect(normal).toContain('Show 11 more');
    expect(normal).not.toContain('Reference ID');
    expect(normal).not.toContain('Projection');
    expect(normal).not.toContain('stable:');
    expect(markup).toContain(
      '<details class="technical-details"><summary>Technical details</summary>',
    );
    expect(markup).toContain('Entity ID');
    expect(markup).toContain('Reference ID');
    expect(markup).toContain('Exact source');
  });

  it('keeps uncertain candidate mentions out of backlinks and inside technical details', () => {
    const candidate = entityNode('folder-a/Note.md');
    const markup = renderInspector(documentProjection, {
      kind: 'node',
      id: candidate.id,
    });
    const normal = normalView(markup);

    expect(normal).toContain('0 backlinks');
    expect(normal).not.toContain('Possible matches from uncertain links');
    expect(markup).toContain('Possible matches from uncertain links');
    expect(markup).toContain('folder-a/Note.md');
  });

  it('explains grouped connections and lists their actual link occurrences', () => {
    const edge = documentProjection.edges.find(
      (candidate) =>
        candidate.kind === 'reference' &&
        candidate.status === 'resolved' &&
        candidate.referenceIds.length > 1,
    );
    if (edge === undefined) throw new Error('Missing grouped reference edge.');

    const markup = renderInspector(documentProjection, {
      kind: 'edge',
      id: edge.id,
    });
    const normal = normalView(markup);

    expect(normal).toContain('>Connection<');
    expect(normal).toContain('Source → Target');
    expect(normal).toContain('links are grouped into this connection');
    expect(normal).toContain('because some sections are currently collapsed');
    expect(normal).toContain('Links in this connection');
    expect(normal).not.toContain('Aggregated Provenance');
    expect(normal).not.toContain('Projection edge ID');
    expect(markup).toContain('Connection occurrence metadata');
  });

  it('describes hierarchy edges as structure and containment', () => {
    const edge = sectionProjection.edges.find(
      (candidate) => candidate.kind === 'hierarchy',
    );
    if (edge === undefined) throw new Error('Missing hierarchy edge.');

    const markup = renderInspector(sectionProjection, {
      kind: 'edge',
      id: edge.id,
    });
    const normal = normalView(markup);

    expect(normal).toContain('>Structure<');
    expect(normal).toContain('>contains<');
    expect(normal).not.toContain('canonical');
    expect(normal).not.toContain('fabricated');
    expect(normal).not.toContain('Projection edge ID');
    expect(markup).toContain('Parent entity ID');
    expect(markup).toContain('Child entity ID');
  });

  it('uses plain-language diagnostic states without inventing a destination', () => {
    const unresolved = renderInspector(documentProjection, {
      kind: 'node',
      id: diagnosticNode('unresolved').id,
    });
    const ambiguous = renderInspector(documentProjection, {
      kind: 'node',
      id: diagnosticNode('ambiguous').id,
    });
    const invalid = renderInspector(documentProjection, {
      kind: 'node',
      id: diagnosticNode('invalid').id,
    });

    expect(normalView(unresolved)).toContain('Broken link');
    expect(normalView(unresolved)).toContain(
      'No matching destination was found.',
    );
    expect(normalView(ambiguous)).toContain('Uncertain link');
    expect(normalView(ambiguous)).toContain('Possible destinations');
    expect(normalView(ambiguous)).toContain(
      'No destination has been selected.',
    );
    expect(normalView(ambiguous)).toContain('folder-a/Note.md');
    expect(normalView(ambiguous)).toContain('folder-b/Note.md');
    expect(normalView(invalid)).toContain('Invalid link');
    expect(normalView(invalid)).toContain('Target escapes the workspace root.');
  });

  it('labels destination navigation and exposes technical details as a native disclosure', () => {
    const target = entityNode('Target.md');
    const markup = renderInspector(documentProjection, {
      kind: 'node',
      id: target.id,
    });

    expect(markup).toContain('aria-label="Navigate to Overview at Source.md');
    expect(markup).toContain('<summary>Technical details</summary>');
    expect(markup).not.toContain('<details class="technical-details" open="">');
  });
});
