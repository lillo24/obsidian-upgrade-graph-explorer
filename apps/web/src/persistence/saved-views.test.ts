import { describe, expect, it } from 'vitest';

import { validateObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
} from '@icarus-graph-explorer/view-projection';

import { captureSavedView } from '../saved-view';
import sampleReport from '../sample-report.json';
import {
  addSavedView,
  clearSavedViewRegistry,
  createEmptySavedViewRegistry,
  deleteSavedView,
  loadSavedViews,
  MAX_SAVED_VIEWS,
  renameSavedView,
  savedViewStorageKey,
  saveSavedViewRegistry,
  serializeSavedViewRegistry,
  updateSavedView,
  validateSavedViewRegistry,
  type SavedViewEntry,
  type SavedViewRegistry,
} from './saved-views';
import type { StorageLike } from './storage';

const reportValidation = validateObsidianDiagnosticReport(sampleReport);
if (!reportValidation.valid) throw new Error('Invalid Synthetic Sample.');
const report = reportValidation.value;
const workspace = createProjectionWorkspace(report.snapshot);
const workspaceId = report.snapshot.workspace.id;

function entry(
  name: string,
  presentationMode: 'global' | 'structure' | 'local' = 'global',
  layout: 'network' | 'hierarchy' = presentationMode === 'structure'
    ? 'hierarchy'
    : 'network',
): SavedViewEntry {
  const root = report.snapshot.entities.find(
    (candidate) => candidate.kind === 'document',
  )!;
  return captureSavedView({
    name,
    workspace,
    presentationMode,
    layout,
    state:
      presentationMode === 'local'
        ? {
            ...documentOnlyProjectionState(),
            focus: {
              rootEntityId: root.id,
              hops: 2,
              direction: 'outgoing',
              hierarchyContext: 'ancestors-and-children',
            },
          }
        : documentOnlyProjectionState(),
    viewports: {},
  });
}

function memoryStorage(): StorageLike & {
  readonly values: Map<string, string>;
} {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe('Named Saved Views registry', () => {
  it('uses an encoded workspace-scoped key and creates an empty schema-v1 registry', () => {
    expect(savedViewStorageKey('stable/workspace name')).toBe(
      'icarus-graph-explorer:saved-views:stable%2Fworkspace%20name',
    );
    expect(createEmptySavedViewRegistry(workspaceId)).toEqual({
      schemaVersion: 1,
      workspaceId,
      views: [],
    });
  });

  it('sorts entries deterministically and round-trips the exact registry', () => {
    const storage = memoryStorage();
    const zebra = addSavedView(
      createEmptySavedViewRegistry(workspaceId),
      entry('Zebra'),
    );
    expect(zebra.ok).toBe(true);
    if (!zebra.ok) return;
    const alpha = addSavedView(zebra.value, entry('alpha'));
    expect(alpha.ok).toBe(true);
    if (!alpha.ok) return;
    expect(alpha.value.views.map(({ name }) => name)).toEqual([
      'alpha',
      'Zebra',
    ]);
    expect(saveSavedViewRegistry(storage, alpha.value)).toEqual({ ok: true });
    expect(loadSavedViews(storage, workspaceId)).toEqual({
      status: 'loaded',
      value: alpha.value,
    });
    expect(serializeSavedViewRegistry(alpha.value)).toBe(
      storage.values.get(savedViewStorageKey(workspaceId)),
    );
  });

  it('rejects duplicate names case-insensitively and enforces name/count bounds', () => {
    const first = addSavedView(
      createEmptySavedViewRegistry(workspaceId),
      entry('Language'),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(addSavedView(first.value, entry(' language '))).toMatchObject({
      ok: false,
    });
    expect(
      addSavedView(first.value, { ...entry('Invalid'), name: ' ' }),
    ).toMatchObject({ ok: false });
    expect(
      addSavedView(first.value, {
        ...entry('Invalid'),
        name: 'x'.repeat(65),
      }),
    ).toMatchObject({ ok: false });
    const full: SavedViewRegistry = {
      ...createEmptySavedViewRegistry(workspaceId),
      views: Array.from({ length: MAX_SAVED_VIEWS }, (_, index) =>
        entry(`View ${String(index).padStart(2, '0')}`),
      ),
    };
    expect(addSavedView(full, entry('Overflow'))).toMatchObject({ ok: false });
  });

  it('updates snapshots, renames without changing snapshots, and deletes one entry', () => {
    const original = entry('Language');
    const registry = {
      ...createEmptySavedViewRegistry(workspaceId),
      views: [original],
    };
    const replacement = entry('ignored', 'local', 'hierarchy');
    const updated = updateSavedView(registry, 'Language', replacement);
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.views[0]).toMatchObject({
      name: 'Language',
      layout: 'hierarchy',
      view: { presentationMode: 'local' },
    });
    const snapshot = updated.value.views[0]!.view;
    const renamed = renameSavedView(
      updated.value,
      'Language',
      ' Deep Language ',
    );
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    expect(renamed.value.views[0]).toEqual({
      name: 'Deep Language',
      layout: 'hierarchy',
      view: snapshot,
    });
    expect(
      renameSavedView(renamed.value, 'Deep Language', 'deep language'),
    ).toMatchObject({ ok: true });
    expect(deleteSavedView(renamed.value, 'Deep Language')).toEqual({
      ok: true,
      value: { ...renamed.value, views: [] },
    });
  });

  it('strictly rejects malformed fields, wrong workspaces, layouts, and presentations', () => {
    const valid = entry('Valid');
    expect(
      validateSavedViewRegistry(
        {
          schemaVersion: 1,
          workspaceId: 'other',
          views: [valid],
        },
        workspaceId,
      ).valid,
    ).toBe(false);
    expect(
      validateSavedViewRegistry({
        schemaVersion: 1,
        workspaceId,
        views: [{ ...valid, layout: 'radial' }],
      }).valid,
    ).toBe(false);
    expect(
      validateSavedViewRegistry({
        schemaVersion: 1,
        workspaceId,
        views: [{ ...valid, extra: true }],
      }).valid,
    ).toBe(false);
    expect(
      validateSavedViewRegistry({
        schemaVersion: 1,
        workspaceId,
        views: [{ ...valid, layout: 'hierarchy' }],
      }).valid,
    ).toBe(false);
    expect(
      validateSavedViewRegistry({
        schemaVersion: 1,
        workspaceId,
        views: [
          {
            ...valid,
            view: { ...valid.view, schemaVersion: 2 },
          },
        ],
      }).valid,
    ).toBe(false);
  });

  it('reuses strict embedded view-state validation and requires deterministic data', () => {
    const valid = entry('Valid');
    expect(
      validateSavedViewRegistry({
        schemaVersion: 1,
        workspaceId,
        views: [
          {
            ...valid,
            view: {
              ...valid.view,
              projection: {
                ...valid.view.projection,
                disclosure: {
                  ...valid.view.projection.disclosure,
                  defaultDepth: 99,
                },
              },
            },
          },
        ],
      }).valid,
    ).toBe(false);
    expect(
      validateSavedViewRegistry({
        schemaVersion: 1,
        workspaceId,
        views: [
          {
            ...valid,
            view: {
              ...valid.view,
              projection: {
                ...valid.view.projection,
                disclosure: {
                  ...valid.view.projection.disclosure,
                  expandedEntityIds: ['z', 'a'],
                },
              },
            },
          },
        ],
      }).valid,
    ).toBe(false);
  });

  it('leaves corrupt bytes untouched and reports storage failures', () => {
    const storage = memoryStorage();
    const key = savedViewStorageKey(workspaceId);
    storage.values.set(key, '{broken');
    expect(loadSavedViews(storage, workspaceId)).toMatchObject({
      status: 'error',
    });
    expect(storage.values.get(key)).toBe('{broken');
    const failing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(loadSavedViews(failing, workspaceId)).toMatchObject({
      status: 'error',
    });
    expect(
      saveSavedViewRegistry(failing, createEmptySavedViewRegistry(workspaceId)),
    ).toMatchObject({ ok: false });
    expect(clearSavedViewRegistry(failing, workspaceId)).toMatchObject({
      ok: false,
    });
  });
});
