import type { ThemeController } from './runtime';

/** Stable explicit theme seam for component tests that do not mount the runtime. */
export const TEST_THEME_CONTROLLER: ThemeController = {
  preference: 'system',
  resolvedTheme: 'light',
  warning: null,
  setPreference: () => undefined,
};
