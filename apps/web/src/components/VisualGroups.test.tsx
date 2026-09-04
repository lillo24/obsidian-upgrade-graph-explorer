import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { VisualGroupDefinition } from '@icarus-graph-explorer/visual-groups';

import type { VisualGroupRegistry } from '../persistence/visual-groups';
import type { VisualGroupSession } from '../visual-groups/session';
import { VisualGroupEditor, VisualGroups } from './VisualGroups';
import {
  prepareVisualGroupDefinition,
  type VisualGroupDraft,
} from './visual-group-editor';

const groups: readonly VisualGroupDefinition[] = [
  {
    name: 'Language',
    query: 'path:"Language"',
    color: 'violet',
    enabled: true,
  },
  {
    name: 'Research',
    query: 'path:"Research" OR title:"Experiment"',
    color: 'green',
    enabled: true,
  },
  {
    name: 'Draft',
    query: 'title:"Draft"',
    color: 'orange',
    enabled: false,
  },
];

function session(
  registryGroups: readonly VisualGroupDefinition[] = groups,
): VisualGroupSession {
  const registry: VisualGroupRegistry = {
    schemaVersion: 1,
    workspaceId: 'workspace',
    groups: registryGroups,
  };
  return {
    registry,
    persistenceMode: 'durable',
    status: 'Saved for this workspace',
  };
}

function renderGroups(
  current: VisualGroupSession,
  options: { readonly contained?: boolean; readonly open?: boolean } = {},
) {
  return renderToStaticMarkup(
    <VisualGroups
      contained={options.contained ?? false}
      onCommit={() => undefined}
      onOpenChange={() => undefined}
      onResetSaved={() => undefined}
      open={options.open ?? false}
      session={current}
    />,
  );
}

describe('Visual Groups product controls', () => {
  it('renders a compact enabled-count trigger adjacent to no panel state', () => {
    const markup = renderGroups(session());

    expect(markup).toContain('aria-label="Groups, 2 enabled"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('>Groups<');
    expect(markup).toContain('visual-groups__badge">2</span>');
    expect(markup).not.toContain('id="visual-groups-panel"');
  });

  it('shows ordered definitions, palette-backed swatches, and bounded actions', () => {
    const markup = renderGroups(session(), { open: true });

    expect(markup).toContain('id="visual-groups-panel"');
    expect(markup).toContain('First matching enabled group supplies');
    expect(markup.indexOf('Language')).toBeLessThan(markup.indexOf('Research'));
    expect(markup.indexOf('Research')).toBeLessThan(markup.indexOf('Draft'));
    expect(markup).toContain('--visual-group-accent:#7c3aed');
    expect(markup).toContain(
      'path:&quot;Research&quot; OR title:&quot;Experiment&quot;',
    );
    expect(markup).toContain('aria-label="Move Language up" disabled=""');
    expect(markup).toContain('aria-label="Move Draft down" disabled=""');
    expect(markup).toContain('>Edit</button>');
    expect(markup).toContain('>Delete</button>');
    expect(markup).toContain('Saved for this workspace');
  });

  it('uses the contained presentation in maximized Tools', () => {
    expect(renderGroups(session(), { contained: true, open: true })).toContain(
      'visual-groups__panel visual-groups__panel--contained',
    );
  });

  it('keeps corrupt persistence blocked behind an explicit reset action', () => {
    const markup = renderGroups(
      {
        registry: session([]).registry,
        persistenceMode: 'blocked-corrupt',
        status: 'Saved Visual Groups could not be loaded',
        error: 'The stored value was left unchanged.',
      },
      { open: true },
    );

    expect(markup).toContain('Saved Visual Groups could not be loaded');
    expect(markup).toContain('Reset saved Visual Groups');
    expect(markup).toContain('<button disabled="" type="button">+ New group');
    expect(markup).toContain('No Visual Groups yet.');
  });

  it('renders a labelled multiline QUERY1 editor with the fixed palette', () => {
    const draft: VisualGroupDraft = {
      name: '',
      query: '',
      color: 'teal',
      enabled: true,
    };
    const markup = renderToStaticMarkup(
      <VisualGroupEditor
        activeQuery={'path:"Language"'}
        draft={draft}
        issue={{ field: 'query', message: 'Character 2: expected a term.' }}
        nameRef={createRef<HTMLInputElement>()}
        onCancel={() => undefined}
        onChange={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(markup).toContain('>Name<input');
    expect(markup).toContain('>Rule<textarea');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('same QUERY1 syntax as Advanced query');
    expect(markup).toContain(
      'AND, OR, NOT, path, folder, title, text, kind, and level',
    );
    expect(markup).toContain(
      'folder=&quot;Notes&quot; matches that folder and all descendants',
    );
    expect(markup).toContain('>Use active query</button>');
    expect(markup).toContain('<legend>Color</legend>');
    for (const label of [
      'Teal',
      'Blue',
      'Violet',
      'Magenta',
      'Red',
      'Orange',
      'Amber',
      'Green',
    ]) {
      expect(markup).toContain(`>${label}</span>`);
    }
    expect(markup).toContain('>Enabled</label>');
    expect(markup).toContain('>Save</button>');
    expect(markup).toContain('>Cancel</button>');
  });

  it('canonicalizes on save preparation and returns positioned errors', () => {
    expect(
      prepareVisualGroupDefinition({
        name: '  Research ',
        query: 'path:Research or title:Experiment',
        color: 'green',
        enabled: true,
      }),
    ).toEqual({
      ok: true,
      value: {
        name: 'Research',
        query: 'path:"Research" OR title:"Experiment"',
        color: 'green',
        enabled: true,
      },
    });
    expect(
      prepareVisualGroupDefinition({
        name: '',
        query: 'documents',
        color: 'teal',
        enabled: true,
      }),
    ).toMatchObject({ ok: false, field: 'name', message: 'Name is required.' });
    expect(
      prepareVisualGroupDefinition({
        name: 'Broken',
        query: 'documents sections',
        color: 'teal',
        enabled: true,
      }),
    ).toMatchObject({ ok: false, field: 'query' });
    const invalid = prepareVisualGroupDefinition({
      name: 'Broken',
      query: 'documents sections',
      color: 'teal',
      enabled: true,
    });
    if (invalid.ok) throw new Error('Expected invalid QUERY1 input.');
    expect(invalid.message).toMatch(/^Character \d+:/u);
  });
});
