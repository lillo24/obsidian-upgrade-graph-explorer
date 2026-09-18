import { describe, expect, it, vi } from 'vitest';

import type { StorageLike } from '../persistence/storage';
import { APPEARANCE_PREFERENCES_STORAGE_KEY } from '../preferences/appearance-preferences';

import { ThemeRuntime, type ThemeMediaQuery, type ThemeRoot } from './runtime';

class MediaQueryStub implements ThemeMediaQuery {
  matches: boolean;
  readonly listeners = new Set<() => void>();

  constructor(matches: boolean) {
    this.matches = matches;
  }

  addEventListener(_type: 'change', listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'change', listener: () => void): void {
    this.listeners.delete(listener);
  }

  setMatches(matches: boolean): void {
    this.matches = matches;
    for (const listener of this.listeners) listener();
  }
}

function memoryStorage(initial?: string): StorageLike {
  const values = new Map<string, string>();
  if (initial !== undefined) {
    values.set(APPEARANCE_PREFERENCES_STORAGE_KEY, initial);
  }
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function themeRoot(): ThemeRoot {
  return {
    dataset: {},
    style: { colorScheme: '' },
  } as ThemeRoot;
}

describe('theme runtime', () => {
  it.each([
    [false, 'light'],
    [true, 'dark'],
  ] as const)('resolves System against the OS (%s)', (matches, expected) => {
    const root = themeRoot();
    const runtime = new ThemeRuntime({
      mediaQuery: new MediaQueryStub(matches),
      root,
      storage: memoryStorage(),
    });

    expect(runtime.getSnapshot()).toMatchObject({
      preference: 'system',
      resolvedTheme: expected,
    });
    expect(root.dataset.theme).toBe(expected);
    expect(root.style.colorScheme).toBe(expected);
    runtime.dispose();
  });

  it('reacts to OS changes only while System is selected', () => {
    const mediaQuery = new MediaQueryStub(false);
    const root = themeRoot();
    const runtime = new ThemeRuntime({
      mediaQuery,
      root,
      storage: memoryStorage(),
    });
    const listener = vi.fn();
    runtime.subscribe(listener);

    mediaQuery.setMatches(true);
    expect(runtime.getSnapshot().resolvedTheme).toBe('dark');
    expect(listener).toHaveBeenCalledTimes(1);

    runtime.setPreference('light');
    expect(mediaQuery.listeners.size).toBe(0);
    mediaQuery.setMatches(false);
    mediaQuery.setMatches(true);
    expect(runtime.getSnapshot().resolvedTheme).toBe('light');

    runtime.setPreference('dark');
    mediaQuery.setMatches(false);
    expect(runtime.getSnapshot().resolvedTheme).toBe('dark');
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
    runtime.dispose();
  });

  it('adopts an in-memory change and warns after a write failure', () => {
    const runtime = new ThemeRuntime({
      mediaQuery: new MediaQueryStub(false),
      storage: {
        getItem: () => null,
        removeItem: () => undefined,
        setItem: () => {
          throw new Error('quota exceeded');
        },
      },
    });

    runtime.setPreference('dark');

    expect(runtime.getSnapshot()).toEqual({
      preference: 'dark',
      resolvedTheme: 'dark',
      warning: expect.stringContaining('reset when the app closes'),
    });
    runtime.dispose();
  });
});
