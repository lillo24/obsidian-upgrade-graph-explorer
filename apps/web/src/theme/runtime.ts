import {
  isThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '@icarus-graph-explorer/theme';

import { browserStorage, type StorageLike } from '../persistence/storage';
import {
  loadAppearancePreference,
  saveAppearancePreference,
} from '../preferences/appearance-preferences';

export const SYSTEM_THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export interface ThemeMediaQuery {
  readonly matches: boolean;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}

export interface ThemeRoot {
  readonly dataset: DOMStringMap;
  readonly style: Pick<CSSStyleDeclaration, 'colorScheme'>;
}

export interface ThemeSnapshot {
  readonly preference: ThemePreference;
  readonly resolvedTheme: ResolvedTheme;
  readonly warning: string | null;
}

export interface ThemeController extends ThemeSnapshot {
  readonly setPreference: (preference: ThemePreference) => void;
}

interface ThemeRuntimeOptions {
  readonly mediaQuery: ThemeMediaQuery;
  readonly root?: ThemeRoot;
  readonly storage?: StorageLike;
}

export function applyResolvedTheme(
  root: ThemeRoot | undefined,
  theme: ResolvedTheme,
): void {
  if (root === undefined) return;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export class ThemeRuntime {
  readonly setPreference = (preference: ThemePreference): void => {
    if (!isThemePreference(preference)) {
      throw new Error('Theme preference is invalid.');
    }
    const saveResult = saveAppearancePreference(this.storage, preference);
    this.snapshot = {
      preference,
      resolvedTheme: resolveTheme(preference, this.mediaQuery.matches),
      warning: saveResult.ok ? null : saveResult.message,
    };
    this.syncSystemSubscription();
    this.applyAndNotify();
  };

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): ThemeSnapshot => this.snapshot;

  private readonly listeners = new Set<() => void>();
  private readonly mediaQuery: ThemeMediaQuery;
  private readonly root: ThemeRoot | undefined;
  private readonly storage: StorageLike | undefined;
  private snapshot: ThemeSnapshot;
  private systemSubscribed = false;

  private readonly handleSystemThemeChange = (): void => {
    if (this.snapshot.preference !== 'system') return;
    const resolvedTheme = resolveTheme('system', this.mediaQuery.matches);
    if (resolvedTheme === this.snapshot.resolvedTheme) return;
    this.snapshot = { ...this.snapshot, resolvedTheme };
    this.applyAndNotify();
  };

  constructor({ mediaQuery, root, storage }: ThemeRuntimeOptions) {
    this.mediaQuery = mediaQuery;
    this.root = root;
    this.storage = storage;
    const loaded = loadAppearancePreference(storage);
    this.snapshot = {
      preference: loaded.preference,
      resolvedTheme: resolveTheme(loaded.preference, mediaQuery.matches),
      warning: loaded.warning,
    };
    this.syncSystemSubscription();
    applyResolvedTheme(this.root, this.snapshot.resolvedTheme);
  }

  dispose(): void {
    if (this.systemSubscribed) {
      this.mediaQuery.removeEventListener(
        'change',
        this.handleSystemThemeChange,
      );
      this.systemSubscribed = false;
    }
    this.listeners.clear();
  }

  private applyAndNotify(): void {
    applyResolvedTheme(this.root, this.snapshot.resolvedTheme);
    for (const listener of this.listeners) listener();
  }

  private syncSystemSubscription(): void {
    const shouldSubscribe = this.snapshot.preference === 'system';
    if (shouldSubscribe === this.systemSubscribed) return;
    if (shouldSubscribe) {
      this.mediaQuery.addEventListener('change', this.handleSystemThemeChange);
    } else {
      this.mediaQuery.removeEventListener(
        'change',
        this.handleSystemThemeChange,
      );
    }
    this.systemSubscribed = shouldSubscribe;
  }
}

const LIGHT_MEDIA_QUERY: ThemeMediaQuery = {
  matches: false,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

export function createBrowserThemeRuntime(): ThemeRuntime {
  const mediaQuery =
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? LIGHT_MEDIA_QUERY
      : window.matchMedia(SYSTEM_THEME_MEDIA_QUERY);
  const storage = browserStorage();
  return new ThemeRuntime({
    mediaQuery,
    ...(typeof document === 'undefined'
      ? {}
      : { root: document.documentElement }),
    ...(storage === undefined ? {} : { storage }),
  });
}
