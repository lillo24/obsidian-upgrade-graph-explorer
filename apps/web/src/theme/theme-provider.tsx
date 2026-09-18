import { useSyncExternalStore, type ReactNode } from 'react';

import type { ThemeController } from './runtime';
import { ThemeRuntime } from './runtime';
import { ThemeContext } from './theme-context';

export function ThemeProvider({
  children,
  runtime,
}: {
  readonly children: ReactNode;
  readonly runtime: ThemeRuntime;
}) {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
  const value: ThemeController = {
    ...snapshot,
    setPreference: runtime.setPreference,
  };
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
