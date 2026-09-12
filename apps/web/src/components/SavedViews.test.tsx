// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { validateObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
} from '@icarus-graph-explorer/view-projection';

import { captureSavedView } from '../saved-view';
import sampleReport from '../sample-report.json';
import { SavedViews, type SavedViewsState } from './SavedViews';
import { SavedViewsPopover } from './SavedViewsPopover';

const validation = validateObsidianDiagnosticReport(sampleReport);
if (!validation.valid) throw new Error('Invalid Synthetic Sample.');
const workspace = createProjectionWorkspace(validation.value.snapshot);
const saved = captureSavedView({
  name: 'Language Overview',
  workspace,
  state: documentOnlyProjectionState(),
  presentationMode: 'global',
  layout: 'network',
  viewports: {},
});
const savedWithQuery = captureSavedView({
  name: 'Query view',
  workspace,
  state: {
    ...documentOnlyProjectionState(),
    filters: { query: 'kind:document' },
  },
  presentationMode: 'global',
  layout: 'network',
  viewports: {},
});

describe('Saved Views product UI', () => {
  const onApply = vi.fn<(name: string) => string | undefined>(() => undefined);
  const onDelete = vi.fn<(name: string) => string | undefined>(() => undefined);
  const onRename = vi.fn<
    (name: string, nextName: string) => string | undefined
  >(() => undefined);
  const onReset = vi.fn<() => string | undefined>(() => undefined);
  const onSave = vi.fn<(name: string) => string | undefined>(() => undefined);
  const onUpdate = vi.fn<(name: string) => string | undefined>(() => undefined);
  const state: SavedViewsState = {
    views: [saved],
    status: 'Saved Views are stored for this stable workspace.',
    writable: true,
    recoveryAvailable: false,
    onApply,
    onDelete,
    onRename,
    onReset,
    onSave,
    onUpdate,
  };

  beforeEach(() => vi.clearAllMocks());

  it('presents Save/Apply/Update/Rename/Delete with semantic summaries', () => {
    const markup = renderToStaticMarkup(
      <SavedViews
        {...state}
        idPrefix="saved-views-test"
        views={[saved, savedWithQuery]}
      />,
    );
    expect(markup).toContain('>Saved Views</h3>');
    expect(markup).toContain('for="saved-views-test-name"');
    expect(markup).toContain('>Save current view</button>');
    expect(markup).toContain('<strong>Language Overview</strong>');
    expect(markup).toContain('All · Network');
    expect(markup).toContain('All · Network · kind:document');
    for (const action of ['Apply', 'Update', 'Rename', 'Delete']) {
      expect(markup).toContain(`>${action}</button>`);
    }
    expect(markup).not.toContain(validation.value.snapshot.workspace.id);
  });

  it('keeps Apply available in read-only mode and exposes explicit recovery', () => {
    const markup = renderToStaticMarkup(
      <SavedViews
        {...state}
        recoveryAvailable
        writable={false}
        idPrefix="saved-views-recovery"
      />,
    );
    expect(markup).toContain('<button type="button">Apply</button>');
    expect(markup).toContain(
      '<button disabled="" type="button">Update</button>',
    );
    expect(markup).toContain('>Reset Saved Views registry</button>');
  });

  describe('nonmodal popover interaction', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
      container = document.createElement('div');
      document.body.append(container);
      root = createRoot(container);
    });

    afterEach(async () => {
      await act(() => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    });

    async function mount(overrides: Partial<SavedViewsState> = {}) {
      await act(() =>
        root.render(<SavedViewsPopover {...state} {...overrides} />),
      );
    }

    async function open() {
      const trigger = container.querySelector<HTMLButtonElement>(
        '[aria-label="Saved Views"]',
      )!;
      await act(() => trigger.click());
      return trigger;
    }

    it('opens with initial focus and Escape closes back to its trigger', async () => {
      await mount();
      const trigger = await open();
      const panel = document.body.querySelector<HTMLElement>(
        '.saved-views-popover',
      );
      expect(panel).not.toBeNull();
      expect(document.activeElement).toBe(
        panel?.querySelector<HTMLInputElement>('input'),
      );
      await act(() =>
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        ),
      );
      expect(document.body.querySelector('.saved-views-popover')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it('dismisses on outside pointer without moving focus', async () => {
      await mount();
      await open();
      const outside = document.createElement('button');
      document.body.append(outside);
      outside.focus();
      await act(() =>
        outside.dispatchEvent(new Event('pointerdown', { bubbles: true })),
      );
      expect(document.body.querySelector('.saved-views-popover')).toBeNull();
      expect(document.activeElement).toBe(outside);
      outside.remove();
    });

    it('requires delete confirmation and closes after successful Apply', async () => {
      await mount();
      const trigger = await open();
      const action = (name: string) =>
        [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(
          (button) => button.textContent?.trim() === name,
        )!;
      await act(() => action('Delete').click());
      expect(onDelete).not.toHaveBeenCalled();
      await act(() => action('Confirm delete').click());
      expect(onDelete).toHaveBeenCalledWith('Language Overview');

      await act(() => action('Apply').click());
      expect(onApply).toHaveBeenCalledWith('Language Overview');
      expect(document.body.querySelector('.saved-views-popover')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it('announces rename validation without closing the popover', async () => {
      onRename.mockReturnValueOnce('Name must contain 1 to 64 characters.');
      await mount();
      await open();
      const action = (name: string) =>
        [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(
          (button) => button.textContent?.trim() === name,
        )!;
      await act(() => action('Rename').click());
      const input = document.body.querySelector<HTMLInputElement>(
        'input[id$="-rename"]',
      )!;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      await act(() => {
        setter?.call(input, ' ');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(() => action('Save name').click());

      expect(document.body.querySelector('[role="alert"]')?.textContent).toBe(
        'Name must contain 1 to 64 characters.',
      );
      expect(
        document.body.querySelector('.saved-views-popover'),
      ).not.toBeNull();
    });
  });
});
