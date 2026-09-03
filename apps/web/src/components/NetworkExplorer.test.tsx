import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { GraphSelection } from '@icarus-graph-explorer/renderer-reactflow';
import type { EntityPresentationOverrideMap } from '@icarus-graph-explorer/presentation-overrides';

import type {
  NetworkExplorerModel,
  NetworkExplorerNode,
} from '../network-explorer-model';
import { NetworkExplorer } from './NetworkExplorer';

function node(
  id: string,
  overrides: Partial<NetworkExplorerNode> = {},
): NetworkExplorerNode {
  return {
    id,
    entityId: `canonical:${id}`,
    glyph: '▰',
    kindLabel: 'File',
    name: `${id}.md`,
    secondary: `${id}.md · L1:C1`,
    focusRoot: false,
    focusDistance: null,
    internalReferenceCount: 0,
    adjacency: [],
    ...overrides,
  };
}

function model(nodes: readonly NetworkExplorerNode[]): NetworkExplorerModel {
  return { nodes, nodeById: new Map(nodes.map((item) => [item.id, item])) };
}

function renderExplorer(
  explorerModel: NetworkExplorerModel,
  selection: GraphSelection | null = null,
  presentationOverrides: EntityPresentationOverrideMap = new Map(),
): string {
  return renderToStaticMarkup(
    <NetworkExplorer
      presentationOverrides={presentationOverrides}
      sizePersistenceStatus="Session only — workspace identity is not stable"
      sizeEditingDisabled={false}
      onSizeScaleChange={() => undefined}
      queryEditor={{
        activeQuery: '',
        queryDraft: '',
        queryIssue: undefined,
        onDraftChange: () => undefined,
        onApply: () => undefined,
        onClear: () => undefined,
        onResetDraft: () => undefined,
      }}
      hiddenPaths={['old/Note.md', 'other/Note.md', 'gone.md']}
      focusedSourcePath={undefined}
      onRestoreFile={() => undefined}
      onFocusNode={() => undefined}
      onInspectNode={() => undefined}
      onHideFile={() => undefined}
      expandedNodeIds={new Set()}
      model={explorerModel}
      onClose={() => undefined}
      onExpandedNodeIdsChange={() => undefined}
      onSelectNode={() => undefined}
      selection={selection}
    />,
  );
}

describe('Network Explorer drawer', () => {
  it('renders an accessible tree with one roving row and selected/group/focus context', () => {
    const root = node('source', {
      focusRoot: true,
      visualGroupName: 'Core notes',
      internalReferenceCount: 2,
    });
    const markup = renderExplorer(model([root, node('target')]), {
      kind: 'node',
      id: root.id,
    });

    expect(markup).toContain('aria-label="Network Explorer"');
    expect(markup).toContain('role="tree"');
    expect(markup).toContain('role="treeitem"');
    expect(markup).toContain('aria-level="1"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('Visual Group Core notes');
    expect(markup).toContain('>Focus<');
    expect(markup).not.toContain('>Root<');
    expect(markup).not.toContain('network-explorer__row-secondary');
    expect(markup).not.toContain('>Core notes<');
    expect(markup).not.toContain('2 internal</span>');
    expect(markup).not.toContain('visible nodes</p>');
    expect(markup).not.toContain('>Visible nodes<');
    expect(markup).not.toContain('>Hidden files<');
    expect(markup).not.toContain('>Advanced query<');
    expect(markup).not.toContain('QUERY1:');
    expect(markup).toContain('class="network-explorer__close"');
    // One roving tree row plus its explicitly keyboard-reachable Actions button.
    expect(markup.match(/tabindex="0"/gu)).toHaveLength(2);
    expect(markup).toContain('aria-label="Actions for source.md"');
    expect(markup).toContain('data-graph-history-shortcuts="off"');
    expect(markup).toContain('class="network-explorer__controls"');
  });

  it('keeps stress-scale DOM bounded to the initial viewport and overscan', () => {
    const nodes = Array.from({ length: 5_000 }, (_, index) =>
      node(`node-${index}`),
    );
    const markup = renderExplorer(model(nodes));

    expect(markup.match(/role="treeitem"/gu)).toHaveLength(14);
    expect(markup.match(/class="network-explorer__actions"/gu)).toHaveLength(
      14,
    );
    expect(markup).not.toContain('role="menu"');
    expect(markup).not.toContain('role="dialog"');
    expect(markup).toContain('height:280000px');
    expect(markup).not.toContain('node-4999.md');
  });

  it('shows a canonical File override indicator without adding actions/sizes to other node kinds', () => {
    const nodes = [
      node('file'),
      node('heading', { kindLabel: 'Heading' }),
      node('block', { kindLabel: 'Block' }),
      node('diagnostic', { kindLabel: 'Diagnostic' }),
    ];
    const markup = renderExplorer(
      model(nodes),
      null,
      new Map(nodes.map((node) => [node.entityId!, { sizeScale: 1.5 }])),
    );
    expect(markup.match(/class="network-explorer__size-badge"/gu)).toHaveLength(
      1,
    );
    expect(markup).toContain('Custom Network size: 1.50×');
    expect(markup).toContain('aria-label="Actions for file.md"');
    for (const name of ['heading', 'block', 'diagnostic'])
      expect(markup).not.toContain(`aria-label="Actions for ${name}.md"`);
    expect(renderExplorer(model([node('file')]))).not.toContain(
      'network-explorer__size-badge',
    );
  });

  it('uses the explicit empty state instead of mounting a virtualizer', () => {
    const markup = renderExplorer(model([]));

    expect(markup).toContain('No visible nodes in the current Network view.');
    expect(markup).toContain('id="network-query-input"');
    expect(markup).toContain('Show gone.md again');
    expect(markup).toContain('>old/Note.md</span>');
    expect(markup).toContain('>more</button>');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain(
      'aria-hidden="true" aria-label="Show other/Note.md again"',
    );
    expect(markup).not.toContain('role="tree"');
    expect(markup).not.toContain('network-explorer__virtual-space');
  });

  it('keeps paths as tooltip context and omits distance badges', () => {
    const markup = renderExplorer(
      model([node('target', { focusDistance: 3 })]),
    );
    expect(markup).toContain('title="target.md · L1:C1"');
    expect(markup).not.toContain('3 hop');
    expect(markup).not.toContain('class="network-explorer__badge"');
  });
});
