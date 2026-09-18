import { createContext, useContext } from 'react';

import type { ThemeController } from './runtime';

export const ThemeContext = createContext<ThemeController | null>(null);

export function useTheme(): ThemeController {
  const theme = useContext(ThemeContext);
  if (theme === null) {
    throw new Error('useTheme must be used within ThemeProvider.');
  }
  return theme;
}
