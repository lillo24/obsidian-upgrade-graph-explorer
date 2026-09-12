// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GraphContextMenu } from './GraphContextMenu';

describe('shared graph context menu', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shares keyboard navigation and action activation', () => {
    const action = vi.fn();
    const cancel = vi.fn();
    act(() => {
      root.render(
        <GraphContextMenu
          items={[
            { id: 'first', label: 'First' },
            {
              id: 'disabled',
              label: 'Disabled',
              disabledReason: 'Unavailable',
            },
            { kind: 'separator', emphasis: 'strong' },
            { id: 'last', label: 'Last' },
          ]}
          name="Folder display"
          onAction={action}
          onCancel={cancel}
          x={10}
          y={10}
        />,
      );
    });
    const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
    expect(menu.querySelector('[role="separator"]')).not.toBeNull();
    expect(menu.textContent).not.toContain('Folder actions');
    expect(document.activeElement?.textContent).toBe('First');
    act(() =>
      menu.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }),
      ),
    );
    expect(document.activeElement?.textContent).toBe('Last');
    act(() =>
      menu.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }),
      ),
    );
    expect(action).toHaveBeenCalledWith('last');
  });

  it('reports Escape with focus restoration and outside dismissal without it', () => {
    const cancel = vi.fn();
    act(() => {
      root.render(
        <GraphContextMenu
          items={[{ id: 'one', label: 'One' }]}
          name="Folder display"
          onAction={vi.fn()}
          onCancel={cancel}
          x={10}
          y={10}
        />,
      );
    });
    const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
    act(() =>
      menu.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }),
      ),
    );
    expect(cancel).toHaveBeenLastCalledWith(true);
    act(() =>
      document.body.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true }),
      ),
    );
    expect(cancel).toHaveBeenLastCalledWith(false);
  });

  it('keeps Escape available when every action is disabled', () => {
    const cancel = vi.fn();
    act(() => {
      root.render(
        <GraphContextMenu
          items={[{ id: 'one', label: 'One', disabledReason: 'Unavailable' }]}
          name="Folder display"
          onAction={vi.fn()}
          onCancel={cancel}
          x={10}
          y={10}
        />,
      );
    });
    const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
    expect(document.activeElement).toBe(menu);
    act(() =>
      menu.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }),
      ),
    );
    expect(cancel).toHaveBeenCalledWith(true);
  });
});
