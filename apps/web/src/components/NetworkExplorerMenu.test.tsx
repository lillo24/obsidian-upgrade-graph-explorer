import type {
  HTMLAttributes,
  KeyboardEvent,
  ReactElement,
  ReactNode,
} from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NetworkExplorerMenu } from './NetworkExplorerMenu';

// Exercise the shared surface's event contract without adding a DOM dependency.
// Browser QA covers native range steps and actual virtual-row focus restoration.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: () => undefined,
  useLayoutEffect: () => undefined,
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => [
    typeof initial === 'function' ? initial() : initial,
    () => undefined,
  ],
}));
vi.mock('react-dom', () => ({ createPortal: (content: ReactNode) => content }));

afterEach(() => vi.unstubAllGlobals());

function editor() {
  vi.stubGlobal('document', { body: {} });
  const onCancel = vi.fn();
  const onAction = vi.fn();
  const surface = NetworkExplorerMenu({
    actions: [{ id: 'size', label: 'Size' }],
    name: 'File',
    x: 20,
    y: 30,
    onCancel,
    onAction,
    editor: {
      label: 'Network size',
      content: <input type="range" aria-label="File size" />,
    },
  }) as unknown as ReactElement<HTMLAttributes<HTMLDivElement>>;
  return { surface, onCancel, onAction };
}

describe('Network size editor keyboard contract', () => {
  it('keeps Escape requesting focus restoration through the existing close callback', () => {
    const { surface, onCancel, onAction } = editor();
    const event = {
      key: 'Escape',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    surface.props.onKeyDown?.(
      event as unknown as KeyboardEvent<HTMLDivElement>,
    );
    expect(onCancel.mock.calls).toEqual([[true]]);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(onAction).not.toHaveBeenCalled();
  });

  it.each([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    'Enter',
    ' ',
  ])('does not consume native range/Reset key %s as a menu action', (key) => {
    const { surface, onCancel, onAction } = editor();
    const event = { key, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    surface.props.onKeyDown?.(
      event as unknown as KeyboardEvent<HTMLDivElement>,
    );
    expect(surface.props.role).toBe('dialog');
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
  });
});
