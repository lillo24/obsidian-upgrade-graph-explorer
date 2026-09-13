// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SAVED_VIEW_TRANSITION_DURATION_MS,
  SavedViewTransitionOverlay,
  type SavedViewVisualTransition,
} from './SavedViewTransitionOverlay';

const appStyles = () =>
  readFileSync(resolve(process.cwd(), 'apps/web/src/App.css'), 'utf8');

describe('SavedViewTransitionOverlay', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders one accessibility-neutral, pointer-transparent visual surface', async () => {
    await act(() =>
      root.render(
        <SavedViewTransitionOverlay
          onComplete={() => undefined}
          transition={{
            name: 'Language Focused',
            origin: 'apply',
            token: 1,
          }}
        />,
      ),
    );

    const overlay = container.querySelector('.saved-view-transition');
    expect(overlay?.getAttribute('aria-hidden')).toBe('true');
    expect(overlay?.getAttribute('data-saved-view-transition-origin')).toBe(
      'apply',
    );
    expect(
      overlay?.querySelector('.saved-view-transition__title')?.textContent,
    ).toBe('Language Focused');
    expect(
      overlay?.querySelector('.saved-view-transition__subtitle')?.textContent,
    ).toBe('View loaded');
    expect(
      overlay?.querySelectorAll('.saved-view-transition__shard'),
    ).toHaveLength(8);
    expect(overlay?.querySelector('button, input, select, textarea, a')).toBe(
      null,
    );

    const css = appStyles();
    expect(css).toMatch(
      /\.saved-view-transition\s*\{[^}]*pointer-events:\s*none;/u,
    );
  });

  it('requests an unmount after its bounded presentation duration', async () => {
    let transition: SavedViewVisualTransition | undefined = {
      name: 'Architecture Overview',
      origin: 'startup-match',
      token: 1,
    };
    const render = () =>
      root.render(
        <SavedViewTransitionOverlay
          onComplete={(token) => {
            if (transition?.token !== token) return;
            transition = undefined;
            render();
          }}
          transition={transition}
        />,
      );

    await act(() => render());
    expect(container.querySelector('.saved-view-transition')).not.toBeNull();

    await act(() =>
      vi.advanceTimersByTimeAsync(SAVED_VIEW_TRANSITION_DURATION_MS),
    );

    expect(container.querySelector('.saved-view-transition')).toBeNull();
  });

  it('replaces an active transition and lets only the latest timer remove it', async () => {
    let transition: SavedViewVisualTransition | undefined = {
      name: 'View A',
      origin: 'apply',
      token: 1,
    };
    const render = () =>
      root.render(
        <SavedViewTransitionOverlay
          onComplete={(token) => {
            if (transition?.token !== token) return;
            transition = undefined;
            render();
          }}
          transition={transition}
        />,
      );

    await act(() => render());
    await act(() => vi.advanceTimersByTimeAsync(240));
    transition = { name: 'View C', origin: 'apply', token: 3 };
    await act(() => render());

    await act(() => vi.advanceTimersByTimeAsync(150));
    expect(
      container.querySelector('.saved-view-transition__title')?.textContent,
    ).toBe('View C');
    expect(
      container
        .querySelector('.saved-view-transition')
        ?.getAttribute('data-saved-view-transition-token'),
    ).toBe('3');

    await act(() => vi.advanceTimersByTimeAsync(240));
    expect(container.querySelector('.saved-view-transition')).toBeNull();
  });

  it('uses an opacity-only reduced-motion rule and disables shard movement', () => {
    const css = appStyles();
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.saved-view-transition__shard\s*\{[\s\S]*?display:\s*none;[\s\S]*?animation:\s*none;/u,
    );
    expect(css).toMatch(
      /@keyframes saved-view-reduced-motion\s*\{[\s\S]*?opacity:/u,
    );
  });
});
